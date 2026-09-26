import type { FoodTag } from './constants';

export interface Mood {
  id: string;
  emoji: string;
  label: string;
  headline: string;
  /** Tags that make a dish a good match, strongest first. */
  tags: FoodTag[];
  /** Prefer restaurants that deliver fastest. */
  preferFast?: boolean;
}

export const MOODS = [
  { id: 'sad', emoji: '😭', label: 'Sad', headline: 'Sad hai? Comfort food le aa 🫂', tags: ['comfort', 'dessert', 'creamy'] },
  { id: 'chill', emoji: '😎', label: 'Chill', headline: 'Chill vibes, light bites 😎', tags: ['snack', 'beverage', 'light'] },
  { id: 'spicy', emoji: '🔥', label: 'Spicy mood', headline: 'Aaj ka mood: Spicy + Crunchy 🔥', tags: ['spicy', 'crunchy', 'street-food'] },
  { id: 'lazy', emoji: '🥱', label: 'Lazy', headline: 'Uthna bhi mat. One-bowl wonders 🥱', tags: ['one-bowl', 'comfort'], preferFast: true },
  { id: 'party', emoji: '🥳', label: 'Party', headline: 'Party scene? Share karne layak 🥳', tags: ['shareable', 'combo', 'snack'] },
  { id: 'healthy', emoji: '💪', label: 'Healthy', headline: 'Gains mode on 💪', tags: ['healthy', 'high-protein', 'light'] },
  { id: 'comfort', emoji: '❤️', label: 'Comfort food', headline: 'Ghar jaisa sukoon ❤️', tags: ['comfort', 'home-style', 'creamy'] },
] as const satisfies readonly Mood[];

export type MoodId = (typeof MOODS)[number]['id'];

export const MOOD_IDS = MOODS.map((m) => m.id) as [MoodId, ...MoodId[]];

export function getMood(id: string): Mood | undefined {
  return MOODS.find((m) => m.id === id);
}

/** 0..1 match between a dish's tags and a mood, weighting the mood's first tags highest. */
export function moodScore(mood: Mood, dishTags: readonly string[]): number {
  const weights = mood.tags.map((_, i) => 1 / (i + 1));
  const max = weights.reduce((a, b) => a + b, 0);
  const got = mood.tags.reduce((sum, tag, i) => (dishTags.includes(tag) ? sum + (weights[i] ?? 0) : sum), 0);
  return max === 0 ? 0 : got / max;
}
