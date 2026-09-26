import { Router } from 'express';
import { addToCartSchema, applyCouponSchema, cartOptionsSchema, mergeCartSchema, updateCartLineSchema } from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import * as cart from './cart.service';

const lineParams = z.object({ lineId: z.string().regex(/^[a-f0-9]{24}$/i) });

export function createCartRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  const respond = async (userId: string, res: Parameters<typeof send>[0], status = 200, extra: Record<string, unknown> = {}) => {
    const { dto } = await cart.evaluateCart(ctx, userId);
    send(res, { ...dto, ...extra }, status);
  };

  router.get('/', async (req, res) => respond(currentUser(req).id, res));

  router.post('/items', async (req, res) => {
    const userId = currentUser(req).id;
    await cart.addToCart(ctx, userId, parse(addToCartSchema, req.body));
    await respond(userId, res, 201);
  });

  router.patch('/items/:lineId', async (req, res) => {
    const userId = currentUser(req).id;
    const { lineId } = parse(lineParams, req.params);
    await cart.updateLine(userId, lineId, parse(updateCartLineSchema, req.body));
    await respond(userId, res);
  });

  router.delete('/items/:lineId', async (req, res) => {
    const userId = currentUser(req).id;
    const { lineId } = parse(lineParams, req.params);
    await cart.updateLine(userId, lineId, { quantity: 0 });
    await respond(userId, res);
  });

  router.delete('/', async (req, res) => {
    const userId = currentUser(req).id;
    await cart.clearCart(userId);
    await respond(userId, res);
  });

  router.post('/coupon', async (req, res) => {
    const userId = currentUser(req).id;
    const { code } = parse(applyCouponSchema, req.body);
    await cart.applyCoupon(ctx, userId, code);
    await respond(userId, res);
  });

  router.delete('/coupon', async (req, res) => {
    const userId = currentUser(req).id;
    await cart.removeCoupon(userId);
    await respond(userId, res);
  });

  router.patch('/options', async (req, res) => {
    const userId = currentUser(req).id;
    await cart.setUsePoints(userId, parse(cartOptionsSchema, req.body).usePoints);
    await respond(userId, res);
  });

  router.post('/merge', async (req, res) => {
    const userId = currentUser(req).id;
    const { lines } = parse(mergeCartSchema, req.body);
    const warnings = await cart.mergeGuestCart(ctx, userId, lines);
    await respond(userId, res, 200, { warnings });
  });

  return router;
}
