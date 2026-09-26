/**
 * Business constants. Every monetary value in NovaFood is an integer number of paise
 * (1 rupee = 100 paise) so totals never suffer from floating-point drift.
 */

export const CURRENCY = 'INR' as const;
export const TIMEZONE = 'Asia/Kolkata' as const;

export const ROLES = ['customer', 'partner', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PRICING = {
  /** Flat platform fee charged per order. */
  platformFeePaise: 500,
  /** GST on restaurant food (5% for non-AC / delivery-only restaurants). */
  gstRate: 0.05,
} as const;

export const LOYALTY = {
  /** Customers earn one Nova Point for every ₹20 of food value on a delivered order. */
  paisePerPointEarned: 2000,
  /** One point is worth ₹1 at checkout. */
  pointValuePaise: 100,
  /** Points can cover at most 20% of the food value after coupons. */
  maxRedeemRatio: 0.2,
  /** Smallest redemption allowed. */
  minRedeemPoints: 20,
} as const;

export const CART_LIMITS = {
  maxLineQuantity: 20,
  maxLines: 30,
  maxNoteLength: 140,
} as const;

export const PAGINATION = {
  defaultLimit: 12,
  maxLimit: 50,
} as const;

export const PAYMENT_METHODS = ['COD', 'RAZORPAY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DIET_TAGS = ['vegan', 'jain', 'gluten-free', 'high-protein', 'keto', 'dairy-free'] as const;
export type DietTag = (typeof DIET_TAGS)[number];

export const ALLERGENS = ['gluten', 'dairy', 'nuts', 'peanuts', 'soy', 'egg', 'shellfish', 'fish', 'sesame'] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Flavour and occasion tags used by search, mood discovery and recommendations. */
export const FOOD_TAGS = [
  'spicy',
  'crunchy',
  'creamy',
  'comfort',
  'home-style',
  'light',
  'healthy',
  'high-protein',
  'dessert',
  'beverage',
  'snack',
  'shareable',
  'combo',
  'one-bowl',
  'street-food',
  'breakfast',
  'late-night',
] as const;
export type FoodTag = (typeof FOOD_TAGS)[number];

export const CUISINES = [
  'North Indian',
  'South Indian',
  'Biryani',
  'Chinese',
  'Italian',
  'Pizza',
  'Burgers',
  'Street Food',
  'Healthy',
  'Desserts',
  'Beverages',
  'Mexican',
  'Korean',
  'Momos',
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const RESTAURANT_STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED'] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const REVIEW_STATUSES = ['PUBLISHED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const NOTIFICATION_TYPES = ['ORDER', 'PAYMENT', 'OFFER', 'RESTAURANT', 'SYSTEM', 'REWARD'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
