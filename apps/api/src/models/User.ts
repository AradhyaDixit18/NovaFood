import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';
import { CUISINES, DIET_TAGS, ROLES } from '@novafood/shared';

const addressSchema = new Schema(
  {
    label: { type: String, required: true, default: 'Home' },
    line1: { type: String, required: true },
    line2: String,
    landmark: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: String,
    location: { lat: Number, lng: Number },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    phone: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    addresses: { type: [addressSchema], default: [] },
    dietaryPreferences: { type: [{ type: String, enum: DIET_TAGS }], default: [] },
    vegetarianOnly: { type: Boolean, default: false },
    favoriteCuisines: { type: [{ type: String, enum: CUISINES }], default: [] },
    notificationPrefs: {
      orderUpdates: { type: Boolean, default: true },
      offers: { type: Boolean, default: true },
      recommendations: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    privacy: {
      personalizedRecommendations: { type: Boolean, default: true },
      showNameOnShareCards: { type: Boolean, default: true },
    },
    pointsBalance: { type: Number, default: 0, min: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
