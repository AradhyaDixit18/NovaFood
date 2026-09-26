import { Router } from 'express';
import { Types } from 'mongoose';
import {
  KITCHEN_ACTIVE_STATUSES,
  ORDER_STATUSES,
  foodInputSchema,
  foodUpdateSchema,
  objectId,
  paginationQuery,
  restaurantInputSchema,
  restaurantUpdateSchema,
  updateOrderStatusSchema,
} from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { forbidden, notFound } from '../../lib/errors';
import { pageMeta, parse, send } from '../../lib/http';
import { slugify, uniqueSuffix } from '../../lib/slug';
import { authenticate, currentUser, requireRole } from '../../middleware/auth';
import { FoodItem } from '../../models/FoodItem';
import { AuditLog } from '../../models/misc';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { toFoodDTO, toOrderDTO, toRestaurantDTO } from '../../serializers';
import { computeAnalytics } from '../analytics/analytics.service';
import { transitionOrder } from '../orders/transitions';

const restaurantParam = z.object({ restaurantId: objectId });
const foodParam = z.object({ foodId: objectId });

/** Partners manage only restaurants they own; admins may act on any restaurant. */
export async function assertCanManage(user: Express.AuthUser, restaurantId: string | Types.ObjectId) {
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw notFound('Restaurant');
  if (user.role === 'admin') return restaurant;
  if (!(restaurant.ownerIds ?? []).some((id) => String(id) === user.id)) throw forbidden('You do not manage this restaurant.');
  return restaurant;
}

async function uniqueSlug(model: 'restaurant' | 'food', name: string, restaurantId?: Types.ObjectId): Promise<string> {
  const base = slugify(name) || 'item';
  const taken = model === 'restaurant' ? await Restaurant.exists({ slug: base }) : await FoodItem.exists({ slug: base, restaurantId });
  return taken ? `${base}-${uniqueSuffix()}` : base;
}

export function createPartnerRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  /** Any signed-in customer can apply; the restaurant stays hidden until an admin approves it. */
  router.post('/apply', async (req, res) => {
    const input = parse(restaurantInputSchema, req.body);
    const user = currentUser(req);
    const restaurant = await Restaurant.create({
      ...input,
      slug: await uniqueSlug('restaurant', input.name),
      status: 'PENDING',
      ownerIds: [user.id],
      art: input.art ?? { kind: 'bowl', hue: Math.floor(Math.random() * 360) },
    });
    if (user.role === 'customer') await User.updateOne({ _id: user.id }, { $set: { role: 'partner' } });
    await AuditLog.create({ actorId: user.id, actorRole: user.role, action: 'restaurant.apply', entity: 'Restaurant', entityId: String(restaurant._id) });
    send(res, toRestaurantDTO(restaurant.toObject(), ctx.now()), 201);
  });

  router.use(requireRole('partner', 'admin'));

  router.get('/restaurants', async (req, res) => {
    const user = currentUser(req);
    const filter = user.role === 'admin' ? {} : { ownerIds: user.id };
    const rows = await Restaurant.find(filter).sort({ name: 1 }).limit(100).lean();
    send(res, rows.map((r) => toRestaurantDTO(r, ctx.now())));
  });

  router.get('/restaurants/:restaurantId', async (req, res) => {
    const { restaurantId } = parse(restaurantParam, req.params);
    const restaurant = await assertCanManage(currentUser(req), restaurantId);
    const foods = await FoodItem.find({ restaurantId, isDeleted: false }).sort({ section: 1, name: 1 }).lean();
    send(res, { restaurant: toRestaurantDTO(restaurant, ctx.now()), foods: foods.map((f) => toFoodDTO(f)) });
  });

  router.patch('/restaurants/:restaurantId', async (req, res) => {
    const { restaurantId } = parse(restaurantParam, req.params);
    const user = currentUser(req);
    await assertCanManage(user, restaurantId);
    const input = parse(restaurantUpdateSchema, req.body);
    const updated = await Restaurant.findByIdAndUpdate(restaurantId, { $set: input }, { new: true, runValidators: true }).lean();
    await AuditLog.create({ actorId: user.id, actorRole: user.role, action: 'restaurant.update', entity: 'Restaurant', entityId: restaurantId, meta: Object.keys(input) });
    send(res, toRestaurantDTO(updated, ctx.now()));
  });

  router.post('/restaurants/:restaurantId/foods', async (req, res) => {
    const { restaurantId } = parse(restaurantParam, req.params);
    await assertCanManage(currentUser(req), restaurantId);
    const input = parse(foodInputSchema, req.body);
    const rid = new Types.ObjectId(restaurantId);
    const food = await FoodItem.create({
      ...input,
      restaurantId: rid,
      slug: await uniqueSlug('food', input.name, rid),
      art: input.art ?? { kind: 'bowl', hue: 20 },
    });
    send(res, toFoodDTO(food.toObject()), 201);
  });

  router.patch('/foods/:foodId', async (req, res) => {
    const { foodId } = parse(foodParam, req.params);
    const food = await FoodItem.findOne({ _id: foodId, isDeleted: false }).lean();
    if (!food) throw notFound('Dish');
    await assertCanManage(currentUser(req), food.restaurantId);
    const input = parse(foodUpdateSchema, req.body);
    const updated = await FoodItem.findByIdAndUpdate(foodId, { $set: input }, { new: true, runValidators: true }).lean();
    send(res, toFoodDTO(updated));
  });

  router.delete('/foods/:foodId', async (req, res) => {
    const { foodId } = parse(foodParam, req.params);
    const food = await FoodItem.findOne({ _id: foodId, isDeleted: false }).lean();
    if (!food) throw notFound('Dish');
    const user = currentUser(req);
    await assertCanManage(user, food.restaurantId);
    // Soft delete: past orders and reviews still reference this dish.
    await FoodItem.updateOne({ _id: foodId }, { $set: { isDeleted: true, isAvailable: false } });
    await AuditLog.create({ actorId: user.id, actorRole: user.role, action: 'food.delete', entity: 'FoodItem', entityId: foodId });
    send(res, { ok: true });
  });

  const ordersQuery = paginationQuery.extend({
    restaurantId: objectId.optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    active: z.enum(['true', 'false']).optional(),
  });

  router.get('/orders', async (req, res) => {
    const q = parse(ordersQuery, req.query);
    const user = currentUser(req);
    const owned = user.role === 'admin' && q.restaurantId
      ? [new Types.ObjectId(q.restaurantId)]
      : (await Restaurant.find(user.role === 'admin' ? {} : { ownerIds: user.id }).select('_id').lean()).map((r) => r._id);
    const ids = q.restaurantId ? owned.filter((id) => String(id) === q.restaurantId) : owned;
    if (q.restaurantId && ids.length === 0) throw forbidden('You do not manage this restaurant.');

    const filter: Record<string, unknown> = { restaurantId: { $in: ids } };
    if (q.status) filter.status = q.status;
    else if (q.active === 'true') filter.status = { $in: KITCHEN_ACTIVE_STATUSES };
    // Kitchens never see orders that have not been paid for yet.
    else filter.status = { $nin: ['PAYMENT_PENDING', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMED'] };

    const [rows, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: q.active === 'true' ? 1 : -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Order.countDocuments(filter),
    ]);
    send(res, rows.map((o) => toOrderDTO(o, { includeCustomer: true })), 200, pageMeta(q.page, q.limit, total));
  });

  router.post('/orders/:id/status', async (req, res) => {
    const { id } = parse(z.object({ id: objectId }), req.params);
    const { status, reason } = parse(updateOrderStatusSchema, req.body);
    const user = currentUser(req);
    const order = await Order.findById(id).lean();
    if (!order) throw notFound('Order');
    await assertCanManage(user, order.restaurantId);
    const updated = await transitionOrder(ctx, id, status, { kind: user.role === 'admin' ? 'admin' : 'partner', userId: user.id }, {
      note: reason,
      ...(status === 'REJECTED' || status === 'CANCELLED' ? { set: { cancelReason: reason ?? 'Restaurant could not fulfil the order' } } : {}),
    });
    send(res, toOrderDTO(updated, { includeCustomer: true }));
  });

  router.get('/restaurants/:restaurantId/analytics', async (req, res) => {
    const { restaurantId } = parse(restaurantParam, req.params);
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
    const restaurant = await assertCanManage(currentUser(req), restaurantId);
    const analytics = await computeAnalytics({ now: ctx.now(), days, restaurantIds: [restaurant._id] });
    send(res, { ...analytics, rating: restaurant.rating, ratingCount: restaurant.ratingCount });
  });

  return router;
}
