import { Types } from 'mongoose';
import { type CheckoutInput, type OrderStatus, type PaymentInitDTO, KITCHEN_ACTIVE_STATUSES } from '@novafood/shared';
import type { AppContext } from '../../context';
import { AppError, forbidden, notFound, unprocessable } from '../../lib/errors';
import { escapeRegex, pageMeta } from '../../lib/http';
import { orderNumber } from '../../lib/slug';
import { Cart } from '../../models/Cart';
import { Coupon, CouponRedemption } from '../../models/misc';
import { Order, type OrderLean } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { toOrderDTO } from '../../serializers';
import { addToCart, clearCart, evaluateCart } from '../cart/cart.service';
import { creditPoints, debitPoints } from '../loyalty/loyalty.service';
import { SYSTEM, applyPlacedEffects, transitionOrder } from './transitions';

export interface CheckoutResult {
  order: OrderLean;
  payment: PaymentInitDTO | null;
}

async function paymentInit(ctx: AppContext, order: OrderLean): Promise<PaymentInitDTO | null> {
  if (order.payment.method !== 'RAZORPAY' || order.status !== 'PAYMENT_PENDING' || !ctx.payments || !order.payment.providerOrderId) {
    return null;
  }
  return {
    provider: 'razorpay',
    keyId: ctx.payments.keyId,
    providerOrderId: order.payment.providerOrderId,
    amountPaise: order.pricing.totalPaise,
    currency: 'INR',
    orderId: String(order._id),
  };
}

/** Creates a gateway order for an order awaiting payment and records its id. */
export async function createProviderOrder(ctx: AppContext, order: OrderLean): Promise<OrderLean> {
  if (!ctx.payments) throw unprocessable('Online payments are not available right now. Choose cash on delivery.', 'PAYMENTS_UNAVAILABLE');
  const providerOrder = await ctx.payments.createOrder({
    amountPaise: order.pricing.totalPaise,
    receipt: order.orderNumber,
    notes: { orderId: String(order._id) },
  });
  if (providerOrder.amountPaise !== order.pricing.totalPaise) {
    throw new AppError(502, 'PAYMENT_AMOUNT_MISMATCH', 'The payment gateway returned an unexpected amount.');
  }
  return (await Order.findByIdAndUpdate(
    order._id,
    { $set: { 'payment.providerOrderId': providerOrder.providerOrderId, 'payment.provider': 'razorpay', 'payment.status': 'PENDING' } },
    { new: true },
  ).lean()) as OrderLean;
}

export async function placeOrder(ctx: AppContext, userId: string, input: CheckoutInput): Promise<CheckoutResult> {
  // Idempotency: the same key always returns the same order.
  const existing = (await Order.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean()) as OrderLean | null;
  if (existing) return { order: existing, payment: await paymentInit(ctx, existing) };

  const user = await User.findById(userId).lean();
  if (!user) throw forbidden();
  if (ctx.env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before placing an order.');
  }
  const address = user.addresses.find((a) => String(a._id) === input.addressId);
  if (!address) throw notFound('Delivery address');
  if (input.paymentMethod === 'RAZORPAY' && !ctx.payments) {
    throw unprocessable('Online payments are not available right now. Choose cash on delivery.', 'PAYMENTS_UNAVAILABLE');
  }

  const evaluation = await evaluateCart(ctx, userId);
  if (!evaluation.restaurant || evaluation.lines.length === 0) throw unprocessable('Your cart is empty.', 'CART_EMPTY');
  if (evaluation.blockers.length > 0) throw unprocessable(evaluation.blockers[0]!, 'CART_BLOCKED');

  const { restaurant, pricing } = evaluation;
  const orderId = new Types.ObjectId();
  const now = ctx.now();
  const isCod = input.paymentMethod === 'COD';
  const status: OrderStatus = isCod ? 'ORDER_PLACED' : 'PAYMENT_PENDING';

  // Reserve scarce resources first; release them if anything below fails (no multi-document
  // transaction needed, and the steps are ordered so every failure is compensated).
  let pointsDebited = false;
  let couponReserved = false;
  try {
    if (pricing.pointsRedeemed > 0) {
      await debitPoints(userId, pricing.pointsRedeemed, orderId, 'Redeemed at checkout');
      pointsDebited = true;
    }
    if (evaluation.coupon) {
      const limit = evaluation.coupon.usageLimit;
      const reserved = await Coupon.updateOne(
        { _id: evaluation.coupon._id, isActive: true, ...(limit != null ? { usedCount: { $lt: limit } } : {}) },
        { $inc: { usedCount: 1 } },
      );
      if (reserved.modifiedCount !== 1) throw unprocessable('That coupon was just fully claimed. Remove it to continue.', 'COUPON_USAGE_LIMIT');
      couponReserved = true;
      await CouponRedemption.create({ couponId: evaluation.coupon._id, userId, orderId });
    }

    const created = await Order.create({
      _id: orderId,
      orderNumber: orderNumber(),
      userId,
      customerName: user.name,
      contactPhone: input.contactPhone,
      restaurantId: restaurant._id,
      restaurantSnapshot: {
        name: restaurant.name,
        slug: restaurant.slug,
        area: restaurant.address?.area,
        art: restaurant.art,
      },
      lines: evaluation.lines.map((l) => ({
        foodId: l.food._id,
        name: l.food.name,
        isVeg: l.food.isVeg,
        cuisine: l.food.cuisine,
        art: l.food.art,
        variantId: l.variant?._id ?? null,
        variantName: l.variant?.name ?? null,
        addOnIds: l.addOns.map((a) => a._id),
        addOns: l.addOns.map((a) => ({ name: a.name, pricePaise: a.pricePaise })),
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        lineTotalPaise: l.unitPricePaise * l.quantity,
        note: l.note,
      })),
      pricing,
      couponId: evaluation.coupon?._id ?? null,
      couponCode: evaluation.coupon?.code ?? null,
      status,
      statusHistory: [{ status, at: now, by: 'customer', byUserId: userId }],
      payment: { method: input.paymentMethod, status: 'PENDING' },
      deliveryAddress: {
        label: address.label,
        line1: address.line1,
        line2: address.line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        phone: address.phone ?? input.contactPhone,
        location: address.location,
      },
      deliveryInstructions: input.deliveryInstructions,
      estimatedDeliveryAt: new Date(now.getTime() + (restaurant.deliveryTimeMins + 5) * 60_000),
      idempotencyKey: input.idempotencyKey,
    });

    let order = created.toObject() as OrderLean;
    if (!isCod) {
      try {
        order = await createProviderOrder(ctx, order);
      } catch (err) {
        await Order.deleteOne({ _id: orderId });
        throw err instanceof AppError ? err : new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not reach the payment gateway. Please try again.');
      }
    }

    await clearCart(userId);
    if (isCod) {
      // COD orders start life as ORDER_PLACED, so run the same effects a paid order gets on
      // its PAYMENT_CONFIRMED -> ORDER_PLACED transition.
      await applyPlacedEffects(ctx, order);
    }
    return { order, payment: await paymentInit(ctx, order) };
  } catch (err) {
    if (couponReserved && evaluation.coupon) {
      await CouponRedemption.deleteOne({ orderId });
      await Coupon.updateOne({ _id: evaluation.coupon._id }, { $inc: { usedCount: -1 } });
    }
    if (pointsDebited) await creditPoints(userId, pricing.pointsRedeemed, 'REVERSE', 'Checkout did not complete', orderId);
    if (err instanceof Error && 'code' in err && err.code === 11000) {
      const again = (await Order.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean()) as OrderLean | null;
      if (again) return { order: again, payment: await paymentInit(ctx, again) };
    }
    throw err;
  }
}

export async function listOrdersForUser(userId: string, q: { page: number; limit: number; status?: OrderStatus; active?: 'true' | 'false' }) {
  const filter: Record<string, unknown> = { userId };
  if (q.status) filter.status = q.status;
  if (q.active === 'true') filter.status = { $in: [...KITCHEN_ACTIVE_STATUSES, 'PAYMENT_PENDING'] };
  const [rows, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items: rows.map((o) => toOrderDTO(o)), meta: pageMeta(q.page, q.limit, total) };
}

/** Customer, the restaurant's owners and admins may view an order. */
export async function getOrderForViewer(ctx: AppContext, orderId: string, viewer: Express.AuthUser): Promise<CheckoutResult> {
  if (!Types.ObjectId.isValid(orderId)) throw notFound('Order');
  const order = (await Order.findById(orderId).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  if (!(await canViewOrder(order, viewer))) throw notFound('Order');
  return { order, payment: String(order.userId) === viewer.id ? await paymentInit(ctx, order) : null };
}

export async function canViewOrder(order: Pick<OrderLean, 'userId' | 'restaurantId'>, viewer: Express.AuthUser): Promise<boolean> {
  if (viewer.role === 'admin' || String(order.userId) === viewer.id) return true;
  if (viewer.role === 'partner') {
    return Boolean(await Restaurant.exists({ _id: order.restaurantId, ownerIds: viewer.id }));
  }
  return false;
}

export async function cancelByCustomer(ctx: AppContext, orderId: string, userId: string, reason?: string) {
  const order = await Order.findOne({ _id: orderId, userId }).lean();
  if (!order) throw notFound('Order');
  return transitionOrder(ctx, order._id, 'CANCELLED', { kind: 'customer', userId }, {
    note: reason,
    set: { cancelReason: reason ?? 'Cancelled by customer' },
  });
}

/** Rebuilds the cart from a past order, at today's prices, skipping anything no longer sold. */
export async function reorder(ctx: AppContext, orderId: string, userId: string) {
  const order = (await Order.findOne({ _id: orderId, userId }).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  await Cart.updateOne({ userId }, { $set: { lines: [], restaurantId: null, couponCode: null } }, { upsert: true });
  const skipped: string[] = [];
  for (const line of order.lines) {
    try {
      await addToCart(ctx, userId, {
        foodId: String(line.foodId),
        variantId: line.variantId ?? null,
        addOnIds: line.addOnIds ?? [],
        quantity: line.quantity,
        note: line.note ?? undefined,
        replaceCart: true,
      });
    } catch {
      skipped.push(line.name);
    }
  }
  return { skipped };
}

export async function searchOrdersAdmin(q: { page: number; limit: number; status?: OrderStatus; q?: string; restaurantIds?: Types.ObjectId[] }) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.restaurantIds) filter.restaurantId = { $in: q.restaurantIds };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ orderNumber: rx }, { customerName: rx }, { 'restaurantSnapshot.name': rx }];
  }
  const [rows, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { items: rows.map((o) => toOrderDTO(o, { includeCustomer: true })), meta: pageMeta(q.page, q.limit, total) };
}

export { SYSTEM };
