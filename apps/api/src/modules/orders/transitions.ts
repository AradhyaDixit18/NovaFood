import { Types } from 'mongoose';
import {
  type OrderActor,
  type OrderStatus,
  STATUS_META,
  canTransition,
  formatINR,
  pointsEarnedFor,
} from '@novafood/shared';
import { primaryClientUrl } from '../../config/env';
import type { AppContext } from '../../context';
import { emailTemplates } from '../../integrations/email';
import { AppError, notFound } from '../../lib/errors';
import { FoodItem } from '../../models/FoodItem';
import { Coupon, CouponRedemption } from '../../models/misc';
import { Order, type OrderLean } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';
import { toOrderDTO } from '../../serializers';
import { creditPoints } from '../loyalty/loyalty.service';
import { notify } from '../notifications/notifications.service';

export interface Actor {
  kind: OrderActor;
  userId?: string | null;
}

export const SYSTEM: Actor = { kind: 'system' };

/**
 * Applies one status change. The update is conditional on the status we read, so two
 * concurrent actors (say, a customer cancelling while the kitchen accepts) cannot both win.
 */
export async function transitionOrder(
  ctx: AppContext,
  orderId: string | Types.ObjectId,
  to: OrderStatus,
  actor: Actor,
  options: { note?: string; set?: Record<string, unknown> } = {},
): Promise<OrderLean> {
  const order = (await Order.findById(orderId).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  const from = order.status as OrderStatus;
  if (!canTransition(from, to, actor.kind)) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `An order that is "${STATUS_META[from].label}" cannot move to "${STATUS_META[to].label}".`,
    );
  }

  const now = ctx.now();
  const updated = (await Order.findOneAndUpdate(
    { _id: order._id, status: from },
    {
      $set: { status: to, ...options.set },
      $push: {
        statusHistory: {
          status: to,
          at: now,
          by: actor.kind,
          byUserId: actor.userId ? new Types.ObjectId(actor.userId) : null,
          note: options.note,
        },
      },
    },
    { new: true },
  ).lean()) as OrderLean | null;
  if (!updated) throw new AppError(409, 'ORDER_CHANGED', 'This order was just updated by someone else. Refresh and try again.');

  const result = await applySideEffects(ctx, updated, from, to);
  broadcast(ctx, result);
  return result;
}

function broadcast(ctx: AppContext, order: OrderLean): void {
  const payload = toOrderDTO(order);
  ctx.realtime.toOrder(String(order._id), 'order:updated', payload);
  ctx.realtime.toUser(String(order.userId), 'order:updated', payload);
  ctx.realtime.toRestaurant(String(order.restaurantId), 'order:updated', toOrderDTO(order, { includeCustomer: true }));
  ctx.realtime.toAdmins('order:updated', payload);
}

async function releaseCouponAndPoints(order: OrderLean): Promise<void> {
  if (order.couponId) {
    const removed = await CouponRedemption.deleteOne({ orderId: order._id });
    if (removed.deletedCount === 1) await Coupon.updateOne({ _id: order.couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
  if (order.pricing.pointsRedeemed > 0) {
    await creditPoints(String(order.userId), order.pricing.pointsRedeemed, 'REVERSE', `Points returned for ${order.orderNumber}`, order._id);
  }
}

/** Everything that happens once an order reaches the kitchen, for both COD and paid orders. */
export async function applyPlacedEffects(ctx: AppContext, order: OrderLean): Promise<void> {
  const userId = String(order.userId);
  const link = `/orders/${String(order._id)}`;
  const meta = STATUS_META.ORDER_PLACED;
  await Promise.all([
    Restaurant.updateOne({ _id: order.restaurantId }, { $inc: { orderCount: 1 } }),
    ...order.lines.map((l) => FoodItem.updateOne({ _id: l.foodId }, { $inc: { orderCount: l.quantity } })),
  ]);
  ctx.realtime.toRestaurant(String(order.restaurantId), 'order:new', toOrderDTO(order, { includeCustomer: true }));
  ctx.realtime.toAdmins('order:new', toOrderDTO(order));
  await notify(ctx, { userId, type: 'ORDER', title: meta.label, body: meta.message, link, transactional: true });
  const user = await User.findById(userId).select('email name notificationPrefs').lean();
  if (user && user.notificationPrefs?.email !== false) {
    ctx.email
      .send({
        to: user.email,
        ...emailTemplates.orderConfirmed(user.name, order.orderNumber, formatINR(order.pricing.totalPaise), `${primaryClientUrl(ctx.env)}${link}`),
      })
      .catch((err) => ctx.logger.error({ err, orderId: String(order._id) }, 'Order confirmation email failed'));
  }
}

async function applySideEffects(ctx: AppContext, order: OrderLean, _from: OrderStatus, to: OrderStatus): Promise<OrderLean> {
  const userId = String(order.userId);
  const link = `/orders/${String(order._id)}`;
  const meta = STATUS_META[to];
  const now = ctx.now();

  switch (to) {
    case 'ORDER_PLACED': {
      await applyPlacedEffects(ctx, order);
      return order;
    }
    case 'RESTAURANT_ACCEPTED': {
      const restaurant = await Restaurant.findById(order.restaurantId).select('deliveryTimeMins').lean();
      const eta = new Date(now.getTime() + (restaurant?.deliveryTimeMins ?? 35) * 60_000);
      await notify(ctx, { userId, type: 'ORDER', title: meta.label, body: meta.message, link });
      return ((await Order.findByIdAndUpdate(order._id, { $set: { estimatedDeliveryAt: eta } }, { new: true }).lean()) ?? order) as OrderLean;
    }
    case 'DELIVERED': {
      const points = pointsEarnedFor(order.pricing.taxablePaise);
      await creditPoints(userId, points, 'EARN', `Earned on ${order.orderNumber}`, order._id);
      await notify(ctx, {
        userId,
        type: 'ORDER',
        title: meta.label,
        body: points > 0 ? `${meta.message} +${points} Nova Points added.` : meta.message,
        link,
      });
      // Cash on delivery is collected at the door, so a delivered COD order is a paid order.
      const paymentSet = order.payment.method === 'COD' ? { 'payment.status': 'PAID', 'payment.paidAt': now } : {};
      return ((await Order.findByIdAndUpdate(order._id, { $set: { deliveredAt: now, pointsEarned: points, ...paymentSet } }, { new: true }).lean()) ??
        order) as OrderLean;
    }
    case 'CANCELLED':
    case 'REJECTED': {
      await releaseCouponAndPoints(order);
      await notify(ctx, {
        userId,
        type: 'ORDER',
        title: meta.label,
        body: order.cancelReason ? `${meta.message} Reason: ${order.cancelReason}` : meta.message,
        link,
        transactional: true,
      });
      if (order.payment.status === 'PAID') {
        // Money was captured: start the refund immediately rather than waiting for an admin.
        return transitionOrder(ctx, order._id, 'REFUND_PENDING', SYSTEM, { note: 'Automatic refund after cancellation' }).then(
          async (o) => (await initiateRefund(ctx, o)) ?? o,
        );
      }
      return order;
    }
    case 'PAYMENT_FAILED': {
      await notify(ctx, { userId, type: 'PAYMENT', title: meta.label, body: meta.message, link, transactional: true });
      return order;
    }
    case 'REFUND_PENDING':
    case 'REFUNDED': {
      await notify(ctx, { userId, type: 'PAYMENT', title: meta.label, body: meta.message, link, transactional: true });
      return order;
    }
    default: {
      if (to === 'PREPARING' || to === 'READY_FOR_PICKUP' || to === 'OUT_FOR_DELIVERY') {
        await notify(ctx, { userId, type: 'ORDER', title: meta.label, body: meta.message, link });
      }
      return order;
    }
  }
}

/** Asks the gateway for a refund. Completion arrives via the `refund.processed` webhook. */
export async function initiateRefund(ctx: AppContext, order: OrderLean): Promise<OrderLean | null> {
  if (order.status !== 'REFUND_PENDING' || !order.payment.providerPaymentId || order.payment.refundId) return null;
  if (!ctx.payments) {
    ctx.logger.warn({ orderId: String(order._id) }, 'Refund needed but no payment provider is configured; admin must settle it manually');
    return null;
  }
  try {
    const { refundId } = await ctx.payments.refund(order.payment.providerPaymentId, order.pricing.totalPaise);
    return (await Order.findByIdAndUpdate(order._id, { $set: { 'payment.refundId': refundId, 'payment.status': 'REFUND_PENDING' } }, { new: true }).lean()) as OrderLean;
  } catch (err) {
    ctx.logger.error({ err, orderId: String(order._id) }, 'Refund request failed; it stays REFUND_PENDING for an admin to retry');
    return null;
  }
}
