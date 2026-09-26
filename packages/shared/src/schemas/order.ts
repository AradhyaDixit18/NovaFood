import { z } from 'zod';
import { CART_LIMITS, PAYMENT_METHODS } from '../constants';
import { ORDER_STATUSES } from '../orderStatus';
import { objectId, paginationQuery, phone, trimmed } from './common';

export const addToCartSchema = z.object({
  foodId: objectId,
  variantId: z.string().max(40).nullable().optional(),
  addOnIds: z.array(z.string().max(40)).max(30).default([]),
  quantity: z.number().int().min(1).max(CART_LIMITS.maxLineQuantity).default(1),
  note: trimmed(CART_LIMITS.maxNoteLength).optional(),
  /** Explicitly discard a cart from another restaurant. Without it the API returns 409. */
  replaceCart: z.boolean().default(false),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartLineSchema = z
  .object({
    quantity: z.number().int().min(0).max(CART_LIMITS.maxLineQuantity).optional(),
    note: trimmed(CART_LIMITS.maxNoteLength).optional(),
  })
  .refine((v) => v.quantity !== undefined || v.note !== undefined, { message: 'Nothing to update' });

export const applyCouponSchema = z.object({ code: z.string().trim().toUpperCase().min(3).max(20) });

export const cartOptionsSchema = z.object({ usePoints: z.boolean() });

/** A guest cart kept in the browser, merged into the account cart after login. */
export const mergeCartSchema = z.object({
  lines: z.array(addToCartSchema.omit({ replaceCart: true })).max(CART_LIMITS.maxLines),
});

export const checkoutSchema = z.object({
  addressId: objectId,
  paymentMethod: z.enum(PAYMENT_METHODS),
  contactPhone: phone,
  deliveryInstructions: trimmed(200).optional(),
  /** Client-generated key so a double-tap or retry never creates two orders. */
  idempotencyKey: z.string().uuid(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(5).max(80),
  razorpayPaymentId: z.string().min(5).max(80),
  razorpaySignature: z.string().min(10).max(200),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  reason: trimmed(200).optional(),
});

export const cancelOrderSchema = z.object({ reason: trimmed(200).optional() });

export const orderListQuerySchema = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  active: z.enum(['true', 'false']).optional(),
  q: trimmed(40).optional(),
});

export const createReviewSchema = z.object({
  orderId: objectId,
  rating: z.number().int().min(1).max(5),
  comment: trimmed(600).optional(),
  dishes: z
    .array(z.object({ foodId: objectId, rating: z.number().int().min(1).max(5), comment: trimmed(300).optional() }))
    .max(20)
    .default([]),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const couponInputSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Use 3–20 letters or numbers'),
    description: trimmed(120).optional(),
    type: z.enum(['PERCENT', 'FLAT']),
    value: z.number().int().min(1),
    minOrderPaise: z.number().int().min(0).default(0),
    maxDiscountPaise: z.number().int().min(0).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    usageLimit: z.number().int().min(1).nullable().optional(),
    perUserLimit: z.number().int().min(1).nullable().optional(),
    firstOrderOnly: z.boolean().default(false),
    restaurantIds: z.array(objectId).max(50).default([]),
    userIds: z.array(objectId).max(500).default([]),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== 'PERCENT' || c.value <= 100, { message: 'Percent must be 100 or less', path: ['value'] })
  .refine((c) => !c.startsAt || !c.expiresAt || c.startsAt < c.expiresAt, {
    message: 'Expiry must be after start',
    path: ['expiresAt'],
  });
export type CouponInput = z.infer<typeof couponInputSchema>;
