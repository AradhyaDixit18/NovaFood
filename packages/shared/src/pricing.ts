import { LOYALTY, PRICING } from './constants';

/**
 * Pure pricing functions. The API calls them with prices read from the database, which
 * makes the server the only authority on what an order costs. The web app calls the same
 * functions to preview totals, so the two can never disagree about the formula.
 */

export interface PricedLine {
  unitPricePaise: number;
  quantity: number;
}

export interface PricingInput {
  lines: PricedLine[];
  deliveryFeePaise: number;
  /** Delivery becomes free when the food subtotal reaches this amount. */
  freeDeliveryAbovePaise?: number | null;
  couponDiscountPaise?: number;
  /** Points the customer wants to spend. Clamped to what is allowed. */
  pointsToRedeem?: number;
  pointsBalance?: number;
}

export interface PriceBreakdown {
  itemsSubtotalPaise: number;
  couponDiscountPaise: number;
  pointsRedeemed: number;
  pointsDiscountPaise: number;
  deliveryFeePaise: number;
  platformFeePaise: number;
  taxablePaise: number;
  gstPaise: number;
  totalPaise: number;
}

function assertNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (paise), received ${value}`);
  }
}

/** Unit price of a configured item: variant price (or base price) plus every selected add-on. */
export function computeUnitPrice(basePricePaise: number, variantPricePaise: number | null, addOnPricesPaise: number[]): number {
  const base = variantPricePaise ?? basePricePaise;
  assertNonNegativeInt(base, 'base price');
  return addOnPricesPaise.reduce((sum, price) => {
    assertNonNegativeInt(price, 'add-on price');
    return sum + price;
  }, base);
}

export function itemsSubtotal(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => {
    assertNonNegativeInt(line.unitPricePaise, 'unit price');
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError(`quantity must be a positive integer, received ${line.quantity}`);
    }
    return sum + line.unitPricePaise * line.quantity;
  }, 0);
}

/** Largest number of points that may be spent on a food value (after coupons). */
export function maxRedeemablePoints(foodValuePaise: number, pointsBalance: number): number {
  const cap = Math.floor((foodValuePaise * LOYALTY.maxRedeemRatio) / LOYALTY.pointValuePaise);
  const allowed = Math.max(0, Math.min(cap, Math.floor(pointsBalance)));
  return allowed >= LOYALTY.minRedeemPoints ? allowed : 0;
}

export function pointsEarnedFor(foodValuePaise: number): number {
  return Math.max(0, Math.floor(foodValuePaise / LOYALTY.paisePerPointEarned));
}

export function priceOrder(input: PricingInput): PriceBreakdown {
  const itemsSubtotalPaise = itemsSubtotal(input.lines);
  assertNonNegativeInt(input.deliveryFeePaise, 'delivery fee');

  const couponDiscountPaise = Math.min(Math.max(0, Math.round(input.couponDiscountPaise ?? 0)), itemsSubtotalPaise);
  const afterCoupon = itemsSubtotalPaise - couponDiscountPaise;

  const requestedPoints = Math.max(0, Math.floor(input.pointsToRedeem ?? 0));
  const pointsRedeemed = requestedPoints > 0 ? Math.min(requestedPoints, maxRedeemablePoints(afterCoupon, input.pointsBalance ?? requestedPoints)) : 0;
  const pointsDiscountPaise = pointsRedeemed * LOYALTY.pointValuePaise;

  const taxablePaise = afterCoupon - pointsDiscountPaise;
  const gstPaise = Math.round(taxablePaise * PRICING.gstRate);

  const freeDelivery = input.freeDeliveryAbovePaise != null && itemsSubtotalPaise >= input.freeDeliveryAbovePaise;
  const deliveryFeePaise = itemsSubtotalPaise === 0 || freeDelivery ? 0 : input.deliveryFeePaise;
  const platformFeePaise = itemsSubtotalPaise === 0 ? 0 : PRICING.platformFeePaise;

  return {
    itemsSubtotalPaise,
    couponDiscountPaise,
    pointsRedeemed,
    pointsDiscountPaise,
    deliveryFeePaise,
    platformFeePaise,
    taxablePaise,
    gstPaise,
    totalPaise: taxablePaise + gstPaise + deliveryFeePaise + platformFeePaise,
  };
}
