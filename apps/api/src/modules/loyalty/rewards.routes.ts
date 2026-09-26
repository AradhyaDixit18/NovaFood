import { Router } from 'express';
import { type ActivityStats, LOYALTY, computeAchievements, weeklyStreak } from '@novafood/shared';
import type { AppContext } from '../../context';
import { send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { PointsEntry, Review } from '../../models/misc';
import { Order } from '../../models/Order';
import { User } from '../../models/User';

export async function activityStats(ctx: AppContext, userId: string): Promise<ActivityStats> {
  const [orders, reviewsWritten] = await Promise.all([
    Order.find({ userId, status: 'DELIVERED' }).select('restaurantId lines.cuisine deliveredAt createdAt').lean(),
    Review.countDocuments({ userId, foodId: null }),
  ]);
  const cuisines = new Set<string>();
  for (const o of orders) for (const l of o.lines) if (l.cuisine) cuisines.add(l.cuisine);
  return {
    deliveredOrders: orders.length,
    distinctCuisines: cuisines.size,
    distinctRestaurants: new Set(orders.map((o) => String(o.restaurantId))).size,
    reviewsWritten,
    weeklyStreak: weeklyStreak(orders.map((o) => o.deliveredAt ?? o.createdAt), ctx.now()),
  };
}

export function createRewardsRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  router.get('/', async (req, res) => {
    const userId = currentUser(req).id;
    const [user, history, stats] = await Promise.all([
      User.findById(userId).select('pointsBalance').lean(),
      PointsEntry.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
      activityStats(ctx, userId),
    ]);
    send(res, {
      balance: user?.pointsBalance ?? 0,
      pointValuePaise: LOYALTY.pointValuePaise,
      earnRule: `1 Nova Point for every ₹${LOYALTY.paisePerPointEarned / 100} of food on delivered orders`,
      redeemRule: `Use up to ${Math.round(LOYALTY.maxRedeemRatio * 100)}% of your food value (minimum ${LOYALTY.minRedeemPoints} points)`,
      history: history.map((h) => ({
        _id: String(h._id),
        type: h.type,
        points: h.points,
        description: h.description,
        orderId: h.orderId ? String(h.orderId) : null,
        createdAt: h.createdAt.toISOString(),
      })),
      stats,
      achievements: computeAchievements(stats),
    });
  });

  return router;
}
