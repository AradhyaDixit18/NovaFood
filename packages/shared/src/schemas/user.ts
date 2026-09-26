import { z } from 'zod';
import { CUISINES, DIET_TAGS } from '../constants';
import { phone, trimmed } from './common';

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  line1: z.string().trim().min(3, 'Enter house / flat and street').max(120),
  line2: trimmed(120).optional(),
  landmark: trimmed(80).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
  phone: phone.optional(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const notificationPrefsSchema = z.object({
  orderUpdates: z.boolean(),
  offers: z.boolean(),
  recommendations: z.boolean(),
  email: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const privacySchema = z.object({
  /** Use order history to personalise recommendations. */
  personalizedRecommendations: z.boolean(),
  /** Allow share cards to show your first name. */
  showNameOnShareCards: z.boolean(),
});
export type PrivacySettings = z.infer<typeof privacySchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  phone: phone.nullable().optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  dietaryPreferences: z.array(z.enum(DIET_TAGS)).max(DIET_TAGS.length).optional(),
  vegetarianOnly: z.boolean().optional(),
  favoriteCuisines: z.array(z.enum(CUISINES)).max(CUISINES.length).optional(),
  notificationPrefs: notificationPrefsSchema.partial().optional(),
  privacy: privacySchema.partial().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
