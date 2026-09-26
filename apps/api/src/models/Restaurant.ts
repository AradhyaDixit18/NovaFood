import { Schema, type Types, model } from 'mongoose';
import { CUISINES, type Cuisine, RESTAURANT_STATUSES, type RestaurantStatus, WEEKDAYS, type Weekday } from '@novafood/shared';

export interface IRestaurant {
  name: string;
  slug: string;
  description: string;
  cuisines: Cuisine[];
  address: { line1: string; area: string; city: string; pincode: string };
  location?: { lat?: number; lng?: number } | null;
  phone?: string | null;
  pureVeg: boolean;
  costForTwoPaise: number;
  deliveryTimeMins: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  openingHours: { day: Weekday; open: string; close: string }[];
  offerText?: string | null;
  policies?: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  art: { kind: string; hue: number };
  rating: number;
  ratingCount: number;
  orderCount: number;
  status: RestaurantStatus;
  isAcceptingOrders: boolean;
  ownerIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type RestaurantLean = IRestaurant & { _id: Types.ObjectId };

const restaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    cuisines: { type: [{ type: String, enum: CUISINES }], required: true, index: true },
    address: {
      line1: { type: String, required: true },
      area: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    location: { lat: Number, lng: Number },
    phone: String,
    pureVeg: { type: Boolean, default: false },
    costForTwoPaise: { type: Number, required: true, min: 0 },
    deliveryTimeMins: { type: Number, required: true, min: 5 },
    deliveryFeePaise: { type: Number, required: true, min: 0 },
    freeDeliveryAbovePaise: { type: Number, default: null },
    minOrderPaise: { type: Number, default: 0, min: 0 },
    openingHours: {
      type: [
        {
          _id: false,
          day: { type: String, enum: WEEKDAYS, required: true },
          open: { type: String, required: true },
          close: { type: String, required: true },
        },
      ],
      default: [],
    },
    offerText: String,
    policies: String,
    logoUrl: { type: String, default: null },
    coverUrl: { type: String, default: null },
    art: {
      kind: { type: String, default: 'bowl' },
      hue: { type: Number, default: 20 },
    },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    status: { type: String, enum: RESTAURANT_STATUSES, default: 'PENDING', index: true },
    isAcceptingOrders: { type: Boolean, default: true },
    ownerIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [], index: true },
  },
  { timestamps: true },
);

export const Restaurant = model<IRestaurant>('Restaurant', restaurantSchema);
