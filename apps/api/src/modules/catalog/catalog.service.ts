import { Types } from 'mongoose';
import {
  type FoodQuery,
  type RestaurantQuery,
  getMood,
  moodScore,
} from '@novafood/shared';
import type { AppContext } from '../../context';
import { notFound } from '../../lib/errors';
import { escapeRegex, pageMeta } from '../../lib/http';
import { FoodItem, type FoodLean } from '../../models/FoodItem';
import { Coupon } from '../../models/misc';
import { Restaurant, type RestaurantLean } from '../../models/Restaurant';
import { restaurantIsOpen, toFoodDTO, toRestaurantDTO, toRestaurantSummary } from '../../serializers';

/**
 * Discovery runs as a MongoDB query for the hard filters followed by in-process scoring.
 * That keeps relevance logic readable and testable at this catalogue size; the documented
 * path to scale is a MongoDB Atlas Search index behind the same function signatures.
 */
const CANDIDATE_CAP = 500;

function textScore(query: string | undefined, ...fields: (string | undefined)[]): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let best = 0;
  for (const field of fields) {
    const f = (field ?? '').toLowerCase();
    if (!f) continue;
    if (f === q) best = Math.max(best, 3);
    else if (f.startsWith(q)) best = Math.max(best, 2);
    else if (f.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

const popularity = (rating: number, count: number) => rating * Math.log10(count + 10);

export async function approvedRestaurantIds(): Promise<Types.ObjectId[]> {
  const rows = await Restaurant.find({ status: 'APPROVED' }).select('_id').lean();
  return rows.map((r) => r._id);
}

export async function listRestaurants(ctx: AppContext, q: RestaurantQuery) {
  const filter: Record<string, unknown> = { status: 'APPROVED' };
  if (q.cuisine?.length) filter.cuisines = { $in: q.cuisine };
  if (q.pureVeg) filter.pureVeg = true;
  if (q.minRating) filter.rating = { $gte: q.minRating };
  if (q.maxDeliveryTime) filter.deliveryTimeMins = { $lte: q.maxDeliveryTime };
  if (q.maxCostForTwo) filter.costForTwoPaise = { $lte: q.maxCostForTwo };
  if (q.hasOffers) filter.offerText = { $nin: [null, ''] };

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    // Restaurants match on their own fields or on any dish they serve.
    const dishHits = await FoodItem.find({ name: rx, isDeleted: false }).select('restaurantId').limit(CANDIDATE_CAP).lean();
    filter.$or = [
      { name: rx },
      { cuisines: rx },
      { 'address.area': rx },
      { _id: { $in: dishHits.map((d) => d.restaurantId) } },
    ];
  }

  const now = ctx.now();
  let rows = (await Restaurant.find(filter).limit(CANDIDATE_CAP).lean()) as RestaurantLean[];
  if (q.openNow) rows = rows.filter((r) => restaurantIsOpen(r, now));

  const scored = rows.map((r) => ({
    r,
    open: restaurantIsOpen(r, now) && r.isAcceptingOrders ? 1 : 0,
    text: textScore(q.q, r.name, ...(r.cuisines ?? [])),
    pop: popularity(r.rating ?? 0, r.ratingCount ?? 0),
  }));

  const sorters: Record<RestaurantQuery['sort'], (a: (typeof scored)[number], b: (typeof scored)[number]) => number> = {
    relevance: (a, b) => b.open - a.open || b.text - a.text || b.pop - a.pop,
    rating: (a, b) => (b.r.rating ?? 0) - (a.r.rating ?? 0) || b.pop - a.pop,
    deliveryTime: (a, b) => a.r.deliveryTimeMins - b.r.deliveryTimeMins,
    costLow: (a, b) => a.r.costForTwoPaise - b.r.costForTwoPaise,
    costHigh: (a, b) => b.r.costForTwoPaise - a.r.costForTwoPaise,
    popularity: (a, b) => (b.r.orderCount ?? 0) - (a.r.orderCount ?? 0) || b.pop - a.pop,
  };
  scored.sort(sorters[q.sort]);

  const start = (q.page - 1) * q.limit;
  const page = scored.slice(start, start + q.limit).map((s) => toRestaurantSummary(s.r, now));
  return { items: page, meta: pageMeta(q.page, q.limit, scored.length) };
}

export async function getRestaurantBySlug(ctx: AppContext, slug: string, options: { includeUnapproved?: boolean } = {}) {
  const restaurant = await Restaurant.findOne({ slug }).lean();
  if (!restaurant || (restaurant.status !== 'APPROVED' && !options.includeUnapproved)) throw notFound('Restaurant');
  const now = ctx.now();

  const [foods, coupons] = await Promise.all([
    FoodItem.find({ restaurantId: restaurant._id, isDeleted: false }).sort({ section: 1, isBestseller: -1, name: 1 }).lean(),
    Coupon.find({
      isActive: true,
      userIds: { $size: 0 },
      $and: [
        { $or: [{ restaurantIds: { $size: 0 } }, { restaurantIds: restaurant._id }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      ],
    })
      .limit(6)
      .lean(),
  ]);

  // Keep the section order stable: sections containing bestsellers first, then alphabetical.
  const sections = new Map<string, FoodLean[]>();
  for (const f of foods as FoodLean[]) {
    if (!sections.has(f.section)) sections.set(f.section, []);
    sections.get(f.section)!.push(f);
  }
  const menu = [...sections.entries()]
    .sort(([a, ai], [b, bi]) => Number(bi.some((f) => f.isBestseller)) - Number(ai.some((f) => f.isBestseller)) || a.localeCompare(b))
    .map(([section, items]) => ({ section, items: items.map((f) => toFoodDTO(f)) }));

  return {
    restaurant: toRestaurantDTO(restaurant, now),
    menu,
    offers: coupons.map((c) => ({
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderPaise: c.minOrderPaise,
      maxDiscountPaise: c.maxDiscountPaise ?? null,
      firstOrderOnly: c.firstOrderOnly,
    })),
  };
}

export async function searchFoods(ctx: AppContext, q: FoodQuery) {
  const restaurants = (await Restaurant.find({ status: 'APPROVED' }).lean()) as RestaurantLean[];
  const byId = new Map(restaurants.map((r) => [String(r._id), r]));

  const filter: Record<string, unknown> = {
    restaurantId: { $in: restaurants.map((r) => r._id) },
    isDeleted: false,
    isAvailable: true,
  };
  if (q.veg) filter.isVeg = true;
  if (q.diet?.length) filter.dietTags = { $all: q.diet };
  if (q.tags?.length) filter.tags = { $in: q.tags };
  if (q.cuisine?.length) filter.cuisine = { $in: q.cuisine };
  if (q.minRating) filter.rating = { $gte: q.minRating };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.pricePaise = {
      ...(q.minPrice !== undefined ? { $gte: q.minPrice } : {}),
      ...(q.maxPrice !== undefined ? { $lte: q.maxPrice } : {}),
    };
  }
  const mood = q.mood ? getMood(q.mood) : undefined;
  if (mood) filter.tags = { $in: mood.tags };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { cuisine: rx }, { section: rx }, { tags: rx }, { ingredients: rx }];
  }

  const now = ctx.now();
  const rows = (await FoodItem.find(filter).limit(CANDIDATE_CAP).lean()) as FoodLean[];
  const scored = rows.map((f) => {
    const r = byId.get(String(f.restaurantId));
    const open = r && restaurantIsOpen(r, now) && r.isAcceptingOrders ? 1 : 0;
    let score = open * 2 + textScore(q.q, f.name, f.cuisine) + popularity(f.rating ?? 0, f.ratingCount ?? 0) / 5;
    if (mood) {
      score += moodScore(mood, f.tags ?? []) * 3;
      if (mood.preferFast && r) score += Math.max(0, (45 - r.deliveryTimeMins) / 15);
    }
    return { f, r, open, score };
  });

  const sorters: Record<FoodQuery['sort'], (a: (typeof scored)[number], b: (typeof scored)[number]) => number> = {
    relevance: (a, b) => b.score - a.score,
    rating: (a, b) => (b.f.rating ?? 0) - (a.f.rating ?? 0),
    priceLow: (a, b) => a.f.pricePaise - b.f.pricePaise,
    priceHigh: (a, b) => b.f.pricePaise - a.f.pricePaise,
    popularity: (a, b) => (b.f.orderCount ?? 0) - (a.f.orderCount ?? 0),
  };
  scored.sort(sorters[q.sort]);

  const start = (q.page - 1) * q.limit;
  const items = scored.slice(start, start + q.limit).map((s) => toFoodDTO(s.f, s.r, now));
  return { items, meta: pageMeta(q.page, q.limit, scored.length), headline: mood?.headline ?? null };
}

export async function getFood(ctx: AppContext, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Dish');
  const food = await FoodItem.findOne({ _id: id, isDeleted: false }).lean();
  if (!food) throw notFound('Dish');
  const restaurant = await Restaurant.findById(food.restaurantId).lean();
  if (!restaurant || restaurant.status !== 'APPROVED') throw notFound('Dish');
  return toFoodDTO(food, restaurant, ctx.now());
}
