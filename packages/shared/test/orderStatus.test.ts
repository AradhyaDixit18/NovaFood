import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, ORDER_TRANSITIONS, canTransition, isTerminal, nextStatuses } from '../src/orderStatus';

describe('order state machine', () => {
  it('lets a partner walk the happy path', () => {
    const path = ['ORDER_PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!, 'partner')).toBe(true);
    }
  });

  it('blocks skipping steps', () => {
    expect(canTransition('ORDER_PLACED', 'DELIVERED', 'partner')).toBe(false);
    expect(canTransition('PREPARING', 'DELIVERED', 'admin')).toBe(false);
  });

  it('only the system confirms payment', () => {
    expect(canTransition('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'customer')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'admin')).toBe(false);
    expect(canTransition('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'system')).toBe(true);
  });

  it('customers can cancel only before the restaurant accepts', () => {
    expect(canTransition('ORDER_PLACED', 'CANCELLED', 'customer')).toBe(true);
    expect(canTransition('RESTAURANT_ACCEPTED', 'CANCELLED', 'customer')).toBe(false);
  });

  it('never leaves a delivered or refunded order', () => {
    expect(isTerminal('DELIVERED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(nextStatuses('DELIVERED', 'admin')).toEqual([]);
  });

  it('references only known statuses', () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      expect(ORDER_STATUSES).toContain(from);
      for (const to of Object.keys(targets)) expect(ORDER_STATUSES).toContain(to);
    }
  });
});
