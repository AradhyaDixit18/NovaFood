import { Schema, type Types, model } from 'mongoose';
import { ALLERGENS, type Allergen, CUISINES, type Cuisine, DIET_TAGS, type DietTag, FOOD_TAGS, type FoodTag } from '@novafood/shared';

export interface IAddOnOption {
  _id: Types.ObjectId;
  name: string;
  pricePaise: number;
  isVeg: boolean;
}

export interface IAddOnGroup {
  _id: Types.ObjectId;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: IAddOnOption[];
}

export interface IVariant {
  _id: Types.ObjectId;
  name: string;
  pricePaise: number;
}

export interface IFoodItem {
  restaurantId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  section: string;
  cuisine: Cuisine;
  pricePaise: number;
  compareAtPricePaise: number | null;
  imageUrl: string | null;
  art: { kind: string; hue: number };
  isVeg: boolean;
  dietTags: DietTag[];
  allergens: Allergen[];
  tags: FoodTag[];
  spiceLevel: number;
  ingredients: string[];
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  variants: IVariant[];
  addOnGroups: IAddOnGroup[];
  isAvailable: boolean;
  isBestseller: boolean;
  /** Soft delete keeps past orders and reviews pointing at a real document. */
  isDeleted: boolean;
  rating: number;
  ratingCount: number;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FoodLean = IFoodItem & { _id: Types.ObjectId };

const optionSchema = new Schema<IAddOnOption>({
  name: { type: String, required: true },
  pricePaise: { type: Number, required: true, min: 0 },
  isVeg: { type: Boolean, default: true },
});

const addOnGroupSchema = new Schema<IAddOnGroup>({
  name: { type: String, required: true },
  minSelect: { type: Number, default: 0 },
  maxSelect: { type: Number, default: 1 },
  options: { type: [optionSchema], default: [] },
});

const variantSchema = new Schema<IVariant>({
  name: { type: String, required: true },
  pricePaise: { type: Number, required: true, min: 0 },
});

const foodSchema = new Schema<IFoodItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    section: { type: String, required: true },
    cuisine: { type: String, enum: CUISINES, required: true, index: true },
    pricePaise: { type: Number, required: true, min: 1 },
    compareAtPricePaise: { type: Number, default: null },
    imageUrl: { type: String, default: null },
    art: {
      kind: { type: String, default: 'bowl' },
      hue: { type: Number, default: 20 },
    },
    isVeg: { type: Boolean, required: true },
    dietTags: { type: [{ type: String, enum: DIET_TAGS }], default: [] },
    allergens: { type: [{ type: String, enum: ALLERGENS }], default: [] },
    tags: { type: [{ type: String, enum: FOOD_TAGS }], default: [], index: true },
    spiceLevel: { type: Number, default: 0, min: 0, max: 3 },
    ingredients: { type: [String], default: [] },
    nutrition: {
      type: new Schema({ calories: Number, proteinG: Number, carbsG: Number, fatG: Number }, { _id: false }),
      default: null,
    },
    variants: { type: [variantSchema], default: [] },
    addOnGroups: { type: [addOnGroupSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    isBestseller: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

foodSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
foodSchema.index({ restaurantId: 1, section: 1 });

export const FoodItem = model<IFoodItem>('FoodItem', foodSchema);
