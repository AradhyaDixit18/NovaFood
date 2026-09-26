import { Router } from 'express';
import { cancelOrderSchema, checkoutSchema, idParams, orderListQuerySchema, verifyPaymentSchema } from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { createLimiters } from '../../middleware/rateLimit';
import { toOrderDTO } from '../../serializers';
import { evaluateCart } from '../cart/cart.service';
import * as payments from '../payments/payments.service';
import * as orders from './orders.service';

const failureSchema = z.object({ reason: z.string().trim().max(200).default('Payment was not completed') });

export function createOrdersRouter(ctx: AppContext): Router {
  const router = Router();
  const limits = createLimiters(ctx);
  router.use(authenticate(ctx, { required: true }));

  router.post('/', limits.checkout, async (req, res) => {
    const input = parse(checkoutSchema, req.body);
    const result = await orders.placeOrder(ctx, currentUser(req).id, input);
    send(res, { order: toOrderDTO(result.order), payment: result.payment }, 201);
  });

  router.get('/', async (req, res) => {
    const q = parse(orderListQuerySchema, req.query);
    const { items, meta } = await orders.listOrdersForUser(currentUser(req).id, q);
    send(res, items, 200, meta);
  });

  router.get('/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const viewer = currentUser(req);
    const result = await orders.getOrderForViewer(ctx, id, viewer);
    const includeCustomer = viewer.role !== 'customer';
    send(res, { order: toOrderDTO(result.order, { includeCustomer }), payment: result.payment });
  });

  router.post('/:id/cancel', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const { reason } = parse(cancelOrderSchema, req.body ?? {});
    const order = await orders.cancelByCustomer(ctx, id, currentUser(req).id, reason);
    send(res, { order: toOrderDTO(order) });
  });

  router.post('/:id/reorder', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const userId = currentUser(req).id;
    const { skipped } = await orders.reorder(ctx, id, userId);
    const { dto } = await evaluateCart(ctx, userId);
    send(res, { cart: dto, skipped });
  });

  router.post('/:id/payment/verify', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const input = parse(verifyPaymentSchema, req.body);
    const order = await payments.verifyCheckout(ctx, currentUser(req).id, id, input);
    send(res, { order: toOrderDTO(order) });
  });

  router.post('/:id/payment/failed', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const { reason } = parse(failureSchema, req.body ?? {});
    const order = await payments.reportFailure(ctx, currentUser(req).id, id, reason);
    send(res, { order: toOrderDTO(order) });
  });

  router.post('/:id/payment/retry', limits.checkout, async (req, res) => {
    const { id } = parse(idParams, req.params);
    const userId = currentUser(req).id;
    await payments.retryPayment(ctx, userId, id);
    const result = await orders.getOrderForViewer(ctx, id, currentUser(req));
    send(res, { order: toOrderDTO(result.order), payment: result.payment });
  });

  return router;
}

/** Mounted separately because it needs the raw body and no user authentication. */
export function createPaymentWebhookRouter(ctx: AppContext): Router {
  const router = Router();
  router.post('/razorpay', async (req, res) => {
    const raw = req.rawBody ?? Buffer.from('');
    const result = await payments.handleWebhook(ctx, raw, req.get('x-razorpay-signature'), req.get('x-razorpay-event-id'));
    send(res, { received: true, duplicate: result.duplicate });
  });
  return router;
}
