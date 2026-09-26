/**
 * Mappers from database documents to the public DTOs in @novafood/shared. Keeping them in one
 * place guarantees that internal fields (password hashes, token hashes, owner-only data) never
 * leak into a response by accident.
 */
import {
  type AddressDTO,
  type FoodDTO,
  type NotificationDTO,
  type OrderDTO,
  type RestaurantDTO,
  type RestaurantSummaryDTO,
  type UserDTO,
  isOpenAt,
  type OpeningWindow,
} from '@novafood/shared';
import type { Types } from 'mongoose';

type Id = Types.ObjectId | string;
const id = (value: Id | null | undefined): string => (value == null ? '' : String(value));
const iso = (value: Date | string | null | undefined): string | null =>
  value == null ? null : new Date(value).toISOString();

/* eslint-disable @typescript-eslint/no-explicit-any -- lean documents are loosely typed */

export function toAddressDTO(a: any): AddressDTO {
  return {
    _id: id(a._id),
    label: a.label,
    line1: a.line1,
    line2: a.line2 ?? undefined,
    landmark: a.landmark ?? undefined,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    phone: a.phone ?? undefined,
    location: a.location?.lat != null ? { lat: a.location.lat, lng: a.location.lng } : undefined,
    isDefault: Boolean(a.isDefault),
  };
}

export function toUserDTO(u: any): UserDTO {
  return {
    _id: id(u._id),
    name: u.name,
    email: u.email,
    emailVerified: Boolean(u.emailVerified),
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    role: u.role,
    status: u.status,
    addresses: (u.addresses ?? []).map(toAddressDTO),
    dietaryPreferences: u.dietaryPreferences ?? [],
    vegetarianOnly: Boolean(u.vegetarianOnly),
    favoriteCuisines: u.favoriteCuisines ?? [],
    notificationPrefs: {
      orderUpdates: u.notificationPrefs?.orderUpdates ?? true,
      offers: u.notificationPrefs?.offers ?? true,
      recommendations: u.notificationPrefs?.recommendations ?? true,
      email: u.notificationPrefs?.email ?? true,
    },
    privacy: {
      personalizedRecommendations: u.privacy?.personalizedRecommendations ?? true,
      showNameOnShareCards: u.privacy?.showNameOnShareCards ?? true,
    },
    pointsBalance: u.pointsBalance ?? 0,
    createdAt: iso(u.createdAt) ?? new Date().toISOString(),
  };
}

export function restaurantIsOpen(r: any, now: Date): boolean {
  return r.status === 'APPROVED' && isOpenAt((r.openingHours ?? []) as OpeningWindow[], now);
}

export function toRestaurantSummary(r: any, now: Date): RestaurantSummaryDTO {
  return {
    _id: id(r._id),
    name: r.name,
    slug: r.slug,
    description: r.description,
    cuisines: r.cuisines ?? [],
    area: r.address?.area ?? '',
    city: r.address?.city ?? '',
    rating: Math.round((r.rating ?? 0) * 10) / 10,
    ratingCount: r.ratingCount ?? 0,
    costForTwoPaise: r.costForTwoPaise,
    deliveryTimeMins: r.deliveryTimeMins,
    deliveryFeePaise: r.deliveryFeePaise,
    freeDeliveryAbovePaise: r.freeDeliveryAbovePaise ?? null,
    minOrderPaise: r.minOrderPaise ?? 0,
    pureVeg: Boolean(r.pureVeg),
    offerText: r.offerText ?? undefined,
    logoUrl: r.logoUrl ?? null,
    coverUrl: r.coverUrl ?? null,
    art: { kind: r.art?.kind ?? 'bowl', hue: r.art?.hue ?? 20 },
    isOpen: restaurantIsOpen(r, now),
    isAcceptingOrders: Boolean(r.isAcceptingOrders),
    status: r.status,
  };
}

export function toRestaurantDTO(r: any, now: Date): RestaurantDTO {
  return {
    ...toRestaurantSummary(r, now),
    address: {
      line1: r.address?.line1 ?? '',
      area: r.address?.area ?? '',
      city: r.address?.city ?? '',
      pincode: r.address?.pincode ?? '',
    },
    location: r.location?.lat != null ? { lat: r.location.lat, lng: r.location.lng } : undefined,
    phone: r.phone ?? undefined,
    openingHours: (r.openingHours ?? []).map((w: any) => ({ day: w.day, open: w.open, close: w.close })),
    policies: r.policies ?? undefined,
    ownerIds: (r.ownerIds ?? []).map(id),
    createdAt: iso(r.createdAt) ?? '',
  };
}

export function toFoodDTO(f: any, restaurant?: any, now?: Date): FoodDTO {
  return {
    _id: id(f._id),
    restaurantId: id(f.restaurantId),
    restaurant:
      restaurant && now
        ? {
            _id: id(restaurant._id),
            name: restaurant.name,
            slug: restaurant.slug,
            isOpen: restaurantIsOpen(restaurant, now),
            deliveryTimeMins: restaurant.deliveryTimeMins,
            rating: Math.round((restaurant.rating ?? 0) * 10) / 10,
          }
        : undefined,
    name: f.name,
    slug: f.slug,
    description: f.description,
    section: f.section,
    cuisine: f.cuisine,
    pricePaise: f.pricePaise,
    compareAtPricePaise: f.compareAtPricePaise ?? null,
    imageUrl: f.imageUrl ?? null,
    art: { kind: f.art?.kind ?? 'bowl', hue: f.art?.hue ?? 20 },
    isVeg: Boolean(f.isVeg),
    dietTags: f.dietTags ?? [],
    allergens: f.allergens ?? [],
    tags: f.tags ?? [],
    spiceLevel: f.spiceLevel ?? 0,
    ingredients: f.ingredients ?? [],
    nutrition: f.nutrition ?? null,
    variants: (f.variants ?? []).map((v: any) => ({ _id: id(v._id), name: v.name, pricePaise: v.pricePaise })),
    addOnGroups: (f.addOnGroups ?? []).map((g: any) => ({
      _id: id(g._id),
      name: g.name,
      minSelect: g.minSelect ?? 0,
      maxSelect: g.maxSelect ?? 1,
      options: (g.options ?? []).map((o: any) => ({ _id: id(o._id), name: o.name, pricePaise: o.pricePaise, isVeg: o.isVeg ?? true })),
    })),
    isAvailable: Boolean(f.isAvailable),
    isBestseller: Boolean(f.isBestseller),
    rating: Math.round((f.rating ?? 0) * 10) / 10,
    ratingCount: f.ratingCount ?? 0,
    orderCount: f.orderCount ?? 0,
  };
}

export function toOrderDTO(o: any, options: { includeCustomer?: boolean } = {}): OrderDTO {
  return {
    _id: id(o._id),
    orderNumber: o.orderNumber,
    userId: id(o.userId),
    customer: options.includeCustomer ? { name: o.customerName, phone: o.contactPhone } : undefined,
    restaurant: {
      _id: id(o.restaurantId),
      name: o.restaurantSnapshot?.name ?? '',
      slug: o.restaurantSnapshot?.slug ?? '',
      area: o.restaurantSnapshot?.area ?? '',
      art: { kind: o.restaurantSnapshot?.art?.kind ?? 'bowl', hue: o.restaurantSnapshot?.art?.hue ?? 20 },
    },
    lines: (o.lines ?? []).map((l: any) => ({
      foodId: id(l.foodId),
      name: l.name,
      isVeg: Boolean(l.isVeg),
      art: { kind: l.art?.kind ?? 'bowl', hue: l.art?.hue ?? 20 },
      variantName: l.variantName ?? null,
      addOns: (l.addOns ?? []).map((a: any) => ({ name: a.name, pricePaise: a.pricePaise })),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      lineTotalPaise: l.lineTotalPaise,
      note: l.note ?? undefined,
    })),
    pricing: {
      itemsSubtotalPaise: o.pricing.itemsSubtotalPaise,
      couponDiscountPaise: o.pricing.couponDiscountPaise,
      pointsRedeemed: o.pricing.pointsRedeemed,
      pointsDiscountPaise: o.pricing.pointsDiscountPaise,
      deliveryFeePaise: o.pricing.deliveryFeePaise,
      platformFeePaise: o.pricing.platformFeePaise,
      taxablePaise: o.pricing.taxablePaise,
      gstPaise: o.pricing.gstPaise,
      totalPaise: o.pricing.totalPaise,
    },
    couponCode: o.couponCode ?? null,
    status: o.status,
    statusHistory: (o.statusHistory ?? []).map((e: any) => ({ status: e.status, at: iso(e.at)!, by: e.by, note: e.note ?? undefined })),
    payment: {
      method: o.payment.method,
      status: o.payment.status,
      providerOrderId: o.payment.providerOrderId ?? null,
    },
    deliveryAddress: {
      label: o.deliveryAddress?.label ?? '',
      line1: o.deliveryAddress?.line1 ?? '',
      line2: o.deliveryAddress?.line2 ?? undefined,
      landmark: o.deliveryAddress?.landmark ?? undefined,
      city: o.deliveryAddress?.city ?? '',
      state: o.deliveryAddress?.state ?? '',
      pincode: o.deliveryAddress?.pincode ?? '',
      phone: o.deliveryAddress?.phone ?? undefined,
    },
    deliveryInstructions: o.deliveryInstructions ?? undefined,
    estimatedDeliveryAt: iso(o.estimatedDeliveryAt),
    deliveredAt: iso(o.deliveredAt),
    pointsEarned: o.pointsEarned ?? 0,
    reviewed: Boolean(o.reviewed),
    createdAt: iso(o.createdAt)!,
  };
}

export function toNotificationDTO(n: any): NotificationDTO {
  return {
    _id: id(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? null,
    read: Boolean(n.readAt),
    createdAt: iso(n.createdAt)!,
  };
}
