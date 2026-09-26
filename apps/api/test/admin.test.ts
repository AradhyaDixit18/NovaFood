import { beforeAll, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { Restaurant } from '../src/models/Restaurant';
import { auth, createFood, createRestaurant, createTestKit, createUser, placeCodOrder, type TestUser } from './helpers';

const kit = createTestKit();
let admin: TestUser;
let partner: TestUser;
let restaurantId: string;
let foodId: string;

beforeAll(async () => {
  admin = await createUser(kit, { role: 'admin', name: 'Admin Person' });
  partner = await createUser(kit, { role: 'partner' });
  const restaurant = await createRestaurant({ ownerIds: [new Types.ObjectId(partner.id)] });
  restaurantId = String(restaurant._id);
  foodId = String((await createFood(restaurant._id, { name: 'Analytics Paneer', slug: 'analytics-paneer', pricePaise: 40000 }))._id);
});

const deliver = async (orderId: string) => {
  for (const status of ['RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    await partner.agent.post(`/api/partner/orders/${orderId}/status`).set(auth(partner)).send({ status });
  }
};

describe('admin access control', () => {
  it('rejects customers and partners', async () => {
    const customer = await createUser(kit);
    expect((await customer.agent.get('/api/admin/analytics').set(auth(customer))).status).toBe(403);
    expect((await partner.agent.get('/api/admin/users').set(auth(partner))).status).toBe(403);
    expect((await kit.request.get('/api/admin/users')).status).toBe(401);
  });
});

describe('analytics', () => {
  it('computes totals from real orders', async () => {
    const buyer = await createUser(kit);
    const a = await placeCodOrder(kit, buyer, foodId);
    const b = await placeCodOrder(kit, buyer, foodId);
    await deliver(a._id);
    const cancelled = await placeCodOrder(kit, buyer, foodId);
    await buyer.agent.post(`/api/orders/${cancelled._id}/cancel`).set(auth(buyer)).send({});

    const res = await admin.agent.get('/api/admin/analytics?days=7').set(auth(admin));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totals.orders).toBe(2);
    expect(data.totals.revenuePaise).toBe(a.pricing.totalPaise + b.pricing.totalPaise);
    expect(data.totals.averageOrderValuePaise).toBe(Math.round((a.pricing.totalPaise + b.pricing.totalPaise) / 2));
    expect(data.statusCounts).toMatchObject({ DELIVERED: 1, ORDER_PLACED: 1, CANCELLED: 1 });
    expect(data.topFoods[0]).toMatchObject({ name: 'Analytics Paneer', quantity: 2 });
    expect(data.daily).toHaveLength(7);
    expect(data.daily.reduce((s: number, d: { orders: number }) => s + d.orders, 0)).toBe(2);
    expect(data.counts.users).toBeGreaterThanOrEqual(3);

    const partnerView = await partner.agent.get(`/api/partner/restaurants/${restaurantId}/analytics?days=7`).set(auth(partner));
    expect(partnerView.body.data.totals.orders).toBe(2);
  });
});

describe('user management', () => {
  it('suspends a user, which immediately invalidates their token', async () => {
    const target = await createUser(kit);
    const res = await admin.agent.patch(`/api/admin/users/${target.id}`).set(auth(admin)).send({ status: 'SUSPENDED' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.status).toBe('SUSPENDED');
    expect((await target.agent.get('/api/auth/me').set(auth(target))).status).toBe(401);
  });

  it('prevents admins from locking themselves out', async () => {
    const res = await admin.agent.patch(`/api/admin/users/${admin.id}`).set(auth(admin)).send({ role: 'customer' });
    expect(res.status).toBe(400);
  });

  it('searches users by name or email', async () => {
    const res = await admin.agent.get('/api/admin/users?q=admin person').set(auth(admin));
    expect(res.body.data[0]._id).toBe(admin.id);
  });
});

describe('restaurant onboarding', () => {
  it('turns a customer application into a pending restaurant that admin approves', async () => {
    const applicant = await createUser(kit);
    const apply = await applicant.agent
      .post('/api/partner/apply')
      .set(auth(applicant))
      .send({
        name: 'New Tandoor',
        description: 'Charcoal kebabs and breads.',
        cuisines: ['North Indian'],
        address: { line1: '1 New Road', area: 'Bellandur', city: 'Bengaluru', pincode: '560103' },
        costForTwoPaise: 60000,
        deliveryTimeMins: 40,
        deliveryFeePaise: 4000,
        openingHours: [{ day: 'sat', open: '00:00', close: '23:59' }],
      });
    expect(apply.status).toBe(201);
    expect(apply.body.data.status).toBe('PENDING');
    expect((await kit.request.get(`/api/restaurants/${apply.body.data.slug}`)).status).toBe(404);

    const approve = await admin.agent.patch(`/api/admin/restaurants/${apply.body.data._id}`).set(auth(admin)).send({ status: 'APPROVED' });
    expect(approve.body.data.status).toBe('APPROVED');
    expect((await kit.request.get(`/api/restaurants/${apply.body.data.slug}`)).status).toBe(200);

    // The applicant is now a partner and manages only their own restaurant.
    const relogin = await applicant.agent.post('/api/auth/login').send({ email: applicant.email, password: applicant.password });
    const token = relogin.body.data.accessToken;
    const mine = await applicant.agent.get('/api/partner/restaurants').set('authorization', `Bearer ${token}`);
    expect(mine.body.data.map((r: { name: string }) => r.name)).toEqual(['New Tandoor']);
    const foreign = await applicant.agent.patch(`/api/partner/restaurants/${restaurantId}`).set('authorization', `Bearer ${token}`).send({ isAcceptingOrders: false });
    expect(foreign.status).toBe(403);
    expect((await Restaurant.findById(restaurantId).lean())?.isAcceptingOrders).toBe(true);
  });
});

describe('menu management', () => {
  it('lets a partner add, edit and soft-delete dishes with validation', async () => {
    const bad = await partner.agent.post(`/api/partner/restaurants/${restaurantId}/foods`).set(auth(partner)).send({ name: 'X', pricePaise: 0 });
    expect(bad.status).toBe(422);
    const created = await partner.agent
      .post(`/api/partner/restaurants/${restaurantId}/foods`)
      .set(auth(partner))
      .send({ name: 'Malai Kofta', description: 'Soft koftas in cashew gravy.', section: 'Curries', cuisine: 'North Indian', pricePaise: 26000, isVeg: true });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    const edited = await partner.agent.patch(`/api/partner/foods/${id}`).set(auth(partner)).send({ isAvailable: false });
    expect(edited.body.data.isAvailable).toBe(false);
    expect((await partner.agent.delete(`/api/partner/foods/${id}`).set(auth(partner))).status).toBe(200);
    expect((await kit.request.get(`/api/foods/${id}`)).status).toBe(404);
  });
});

describe('coupons & moderation', () => {
  it('validates and creates coupons', async () => {
    const bad = await admin.agent.post('/api/admin/coupons').set(auth(admin)).send({ code: 'BIG', type: 'PERCENT', value: 150 });
    expect(bad.status).toBe(422);
    const ok = await admin.agent.post('/api/admin/coupons').set(auth(admin)).send({ code: 'weekend40', type: 'PERCENT', value: 40, maxDiscountPaise: 12000 });
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe('WEEKEND40');
    const pub = await kit.request.get('/api/coupons');
    expect(pub.body.data.map((c: { code: string }) => c.code)).toContain('WEEKEND40');
    await admin.agent.patch(`/api/admin/coupons/${ok.body.data._id}`).set(auth(admin)).send({ isActive: false });
    const after = await kit.request.get('/api/coupons');
    expect(after.body.data.map((c: { code: string }) => c.code)).not.toContain('WEEKEND40');
  });

  it('hides a review and recomputes the rating', async () => {
    const reviewer = await createUser(kit);
    const order = await placeCodOrder(kit, reviewer, foodId);
    await deliver(order._id);
    await reviewer.agent.post('/api/reviews').set(auth(reviewer)).send({ orderId: order._id, rating: 1, comment: 'spam spam' });
    const before = await Restaurant.findById(restaurantId).lean();
    expect(before?.ratingCount).toBe(1);
    const list = await admin.agent.get('/api/admin/reviews?maxRating=2').set(auth(admin));
    const review = list.body.data.find((r: { comment: string }) => r.comment === 'spam spam');
    await admin.agent.patch(`/api/admin/reviews/${review._id}`).set(auth(admin)).send({ status: 'HIDDEN', note: 'Spam' });
    const after = await Restaurant.findById(restaurantId).lean();
    expect(after?.ratingCount).toBe(0);
    expect((await kit.request.get(`/api/reviews?restaurantId=${restaurantId}`)).body.data).toHaveLength(0);
  });
});
