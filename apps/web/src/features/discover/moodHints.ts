import { MOODS as BASE, type Mood } from '@novafood/shared';
import type { MascotMood } from '../../stores/mascot';

export type MascotMoodHint = MascotMood;

/** How Nova reacts when each mood is picked. */
const MASCOT: Record<string, MascotMood> = {
  sad: 'worried',
  chill: 'happy',
  spicy: 'hungry',
  lazy: 'sleepy',
  party: 'celebrate',
  healthy: 'happy',
  comfort: 'curious',
};

export const MOODS = BASE.map((m) => ({ ...m, mascot: MASCOT[m.id] ?? 'happy' }));
export const getMood = (id: string): (Mood & { mascot: MascotMood }) | undefined => MOODS.find((m) => m.id === id);
