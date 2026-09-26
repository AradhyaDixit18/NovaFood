import { type Request, Router } from 'express';
import { Types } from 'mongoose';
import {
  ORDER_STATUSES,
  RESTAURANT_STATUSES,
  ROLES,
  couponInputSchema,
  idParams,
  objectId,
  paginationQuery,
  restaurantInputSchema,
  restaurantUpdateSchema,
  updateOrderStatusSchema,
} from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { badRequest, notFound } from '../../lib/errors';
import { escapeRegex, pageMeta, parse, send } from '../../lib/http';
import { slugify, uniqueSuffix } from '../../lib/slug';
import { authenticate, currentUser, requireRole } from '../../middleware/auth';
import { AuditLog, Coupon, type CouponLean, Review, type ReviewLean } from '../../models/misc';
import { Order, type OrderLean } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { Session } from '../../models/Session';
import { User } from '../../models/User';
import { toOrderDTO, toRestaurantDTO, toUserDTO } from '../../serializers';
import { computeAnalytics, platformCounts } from '../analytics/analytics.service';
import { toCouponDTO } from '../coupons/coupons.routes';
import { notify } from '../notifications/notifications.service';
import { searchOrdersAdmin } from '../orders/orders.service';
import { initiateRefund, transitionOrder } from '../orders/transitions';
import { moderateReview, toReviewDTOs } from '../reviews/reviews.service';

export function createAdminRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }), requireRole('admin'));

  const audit = (req: Request, action: string, entity: string, entityId: string, meta?: unknown) =>
    AuditLog.create({ actorId: currentUser(req).id, actorRole: 'admin', action, entity, entityId, meta });

  /* --------------------------------- Analytics -------------------------------- */

  router.get('/analytics', async (req, res) => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query);
    const [analytics, counts] = await Promise.all([computeAnalytics({ now: ctx.now(), days }), platformCounts(ctx.now(), days)]);
    send(res, { ...analytics, counts });
  });

  /* ----------------------------------- Users ---------------------------------- */

  const usersQuery = paginationQuery.extend({
    q: z.string().trim().max(60).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  });

  router.get('/users', async (req, res) => {
    const q = parse(usersQuery, req.query);
    const filter: Record<string, unknown> = {};
    if (q.role) filter.role = q.role;
    if (q.status) filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [rows, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      User.countDocuments(filter),
    ]);
    send(res, rows.map(toUserDTO), 200, pageMeta(q.page, q.limit, total));
  });

  router.patch('/users/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const input = parse(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), role: z.enum(ROLES).optional() }), req.body);
    if (id === currentUser(req).id) throw badRequest('You cannot change your own role or status.');
    const result = await User.updateOne({ _id: id }, { $set: input });
    if (result.matchedCount === 0) throw notFound('User');
    const user = await User.findById(id).lean();
    if (input.status === 'SUSPENDED') await Session.updateMany({ userId: id, revokedAt: null }, { $set: { revokedAt: ctx.now() } });
    await audit(req, 'user.update', 'User', id, input);
    send(res, toUserDTO(user));
  });

  /* -------------------------------- Restaurants -------------------------------- */

  const restaurantsQuery = paginationQuery.extend({
    q: z.string().trim().max(60).optional(),
    status: z.enum(RESTAURANT_STATUSES).optional(),
  });

  router.get('/restaurants', async (req, res) => {
    const q = parse(restaurantsQuery, req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.status = q.status;
    if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
    const [rows, total] = await Promise.all([
      Restaurant.find(filter).sort({ status: 1, name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Restaurant.countDocuments(filter),
    ]);
    send(res, rows.map((r) => toRestaurantDTO(r, ctx.now())), 200, pageMeta(q.page, q.limit, total));
  });

  router.post('/restaurants', async (req, res) => {
    const input = parse(restaurantInputSchema.extend({ ownerEmail: z.string().email().optional() }), req.body);
    const owner = input.ownerEmail ? await User.findOne({ email: input.ownerEmail.toLowerCase() }) : null;
    if (input.ownerEmail && !owner) throw notFound('Owner account');
    if (owner && owner.role === 'customer') await User.updateOne({ _id: owner._id }, { $set: { role: 'partner' } });
    const base = slugify(input.name);
    const restaurant = await Restaurant.create({
      ...input,
      slug: (await Restaurant.exists({ slug: base })) ? `${base}-${uniqueSuffix()}` : base,
      status: 'APPROVED',
      ownerIds: owner ? [owner._id] : [],
      art: input.art ?? { kind: 'bowl', hue: 20 },
    });
    await audit(req, 'restaurant.create', 'Restaurant', String(restaurant._id));
    send(res, toRestaurantDTO(restaurant.toObject(), ctx.now()), 201);
  });

  router.patch('/restaurants/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const input = parse(restaurantUpdateSchema.extend({ status: z.enum(RESTAURANT_STATUSES).optional() }), req.body);
    const restaurant = await Restaurant.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).lean();
    if (!restaurant) throw notFound('Restaurant');
    await audit(req, 'restaurant.update', 'Restaurant', id, input);
    for (const ownerId of restaurant.ownerIds ?? []) {
      if (input.status === 'APPROVED') {
        await notify(ctx, { userId: String(ownerId), type: 'RESTAURANT', title: 'You are live! 🎉', body: `${restaurant.name} is now visible on NovaFood.`, link: '/partner', transactional: true });
      }
    }
    send(res, toRestaurantDTO(restaurant, ctx.now()));
  });

  /* ----------------------------------- Orders ---------------------------------- */

  const ordersQuery = paginationQuery.extend({ status: z.enum(ORDER_STATUSES).optional(), q: z.string().trim().max(40).optional(), restaurantId: objectId.optional() });

  router.get('/orders', async (req, res) => {
    const q = parse(ordersQuery, req.query);
    const { items, meta } = await searchOrdersAdmin({ ...q, restaurantIds: q.restaurantId ? [new Types.ObjectId(q.restaurantId)] : undefined });
    send(res, items, 200, meta);
  });

  router.post('/orders/:id/status', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const { status, reason } = parse(updateOrderStatusSchema, req.body);
    const order = await transitionOrder(ctx, id, status, { kind: 'admin', userId: currentUser(req).id }, {
      note: reason,
      ...(status === 'CANCELLED' || status === 'REJECTED' ? { set: { cancelReason: reason ?? 'Cancelled by NovaFood support' } } : {}),
    });
    await audit(req, 'order.status', 'Order', id, { status, reason });
    send(res, toOrderDTO(order, { includeCustomer: true }));
  });

  /** Retries a gateway refund, or records a refund settled outside the gateway. */
  router.post('/orders/:id/refund', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const { settledManually } = parse(z.object({ settledManually: z.boolean().default(false) }), req.body ?? {});
    const order = (await Order.findById(id).lean()) as OrderLean | null;
    if (!order) throw notFound('Order');
    if (order.status !== 'REFUND_PENDING') throw badRequest('Only orders awaiting a refund can be refunded.');
    let result: OrderLean = order;
    if (settledManually) {
      result = await transitionOrder(ctx, id, 'REFUNDED', { kind: 'admin', userId: currentUser(req).id }, {
        note: 'Refund settled manually',
        set: { 'payment.status': 'REFUNDED' },
      });
    } else {
      const refunded = await initiateRefund(ctx, order);
      if (!refunded) throw badRequest('The gateway refund could not be started. Check the payment settings or settle it manually.');
      result = refunded;
    }
    await audit(req, 'order.refund', 'Order', id, { settledManually });
    send(res, toOrderDTO(result, { includeCustomer: true }));
  });

  /* ---------------------------------- Coupons ---------------------------------- */

  router.get('/coupons', async (_req, res) => {
    const rows = (await Coupon.find({}).sort({ createdAt: -1 }).limit(200).lean()) as CouponLean[];
    send(res, rows.map((c) => ({ ...toCouponDTO(c), isActive: c.isActive, usedCount: c.usedCount, usageLimit: c.usageLimit ?? null, perUserLimit: c.perUserLimit ?? null })));
  });

  router.post('/coupons', async (req, res) => {
    const input = parse(couponInputSchema, req.body);
    const coupon = await Coupon.create({ ...input, createdBy: currentUser(req).id });
    await audit(req, 'coupon.create', 'Coupon', String(coupon._id));
    send(res, toCouponDTO(coupon.toObject() as CouponLean), 201);
  });

  router.patch('/coupons/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const input = parse(
      z.object({
        description: z.string().max(120).optional(),
        isActive: z.boolean().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
        usageLimit: z.number().int().min(1).nullable().optional(),
        maxDiscountPaise: z.number().int().min(0).nullable().optional(),
        minOrderPaise: z.number().int().min(0).optional(),
      }),
      req.body,
    );
    const coupon = (await Coupon.findByIdAndUpdate(id, { $set: input }, { new: true }).lean()) as CouponLean | null;
    if (!coupon) throw notFound('Coupon');
    await audit(req, 'coupon.update', 'Coupon', id, input);
    send(res, toCouponDTO(coupon));
  });

  /* ---------------------------------- Reviews ---------------------------------- */

  router.get('/reviews', async (req, res) => {
    const q = parse(paginationQuery.extend({ status: z.enum(['PUBLISHED', 'HIDDEN']).optional(), maxRating: z.coerce.number().int().min(1).max(5).optional() }), req.query);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.status = q.status;
    if (q.maxRating) filter.rating = { $lte: q.maxRating };
    const [rows, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Review.countDocuments(filter),
    ]);
    send(res, await toReviewDTOs(rows as ReviewLean[]), 200, pageMeta(q.page, q.limit, total));
  });

  router.patch('/reviews/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const { status, note } = parse(z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']), note: z.string().max(200).optional() }), req.body);
    await moderateReview(ctx, id, currentUser(req).id, status, note);
    await audit(req, 'review.moderate', 'Review', id, { status, note });
    send(res, { ok: true });
  });

  return router;
}
