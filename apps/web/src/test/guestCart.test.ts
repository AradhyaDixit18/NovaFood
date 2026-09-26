import { beforeEach, describe, expect, it } from 'vitest';
import { lineKey, useGuestCart } from '../stores/guestCart';

const line = (restaurantId: string, foodId = 'f1', addOnIds: string[] = []) => ({
  key: lineKey(foodId, null, addOnIds),
  foodId,
  variantId: null,
  addOnIds,
  quantity: 1,
  snapshot: { name: 'Dish', isVeg: true, art: { kind: 'bowl', hue: 1 }, unitPricePaise: 10000, addOnNames: [], restaurantId, restaurantName: 'R', restaurantSlug: 'r' },
});

describe('guest cart', () => {
  beforeEach(() => useGuestCart.getState().clear());

  it('treats add-on order as the same configuration', () => {
    expect(lineKey('f', 'v', ['b', 'a'])).toBe(lineKey('f', 'v', ['a', 'b']));
  });

  it('merges identical lines and persists them', () => {
    useGuestCart.getState().add(line('r1'));
    useGuestCart.getState().add(line('r1'));
    expect(useGuestCart.getState().lines).toHaveLength(1);
    expect(useGuestCart.getState().lines[0]!.quantity).toBe(2);
    expect(JSON.parse(localStorage.getItem('nf-guest-cart')!)).toHaveLength(1);
  });

  it('refuses a second restaurant unless asked to replace', () => {
    useGuestCart.getState().add(line('r1'));
    expect(useGuestCart.getState().add(line('r2', 'f2'))).toBe('conflict');
    expect(useGuestCart.getState().add(line('r2', 'f2'), true)).toBe('added');
    expect(useGuestCart.getState().lines.map((l) => l.foodId)).toEqual(['f2']);
  });

  it('removes a line at quantity zero', () => {
    useGuestCart.getState().add(line('r1'));
    useGuestCart.getState().setQuantity(useGuestCart.getState().lines[0]!.key, 0);
    expect(useGuestCart.getState().lines).toEqual([]);
  });
});
