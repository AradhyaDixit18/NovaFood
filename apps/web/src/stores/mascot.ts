import { create } from 'zustand';

/** Nova, the mascot, reacts to what is happening in the app. */
export type MascotMood = 'idle' | 'curious' | 'happy' | 'hungry' | 'celebrate' | 'worried' | 'sleepy';

interface MascotState {
  mood: MascotMood;
  /** Set a mood; transient moods fall back to idle after `ms`. */
  react: (mood: MascotMood, ms?: number) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useMascot = create<MascotState>((set) => ({
  mood: 'idle',
  react: (mood, ms = 2400) => {
    clearTimeout(timer);
    set({ mood });
    if (mood !== 'idle' && ms > 0) timer = setTimeout(() => set({ mood: 'idle' }), ms);
  },
}));
