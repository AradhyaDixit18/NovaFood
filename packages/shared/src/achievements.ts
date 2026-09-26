/**
 * Achievements reward exploration (new cuisines, new restaurants, reviews) rather than
 * ordering frequency, and nothing expires or nags. That keeps the gamification fun without
 * pushing people to order more than they want to.
 */

export interface ActivityStats {
  deliveredOrders: number;
  distinctCuisines: number;
  distinctRestaurants: number;
  reviewsWritten: number;
  /** Consecutive ISO weeks (ending this week or last week) with at least one delivered order. */
  weeklyStreak: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  unlocked: boolean;
}

interface Definition {
  id: string;
  emoji: string;
  title: string;
  description: string;
  target: number;
  metric: keyof ActivityStats;
}

const DEFINITIONS: Definition[] = [
  { id: 'first-bite', emoji: '🍽️', title: 'First Bite', description: 'Get your first order delivered', target: 1, metric: 'deliveredOrders' },
  { id: 'cuisine-explorer', emoji: '🧭', title: 'Cuisine Explorer', description: 'Try 5 different cuisines', target: 5, metric: 'distinctCuisines' },
  { id: 'globetrotter', emoji: '🌏', title: 'Plate Globetrotter', description: 'Try 10 different cuisines', target: 10, metric: 'distinctCuisines' },
  { id: 'restaurant-hopper', emoji: '🏃', title: 'Restaurant Hopper', description: 'Order from 10 different restaurants', target: 10, metric: 'distinctRestaurants' },
  { id: 'food-critic', emoji: '✍️', title: 'Food Critic', description: 'Write 5 reviews', target: 5, metric: 'reviewsWritten' },
  { id: 'weekly-regular', emoji: '🔥', title: 'Weekly Regular', description: 'Order in 3 consecutive weeks', target: 3, metric: 'weeklyStreak' },
];

export function computeAchievements(stats: ActivityStats): Achievement[] {
  return DEFINITIONS.map((d) => {
    const progress = Math.min(stats[d.metric], d.target);
    return {
      id: d.id,
      emoji: d.emoji,
      title: d.title,
      description: d.description,
      target: d.target,
      progress,
      unlocked: stats[d.metric] >= d.target,
    };
  });
}

/** ISO-8601 week key, e.g. "2026-W39". */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Counts consecutive weeks with an order, allowing the current week to still be "in progress". */
export function weeklyStreak(orderDates: Date[], now: Date): number {
  const weeks = new Set(orderDates.map(isoWeekKey));
  const WEEK = 7 * 86_400_000;
  let cursor = new Date(now.getTime());
  if (!weeks.has(isoWeekKey(cursor))) cursor = new Date(cursor.getTime() - WEEK);
  let streak = 0;
  while (weeks.has(isoWeekKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - WEEK);
  }
  return streak;
}
