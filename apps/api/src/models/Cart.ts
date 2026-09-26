import { type HydratedDocument, type Model, Schema, type Types, model } from 'mongoose';

export interface ICartLine {
  _id: Types.ObjectId;
  foodId: Types.ObjectId;
  variantId: string | null;
  addOnIds: string[];
  quantity: number;
  note?: string | null;
  /** Identifies an exact configuration, so adding the same thing twice bumps the quantity. */
  key: string;
}

export interface ICart {
  userId: Types.ObjectId;
  restaurantId: Types.ObjectId | null;
  lines: ICartLine[];
  couponCode: string | null;
  usePoints: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CartLean = ICart & { _id: Types.ObjectId };
type CartHydrated = HydratedDocument<ICart, { lines: Types.DocumentArray<ICartLine> }>;

const cartLineSchema = new Schema<ICartLine>({
  foodId: { type: Schema.Types.ObjectId, ref: 'FoodItem', required: true },
  variantId: { type: String, default: null },
  addOnIds: { type: [String], default: [] },
  quantity: { type: Number, required: true, min: 1 },
  note: String,
  key: { type: String, required: true },
});

const cartSchema = new Schema<ICart, Model<ICart, object, object, object, CartHydrated>>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', default: null },
    lines: { type: [cartLineSchema], default: [] },
    couponCode: { type: String, default: null },
    usePoints: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Cart = model<ICart, Model<ICart, object, object, object, CartHydrated>>('Cart', cartSchema);
