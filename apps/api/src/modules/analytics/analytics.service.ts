import type { Types } from 'mongoose';
import { ORDER_STATUSES, type OrderStatus, TIMEZONE } from '@novafood/shared';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';

/** Orders that represent real revenue (delivered, or on their way to being delivered). */
const REVENUE_STATUSES: OrderStatus[] = ['ORDER_PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface AnalyticsQuery {
  now: Date;
  days: number;
  restaurantIds?: Types.ObjectId[];
}

/**
 * Every figure is computed from stored orders at request time; nothing is estimated.
 *
 * Status counts use a MongoDB `$group`. The revenue breakdowns are folded in one pass over a
 * narrow projection of the window's orders, which keeps the logic portable across MongoDB
 * and wire-compatible engines and buckets days in IST. For very large windows this moves to
 * a `$facet` pipeline or a pre-aggregated daily rollup collection.
 */
export async function computeAnalytics(q: AnalyticsQuery) {
  const since = new Date(q.now.getTime() - q.days * 86_400_000);
  const scope: Record<string, unknown> = { createdAt: { $gte: since } };
  if (q.restaurantIds) scope.restaurantId = { $in: q.restaurantIds };

  const [statusRows, revenueOrders] = await Promise.all([
    Order.aggregate<{ _id: OrderStatus; count: number }>([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.find({ ...scope, status: { $in: REVENUE_STATUSES } })
      .select('createdAt restaurantId restaurantSnapshot.name pricing.totalPaise lines.foodId lines.name lines.quantity lines.lineTotalPaise')
      .lean(),
  ]);

  const buckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = q.days - 1; i >= 0; i--) {
    buckets.set(dayKey.format(new Date(q.now.getTime() - i * 86_400_000)), { orders: 0, revenue: 0 });
  }
  const foods = new Map<string, { name: string; quantity: number; revenue: number }>();
  const restaurants = new Map<string, { name: string; orders: number; revenue: number }>();
  let revenue = 0;

  for (const o of revenueOrders) {
    const total = o.pricing?.totalPaise ?? 0;
    revenue += total;
    const bucket = buckets.get(dayKey.format(o.createdAt));
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue += total;
    }
    const rKey = String(o.restaurantId);
    const r = restaurants.get(rKey) ?? { name: o.restaurantSnapshot?.name ?? '', orders: 0, revenue: 0 };
    r.orders += 1;
    r.revenue += total;
    restaurants.set(rKey, r);
    for (const line of o.lines ?? []) {
      const fKey = String(line.foodId);
      const f = foods.get(fKey) ?? { name: line.name, quantity: 0, revenue: 0 };
      f.quantity += line.quantity;
      f.revenue += line.lineTotalPaise;
      foods.set(fKey, f);
    }
  }

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of statusRows) statusCounts[row._id] = row.count;
  const orders = revenueOrders.length;

  return {
    rangeDays: q.days,
    totals: {
      orders,
      revenuePaise: revenue,
      averageOrderValuePaise: orders ? Math.round(revenue / orders) : 0,
    },
    statusCounts,
    topFoods: [...foods]
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 8)
      .map(([foodId, f]) => ({ foodId, name: f.name, quantity: f.quantity, revenuePaise: f.revenue })),
    topRestaurants: [...restaurants]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8)
      .map(([restaurantId, r]) => ({ restaurantId, name: r.name, orders: r.orders, revenuePaise: r.revenue })),
    daily: [...buckets].map(([date, v]) => ({ date, orders: v.orders, revenuePaise: v.revenue })),
  };
}

export async function platformCounts(now: Date, days: number) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const [users, newUsers, restaurants, pendingRestaurants] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: since } }),
    Restaurant.countDocuments({ status: 'APPROVED' }),
    Restaurant.countDocuments({ status: 'PENDING' }),
  ]);
  return { users, newUsers, restaurants, pendingRestaurants };
}
