import { describe, expect, it } from 'vitest';
import { computeUnitPrice, maxRedeemablePoints, pointsEarnedFor, priceOrder } from '../src/pricing';

describe('computeUnitPrice', () => {
  it('uses the variant price instead of the base price and adds add-ons', () => {
    expect(computeUnitPrice(19900, 24900, [3000, 2000])).toBe(29900);
  });
  it('falls back to the base price without a variant', () => {
    expect(computeUnitPrice(19900, null, [])).toBe(19900);
  });
  it('rejects fractional paise', () => {
    expect(() => computeUnitPrice(199.5, null, [])).toThrow(RangeError);
  });
});

describe('priceOrder', () => {
  it('computes a full breakdown in integer paise', () => {
    const result = priceOrder({
      lines: [
        { unitPricePaise: 24900, quantity: 2 },
        { unitPricePaise: 9900, quantity: 1 },
      ],
      deliveryFeePaise: 3900,
      couponDiscountPaise: 5000,
    });
    expect(result.itemsSubtotalPaise).toBe(59700);
    expect(result.couponDiscountPaise).toBe(5000);
    expect(result.taxablePaise).toBe(54700);
    expect(result.gstPaise).toBe(2735);
    expect(result.deliveryFeePaise).toBe(3900);
    expect(result.platformFeePaise).toBe(500);
    expect(result.totalPaise).toBe(54700 + 2735 + 3900 + 500);
  });

  it('waives delivery above the free-delivery threshold', () => {
    const result = priceOrder({ lines: [{ unitPricePaise: 50000, quantity: 1 }], deliveryFeePaise: 3900, freeDeliveryAbovePaise: 49900 });
    expect(result.deliveryFeePaise).toBe(0);
  });

  it('never lets a coupon exceed the subtotal', () => {
    const result = priceOrder({ lines: [{ unitPricePaise: 10000, quantity: 1 }], deliveryFeePaise: 0, couponDiscountPaise: 999999 });
    expect(result.couponDiscountPaise).toBe(10000);
    expect(result.taxablePaise).toBe(0);
  });

  it('charges nothing for an empty cart', () => {
    const result = priceOrder({ lines: [], deliveryFeePaise: 3900 });
    expect(result.totalPaise).toBe(0);
  });

  it('clamps redeemed points to 20% of food value and the balance', () => {
    const result = priceOrder({
      lines: [{ unitPricePaise: 50000, quantity: 1 }],
      deliveryFeePaise: 0,
      pointsToRedeem: 500,
      pointsBalance: 500,
    });
    expect(result.pointsRedeemed).toBe(100);
    expect(result.pointsDiscountPaise).toBe(10000);
  });
});

describe('loyalty helpers', () => {
  it('requires the minimum redemption', () => {
    expect(maxRedeemablePoints(5000, 1000)).toBe(0);
    expect(maxRedeemablePoints(100000, 1000)).toBe(200);
  });
  it('earns a point per ₹20', () => {
    expect(pointsEarnedFor(59900)).toBe(29);
  });
});
