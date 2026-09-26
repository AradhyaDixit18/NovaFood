import { beforeAll, describe, expect, it } from 'vitest';
import { FoodItem } from '../src/models/FoodItem';
import { Coupon, Notification, PointsEntry } from '../src/models/misc';
import { Restaurant } from '../src/models/Restaurant';
import { User } from '../src/models/User';
import { auth, createFood, createPartnerWithRestaurant, createTestKit, createUser, placeCodOrder, type TestUser } from './helpers';

const kit = createTestKit();
let partner: TestUser;
let restaurantId: string;
let foodId: string;

beforeAll(async () => {
  const setup = await createPartnerWithRestaurant(kit);
  partner = setup.partner;
  restaurantId = String(setup.restaurant._id);
  foodId = String((await createFood(setup.restaurant._id, { pricePaise: 50000, cuisine: 'Biryani' }))._id);
});

const move = (user: TestUser, orderId: string, status: string, path = 'partner') =>
  user.agent.post(`/api/${path}/orders/${orderId}/status`).set(auth(user)).send({ status });

describe('order lifecycle', () => {
  it('walks the kitchen through every step and credits points on delivery', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    for (const status of ['RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const res = await move(partner, order._id, status);
      expect(res.status, `${status}: ${JSON.stringify(res.body)}`).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
    const view = await customer.agent.get(`/api/orders/${order._id}`).set(auth(customer));
    const final = view.body.data.order;
    expect(final.statusHistory.map((e: { status: string }) => e.status)).toEqual([
      'ORDER_PLACED',
      'RESTAURANT_ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
    expect(final.payment.status).toBe('PAID'); // cash collected at the door
    expect(final.pointsEarned).toBe(25); // ₹500 of food -> one point per ₹20
    expect((await User.findById(customer.id).lean())?.pointsBalance).toBe(final.pointsEarned);
    expect(await PointsEntry.countDocuments({ userId: customer.id, type: 'EARN' })).toBe(1);

    const notes = await Notification.find({ userId: customer.id }).lean();
    expect(notes.map((n) => n.title)).toEqual(expect.arrayContaining(['Order placed', 'Accepted', 'Delivered']));
    expect(kit.hub.events.filter((e) => e.room === `order:${order._id}` && e.event === 'order:updated')).toHaveLength(5);
  });

  it('rejects invalid transitions', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    const skip = await move(partner, order._id, 'DELIVERED');
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');
    const paid = await move(partner, order._id, 'PAYMENT_CONFIRMED');
    expect(paid.status).toBe(409);
  });

  it('lets customers cancel before acceptance only, releasing coupons and points', async () => {
    await Coupon.create({ code: 'LIFE10', type: 'FLAT', value: 1000, minOrderPaise: 0 });
    const customer = await createUser(kit);
    await User.updateOne({ _id: customer.id }, { $set: { pointsBalance: 100 } });
    await customer.agent.patch('/api/cart/options').set(auth(customer)).send({ usePoints: true });
    await customer.agent.post('/api/cart/items').set(auth(customer)).send({ foodId });
    await customer.agent.post('/api/cart/coupon').set(auth(customer)).send({ code: 'LIFE10' });
    const order = await placeCodOrder(kit, customer, foodId);
    expect((await User.findById(customer.id).lean())?.pointsBalance).toBeLessThan(100);
    expect((await Coupon.findOne({ code: 'LIFE10' }).lean())?.usedCount).toBe(1);

    const cancel = await customer.agent.post(`/api/orders/${order._id}/cancel`).set(auth(customer)).send({ reason: 'Ordered by mistake' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.order.status).toBe('CANCELLED');
    expect((await User.findById(customer.id).lean())?.pointsBalance).toBe(100);
    expect((await Coupon.findOne({ code: 'LIFE10' }).lean())?.usedCount).toBe(0);

    const accepted = await placeCodOrder(kit, customer, foodId);
    await move(partner, accepted._id, 'RESTAURANT_ACCEPTED');
    const late = await customer.agent.post(`/api/orders/${accepted._id}/cancel`).set(auth(customer)).send({});
    expect(late.status).toBe(409);
  });

  it('lets the kitchen reject with a reason the customer sees', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    const res = await partner.agent.post(`/api/partner/orders/${order._id}/status`).set(auth(partner)).send({ status: 'REJECTED', reason: 'Out of chicken' });
    expect(res.body.data.status).toBe('REJECTED');
    const note = await Notification.findOne({ userId: customer.id, title: 'Rejected by restaurant' }).lean();
    expect(note?.body).toContain('Out of chicken');
  });

  it('keeps each party inside its own permissions', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    expect((await move(customer, order._id, 'RESTAURANT_ACCEPTED')).status).toBe(403);
    const { partner: stranger } = await createPartnerWithRestaurant(kit);
    expect((await move(stranger, order._id, 'RESTAURANT_ACCEPTED')).status).toBe(403);
    const nosy = await createUser(kit);
    expect((await nosy.agent.get(`/api/orders/${order._id}`).set(auth(nosy))).status).toBe(404);
    expect((await move(customer, order._id, 'RESTAURANT_ACCEPTED', 'admin')).status).toBe(403);
  });

  it('hides unpaid online orders from the kitchen board', async () => {
    const board = await partner.agent.get(`/api/partner/orders?restaurantId=${restaurantId}`).set(auth(partner));
    expect(board.status).toBe(200);
    expect(board.body.data.every((o: { status: string }) => !o.status.startsWith('PAYMENT_'))).toBe(true);
    expect(board.body.data[0].customer).toBeDefined();
  });
});

describe('reorder', () => {
  it('rebuilds the cart at current prices and skips sold-out dishes', async () => {
    const customer = await createUser(kit);
    const extra = await createFood((await Restaurant.findById(restaurantId))!._id, { pricePaise: 12000 });
    await customer.agent.post('/api/cart/items').set(auth(customer)).send({ foodId: String(extra._id) });
    const order = await placeCodOrder(kit, customer, foodId);
    await FoodItem.updateOne({ _id: foodId }, { $set: { pricePaise: 55000 } });
    await FoodItem.updateOne({ _id: extra._id }, { $set: { isAvailable: false } });
    const res = await customer.agent.post(`/api/orders/${order._id}/reorder`).set(auth(customer));
    expect(res.status).toBe(200);
    expect(res.body.data.skipped).toEqual([extra.name]);
    expect(res.body.data.cart.lines[0].unitPricePaise).toBe(55000);
    await FoodItem.updateOne({ _id: foodId }, { $set: { pricePaise: 50000 } });
  });
});

describe('reviews', () => {
  it('allows one review per delivered order and updates ratings', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    const early = await customer.agent.post('/api/reviews').set(auth(customer)).send({ orderId: order._id, rating: 5 });
    expect(early.status).toBe(422);

    for (const s of ['RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']) await move(partner, order._id, s);
    const review = await customer.agent
      .post('/api/reviews')
      .set(auth(customer))
      .send({ orderId: order._id, rating: 4, comment: 'Mast tha', dishes: [{ foodId, rating: 5 }, { foodId: '0123456789abcdef01234567', rating: 1 }] });
    expect(review.status).toBe(201);
    const dup = await customer.agent.post('/api/reviews').set(auth(customer)).send({ orderId: order._id, rating: 1 });
    expect(dup.status).toBe(409);

    const restaurant = await Restaurant.findById(restaurantId).lean();
    expect(restaurant?.ratingCount).toBe(1);
    expect(restaurant?.rating).toBe(4);
    const food = await FoodItem.findById(foodId).lean();
    expect(food?.rating).toBe(5);

    const list = await kit.request.get(`/api/reviews?restaurantId=${restaurantId}`);
    expect(list.body.data[0].user.name).toBe('Test U.');

    const other = await createUser(kit);
    const vote = await other.agent.post(`/api/reviews/${list.body.data[0]._id}/helpful`).set(auth(other));
    expect(vote.body.data).toEqual({ helpful: true, helpfulCount: 1 });
    const own = await customer.agent.post(`/api/reviews/${list.body.data[0]._id}/helpful`).set(auth(customer));
    expect(own.status).toBe(422);
  });
});

describe('rewards & recommendations', () => {
  it('reports balance, history and exploration achievements', async () => {
    const customer = await createUser(kit);
    const order = await placeCodOrder(kit, customer, foodId);
    for (const s of ['RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']) await move(partner, order._id, s);
    const res = await customer.agent.get('/api/rewards').set(auth(customer));
    expect(res.body.data.balance).toBeGreaterThan(0);
    expect(res.body.data.stats).toMatchObject({ deliveredOrders: 1, distinctCuisines: 1, distinctRestaurants: 1 });
    expect(res.body.data.achievements.find((a: { id: string }) => a.id === 'first-bite').unlocked).toBe(true);
  });

  it('explains every recommendation', async () => {
    const customer = await createUser(kit);
    const res = await customer.agent.get('/api/recommendations/for-you').set(auth(customer));
    expect(res.status).toBe(200);
    expect(res.body.data.greeting).toBeTypeOf('string');
    for (const item of res.body.data.items) expect(item.reason.length).toBeGreaterThan(3);
  });
});
