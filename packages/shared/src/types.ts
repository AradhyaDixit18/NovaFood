/**
 * Shapes returned by the API (JSON-serialised: dates are ISO strings, ids are strings).
 */
import type {
  Allergen,
  Cuisine,
  DietTag,
  FoodTag,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  RestaurantStatus,
  Role,
} from './constants';
import type { OrderStatus } from './orderStatus';
import type { PriceBreakdown } from './pricing';
import type { OpeningWindow } from './time';
import type { NotificationPrefs, PrivacySettings } from './schemas/user';

export interface ApiSuccess<T> {
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Art {
  kind: string;
  hue: number;
}

export interface AddressDTO {
  _id: string;
  label: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  location?: { lat: number; lng: number };
  isDefault: boolean;
}

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  addresses: AddressDTO[];
  dietaryPreferences: DietTag[];
  vegetarianOnly: boolean;
  favoriteCuisines: Cuisine[];
  notificationPrefs: NotificationPrefs;
  privacy: PrivacySettings;
  pointsBalance: number;
  createdAt: string;
}

export interface RestaurantSummaryDTO {
  _id: string;
  name: string;
  slug: string;
  description: string;
  cuisines: Cuisine[];
  area: string;
  city: string;
  rating: number;
  ratingCount: number;
  costForTwoPaise: number;
  deliveryTimeMins: number;
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  pureVeg: boolean;
  offerText?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  art: Art;
  isOpen: boolean;
  isAcceptingOrders: boolean;
  status: RestaurantStatus;
}

export interface RestaurantDTO extends RestaurantSummaryDTO {
  address: { line1: string; area: string; city: string; pincode: string };
  location?: { lat: number; lng: number };
  phone?: string;
  openingHours: OpeningWindow[];
  policies?: string;
  ownerIds: string[];
  createdAt: string;
}

export interface AddOnOptionDTO {
  _id: string;
  name: string;
  pricePaise: number;
  isVeg: boolean;
}

export interface AddOnGroupDTO {
  _id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: AddOnOptionDTO[];
}

export interface VariantDTO {
  _id: string;
  name: string;
  pricePaise: number;
}

export interface FoodDTO {
  _id: string;
  restaurantId: string;
  restaurant?: Pick<RestaurantSummaryDTO, '_id' | 'name' | 'slug' | 'isOpen' | 'deliveryTimeMins' | 'rating'>;
  name: string;
  slug: string;
  description: string;
  section: string;
  cuisine: Cuisine;
  pricePaise: number;
  compareAtPricePaise?: number | null;
  imageUrl?: string | null;
  art: Art;
  isVeg: boolean;
  dietTags: DietTag[];
  allergens: Allergen[];
  tags: FoodTag[];
  spiceLevel: number;
  ingredients: string[];
  nutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  variants: VariantDTO[];
  addOnGroups: AddOnGroupDTO[];
  isAvailable: boolean;
  isBestseller: boolean;
  rating: number;
  ratingCount: number;
  orderCount: number;
}

export interface CartLineDTO {
  _id: string;
  foodId: string;
  name: string;
  isVeg: boolean;
  art: Art;
  imageUrl?: string | null;
  variant?: { _id: string; name: string } | null;
  addOns: { _id: string; name: string; pricePaise: number }[];
  quantity: number;
  note?: string;
  unitPricePaise: number;
  lineTotalPaise: number;
  available: boolean;
}

export interface CartDTO {
  _id: string | null;
  restaurant: Pick<
    RestaurantSummaryDTO,
    '_id' | 'name' | 'slug' | 'art' | 'isOpen' | 'isAcceptingOrders' | 'minOrderPaise' | 'deliveryTimeMins'
  > | null;
  lines: CartLineDTO[];
  itemCount: number;
  coupon: { code: string; description: string; discountPaise: number } | null;
  couponError: string | null;
  usePoints: boolean;
  pointsBalance: number;
  pricing: PriceBreakdown;
  /** Problems that block checkout, e.g. restaurant closed or below minimum order. */
  blockers: string[];
  pointsWillEarn: number;
}

export interface OrderLineDTO {
  foodId: string;
  name: string;
  isVeg: boolean;
  art: Art;
  variantName?: string | null;
  addOns: { name: string; pricePaise: number }[];
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  note?: string;
}

export interface StatusEventDTO {
  status: OrderStatus;
  at: string;
  by: 'customer' | 'partner' | 'admin' | 'system';
  note?: string;
}

export interface OrderDTO {
  _id: string;
  orderNumber: string;
  userId: string;
  customer?: { name: string; phone: string };
  restaurant: Pick<RestaurantSummaryDTO, '_id' | 'name' | 'slug' | 'art' | 'area'>;
  lines: OrderLineDTO[];
  pricing: PriceBreakdown;
  couponCode?: string | null;
  status: OrderStatus;
  statusHistory: StatusEventDTO[];
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    providerOrderId?: string | null;
  };
  deliveryAddress: Omit<AddressDTO, '_id' | 'isDefault'>;
  deliveryInstructions?: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  pointsEarned: number;
  reviewed: boolean;
  createdAt: string;
}

export interface PaymentInitDTO {
  provider: 'razorpay';
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  orderId: string;
}

export interface CheckoutResultDTO {
  order: OrderDTO;
  payment: PaymentInitDTO | null;
}

export interface ReviewDTO {
  _id: string;
  user: { _id: string; name: string; avatarUrl?: string | null };
  restaurantId: string;
  foodId?: string | null;
  foodName?: string | null;
  rating: number;
  comment?: string;
  helpfulCount: number;
  markedHelpful: boolean;
  status: 'PUBLISHED' | 'HIDDEN';
  createdAt: string;
}

export interface NotificationDTO {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface CouponDTO {
  _id: string;
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  expiresAt: string | null;
  firstOrderOnly: boolean;
  restaurantIds: string[];
}

export interface RecommendationDTO {
  food: FoodDTO;
  score: number;
  reason: string;
}

export interface SearchSuggestionsDTO {
  restaurants: Pick<RestaurantSummaryDTO, '_id' | 'name' | 'slug' | 'cuisines' | 'art'>[];
  dishes: Pick<FoodDTO, '_id' | 'name' | 'isVeg' | 'pricePaise' | 'art'>[] & { restaurantSlug?: string }[];
  cuisines: string[];
}

export interface LoyaltyEntryDTO {
  _id: string;
  type: 'EARN' | 'REDEEM' | 'REVERSE' | 'BONUS';
  points: number;
  description: string;
  orderId?: string | null;
  createdAt: string;
}
