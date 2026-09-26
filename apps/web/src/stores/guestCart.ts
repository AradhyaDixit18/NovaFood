import type { Art } from '@novafood/shared';
import { create } from 'zustand';
import { safeStorage } from '../lib/storage';

export interface GuestLine {
  key: string;
  foodId: string;
  variantId: string | null;
  addOnIds: string[];
  quantity: number;
  note?: string;
  /** Display-only snapshot. The server re-prices everything when the cart is merged. */
  snapshot: {
    name: string;
    isVeg: boolean;
    art: Art;
    imageUrl?: string | null;
    unitPricePaise: number;
    variantName?: string | null;
    addOnNames: string[];
    restaurantId: string;
    restaurantName: string;
    restaurantSlug: string;
  };
}

interface GuestCartState {
  lines: GuestLine[];
  add: (line: GuestLine, replace?: boolean) => 'added' | 'conflict';
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

const KEY = 'nf-guest-cart';
const persist = (lines: GuestLine[]) => safeStorage.set(KEY, lines);

export const lineKey = (foodId: string, variantId: string | null, addOnIds: string[]) =>
  `${foodId}:${variantId ?? '-'}:${[...addOnIds].sort().join(',')}`;

export const useGuestCart = create<GuestCartState>((set, get) => ({
  lines: safeStorage.get<GuestLine[]>(KEY, []),
  add: (line, replace = false) => {
    const current = get().lines;
    if (current.length && current[0]!.snapshot.restaurantId !== line.snapshot.restaurantId && !replace) return 'conflict';
    const base = replace && current[0]?.snapshot.restaurantId !== line.snapshot.restaurantId ? [] : current;
    const existing = base.find((l) => l.key === line.key);
    const lines = existing
      ? base.map((l) => (l.key === line.key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
      : [...base, line];
    persist(lines);
    set({ lines });
    return 'added';
  },
  setQuantity: (key, quantity) => {
    const lines = quantity <= 0 ? get().lines.filter((l) => l.key !== key) : get().lines.map((l) => (l.key === key ? { ...l, quantity } : l));
    persist(lines);
    set({ lines });
  },
  clear: () => {
    persist([]);
    set({ lines: [] });
  },
}));
