import { Router } from 'express';
import { Types } from 'mongoose';
import { CUISINES, foodQuerySchema, restaurantQuerySchema, searchQuerySchema } from '@novafood/shared';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { escapeRegex, parse, send } from '../../lib/http';
import { authenticate } from '../../middleware/auth';
import { FoodItem } from '../../models/FoodItem';
import { SearchEvent } from '../../models/misc';
import { Restaurant } from '../../models/Restaurant';
import * as catalog from './catalog.service';

const slugParams = z.object({ slug: z.string().min(1).max(80) });

export function createCatalogRouter(ctx: AppContext): Router {
  const router = Router();
  const optionalAuth = authenticate(ctx, { required: false });

  router.get('/restaurants', async (req, res) => {
    const q = parse(restaurantQuerySchema, req.query);
    const { items, meta } = await catalog.listRestaurants(ctx, q);
    send(res, items, 200, meta);
  });

  router.get('/restaurants/:slug', async (req, res) => {
    const { slug } = parse(slugParams, req.params);
    send(res, await catalog.getRestaurantBySlug(ctx, slug));
  });

  router.get('/foods', async (req, res) => {
    const q = parse(foodQuerySchema, req.query);
    const { items, meta, headline } = await catalog.searchFoods(ctx, q);
    res.status(200).json({ data: items, meta: { ...meta, headline } });
  });

  router.get('/foods/:id', async (req, res) => {
    send(res, await catalog.getFood(ctx, String(req.params.id)));
  });

  /** Type-ahead: cheap, not logged. */
  router.get('/search/suggest', async (req, res) => {
    const { q } = parse(searchQuerySchema, req.query);
    const rx = new RegExp(escapeRegex(q), 'i');
    const approved = await catalog.approvedRestaurantIds();
    const [restaurants, dishes] = await Promise.all([
      Restaurant.find({ status: 'APPROVED', $or: [{ name: rx }, { cuisines: rx }] })
        .select('name slug cuisines art')
        .limit(5)
        .lean(),
      FoodItem.find({ restaurantId: { $in: approved }, isDeleted: false, name: rx })
        .select('name isVeg pricePaise art restaurantId')
        .sort({ orderCount: -1 })
        .limit(6)
        .lean(),
    ]);
    const slugById = new Map(
      (await Restaurant.find({ _id: { $in: dishes.map((d) => d.restaurantId) } }).select('slug').lean()).map((r) => [String(r._id), r.slug]),
    );
    send(res, {
      restaurants: restaurants.map((r) => ({ _id: String(r._id), name: r.name, slug: r.slug, cuisines: r.cuisines, art: r.art })),
      dishes: dishes.map((d) => ({
        _id: String(d._id),
        name: d.name,
        isVeg: d.isVeg,
        pricePaise: d.pricePaise,
        art: d.art,
        restaurantSlug: slugById.get(String(d.restaurantId)),
      })),
      cuisines: CUISINES.filter((c) => rx.test(c)).slice(0, 4),
    });
  });

  /** Full search: restaurants and dishes together; records the term for trending. */
  router.get('/search', optionalAuth, async (req, res) => {
    const { q } = parse(searchQuerySchema, req.query);
    const [restaurants, dishes] = await Promise.all([
      catalog.listRestaurants(ctx, parse(restaurantQuerySchema, { q, limit: 12 })),
      catalog.searchFoods(ctx, parse(foodQuerySchema, { q, limit: 24 })),
    ]);
    const term = q.toLowerCase().replace(/\s+/g, ' ').trim();
    await SearchEvent.create({
      term,
      userId: req.user ? new Types.ObjectId(req.user.id) : null,
      results: restaurants.meta.total + dishes.meta.total,
    });
    send(res, { restaurants: restaurants.items, dishes: dishes.items });
  });

  router.get('/search/trending', async (_req, res) => {
    const since = new Date(ctx.now().getTime() - 7 * 86_400_000);
    const rows = await SearchEvent.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, results: { $gt: 0 } } },
      { $group: { _id: '$term', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);
    send(res, rows.map((r) => ({ term: r._id, count: r.count })));
  });

  return router;
}
