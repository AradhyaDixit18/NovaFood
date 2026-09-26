import { describe, expect, it } from 'vitest';
import { isOpenAt, mealSlot } from '../src/time';
import { computeAchievements, weeklyStreak } from '../src/achievements';
import { getMood, moodScore } from '../src/moods';

// 2026-09-26 is a Saturday. 10:00 UTC = 15:30 IST.
const satAfternoon = new Date('2026-09-26T10:00:00Z');
// 2026-09-26 19:30 UTC = Sunday 01:00 IST.
const sunLateNight = new Date('2026-09-26T19:30:00Z');

describe('opening hours (IST)', () => {
  it('is open inside a same-day window', () => {
    expect(isOpenAt([{ day: 'sat', open: '11:00', close: '23:00' }], satAfternoon)).toBe(true);
  });
  it('is closed outside every window', () => {
    expect(isOpenAt([{ day: 'sat', open: '18:00', close: '23:00' }], satAfternoon)).toBe(false);
  });
  it('handles windows that cross midnight', () => {
    expect(isOpenAt([{ day: 'sat', open: '20:00', close: '03:00' }], sunLateNight)).toBe(true);
    expect(isOpenAt([{ day: 'sun', open: '11:00', close: '23:00' }], sunLateNight)).toBe(false);
  });
  it('maps times to meal slots', () => {
    expect(mealSlot(satAfternoon)).toBe('lunch');
    expect(mealSlot(sunLateNight)).toBe('late-night');
  });
});

describe('achievements & streaks', () => {
  it('unlocks based on exploration stats', () => {
    const a = computeAchievements({ deliveredOrders: 1, distinctCuisines: 5, distinctRestaurants: 2, reviewsWritten: 0, weeklyStreak: 0 });
    expect(a.find((x) => x.id === 'first-bite')?.unlocked).toBe(true);
    expect(a.find((x) => x.id === 'cuisine-explorer')?.unlocked).toBe(true);
    expect(a.find((x) => x.id === 'globetrotter')?.progress).toBe(5);
  });
  it('counts consecutive weeks and tolerates an empty current week', () => {
    const now = new Date('2026-09-26T10:00:00Z');
    const weeks = [7, 14, 21].map((d) => new Date(now.getTime() - d * 86_400_000));
    expect(weeklyStreak(weeks, now)).toBe(3);
    expect(weeklyStreak([], now)).toBe(0);
  });
});

describe('moods', () => {
  it('scores dishes by weighted tag overlap', () => {
    const spicy = getMood('spicy')!;
    expect(moodScore(spicy, ['spicy', 'crunchy', 'street-food'])).toBeCloseTo(1);
    expect(moodScore(spicy, ['dessert'])).toBe(0);
    expect(moodScore(spicy, ['spicy'])).toBeGreaterThan(moodScore(spicy, ['crunchy']));
  });
});
