import { z } from 'zod';
import { ALLERGENS, CUISINES, DIET_TAGS, FOOD_TAGS } from '../constants';
import { MOOD_IDS } from '../moods';
import { WEEKDAYS } from '../time';
import { paginationQuery, queryBoolean, queryList, trimmed } from './common';

const paise = z.number().int().min(0).max(10_000_000);

export const RESTAURANT_SORTS = ['relevance', 'rating', 'deliveryTime', 'costLow', 'costHigh', 'popularity'] as const;
export type RestaurantSort = (typeof RESTAURANT_SORTS)[number];

export const restaurantQuerySchema = paginationQuery.extend({
  q: trimmed(80).optional(),
  cuisine: queryList.optional(),
  pureVeg: queryBoolean.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxDeliveryTime: z.coerce.number().int().min(5).max(180).optional(),
  maxCostForTwo: z.coerce.number().int().min(0).optional(),
  hasOffers: queryBoolean.optional(),
  openNow: queryBoolean.optional(),
  sort: z.enum(RESTAURANT_SORTS).default('relevance'),
});
export type RestaurantQuery = z.infer<typeof restaurantQuerySchema>;

export const FOOD_SORTS = ['relevance', 'rating', 'priceLow', 'priceHigh', 'popularity'] as const;

export const foodQuerySchema = paginationQuery.extend({
  q: trimmed(80).optional(),
  veg: queryBoolean.optional(),
  diet: queryList.optional(),
  tags: queryList.optional(),
  cuisine: queryList.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  mood: z.enum(MOOD_IDS).optional(),
  sort: z.enum(FOOD_SORTS).default('relevance'),
});
export type FoodQuery = z.infer<typeof foodQuerySchema>;

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });

export const openingWindowSchema = z.object({
  day: z.enum(WEEKDAYS),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const artSchema = z.object({
  kind: z.string().max(30),
  hue: z.number().int().min(0).max(360),
});

export const restaurantInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(500),
  cuisines: z.array(z.enum(CUISINES)).min(1).max(5),
  address: z.object({
    line1: z.string().trim().min(3).max(120),
    area: z.string().trim().min(2).max(60),
    city: z.string().trim().min(2).max(60),
    pincode: z.string().regex(/^[1-9]\d{5}$/),
  }),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  pureVeg: z.boolean().default(false),
  costForTwoPaise: paise,
  deliveryTimeMins: z.number().int().min(10).max(120),
  deliveryFeePaise: paise,
  freeDeliveryAbovePaise: paise.nullable().optional(),
  minOrderPaise: paise.default(0),
  openingHours: z.array(openingWindowSchema).min(1).max(21),
  offerText: trimmed(80).optional(),
  policies: trimmed(600).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
  art: artSchema.optional(),
});
export type RestaurantInput = z.infer<typeof restaurantInputSchema>;

export const restaurantUpdateSchema = restaurantInputSchema.partial().extend({
  isAcceptingOrders: z.boolean().optional(),
});

const optionSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  pricePaise: paise,
  isVeg: z.boolean().default(true),
});

export const addOnGroupSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    minSelect: z.number().int().min(0).max(10).default(0),
    maxSelect: z.number().int().min(1).max(10).default(1),
    options: z.array(optionSchema).min(1).max(15),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: 'minSelect cannot exceed maxSelect' });

export const variantSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  pricePaise: paise,
});

export const foodInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(400),
  section: z.string().trim().min(2).max(40),
  cuisine: z.enum(CUISINES),
  pricePaise: paise.refine((v) => v > 0, 'Price must be above zero'),
  compareAtPricePaise: paise.nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  art: artSchema.optional(),
  isVeg: z.boolean(),
  dietTags: z.array(z.enum(DIET_TAGS)).default([]),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  tags: z.array(z.enum(FOOD_TAGS)).default([]),
  spiceLevel: z.number().int().min(0).max(3).default(0),
  ingredients: z.array(z.string().trim().min(1).max(40)).max(25).default([]),
  nutrition: z
    .object({
      calories: z.number().int().min(0).max(5000),
      proteinG: z.number().min(0).max(500),
      carbsG: z.number().min(0).max(1000),
      fatG: z.number().min(0).max(500),
    })
    .nullable()
    .optional(),
  variants: z.array(variantSchema).max(6).default([]),
  addOnGroups: z.array(addOnGroupSchema).max(6).default([]),
  isAvailable: z.boolean().default(true),
  isBestseller: z.boolean().default(false),
});
export type FoodInput = z.infer<typeof foodInputSchema>;

export const foodUpdateSchema = foodInputSchema.partial();
