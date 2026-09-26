import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { WEEKDAYS } from '@novafood/shared';
import { Cart } from '../src/models/Cart';
import { FoodItem } from '../src/models/FoodItem';
import { Coupon } from '../src/models/misc';
import { Order } from '../src/models/Order';
import { Restaurant } from '../src/models/Restaurant';
import { User } from '../src/models/User';
import { addAddress, auth, createConfigurableFood, createFood, createRestaurant, createTestKit, createUser, type TestUser } from './helpers';

const kit = createTestKit();
let restaurant: Awaited<ReturnType<typeof createRestaurant>>;
let burger: Awaited<ReturnType<typeof createConfigurableFood>>;
let simple: Awaited<ReturnType<typeof createFood>>;
let other: Awaited<ReturnType<typeof createFood>>;

beforeAll(async () => {
  restaurant = await createRestaurant({ deliveryFeePaise: 4000, freeDeliveryAbovePaise: 100000, minOrderPaise: 15000 });
  burger = await createConfigurableFood(restaurant._id);
  simple = await createFood(restaurant._id, { pricePaise: 10000 });
  const second = await createRestaurant();
  other = await createFood(second._id);
  await Coupon.create([
    { code: 'FLAT50', type: 'FLAT', value: 5000, minOrderPaise: 30000 },
    { code: 'FIRST20', type: 'PERCENT', value: 20, maxDiscountPaise: 6000, minOrderPaise: 0, firstOrderOnly: true },
    { code: 'ONCE', type: 'FLAT', value: 1000, minOrderPaise: 0, usageLimit: 1 },
  ]);
});

const variant = (name: string) => String(burger.variants.find((v) => v.name === name)!._id);
const addOn = (name: string) => String(burger.addOnGroups[0]!.options.find((o) => o.name === name)!._id);

async function freshUser(): Promise<TestUser> {
  return createUser(kit);
}

describe('adding to the cart', () => {
  it('prices a configured item from the database', async () => {
    const user = await freshUser();
    const res = await user.agent
      .post('/api/cart/items')
      .set(auth(user))
      .send({ foodId: String(burger._id), variantId: variant('Double'), addOnIds: [addOn('Cheese'), addOn('Egg')], quantity: 2 });
    expect(res.status).toBe(201);
    const line = res.body.data.lines[0];
    expect(line.unitPricePaise).toBe(28000 + 3000 + 3500);
    expect(line.lineTotalPaise).toBe(69000);
    expect(res.body.data.pricing).toMatchObject({ itemsSubtotalPaise: 69000, deliveryFeePaise: 4000, platformFeePaise: 500, gstPaise: 3450 });
    expect(res.body.data.pricing.totalPaise).toBe(69000 + 3450 + 4000 + 500);
  });

  it('ignores any price the client sends', async () => {
    const user = await freshUser();
    const res = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity: 1, pricePaise: 1, unitPricePaise: 1 });
    expect(res.body.data.lines[0].unitPricePaise).toBe(10000);
  });

  it('merges identical configurations and keeps different ones separate', async () => {
    const user = await freshUser();
    const body = { foodId: String(burger._id), variantId: variant('Single'), addOnIds: [addOn('Cheese')], quantity: 1 };
    await user.agent.post('/api/cart/items').set(auth(user)).send(body);
    await user.agent.post('/api/cart/items').set(auth(user)).send(body);
    const res = await user.agent.post('/api/cart/items').set(auth(user)).send({ ...body, addOnIds: [] });
    expect(res.body.data.lines.map((l: { quantity: number }) => l.quantity)).toEqual([2, 1]);
  });

  it('requires a size when the dish has sizes, and enforces add-on limits', async () => {
    const user = await freshUser();
    const noSize = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(burger._id) });
    expect(noSize.status).toBe(400);
    const tooMany = await user.agent
      .post('/api/cart/items')
      .set(auth(user))
      .send({ foodId: String(burger._id), variantId: variant('Single'), addOnIds: [addOn('Cheese'), addOn('Egg'), addOn('Jalapeño')] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/at most 2/);
    const foreign = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(burger._id), variantId: variant('Single'), addOnIds: ['000000000000000000000000'] });
    expect(foreign.status).toBe(400);
  });

  it('asks before replacing a cart from another restaurant', async () => {
    const user = await freshUser();
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id) });
    const clash = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(other._id) });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('CART_RESTAURANT_MISMATCH');
    const replaced = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(other._id), replaceCart: true });
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.lines).toHaveLength(1);
    expect(replaced.body.data.lines[0].foodId).toBe(String(other._id));
  });

  it('updates quantity and removes a line at zero', async () => {
    const user = await freshUser();
    const add = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity: 3 });
    const lineId = add.body.data.lines[0]._id;
    const updated = await user.agent.patch(`/api/cart/items/${lineId}`).set(auth(user)).send({ quantity: 1, note: 'Less spicy' });
    expect(updated.body.data.lines[0]).toMatchObject({ quantity: 1, note: 'Less spicy' });
    const removed = await user.agent.patch(`/api/cart/items/${lineId}`).set(auth(user)).send({ quantity: 0 });
    expect(removed.body.data.lines).toEqual([]);
    expect(removed.body.data.restaurant).toBeNull();
  });

  it('refuses unavailable dishes', async () => {
    const user = await freshUser();
    const soldOut = await createFood(restaurant._id, { isAvailable: false });
    const res = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(soldOut._id) });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
  });

  it('merges a guest cart after login', async () => {
    const user = await freshUser();
    const res = await user.agent
      .post('/api/cart/merge')
      .set(auth(user))
      .send({ lines: [{ foodId: String(simple._id), quantity: 2 }, { foodId: String(other._id), quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.lines).toHaveLength(1);
    expect(res.body.data.warnings.length).toBe(1);
  });
});

describe('coupons', () => {
  it('applies a valid coupon and reports why an invalid one fails', async () => {
    const user = await freshUser();
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity: 2 });
    const tooSmall = await user.agent.post('/api/cart/coupon').set(auth(user)).send({ code: 'flat50' });
    expect(tooSmall.status).toBe(422);
    expect(tooSmall.body.error.message).toMatch(/Add ₹100 more/);
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity: 1 });
    const ok = await user.agent.post('/api/cart/coupon').set(auth(user)).send({ code: 'FLAT50' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.coupon).toMatchObject({ code: 'FLAT50', discountPaise: 5000 });
    expect(ok.body.data.pricing.couponDiscountPaise).toBe(5000);
    const unknown = await user.agent.post('/api/cart/coupon').set(auth(user)).send({ code: 'NOPE99' });
    expect(unknown.body.error.code).toBe('COUPON_INVALID');
  });

  it('re-validates a coupon when the cart shrinks', async () => {
    const user = await freshUser();
    const add = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity: 3 });
    await user.agent.post('/api/cart/coupon').set(auth(user)).send({ code: 'FLAT50' });
    const res = await user.agent.patch(`/api/cart/items/${add.body.data.lines[0]._id}`).set(auth(user)).send({ quantity: 2 });
    expect(res.body.data.coupon).toBeNull();
    expect(res.body.data.couponError).toMatch(/Add ₹100 more/);
    expect(res.body.data.blockers.some((b: string) => b.includes('FLAT50'))).toBe(true);
  });
});

describe('checkout', () => {
  async function readyUser(quantity = 2) {
    const user = await freshUser();
    const addressId = await addAddress(user);
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(simple._id), quantity });
    return { user, addressId };
  }
  const checkout = (user: TestUser, addressId: string, extra: Record<string, unknown> = {}) =>
    user.agent.post('/api/orders').set(auth(user)).send({ addressId, paymentMethod: 'COD', contactPhone: '9876543210', idempotencyKey: randomUUID(), ...extra });

  it('places a cash-on-delivery order with server-side totals and empties the cart', async () => {
    const { user, addressId } = await readyUser();
    const res = await checkout(user, addressId, { deliveryInstructions: 'Ring the bell' });
    expect(res.status).toBe(201);
    const order = res.body.data.order;
    expect(order.status).toBe('ORDER_PLACED');
    expect(order.orderNumber).toMatch(/^NF-[A-Z2-9]{6}$/);
    expect(order.pricing.itemsSubtotalPaise).toBe(20000);
    expect(order.payment).toMatchObject({ method: 'COD', status: 'PENDING' });
    expect(res.body.data.payment).toBeNull();
    const cart = await Cart.findOne({ userId: user.id }).lean();
    expect(cart?.lines).toHaveLength(0);
    expect(kit.hub.events.some((e) => e.event === 'order:new' && e.room === `restaurant:${String(restaurant._id)}`)).toBe(true);
  });

  it('is idempotent: the same key never creates two orders', async () => {
    const { user, addressId } = await readyUser();
    const key = randomUUID();
    const a = await checkout(user, addressId, { idempotencyKey: key });
    const b = await checkout(user, addressId, { idempotencyKey: key });
    expect(b.status).toBe(201);
    expect(b.body.data.order._id).toBe(a.body.data.order._id);
    expect(await Order.countDocuments({ userId: user.id })).toBe(1);
  });

  it('enforces the minimum order, empty carts and restaurant hours', async () => {
    const { user, addressId } = await readyUser(1);
    const min = await checkout(user, addressId);
    expect(min.status).toBe(422);
    expect(min.body.error.message).toMatch(/Minimum order/);

    const empty = await freshUser();
    const emptyAddress = await addAddress(empty);
    expect((await checkout(empty, emptyAddress)).body.error.code).toBe('CART_EMPTY');

    const closed = await createRestaurant({ openingHours: WEEKDAYS.map((day) => ({ day, open: '03:00', close: '04:00' })) });
    const closedFood = await createFood(closed._id);
    const late = await freshUser();
    const lateAddress = await addAddress(late);
    await late.agent.post('/api/cart/items').set(auth(late)).send({ foodId: String(closedFood._id) });
    const res = await checkout(late, lateAddress);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/band hai/);
  });

  it('blocks checkout when a dish sells out after it was added', async () => {
    const dish = await createFood(restaurant._id, { pricePaise: 30000 });
    const user = await freshUser();
    const addressId = await addAddress(user);
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(dish._id) });
    await FoodItem.updateOne({ _id: dish._id }, { $set: { isAvailable: false } });
    const res = await checkout(user, addressId);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/unavailable/);
  });

  it('stops orders when the kitchen pauses', async () => {
    const paused = await createRestaurant({ isAcceptingOrders: false });
    const dish = await createFood(paused._id);
    const user = await freshUser();
    const addressId = await addAddress(user);
    await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId: String(dish._id) });
    const res = await checkout(user, addressId);
    expect(res.body.error.message).toMatch(/orders nahi le raha/);
    await Restaurant.updateOne({ _id: paused._id }, { isAcceptingOrders: true });
  });

  it('consumes coupon usage atomically and honours first-order coupons', async () => {
    const first = await readyUser(3);
    await first.user.agent.post('/api/cart/coupon').set(auth(first.user)).send({ code: 'ONCE' });
    const placed = await checkout(first.user, first.addressId);
    expect(placed.body.data.order.pricing.couponDiscountPaise).toBe(1000);
    expect((await Coupon.findOne({ code: 'ONCE' }).lean())?.usedCount).toBe(1);

    const second = await readyUser(3);
    const claimed = await second.user.agent.post('/api/cart/coupon').set(auth(second.user)).send({ code: 'ONCE' });
    expect(claimed.body.error.code).toBe('COUPON_USAGE_LIMIT');

    // FIRST20 works on a first order but not a second.
    await first.user.agent.post('/api/cart/items').set(auth(first.user)).send({ foodId: String(simple._id), quantity: 2 });
    const again = await first.user.agent.post('/api/cart/coupon').set(auth(first.user)).send({ code: 'FIRST20' });
    expect(again.body.error.code).toBe('COUPON_FIRST_ORDER_ONLY');
  });

  it('redeems Nova Points and never lets the balance go negative', async () => {
    const { user, addressId } = await readyUser(5); // ₹500 of food
    await User.updateOne({ _id: user.id }, { $set: { pointsBalance: 300 } });
    const options = await user.agent.patch('/api/cart/options').set(auth(user)).send({ usePoints: true });
    expect(options.body.data.pricing.pointsRedeemed).toBe(100); // capped at 20% of ₹500
    const res = await checkout(user, addressId);
    expect(res.body.data.order.pricing.pointsDiscountPaise).toBe(10000);
    expect((await User.findById(user.id).lean())?.pointsBalance).toBe(200);
  });

  it('rejects an address that is not the customer’s', async () => {
    const { user } = await readyUser();
    const res = await checkout(user, '0123456789abcdef01234567');
    expect(res.status).toBe(404);
  });

  it('refuses online payment when no gateway is configured', async () => {
    const { user, addressId } = await readyUser();
    const res = await checkout(user, addressId, { paymentMethod: 'RAZORPAY' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENTS_UNAVAILABLE');
  });
});
