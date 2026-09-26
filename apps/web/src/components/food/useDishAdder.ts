import { create } from 'zustand';
import type { FoodDTO } from '@novafood/shared';
import { type AddInput, useAddToCart } from '../../api/cart';

export type Target = { food: FoodDTO; restaurant: AddInput['restaurant']; origin: DOMRect | null };

export const useCustomizer = create<{ target: Target | null; open: (t: Target) => void; close: () => void }>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

/** Adds directly when a dish has nothing to choose, otherwise opens the customiser. */
export function useDishAdder() {
  const add = useAddToCart();
  const open = useCustomizer((s) => s.open);
  return {
    pending: add.isPending,
    add: (food: FoodDTO, restaurant: AddInput['restaurant'], origin?: DOMRect | null) => {
      if (food.variants.length > 0 || food.addOnGroups.length > 0) open({ food, restaurant, origin: origin ?? null });
      else add.mutate({ food, restaurant, origin });
    },
  };
}
