import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CartDTO, COPY, type FoodDTO, computeUnitPrice } from '@novafood/shared';
import { ApiError, api, errorMessage } from '../lib/api';
import { useIsAuthed } from '../stores/auth';
import { confirm } from '../stores/confirm';
import { lineKey, useGuestCart } from '../stores/guestCart';
import { useMascot } from '../stores/mascot';
import { toast } from '../stores/toast';
import { useUi } from '../stores/ui';
import { keys } from './keys';

export const useServerCart = () => {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.cart, queryFn: () => api<CartDTO>('/cart'), enabled: authed, staleTime: 10_000 });
};

/** Cart line count shown in the navbar, for both guests and signed-in users. */
export function useCartCount(): number {
  const authed = useIsAuthed();
  const { data } = useServerCart();
  const guest = useGuestCart((s) => s.lines);
  return authed ? (data?.itemCount ?? 0) : guest.reduce((s, l) => s + l.quantity, 0);
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<CartDTO>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
    onError: (err) => {
      useMascot.getState().react('worried');
      toast.error(errorMessage(err));
    },
  });
}

export const useUpdateLine = () =>
  useCartMutation((v: { lineId: string; quantity?: number; note?: string }) =>
    api<CartDTO>(`/cart/items/${v.lineId}`, { method: 'PATCH', body: { quantity: v.quantity, note: v.note } }),
  );
export const useClearCart = () => useCartMutation(() => api<CartDTO>('/cart', { method: 'DELETE' }));
export const useRemoveCoupon = () => useCartMutation(() => api<CartDTO>('/cart/coupon', { method: 'DELETE' }));
export const useSetUsePoints = () => useCartMutation((usePoints: boolean) => api<CartDTO>('/cart/options', { method: 'PATCH', body: { usePoints } }));

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<CartDTO>('/cart/coupon', { method: 'POST', body: { code } }),
    onSuccess: (cart) => {
      qc.setQueryData(keys.cart, cart);
      useMascot.getState().react('happy');
      toast.success(`${cart.coupon?.code} applied 🎉`, cart.coupon?.description);
    },
  });
}

export interface AddInput {
  food: Pick<FoodDTO, '_id' | 'name' | 'isVeg' | 'art' | 'imageUrl' | 'pricePaise' | 'variants' | 'addOnGroups'>;
  restaurant: { _id: string; name: string; slug: string };
  variantId?: string | null;
  addOnIds?: string[];
  quantity?: number;
  note?: string;
  /** Where the tap happened, for the fly-to-cart animation. */
  origin?: DOMRect | null;
}

/** One entry point for adding to the cart, whether or not the user is signed in. */
export function useAddToCart() {
  const authed = useIsAuthed();
  const qc = useQueryClient();
  const guest = useGuestCart();

  return useMutation({
    mutationFn: async (input: AddInput): Promise<number> => {
      const addOnIds = input.addOnIds ?? [];
      const quantity = input.quantity ?? 1;
      const askReplace = () =>
        confirm({ title: 'Start a new cart?', body: COPY.cart.otherRestaurant, confirmLabel: 'Start fresh', cancelLabel: 'Keep my cart' });

      if (authed) {
        const body = { foodId: input.food._id, variantId: input.variantId ?? null, addOnIds, quantity, note: input.note };
        try {
          const cart = await api<CartDTO>('/cart/items', { method: 'POST', body });
          qc.setQueryData(keys.cart, cart);
          return cart.itemCount;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'CART_RESTAURANT_MISMATCH' && (await askReplace())) {
            const cart = await api<CartDTO>('/cart/items', { method: 'POST', body: { ...body, replaceCart: true } });
            qc.setQueryData(keys.cart, cart);
            return cart.itemCount;
          }
          throw err;
        }
      }

      const variant = input.food.variants.find((v) => v._id === input.variantId) ?? null;
      const options = input.food.addOnGroups.flatMap((g) => g.options).filter((o) => addOnIds.includes(o._id));
      const line = {
        key: lineKey(input.food._id, variant?._id ?? null, addOnIds),
        foodId: input.food._id,
        variantId: variant?._id ?? null,
        addOnIds,
        quantity,
        note: input.note,
        snapshot: {
          name: input.food.name,
          isVeg: input.food.isVeg,
          art: input.food.art,
          imageUrl: input.food.imageUrl,
          unitPricePaise: computeUnitPrice(input.food.pricePaise, variant?.pricePaise ?? null, options.map((o) => o.pricePaise)),
          variantName: variant?.name ?? null,
          addOnNames: options.map((o) => o.name),
          restaurantId: input.restaurant._id,
          restaurantName: input.restaurant.name,
          restaurantSlug: input.restaurant.slug,
        },
      };
      let result = guest.add(line);
      if (result === 'conflict') {
        if (!(await askReplace())) throw new Error('cancelled');
        result = guest.add(line, true);
      }
      return useGuestCart.getState().lines.reduce((s, l) => s + l.quantity, 0);
    },
    onSuccess: (count, input) => {
      if (input.origin) useUi.getState().launch(input.origin, input.food.art);
      const mascot = useMascot.getState();
      if (count >= 5) {
        mascot.react('hungry', 3000);
        toast.success(COPY.cart.full);
      } else {
        mascot.react('happy');
      }
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'cancelled') return;
      useMascot.getState().react('worried');
      toast.error(errorMessage(err));
    },
  });
}

/** After login, fold the browser cart into the account and report anything that did not fit. */
export async function mergeGuestCartIntoAccount(): Promise<void> {
  const lines = useGuestCart.getState().lines;
  if (lines.length === 0) return;
  try {
    const cart = await api<CartDTO & { warnings: string[] }>('/cart/merge', {
      method: 'POST',
      body: { lines: lines.map((l) => ({ foodId: l.foodId, variantId: l.variantId, addOnIds: l.addOnIds, quantity: l.quantity, note: l.note })) },
    });
    useGuestCart.getState().clear();
    for (const w of cart.warnings ?? []) toast.info(w);
  } catch {
    /* keep the guest cart; the user can retry from the cart page */
  }
}
