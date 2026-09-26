import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Order } from '../src/models/Order';
import { PaymentEvent } from '../src/models/misc';
import {
  addAddress,
  auth,
  checkoutSignature,
  createFood,
  createPartnerWithRestaurant,
  createTestKit,
  createUser,
  type TestUser,
  webhookSignature,
} from './helpers';

const kit = createTestKit({ payments: true });
let foodId: string;
let partner: TestUser;

beforeAll(async () => {
  const setup = await createPartnerWithRestaurant(kit);
  partner = setup.partner;
  foodId = String((await createFood(setup.restaurant._id, { pricePaise: 25000 }))._id);
});

async function onlineOrder() {
  const user = await createUser(kit);
  const addressId = await addAddress(user);
  await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId, quantity: 2 });
  const res = await user.agent
    .post('/api/orders')
    .set(auth(user))
    .send({ addressId, paymentMethod: 'RAZORPAY', contactPhone: '9876543210', idempotencyKey: randomUUID() });
  expect(res.status).toBe(201);
  return { user, order: res.body.data.order, payment: res.body.data.payment };
}

const sendWebhook = (payload: unknown, eventId = randomUUID(), signature?: string) => {
  const body = JSON.stringify(payload);
  return kit.request
    .post('/api/payments/webhooks/razorpay')
    .set('content-type', 'application/json')
    .set('x-razorpay-signature', signature ?? webhookSignature(body))
    .set('x-razorpay-event-id', eventId)
    .send(body);
};

describe('online payments', () => {
  it('creates a gateway order for the server-computed amount and waits for payment', async () => {
    const { order, payment } = await onlineOrder();
    expect(order.status).toBe('PAYMENT_PENDING');
    expect(payment).toMatchObject({ provider: 'razorpay', keyId: 'rzp_test_offline', amountPaise: order.pricing.totalPaise, currency: 'INR' });
    expect(payment.providerOrderId).toMatch(/^order_test_/);
    // The kitchen is not told about an unpaid order.
    expect(kit.hub.events.some((e) => e.event === 'order:new' && (e.payload as { _id: string })._id === order._id)).toBe(false);
  });

  it('never trusts an invalid signature', async () => {
    const { user, order, payment } = await onlineOrder();
    const res = await user.agent
      .post(`/api/orders/${order._id}/payment/verify`)
      .set(auth(user))
      .send({ razorpayOrderId: payment.providerOrderId, razorpayPaymentId: 'pay_fake123', razorpaySignature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');
    expect((await Order.findById(order._id).lean())?.status).toBe('PAYMENT_PENDING');
  });

  it('confirms a correctly signed payment exactly once', async () => {
    const { user, order, payment } = await onlineOrder();
    const body = {
      razorpayOrderId: payment.providerOrderId,
      razorpayPaymentId: 'pay_ok123',
      razorpaySignature: checkoutSignature(payment.providerOrderId, 'pay_ok123'),
    };
    const first = await user.agent.post(`/api/orders/${order._id}/payment/verify`).set(auth(user)).send(body);
    expect(first.status).toBe(200);
    expect(first.body.data.order.status).toBe('ORDER_PLACED');
    expect(first.body.data.order.payment.status).toBe('PAID');
    const second = await user.agent.post(`/api/orders/${order._id}/payment/verify`).set(auth(user)).send(body);
    expect(second.body.data.order.status).toBe('ORDER_PLACED');
    const history = (await Order.findById(order._id).lean())!.statusHistory.map((e) => e.status);
    expect(history).toEqual(['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'ORDER_PLACED']);
  });

  it('refuses a payment id that belongs to a different order', async () => {
    const a = await onlineOrder();
    const b = await onlineOrder();
    const res = await a.user.agent
      .post(`/api/orders/${a.order._id}/payment/verify`)
      .set(auth(a.user))
      .send({ razorpayOrderId: b.payment.providerOrderId, razorpayPaymentId: 'pay_x1', razorpaySignature: checkoutSignature(b.payment.providerOrderId, 'pay_x1') });
    expect(res.status).toBe(400);
  });

  it('handles failure and a successful retry', async () => {
    const { user, order } = await onlineOrder();
    const failed = await user.agent.post(`/api/orders/${order._id}/payment/failed`).set(auth(user)).send({ reason: 'Card declined' });
    expect(failed.body.data.order.status).toBe('PAYMENT_FAILED');
    const retry = await user.agent.post(`/api/orders/${order._id}/payment/retry`).set(auth(user));
    expect(retry.status).toBe(200);
    expect(retry.body.data.order.status).toBe('PAYMENT_PENDING');
    const newProviderOrder = retry.body.data.payment.providerOrderId;
    const ok = await user.agent
      .post(`/api/orders/${order._id}/payment/verify`)
      .set(auth(user))
      .send({ razorpayOrderId: newProviderOrder, razorpayPaymentId: 'pay_retry1', razorpaySignature: checkoutSignature(newProviderOrder, 'pay_retry1') });
    expect(ok.body.data.order.status).toBe('ORDER_PLACED');
  });
});

describe('webhooks', () => {
  it('rejects unsigned or tampered webhooks', async () => {
    const res = await sendWebhook({ event: 'payment.captured' }, randomUUID(), 'deadbeef');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('confirms payment from payment.captured and ignores a redelivered event', async () => {
    const { order, payment } = await onlineOrder();
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_hook1', order_id: payment.providerOrderId } } } };
    const eventId = randomUUID();
    const first = await sendWebhook(payload, eventId);
    expect(first.body.data).toEqual({ received: true, duplicate: false });
    const again = await sendWebhook(payload, eventId);
    expect(again.body.data.duplicate).toBe(true);
    const stored = await Order.findById(order._id).lean();
    expect(stored?.status).toBe('ORDER_PLACED');
    expect(stored?.payment.providerPaymentId).toBe('pay_hook1');
    expect(await PaymentEvent.countDocuments({ eventId })).toBe(1);
  });

  it('marks a payment failed from payment.failed', async () => {
    const { order, payment } = await onlineOrder();
    await sendWebhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f1', order_id: payment.providerOrderId, error_description: 'Bank declined' } } } });
    const stored = await Order.findById(order._id).lean();
    expect(stored?.status).toBe('PAYMENT_FAILED');
    expect(stored?.payment.failureReason).toBe('Bank declined');
  });
});

describe('refunds', () => {
  it('refunds automatically when a paid order is rejected and completes via webhook', async () => {
    const { user, order, payment } = await onlineOrder();
    await user.agent
      .post(`/api/orders/${order._id}/payment/verify`)
      .set(auth(user))
      .send({ razorpayOrderId: payment.providerOrderId, razorpayPaymentId: 'pay_refund1', razorpaySignature: checkoutSignature(payment.providerOrderId, 'pay_refund1') });

    const rejected = await partner.agent.post(`/api/partner/orders/${order._id}/status`).set(auth(partner)).send({ status: 'REJECTED', reason: 'Closing early' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REFUND_PENDING');
    expect(kit.payments!.refunds).toContainEqual({ paymentId: 'pay_refund1', amount: order.pricing.totalPaise });

    await sendWebhook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_refund1' } } } });
    const stored = await Order.findById(order._id).lean();
    expect(stored?.status).toBe('REFUNDED');
    expect(stored?.payment.status).toBe('REFUNDED');
  });
});
