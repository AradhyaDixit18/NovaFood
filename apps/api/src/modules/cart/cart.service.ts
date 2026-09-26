import { type Types } from 'mongoose';
import {
  type AddToCartInput,
  CART_LIMITS,
  type CartDTO,
  COPY,
  type CouponRule,
  computeUnitPrice,
  describeCoupon,
  evaluateCoupon,
  formatINR,
  pointsEarnedFor,
  priceOrder,
} from '@novafood/shared';
import type { AppContext } from '../../context';
import { AppError, badRequest, notFound, unprocessable } from '../../lib/errors';
import { Cart, type CartLean } from '../../models/Cart';
import { FoodItem, type FoodLean } from '../../models/FoodItem';
import { Order } from '../../models/Order';
import { Coupon, type CouponLean, CouponRedemption } from '../../models/misc';
import { Restaurant, type RestaurantLean } from '../../models/Restaurant';
import { User } from '../../models/User';
import { restaurantIsOpen } from '../../serializers';

/** Statuses that count as a "real" past order for first-order coupons. */
const SUCCESSFUL_ORDER_STATUSES = [
  'ORDER_PLACED',
  'RESTAURANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export interface ResolvedLine {
  lineId: string;
  food: FoodLean;
  variant: { _id: string; name: string; pricePaise: number } | null;
  addOns: { _id: string; name: string; pricePaise: number }[];
  quantity: number;
  note?: string;
  unitPricePaise: number;
  available: boolean;
}

export interface CartEvaluation {
  cart: CartLean | null;
  restaurant: RestaurantLean | null;
  lines: ResolvedLine[];
  coupon: CouponLean | null;
  couponDiscountPaise: number;
  couponError: string | null;
  pricing: ReturnType<typeof priceOrder>;
  blockers: string[];
  pointsBalance: number;
  dto: CartDTO;
}

const lineKey = (foodId: string, variantId: string | null | undefined, addOnIds: string[]) =>
  `${foodId}:${variantId ?? '-'}:${[...addOnIds].sort().join(',')}`;

/** Resolves the chosen variant and add-ons against the dish, enforcing each group's min/max. */
export function resolveSelection(food: FoodLean, variantId: string | null | undefined, addOnIds: string[]) {
  const variants = (food.variants ?? []) as unknown as { _id: Types.ObjectId; name: string; pricePaise: number }[];
  let variant: ResolvedLine['variant'] = null;
  if (variants.length > 0) {
    const found = variantId ? variants.find((v) => String(v._id) === variantId) : undefined;
    if (!found) throw badRequest(`Choose a size for ${food.name}.`);
    variant = { _id: String(found._id), name: found.name, pricePaise: found.pricePaise };
  } else if (variantId) {
    throw badRequest(`${food.name} has no size options.`);
  }

  const unique = [...new Set(addOnIds)];
  const addOns: ResolvedLine['addOns'] = [];
  const groups = (food.addOnGroups ?? []) as unknown as {
    _id: Types.ObjectId;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { _id: Types.ObjectId; name: string; pricePaise: number }[];
  }[];
  const matched = new Set<string>();
  for (const group of groups) {
    const picked = group.options.filter((o) => unique.includes(String(o._id)));
    if (picked.length < (group.minSelect ?? 0)) throw badRequest(`Pick at least ${group.minSelect} in "${group.name}".`);
    if (picked.length > (group.maxSelect ?? 1)) throw badRequest(`Pick at most ${group.maxSelect} in "${group.name}".`);
    for (const o of picked) {
      matched.add(String(o._id));
      addOns.push({ _id: String(o._id), name: o.name, pricePaise: o.pricePaise });
    }
  }
  if (matched.size !== unique.length) throw badRequest(`Some options are not available for ${food.name}.`);
  return { variant, addOns };
}

async function couponFacts(userId: string, couponId: Types.ObjectId) {
  const [userRedemptions, userSuccessfulOrders] = await Promise.all([
    CouponRedemption.countDocuments({ couponId, userId }),
    Order.countDocuments({ userId, status: { $in: SUCCESSFUL_ORDER_STATUSES } }),
  ]);
  return { userRedemptions, userSuccessfulOrders };
}

export function toCouponRule(c: CouponLean): CouponRule {
  return {
    code: c.code,
    type: c.type,
    value: c.value,
    minOrderPaise: c.minOrderPaise ?? 0,
    maxDiscountPaise: c.maxDiscountPaise ?? null,
    startsAt: c.startsAt ?? null,
    expiresAt: c.expiresAt ?? null,
    isActive: c.isActive,
    usageLimit: c.usageLimit ?? null,
    usedCount: c.usedCount ?? 0,
    perUserLimit: c.perUserLimit ?? null,
    firstOrderOnly: c.firstOrderOnly,
    restaurantIds: (c.restaurantIds ?? []).map(String),
    userIds: (c.userIds ?? []).map(String),
  };
}

export async function checkCoupon(ctx: AppContext, userId: string, coupon: CouponLean, restaurantId: string, subtotalPaise: number) {
  const facts = await couponFacts(userId, coupon._id);
  return evaluateCoupon(toCouponRule(coupon), { now: ctx.now(), subtotalPaise, restaurantId, userId, ...facts });
}

const emptyPricing = priceOrder({ lines: [], deliveryFeePaise: 0 });

/**
 * The single authority on what a cart contains and costs. Every price is read from the
 * database at evaluation time; nothing the client sends about money is trusted.
 */
export async function evaluateCart(ctx: AppContext, userId: string): Promise<CartEvaluation> {
  const [cart, user] = await Promise.all([Cart.findOne({ userId }).lean() as Promise<CartLean | null>, User.findById(userId).select('pointsBalance').lean()]);
  const pointsBalance = user?.pointsBalance ?? 0;

  if (!cart || cart.lines.length === 0 || !cart.restaurantId) {
    return {
      cart,
      restaurant: null,
      lines: [],
      coupon: null,
      couponDiscountPaise: 0,
      couponError: null,
      pricing: emptyPricing,
      blockers: [],
      pointsBalance,
      dto: {
        _id: cart ? String(cart._id) : null,
        restaurant: null,
        lines: [],
        itemCount: 0,
        coupon: null,
        couponError: null,
        usePoints: cart?.usePoints ?? false,
        pointsBalance,
        pricing: emptyPricing,
        blockers: [],
        pointsWillEarn: 0,
      },
    };
  }

  const now = ctx.now();
  const [restaurant, foods] = await Promise.all([
    Restaurant.findById(cart.restaurantId).lean() as Promise<RestaurantLean | null>,
    FoodItem.find({ _id: { $in: cart.lines.map((l) => l.foodId) } }).lean() as Promise<FoodLean[]>,
  ]);
  const foodById = new Map(foods.map((f) => [String(f._id), f]));

  const lines: ResolvedLine[] = [];
  for (const line of cart.lines) {
    const food = foodById.get(String(line.foodId));
    if (!food) continue; // hard-deleted: silently drop
    let available = !food.isDeleted && food.isAvailable;
    let variant: ResolvedLine['variant'] = null;
    let addOns: ResolvedLine['addOns'] = [];
    try {
      ({ variant, addOns } = resolveSelection(food, line.variantId, line.addOnIds ?? []));
    } catch {
      available = false; // the menu changed underneath this line
    }
    lines.push({
      lineId: String(line._id),
      food,
      variant,
      addOns,
      quantity: line.quantity,
      note: line.note ?? undefined,
      unitPricePaise: computeUnitPrice(food.pricePaise, variant?.pricePaise ?? null, addOns.map((a) => a.pricePaise)),
      available,
    });
  }

  const pricedLines = lines.filter((l) => l.available);
  const subtotal = pricedLines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0);

  let coupon: CouponLean | null = null;
  let couponDiscountPaise = 0;
  let couponError: string | null = null;
  if (cart.couponCode) {
    coupon = (await Coupon.findOne({ code: cart.couponCode }).lean()) as CouponLean | null;
    if (!coupon) couponError = 'This coupon no longer exists.';
    else {
      const result = await checkCoupon(ctx, userId, coupon, String(cart.restaurantId), subtotal);
      if (result.ok) couponDiscountPaise = result.discountPaise;
      else couponError = result.message;
    }
  }

  const pricing = priceOrder({
    lines: pricedLines.map((l) => ({ unitPricePaise: l.unitPricePaise, quantity: l.quantity })),
    deliveryFeePaise: restaurant?.deliveryFeePaise ?? 0,
    freeDeliveryAbovePaise: restaurant?.freeDeliveryAbovePaise ?? null,
    couponDiscountPaise,
    pointsToRedeem: cart.usePoints ? pointsBalance : 0,
    pointsBalance,
  });

  const blockers: string[] = [];
  if (!restaurant || restaurant.status !== 'APPROVED') blockers.push('This restaurant is not available right now.');
  else if (!restaurant.isAcceptingOrders) blockers.push(COPY.error.restaurantOffline);
  else if (!restaurantIsOpen(restaurant, now)) blockers.push(COPY.error.restaurantClosed);
  const unavailable = lines.filter((l) => !l.available);
  if (unavailable.length) blockers.push(`Remove unavailable items: ${unavailable.map((l) => l.food.name).join(', ')}.`);
  if (restaurant && subtotal < (restaurant.minOrderPaise ?? 0)) {
    blockers.push(`Minimum order is ${formatINR(restaurant.minOrderPaise)}. Add ${formatINR(restaurant.minOrderPaise - subtotal)} more.`);
  }
  if (couponError) blockers.push(`Coupon ${cart.couponCode}: ${couponError}`);

  const dto: CartDTO = {
    _id: String(cart._id),
    restaurant: restaurant
      ? {
          _id: String(restaurant._id),
          name: restaurant.name,
          slug: restaurant.slug,
          art: { kind: restaurant.art?.kind ?? 'bowl', hue: restaurant.art?.hue ?? 20 },
          isOpen: restaurantIsOpen(restaurant, now),
          isAcceptingOrders: restaurant.isAcceptingOrders,
          minOrderPaise: restaurant.minOrderPaise ?? 0,
          deliveryTimeMins: restaurant.deliveryTimeMins,
        }
      : null,
    lines: lines.map((l) => ({
      _id: l.lineId,
      foodId: String(l.food._id),
      name: l.food.name,
      isVeg: l.food.isVeg,
      art: { kind: l.food.art?.kind ?? 'bowl', hue: l.food.art?.hue ?? 20 },
      imageUrl: l.food.imageUrl ?? null,
      variant: l.variant ? { _id: l.variant._id, name: l.variant.name } : null,
      addOns: l.addOns,
      quantity: l.quantity,
      note: l.note,
      unitPricePaise: l.unitPricePaise,
      lineTotalPaise: l.unitPricePaise * l.quantity,
      available: l.available,
    })),
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    coupon:
      coupon && !couponError
        ? { code: coupon.code, description: coupon.description || describeCoupon(coupon), discountPaise: couponDiscountPaise }
        : null,
    couponError,
    usePoints: cart.usePoints,
    pointsBalance,
    pricing,
    blockers,
    pointsWillEarn: pointsEarnedFor(pricing.taxablePaise),
  };

  return { cart, restaurant, lines, coupon, couponDiscountPaise, couponError, pricing, blockers, pointsBalance, dto };
}

export async function addToCart(ctx: AppContext, userId: string, input: AddToCartInput): Promise<void> {
  const food = (await FoodItem.findOne({ _id: input.foodId, isDeleted: false }).lean()) as FoodLean | null;
  if (!food) throw notFound('Dish');
  if (!food.isAvailable) throw unprocessable(COPY.error.itemUnavailable, 'ITEM_UNAVAILABLE');
  const restaurant = await Restaurant.findById(food.restaurantId).lean();
  if (!restaurant || restaurant.status !== 'APPROVED') throw notFound('Restaurant');

  resolveSelection(food, input.variantId, input.addOnIds);
  const key = lineKey(String(food._id), input.variantId, input.addOnIds);

  const cart = (await Cart.findOne({ userId })) ?? new Cart({ userId, lines: [] });
  if (cart.restaurantId && String(cart.restaurantId) !== String(food.restaurantId) && cart.lines.length > 0) {
    if (!input.replaceCart) {
      throw new AppError(409, 'CART_RESTAURANT_MISMATCH', COPY.cart.otherRestaurant);
    }
    cart.lines.splice(0, cart.lines.length);
    cart.couponCode = null;
  }
  cart.restaurantId = food.restaurantId;

  const existing = cart.lines.find((l) => l.key === key);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + input.quantity, CART_LIMITS.maxLineQuantity);
    if (input.note !== undefined) existing.note = input.note;
  } else {
    if (cart.lines.length >= CART_LIMITS.maxLines) throw badRequest('Your cart is full. Remove something first.');
    cart.lines.push({
      foodId: food._id,
      variantId: input.variantId ?? null,
      addOnIds: input.addOnIds,
      quantity: input.quantity,
      note: input.note,
      key,
    });
  }
  await cart.save();
}

export async function updateLine(userId: string, lineId: string, patch: { quantity?: number; note?: string }): Promise<void> {
  const cart = await Cart.findOne({ userId });
  const line = cart?.lines.id(lineId);
  if (!cart || !line) throw notFound('Cart item');
  if (patch.quantity === 0) line.deleteOne();
  else {
    if (patch.quantity !== undefined) line.quantity = patch.quantity;
    if (patch.note !== undefined) line.note = patch.note;
  }
  if (cart.lines.length === 0) {
    cart.restaurantId = null;
    cart.couponCode = null;
  }
  await cart.save();
}

export async function clearCart(userId: string): Promise<void> {
  await Cart.updateOne({ userId }, { $set: { lines: [], restaurantId: null, couponCode: null, usePoints: false } });
}

export async function applyCoupon(ctx: AppContext, userId: string, code: string): Promise<void> {
  const evaluation = await evaluateCart(ctx, userId);
  if (!evaluation.cart || !evaluation.restaurant) throw unprocessable(COPY.empty.cart.title, 'CART_EMPTY');
  const coupon = (await Coupon.findOne({ code }).lean()) as CouponLean | null;
  if (!coupon) throw unprocessable('That coupon code does not exist.', 'COUPON_INVALID');
  const subtotal = evaluation.pricing.itemsSubtotalPaise;
  const result = await checkCoupon(ctx, userId, coupon, String(evaluation.restaurant._id), subtotal);
  if (!result.ok) throw unprocessable(result.message, `COUPON_${result.reason}`);
  await Cart.updateOne({ userId }, { $set: { couponCode: coupon.code } });
}

export async function removeCoupon(userId: string): Promise<void> {
  await Cart.updateOne({ userId }, { $set: { couponCode: null } });
}

export async function setUsePoints(userId: string, usePoints: boolean): Promise<void> {
  await Cart.updateOne({ userId }, { $set: { usePoints } }, { upsert: true });
}

/** Folds a guest (browser) cart into the account cart after login. */
export async function mergeGuestCart(ctx: AppContext, userId: string, lines: Omit<AddToCartInput, 'replaceCart'>[]) {
  const warnings: string[] = [];
  const current = await Cart.findOne({ userId }).lean();
  const hasServerLines = Boolean(current && current.lines.length > 0);
  for (const line of lines) {
    try {
      await addToCart(ctx, userId, { ...line, replaceCart: false });
    } catch (err) {
      if (err instanceof AppError && err.code === 'CART_RESTAURANT_MISMATCH') {
        warnings.push(hasServerLines ? 'We kept the cart saved on your account.' : 'Items from a second restaurant were skipped.');
        break;
      }
      warnings.push(err instanceof AppError ? err.message : 'An item could not be added.');
    }
  }
  return [...new Set(warnings)];
}

