import { Types } from 'mongoose';
import {
  type MealSlot,
  type RecommendationDTO,
  WEEKDAY_LABEL,
  mealSlot,
  weekdayOf,
} from '@novafood/shared';
import type { AppContext } from '../../context';
import { FoodItem, type FoodLean } from '../../models/FoodItem';
import { Favorite } from '../../models/misc';
import { Order, type OrderLean } from '../../models/Order';
import { Restaurant, type RestaurantLean } from '../../models/Restaurant';
import { User } from '../../models/User';
import { restaurantIsOpen, toFoodDTO } from '../../serializers';

/**
 * NovaFood's "Taste Engine": an explainable, content-based recommender. Each dish gets a
 * weighted score from the customer's own history (cuisine and tag affinity, favourites,
 * typical spend, weekday habits) plus context (time of day) and global signals (popularity,
 * rating). It is deliberately not presented as AI: every suggestion carries the real reason.
 */

const SLOT_TAGS: Record<MealSlot, string[]> = {
  breakfast: ['breakfast', 'light', 'beverage'],
  lunch: ['one-bowl', 'home-style', 'comfort'],
  snacks: ['snack', 'street-food', 'beverage'],
  dinner: ['comfort', 'shareable', 'spicy'],
  'late-night': ['late-night', 'snack', 'comfort'],
};

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snacks: 'chai-time',
  dinner: 'dinner',
  'late-night': 'late-night cravings',
};

interface Profile {
  cuisine: Map<string, number>;
  tags: Map<string, number>;
  weekdayCuisine: Map<string, number>;
  orderedFoodIds: Set<string>;
  favoriteFoodIds: Set<string>;
  favoriteRestaurantIds: Set<string>;
  medianUnitPaise: number | null;
  vegetarianOnly: boolean;
  dietTags: string[];
  favoriteCuisines: string[];
  personalized: boolean;
}

const bump = (m: Map<string, number>, k: string, by: number) => m.set(k, (m.get(k) ?? 0) + by);

function normalize(m: Map<string, number>): Map<string, number> {
  const max = Math.max(0, ...m.values());
  if (max === 0) return m;
  return new Map([...m].map(([k, v]) => [k, v / max]));
}

async function buildProfile(ctx: AppContext, userId: string | null): Promise<Profile> {
  const empty: Profile = {
    cuisine: new Map(),
    tags: new Map(),
    weekdayCuisine: new Map(),
    orderedFoodIds: new Set(),
    favoriteFoodIds: new Set(),
    favoriteRestaurantIds: new Set(),
    medianUnitPaise: null,
    vegetarianOnly: false,
    dietTags: [],
    favoriteCuisines: [],
    personalized: false,
  };
  if (!userId) return empty;

  const user = await User.findById(userId).select('vegetarianOnly dietaryPreferences favoriteCuisines privacy').lean();
  if (!user) return empty;
  const base = {
    ...empty,
    vegetarianOnly: Boolean(user.vegetarianOnly),
    dietTags: user.dietaryPreferences ?? [],
    favoriteCuisines: user.favoriteCuisines ?? [],
  };
  if (user.privacy?.personalizedRecommendations === false) return base;

  const [orders, favorites] = await Promise.all([
    Order.find({ userId, status: { $in: ['DELIVERED', 'OUT_FOR_DELIVERY', 'PREPARING', 'RESTAURANT_ACCEPTED', 'ORDER_PLACED'] } })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean() as Promise<OrderLean[]>,
    Favorite.find({ userId }).lean(),
  ]);

  const foodIds = [...new Set(orders.flatMap((o) => o.lines.map((l) => String(l.foodId))))];
  const foods = (await FoodItem.find({ _id: { $in: foodIds } }).select('tags cuisine').lean()) as FoodLean[];
  const tagsByFood = new Map(foods.map((f) => [String(f._id), f.tags ?? []]));

  const today = weekdayOf(ctx.now());
  const prices: number[] = [];
  orders.forEach((order, index) => {
    const recency = 1 / (1 + index / 10); // recent orders count more
    const sameWeekday = weekdayOf(order.createdAt) === today;
    for (const line of order.lines) {
      if (line.cuisine) {
        bump(base.cuisine, line.cuisine, recency * line.quantity);
        if (sameWeekday) bump(base.weekdayCuisine, line.cuisine, 1);
      }
      for (const tag of tagsByFood.get(String(line.foodId)) ?? []) bump(base.tags, tag, recency);
      base.orderedFoodIds.add(String(line.foodId));
      prices.push(line.unitPricePaise);
    }
  });
  for (const c of base.favoriteCuisines) bump(base.cuisine, c, 2);
  for (const f of favorites) (f.kind === 'food' ? base.favoriteFoodIds : base.favoriteRestaurantIds).add(String(f.targetId));

  prices.sort((a, b) => a - b);
  return {
    ...base,
    cuisine: normalize(base.cuisine),
    tags: normalize(base.tags),
    medianUnitPaise: prices.length ? (prices[Math.floor(prices.length / 2)] ?? null) : null,
    personalized: orders.length > 0 || favorites.length > 0 || base.favoriteCuisines.length > 0,
  };
}

interface Scored {
  food: FoodLean;
  restaurant: RestaurantLean;
  score: number;
  reason: string;
}

export async function recommendForUser(ctx: AppContext, userId: string | null, limit = 12): Promise<RecommendationDTO[]> {
  const now = ctx.now();
  const slot = mealSlot(now);
  const today = weekdayOf(now);
  const profile = await buildProfile(ctx, userId);

  const restaurants = (await Restaurant.find({ status: 'APPROVED', isAcceptingOrders: true }).lean()) as RestaurantLean[];
  const open = restaurants.filter((r) => restaurantIsOpen(r, now));
  const pool = open.length > 0 ? open : restaurants; // closed-hours fallback still shows ideas
  const rById = new Map(pool.map((r) => [String(r._id), r]));

  const filter: Record<string, unknown> = { restaurantId: { $in: pool.map((r) => r._id) }, isDeleted: false, isAvailable: true };
  if (profile.vegetarianOnly) filter.isVeg = true;
  if (profile.dietTags.length) filter.dietTags = { $all: profile.dietTags };
  const foods = (await FoodItem.find(filter).limit(600).lean()) as FoodLean[];

  const maxOrders = Math.max(1, ...foods.map((f) => f.orderCount ?? 0));
  const scored: Scored[] = [];

  for (const food of foods) {
    const restaurant = rById.get(String(food.restaurantId));
    if (!restaurant) continue;
    const tags = food.tags ?? [];
    const parts: { key: string; value: number; reason: string }[] = [];

    const cuisineAff = profile.cuisine.get(food.cuisine) ?? 0;
    parts.push({ key: 'cuisine', value: cuisineAff * 3, reason: `Because you love ${food.cuisine}` });

    const tagAff = tags.reduce((s, t) => s + (profile.tags.get(t) ?? 0), 0) / Math.max(1, tags.length);
    parts.push({ key: 'tags', value: tagAff * 2, reason: `Matches your usual vibe` });

    const weekday = profile.weekdayCuisine.get(food.cuisine) ?? 0;
    if (weekday >= 2) parts.push({ key: 'weekday', value: 2.5, reason: `Your ${WEEKDAY_LABEL[today]} mood looks like ${food.cuisine} 👀` });

    if (profile.favoriteFoodIds.has(String(food._id))) parts.push({ key: 'fav', value: 2.5, reason: 'You saved this ❤️' });
    if (profile.favoriteRestaurantIds.has(String(food.restaurantId))) parts.push({ key: 'favR', value: 1, reason: `From ${restaurant.name}, one of your favourites` });

    const slotFit = tags.filter((t) => SLOT_TAGS[slot].includes(t)).length;
    parts.push({ key: 'slot', value: slotFit * 0.8, reason: `Perfect for ${SLOT_LABEL[slot]}` });

    if (profile.medianUnitPaise) {
      const ratio = food.pricePaise / profile.medianUnitPaise;
      parts.push({ key: 'price', value: Math.exp(-((Math.log(ratio)) ** 2) / 0.5) * 0.8, reason: 'In your usual price range' });
    }

    const pop = (food.orderCount ?? 0) / maxOrders + ((food.rating ?? 0) / 5) * Math.min(1, (food.ratingCount ?? 0) / 20);
    parts.push({ key: 'pop', value: pop * 1.2, reason: food.isBestseller ? 'Bestseller right now 🔥' : 'Trending right now 🔥' });

    // Gently favour discovery over re-suggesting the exact dish they order every time.
    const repeatPenalty = profile.orderedFoodIds.has(String(food._id)) && !profile.favoriteFoodIds.has(String(food._id)) ? 0.6 : 0;

    const score = parts.reduce((s, p) => s + p.value, 0) - repeatPenalty;
    const top = [...parts].sort((a, b) => b.value - a.value)[0];
    scored.push({ food, restaurant, score, reason: top && top.value > 0.05 ? top.reason : 'Trending right now 🔥' });
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversity: at most two dishes per restaurant.
  const perRestaurant = new Map<string, number>();
  const picked: Scored[] = [];
  for (const s of scored) {
    const key = String(s.restaurant._id);
    const count = perRestaurant.get(key) ?? 0;
    if (count >= 2) continue;
    perRestaurant.set(key, count + 1);
    picked.push(s);
    if (picked.length >= limit) break;
  }

  return picked.map((s) => ({ food: toFoodDTO(s.food, s.restaurant, now), score: Math.round(s.score * 100) / 100, reason: s.reason }));
}

/** "Your usual Friday order?": the most repeated basket, with weekday awareness. */
export async function smartReorder(ctx: AppContext, userId: string) {
  const orders = (await Order.find({ userId, status: 'DELIVERED' }).sort({ createdAt: -1 }).limit(50).lean()) as OrderLean[];
  if (orders.length < 2) return null;
  const today = weekdayOf(ctx.now());

  const groups = new Map<string, { orders: OrderLean[]; onToday: number }>();
  for (const o of orders) {
    const signature = `${String(o.restaurantId)}|${o.lines.map((l) => `${String(l.foodId)}:${l.variantId ?? ''}`).sort().join(',')}`;
    const g = groups.get(signature) ?? { orders: [], onToday: 0 };
    g.orders.push(o);
    if (weekdayOf(o.createdAt) === today) g.onToday += 1;
    groups.set(signature, g);
  }
  const best = [...groups.values()]
    .filter((g) => g.orders.length >= 2)
    .sort((a, b) => b.onToday - a.onToday || b.orders.length - a.orders.length)[0];
  if (!best) return null;
  const latest = best.orders[0]!;
  const restaurant = await Restaurant.findById(latest.restaurantId).lean();
  if (!restaurant || restaurant.status !== 'APPROVED') return null;

  return {
    orderId: String(latest._id),
    restaurant: { _id: String(restaurant._id), name: restaurant.name, slug: restaurant.slug, isOpen: restaurantIsOpen(restaurant, ctx.now()) },
    items: latest.lines.map((l) => ({ name: l.name, quantity: l.quantity, isVeg: Boolean(l.isVeg), art: l.art })),
    timesOrdered: best.orders.length,
    headline: best.onToday >= 2 ? `Your usual ${WEEKDAY_LABEL[today]} order?` : 'Order your usual again?',
  };
}

/** Dishes most often ordered together with a given dish. */
export async function alsoOrdered(foodId: string, limit = 6) {
  if (!Types.ObjectId.isValid(foodId)) return [];
  const orders = (await Order.find({ 'lines.foodId': new Types.ObjectId(foodId), status: 'DELIVERED' }).select('lines.foodId').limit(300).lean()) as OrderLean[];
  const counts = new Map<string, number>();
  for (const o of orders) {
    for (const id of new Set(o.lines.map((l) => String(l.foodId)))) if (id !== foodId) bump(counts, id, 1);
  }
  const ids = [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  const foods = (await FoodItem.find({ _id: { $in: ids }, isDeleted: false, isAvailable: true }).lean()) as FoodLean[];
  return ids
    .map((id) => foods.find((f) => String(f._id) === id))
    .filter((f): f is FoodLean => Boolean(f))
    .map((f) => ({ food: toFoodDTO(f), timesTogether: counts.get(String(f._id)) ?? 0 }));
}
