import { Schema, type Types, model } from 'mongoose';
import {
  ORDER_STATUSES,
  type OrderActor,
  type OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
  type PriceBreakdown,
} from '@novafood/shared';

export interface IOrderLine {
  foodId: Types.ObjectId;
  name: string;
  isVeg: boolean;
  cuisine?: string | null;
  art: { kind: string; hue: number };
  variantId: string | null;
  variantName: string | null;
  addOnIds: string[];
  addOns: { name: string; pricePaise: number }[];
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  note?: string | null;
}

export interface IStatusEvent {
  status: OrderStatus;
  at: Date;
  by: OrderActor;
  byUserId: Types.ObjectId | null;
  note?: string | null;
}

export interface IOrder {
  orderNumber: string;
  userId: Types.ObjectId;
  customerName: string;
  contactPhone: string;
  restaurantId: Types.ObjectId;
  restaurantSnapshot: { name: string; slug: string; area: string; art: { kind: string; hue: number } };
  lines: IOrderLine[];
  pricing: PriceBreakdown;
  couponId: Types.ObjectId | null;
  couponCode: string | null;
  status: OrderStatus;
  statusHistory: IStatusEvent[];
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    provider: string | null;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    refundId: string | null;
    paidAt: Date | null;
    failureReason: string | null;
  };
  deliveryAddress: {
    label: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    pincode: string;
    phone?: string | null;
    location?: { lat?: number; lng?: number } | null;
  };
  deliveryInstructions?: string | null;
  estimatedDeliveryAt: Date | null;
  deliveredAt: Date | null;
  pointsEarned: number;
  reviewed: boolean;
  idempotencyKey: string;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderLean = IOrder & { _id: Types.ObjectId };

const orderLineSchema = new Schema<IOrderLine>(
  {
    foodId: { type: Schema.Types.ObjectId, ref: 'FoodItem', required: true },
    name: { type: String, required: true },
    isVeg: Boolean,
    cuisine: String,
    art: { kind: String, hue: Number },
    variantId: { type: String, default: null },
    variantName: { type: String, default: null },
    addOnIds: { type: [String], default: [] },
    addOns: { type: [{ _id: false, name: String, pricePaise: Number }], default: [] },
    quantity: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true },
    lineTotalPaise: { type: Number, required: true },
    note: String,
  },
  { _id: false },
);

const statusEventSchema = new Schema<IStatusEvent>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: String, enum: ['customer', 'partner', 'admin', 'system'], required: true },
    byUserId: { type: Schema.Types.ObjectId, default: null },
    note: String,
  },
  { _id: false },
);

const money = { type: Number, required: true, min: 0 };
const pricingSchema = new Schema<PriceBreakdown>(
  {
    itemsSubtotalPaise: money,
    couponDiscountPaise: money,
    pointsRedeemed: money,
    pointsDiscountPaise: money,
    deliveryFeePaise: money,
    platformFeePaise: money,
    taxablePaise: money,
    gstPaise: money,
    totalPaise: money,
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    restaurantSnapshot: { name: String, slug: String, area: String, art: { kind: String, hue: Number } },
    lines: { type: [orderLineSchema], required: true },
    pricing: { type: pricingSchema, required: true },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponCode: { type: String, default: null },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: PAYMENT_STATUSES, required: true },
      provider: { type: String, default: null },
      providerOrderId: { type: String, default: null },
      providerPaymentId: { type: String, default: null },
      refundId: { type: String, default: null },
      paidAt: { type: Date, default: null },
      failureReason: { type: String, default: null },
    },
    deliveryAddress: {
      label: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
      location: { lat: Number, lng: Number },
    },
    deliveryInstructions: String,
    estimatedDeliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    pointsEarned: { type: Number, default: 0 },
    reviewed: { type: Boolean, default: false },
    idempotencyKey: { type: String, required: true },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.providerOrderId': 1 });
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

export const Order = model<IOrder>('Order', orderSchema);
