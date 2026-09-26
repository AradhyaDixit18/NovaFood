import { Router } from 'express';
import { createReviewSchema, idParams, objectId, paginationQuery } from '@novafood/shared';
import type { AppContext } from '../../context';
import { badRequest } from '../../lib/errors';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { Review, type ReviewLean } from '../../models/misc';
import * as reviews from './reviews.service';

const listQuery = paginationQuery.extend({ restaurantId: objectId.optional(), foodId: objectId.optional() });

export function createReviewsRouter(ctx: AppContext): Router {
  const router = Router();
  const requireAuth = authenticate(ctx, { required: true });
  const optionalAuth = authenticate(ctx, { required: false });

  router.get('/', optionalAuth, async (req, res) => {
    const q = parse(listQuery, req.query);
    if (!q.restaurantId && !q.foodId) throw badRequest('Pass restaurantId or foodId.');
    const { items, meta } = await reviews.listReviews(q, req.user?.id);
    send(res, items, 200, meta);
  });

  router.get('/mine', requireAuth, async (req, res) => {
    const rows = await Review.find({ userId: currentUser(req).id }).sort({ createdAt: -1 }).limit(50).lean();
    send(res, await reviews.toReviewDTOs(rows as ReviewLean[], currentUser(req).id));
  });

  router.post('/', requireAuth, async (req, res) => {
    await reviews.createReview(ctx, currentUser(req).id, parse(createReviewSchema, req.body));
    send(res, { ok: true }, 201);
  });

  router.post('/:id/helpful', requireAuth, async (req, res) => {
    const { id } = parse(idParams, req.params);
    send(res, await reviews.toggleHelpful(currentUser(req).id, id));
  });

  return router;
}
