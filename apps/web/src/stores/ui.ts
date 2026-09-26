import { create } from 'zustand';
import { safeStorage } from '../lib/storage';

export type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

interface UiState {
  theme: Theme;
  toggleTheme: () => void;
  /** Screen position of the cart button, the landing spot for the fly-to-cart animation. */
  cartTarget: DOMRect | null;
  setCartTarget: (rect: DOMRect | null) => void;
  flights: { id: number; from: DOMRect; art: { kind: string; hue: number } }[];
  launch: (from: DOMRect, art: { kind: string; hue: number }) => void;
  land: (id: number) => void;
}

let flightId = 1;

export const useUi = create<UiState>((set, get) => ({
  theme: initialTheme(),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    safeStorage.set('nf-theme', theme);
    set({ theme });
  },
  cartTarget: null,
  setCartTarget: (rect) => set({ cartTarget: rect }),
  flights: [],
  launch: (from, art) => set({ flights: [...get().flights, { id: flightId++, from, art }] }),
  land: (id) => set({ flights: get().flights.filter((f) => f.id !== id) }),
}));
