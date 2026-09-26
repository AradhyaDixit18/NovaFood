import { Schema, type Types, model } from 'mongoose';
import { supportsTtlIndexes } from './compat';
import { NOTIFICATION_TYPES, REVIEW_STATUSES, type ReviewStatus } from '@novafood/shared';

export interface ICoupon {
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  firstOrderOnly: boolean;
  restaurantIds: Types.ObjectId[];
  userIds: Types.ObjectId[];
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
export type CouponLean = ICoupon & { _id: Types.ObjectId };

export interface IReview {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  restaurantId: Types.ObjectId;
  foodId: Types.ObjectId | null;
  foodName: string | null;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  helpfulBy: Types.ObjectId[];
  helpfulCount: number;
  moderatedBy: Types.ObjectId | null;
  moderationNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export type ReviewLean = IReview & { _id: Types.ObjectId };

/* ---------------------------------- Coupons ---------------------------------- */

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['PERCENT', 'FLAT'], required: true },
    value: { type: Number, required: true, min: 1 },
    minOrderPaise: { type: Number, default: 0 },
    maxDiscountPaise: { type: Number, default: null },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: null },
    firstOrderOnly: { type: Boolean, default: false },
    restaurantIds: { type: [Schema.Types.ObjectId], default: [] },
    userIds: { type: [Schema.Types.ObjectId], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const Coupon = model<ICoupon>('Coupon', couponSchema);

const redemptionSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  },
  { timestamps: true },
);
redemptionSchema.index({ couponId: 1, userId: 1 });
export const CouponRedemption = model('CouponRedemption', redemptionSchema);

/* ---------------------------------- Reviews ---------------------------------- */

const reviewSchema = new Schema<IReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    /** null for the restaurant-level review of an order. */
    foodId: { type: Schema.Types.ObjectId, ref: 'FoodItem', default: null },
    foodName: { type: String, default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
    status: { type: String, enum: REVIEW_STATUSES, default: 'PUBLISHED' },
    helpfulBy: { type: [Schema.Types.ObjectId], default: [] },
    helpfulCount: { type: Number, default: 0 },
    moderatedBy: { type: Schema.Types.ObjectId, default: null },
    moderationNote: String,
  },
  { timestamps: true },
);
reviewSchema.index({ orderId: 1, foodId: 1 }, { unique: true });
reviewSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ foodId: 1, status: 1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
export const Review = model<IReview>('Review', reviewSchema);

/* --------------------------------- Favorites --------------------------------- */

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['restaurant', 'food'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
favoriteSchema.index({ userId: 1, kind: 1, targetId: 1 }, { unique: true });
export const Favorite = model('Favorite', favoriteSchema);

/* ------------------------------- Notifications ------------------------------- */

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
export const Notification = model('Notification', notificationSchema);

/* ------------------------------- Nova Points -------------------------------- */

const pointsEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['EARN', 'REDEEM', 'REVERSE', 'BONUS'], required: true },
    /** Signed: positive when credited, negative when spent. */
    points: { type: Number, required: true },
    description: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true },
);
pointsEntrySchema.index({ userId: 1, createdAt: -1 });
pointsEntrySchema.index({ orderId: 1, type: 1 });
export const PointsEntry = model('PointsEntry', pointsEntrySchema);

/* ------------------------------ Search analytics ----------------------------- */

const searchEventSchema = new Schema(
  {
    term: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, default: null },
    results: { type: Number, default: 0 },
  },
  { timestamps: true },
);
if (supportsTtlIndexes) searchEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
else searchEventSchema.index({ createdAt: 1 });
searchEventSchema.index({ term: 1 });
export const SearchEvent = model('SearchEvent', searchEventSchema);

/* ------------------------------ Payment events ------------------------------- */

/** Every processed webhook event, so a retried delivery is a no-op. */
const paymentEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    providerOrderId: String,
    payload: Schema.Types.Mixed,
  },
  { timestamps: true },
);
export const PaymentEvent = model('PaymentEvent', paymentEventSchema);

/* --------------------------------- Audit log --------------------------------- */

const auditSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: true },
);
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
export const AuditLog = model('AuditLog', auditSchema);
