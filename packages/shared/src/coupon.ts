/**
 * Coupon evaluation, kept pure so every rule is unit-testable. The API supplies the
 * database facts (usage counts, prior orders) and applies the result atomically.
 */

export type CouponType = 'PERCENT' | 'FLAT';

export interface CouponRule {
  code: string;
  type: CouponType;
  /** Percent (1–100) for PERCENT coupons, paise for FLAT coupons. */
  value: number;
  minOrderPaise: number;
  maxDiscountPaise?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  isActive: boolean;
  usageLimit?: number | null;
  usedCount: number;
  perUserLimit?: number | null;
  firstOrderOnly: boolean;
  restaurantIds?: string[];
  userIds?: string[];
}

export interface CouponContext {
  now: Date;
  subtotalPaise: number;
  restaurantId: string;
  userId: string;
  /** How many times this user already redeemed this coupon. */
  userRedemptions: number;
  /** Orders this user has placed that were not cancelled or failed. */
  userSuccessfulOrders: number;
}

export type CouponRejection =
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'MIN_ORDER'
  | 'USAGE_LIMIT'
  | 'USER_LIMIT'
  | 'FIRST_ORDER_ONLY'
  | 'WRONG_RESTAURANT'
  | 'NOT_ELIGIBLE';

export type CouponResult =
  | { ok: true; discountPaise: number }
  | { ok: false; reason: CouponRejection; message: string };

const rupees = (paise: number) => `₹${Math.round(paise / 100)}`;

export function evaluateCoupon(coupon: CouponRule, ctx: CouponContext): CouponResult {
  const reject = (reason: CouponRejection, message: string): CouponResult => ({ ok: false, reason, message });

  if (!coupon.isActive) return reject('INACTIVE', 'This coupon is no longer active.');
  if (coupon.startsAt && ctx.now < coupon.startsAt) return reject('NOT_STARTED', 'This coupon is not live yet.');
  if (coupon.expiresAt && ctx.now > coupon.expiresAt) return reject('EXPIRED', 'This coupon has expired.');
  if (coupon.userIds && coupon.userIds.length > 0 && !coupon.userIds.includes(ctx.userId)) {
    return reject('NOT_ELIGIBLE', 'This coupon is not available on your account.');
  }
  if (coupon.restaurantIds && coupon.restaurantIds.length > 0 && !coupon.restaurantIds.includes(ctx.restaurantId)) {
    return reject('WRONG_RESTAURANT', 'This coupon does not apply to this restaurant.');
  }
  if (coupon.firstOrderOnly && ctx.userSuccessfulOrders > 0) {
    return reject('FIRST_ORDER_ONLY', 'This coupon is only valid on your first order.');
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return reject('USAGE_LIMIT', 'This coupon has been fully claimed.');
  }
  if (coupon.perUserLimit != null && ctx.userRedemptions >= coupon.perUserLimit) {
    return reject('USER_LIMIT', 'You have already used this coupon.');
  }
  if (ctx.subtotalPaise < coupon.minOrderPaise) {
    return reject('MIN_ORDER', `Add ${rupees(coupon.minOrderPaise - ctx.subtotalPaise)} more to use this coupon.`);
  }

  let discount =
    coupon.type === 'PERCENT' ? Math.floor((ctx.subtotalPaise * coupon.value) / 100) : Math.round(coupon.value);
  if (coupon.maxDiscountPaise != null) discount = Math.min(discount, coupon.maxDiscountPaise);
  discount = Math.max(0, Math.min(discount, ctx.subtotalPaise));

  return { ok: true, discountPaise: discount };
}

export function describeCoupon(coupon: Pick<CouponRule, 'type' | 'value' | 'maxDiscountPaise' | 'minOrderPaise'>): string {
  const main =
    coupon.type === 'PERCENT'
      ? `${coupon.value}% off${coupon.maxDiscountPaise ? ` up to ${rupees(coupon.maxDiscountPaise)}` : ''}`
      : `${rupees(coupon.value)} off`;
  return coupon.minOrderPaise > 0 ? `${main} on orders above ${rupees(coupon.minOrderPaise)}` : main;
}
