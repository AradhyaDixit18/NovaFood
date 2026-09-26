import { describe, expect, it } from 'vitest';
import { type CouponContext, type CouponRule, describeCoupon, evaluateCoupon } from '../src/coupon';

const base: CouponRule = {
  code: 'NOVA50',
  type: 'PERCENT',
  value: 50,
  minOrderPaise: 19900,
  maxDiscountPaise: 10000,
  isActive: true,
  usedCount: 0,
  firstOrderOnly: false,
};
const ctx: CouponContext = {
  now: new Date('2026-09-26T10:00:00Z'),
  subtotalPaise: 40000,
  restaurantId: 'r1',
  userId: 'u1',
  userRedemptions: 0,
  userSuccessfulOrders: 3,
};

describe('evaluateCoupon', () => {
  it('applies a capped percentage', () => {
    expect(evaluateCoupon(base, ctx)).toEqual({ ok: true, discountPaise: 10000 });
  });
  it('applies a flat discount', () => {
    expect(evaluateCoupon({ ...base, type: 'FLAT', value: 7500, maxDiscountPaise: null }, ctx)).toEqual({ ok: true, discountPaise: 7500 });
  });
  it('enforces minimum order with a helpful message', () => {
    const r = evaluateCoupon(base, { ...ctx, subtotalPaise: 15000 });
    expect(r).toMatchObject({ ok: false, reason: 'MIN_ORDER' });
    if (!r.ok) expect(r.message).toContain('₹49');
  });
  it('rejects expired, inactive and not-yet-live coupons', () => {
    expect(evaluateCoupon({ ...base, expiresAt: new Date('2026-09-01') }, ctx)).toMatchObject({ reason: 'EXPIRED' });
    expect(evaluateCoupon({ ...base, isActive: false }, ctx)).toMatchObject({ reason: 'INACTIVE' });
    expect(evaluateCoupon({ ...base, startsAt: new Date('2026-10-01') }, ctx)).toMatchObject({ reason: 'NOT_STARTED' });
  });
  it('enforces global and per-user limits', () => {
    expect(evaluateCoupon({ ...base, usageLimit: 10, usedCount: 10 }, ctx)).toMatchObject({ reason: 'USAGE_LIMIT' });
    expect(evaluateCoupon({ ...base, perUserLimit: 1 }, { ...ctx, userRedemptions: 1 })).toMatchObject({ reason: 'USER_LIMIT' });
  });
  it('enforces first-order, restaurant and user targeting', () => {
    expect(evaluateCoupon({ ...base, firstOrderOnly: true }, ctx)).toMatchObject({ reason: 'FIRST_ORDER_ONLY' });
    expect(evaluateCoupon({ ...base, firstOrderOnly: true }, { ...ctx, userSuccessfulOrders: 0 })).toMatchObject({ ok: true });
    expect(evaluateCoupon({ ...base, restaurantIds: ['r2'] }, ctx)).toMatchObject({ reason: 'WRONG_RESTAURANT' });
    expect(evaluateCoupon({ ...base, userIds: ['u9'] }, ctx)).toMatchObject({ reason: 'NOT_ELIGIBLE' });
  });
  it('describes coupons in plain language', () => {
    expect(describeCoupon(base)).toBe('50% off up to ₹100 on orders above ₹199');
  });
});
