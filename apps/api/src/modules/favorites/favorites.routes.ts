import { Router } from 'express';
import { objectId } from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { notFound } from '../../lib/errors';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { FoodItem } from '../../models/FoodItem';
import { Favorite } from '../../models/misc';
import { Restaurant } from '../../models/Restaurant';
import { toFoodDTO, toRestaurantSummary } from '../../serializers';

const params = z.object({ kind: z.enum(['restaurant', 'food']), id: objectId });

export function createFavoritesRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  router.get('/', async (req, res) => {
    const favs = await Favorite.find({ userId: currentUser(req).id }).sort({ createdAt: -1 }).lean();
    const restaurantIds = favs.filter((f) => f.kind === 'restaurant').map((f) => f.targetId);
    const foodIds = favs.filter((f) => f.kind === 'food').map((f) => f.targetId);
    const [restaurants, foods] = await Promise.all([
      Restaurant.find({ _id: { $in: restaurantIds }, status: 'APPROVED' }).lean(),
      FoodItem.find({ _id: { $in: foodIds }, isDeleted: false }).lean(),
    ]);
    const foodRestaurants = await Restaurant.find({ _id: { $in: foods.map((f) => f.restaurantId) } }).lean();
    const rById = new Map(foodRestaurants.map((r) => [String(r._id), r]));
    const now = ctx.now();
    send(res, {
      restaurants: restaurants.map((r) => toRestaurantSummary(r, now)),
      foods: foods.map((f) => toFoodDTO(f, rById.get(String(f.restaurantId)), now)),
    });
  });

  router.get('/ids', async (req, res) => {
    const favs = await Favorite.find({ userId: currentUser(req).id }).select('kind targetId').lean();
    send(res, {
      restaurantIds: favs.filter((f) => f.kind === 'restaurant').map((f) => String(f.targetId)),
      foodIds: favs.filter((f) => f.kind === 'food').map((f) => String(f.targetId)),
    });
  });

  router.put('/:kind/:id', async (req, res) => {
    const { kind, id } = parse(params, req.params);
    const exists = kind === 'restaurant' ? await Restaurant.exists({ _id: id, status: 'APPROVED' }) : await FoodItem.exists({ _id: id, isDeleted: false });
    if (!exists) throw notFound(kind === 'restaurant' ? 'Restaurant' : 'Dish');
    await Favorite.updateOne({ userId: currentUser(req).id, kind, targetId: id }, { $setOnInsert: { userId: currentUser(req).id, kind, targetId: id } }, { upsert: true });
    send(res, { favorited: true });
  });

  router.delete('/:kind/:id', async (req, res) => {
    const { kind, id } = parse(params, req.params);
    await Favorite.deleteOne({ userId: currentUser(req).id, kind, targetId: id });
    send(res, { favorited: false });
  });

  return router;
}
