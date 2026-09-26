import type { AppContext } from '../../context';
import { AppError, badRequest, notFound, serviceUnavailable } from '../../lib/errors';
import { PaymentEvent } from '../../models/misc';
import { Order, type OrderLean } from '../../models/Order';
import { createProviderOrder } from '../orders/orders.service';
import { SYSTEM, transitionOrder } from '../orders/transitions';

/**
 * Marks an order paid and hands it to the kitchen. Safe to call twice (checkout callback and
 * webhook can race): the conditional update only matches while payment is still pending.
 */
export async function confirmPayment(ctx: AppContext, providerOrderId: string, providerPaymentId: string): Promise<OrderLean | null> {
  const now = ctx.now();
  const claimed = (await Order.findOneAndUpdate(
    { 'payment.providerOrderId': providerOrderId, 'payment.status': { $in: ['PENDING', 'FAILED'] }, status: { $in: ['PAYMENT_PENDING', 'PAYMENT_FAILED'] } },
    { $set: { 'payment.status': 'PAID', 'payment.providerPaymentId': providerPaymentId, 'payment.paidAt': now, 'payment.failureReason': null } },
    { new: true },
  ).lean()) as OrderLean | null;

  if (!claimed) {
    return (await Order.findOne({ 'payment.providerOrderId': providerOrderId }).lean()) as OrderLean | null;
  }
  if (claimed.status === 'PAYMENT_FAILED') {
    await transitionOrder(ctx, claimed._id, 'PAYMENT_PENDING', SYSTEM, { note: 'Payment succeeded after an earlier failure' });
  }
  await transitionOrder(ctx, claimed._id, 'PAYMENT_CONFIRMED', SYSTEM);
  return transitionOrder(ctx, claimed._id, 'ORDER_PLACED', SYSTEM);
}

export async function verifyCheckout(
  ctx: AppContext,
  userId: string,
  orderId: string,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
): Promise<OrderLean> {
  if (!ctx.payments) throw serviceUnavailable('Online payments are not configured.', 'PAYMENTS_UNAVAILABLE');
  const order = (await Order.findOne({ _id: orderId, userId }).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  if (order.payment.providerOrderId !== input.razorpayOrderId) throw badRequest('This payment does not belong to this order.');

  const valid = ctx.payments.verifyCheckoutSignature({
    providerOrderId: input.razorpayOrderId,
    providerPaymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!valid) {
    ctx.logger.warn({ orderId }, 'Rejected payment with an invalid signature');
    throw new AppError(400, 'PAYMENT_SIGNATURE_INVALID', 'We could not verify this payment. If money was deducted, it will be refunded automatically.');
  }
  const result = await confirmPayment(ctx, input.razorpayOrderId, input.razorpayPaymentId);
  if (!result) throw notFound('Order');
  return result;
}

/** The checkout widget reported a failure (the webhook will usually confirm it too). */
export async function reportFailure(ctx: AppContext, userId: string, orderId: string, reason: string): Promise<OrderLean> {
  const order = (await Order.findOne({ _id: orderId, userId }).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  if (order.status !== 'PAYMENT_PENDING') return order;
  return transitionOrder(ctx, order._id, 'PAYMENT_FAILED', SYSTEM, {
    note: reason,
    set: { 'payment.status': 'FAILED', 'payment.failureReason': reason.slice(0, 200) },
  });
}

export async function retryPayment(ctx: AppContext, userId: string, orderId: string): Promise<OrderLean> {
  const order = (await Order.findOne({ _id: orderId, userId }).lean()) as OrderLean | null;
  if (!order) throw notFound('Order');
  if (order.payment.method !== 'RAZORPAY') throw badRequest('This order is not paid online.');
  const pending = order.status === 'PAYMENT_FAILED'
    ? await transitionOrder(ctx, order._id, 'PAYMENT_PENDING', { kind: 'customer', userId }, { set: { 'payment.status': 'PENDING' } })
    : order;
  if (pending.status !== 'PAYMENT_PENDING') throw badRequest('This order does not need payment.');
  return createProviderOrder(ctx, pending);
}

interface RazorpayWebhook {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
    order?: { entity?: { id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string } };
  };
}

/** Verified, de-duplicated webhook handling. Unknown events are acknowledged and ignored. */
export async function handleWebhook(ctx: AppContext, rawBody: Buffer, signature: string | undefined, eventId: string | undefined) {
  if (!ctx.payments) throw serviceUnavailable('Online payments are not configured.', 'PAYMENTS_UNAVAILABLE');
  if (!signature || !ctx.payments.verifyWebhookSignature(rawBody, signature)) {
    throw new AppError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature.');
  }
  const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook;
  const id = eventId ?? `${body.event}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? ''}`;

  try {
    await PaymentEvent.create({ eventId: id, type: body.event, providerOrderId: body.payload?.payment?.entity?.order_id, payload: body });
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 11000) return { duplicate: true };
    throw err;
  }

  const payment = body.payload?.payment?.entity;
  switch (body.event) {
    case 'payment.captured':
    case 'order.paid': {
      const providerOrderId = payment?.order_id ?? body.payload?.order?.entity?.id;
      if (providerOrderId && payment?.id) await confirmPayment(ctx, providerOrderId, payment.id);
      break;
    }
    case 'payment.failed': {
      if (!payment?.order_id) break;
      const order = await Order.findOne({ 'payment.providerOrderId': payment.order_id, status: 'PAYMENT_PENDING' }).lean();
      if (order) {
        await transitionOrder(ctx, order._id, 'PAYMENT_FAILED', SYSTEM, {
          note: payment.error_description,
          set: { 'payment.status': 'FAILED', 'payment.failureReason': payment.error_description ?? 'Payment failed' },
        });
      }
      break;
    }
    case 'refund.processed': {
      const paymentId = body.payload?.refund?.entity?.payment_id;
      if (!paymentId) break;
      const order = await Order.findOne({ 'payment.providerPaymentId': paymentId, status: 'REFUND_PENDING' }).lean();
      if (order) await transitionOrder(ctx, order._id, 'REFUNDED', SYSTEM, { set: { 'payment.status': 'REFUNDED' } });
      break;
    }
    default:
      break;
  }
  return { duplicate: false };
}
