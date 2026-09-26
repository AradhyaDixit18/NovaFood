import { Router } from 'express';
import { COPY, mealSlot } from '@novafood/shared';
import type { AppContext } from '../../context';
import { send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import * as recs from './recommendations.service';

export function createRecommendationsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/for-you', authenticate(ctx, { required: false }), async (req, res) => {
    const items = await recs.recommendForUser(ctx, req.user?.id ?? null, 12);
    send(res, { greeting: COPY.greeting[mealSlot(ctx.now())], items });
  });

  router.get('/smart-reorder', authenticate(ctx, { required: true }), async (req, res) => {
    send(res, await recs.smartReorder(ctx, currentUser(req).id));
  });

  router.get('/also-ordered/:foodId', async (req, res) => {
    send(res, await recs.alsoOrdered(String(req.params.foodId)));
  });

  return router;
}
