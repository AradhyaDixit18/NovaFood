/**
 * The order state machine. It is the single source of truth for which status changes are
 * legal and who may perform them. The API enforces it on every transition; the web app uses
 * it to decide which buttons to render.
 *
 * "Cart" and "checkout" are client-side stages. An Order document only exists from
 * PAYMENT_PENDING (online payment) or ORDER_PLACED (cash on delivery) onwards.
 */

export const ORDER_STATUSES = [
  'PAYMENT_PENDING',
  'PAYMENT_FAILED',
  'PAYMENT_CONFIRMED',
  'ORDER_PLACED',
  'RESTAURANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REJECTED',
  'REFUND_PENDING',
  'REFUNDED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderActor = 'customer' | 'partner' | 'admin' | 'system';

type TransitionTable = Record<OrderStatus, Partial<Record<OrderStatus, readonly OrderActor[]>>>;

export const ORDER_TRANSITIONS: TransitionTable = {
  PAYMENT_PENDING: {
    PAYMENT_CONFIRMED: ['system'],
    PAYMENT_FAILED: ['system'],
    CANCELLED: ['customer', 'admin', 'system'],
  },
  PAYMENT_FAILED: {
    PAYMENT_PENDING: ['customer', 'system'],
    CANCELLED: ['customer', 'admin', 'system'],
  },
  PAYMENT_CONFIRMED: {
    ORDER_PLACED: ['system'],
  },
  ORDER_PLACED: {
    RESTAURANT_ACCEPTED: ['partner', 'admin'],
    REJECTED: ['partner', 'admin'],
    CANCELLED: ['customer', 'admin'],
  },
  RESTAURANT_ACCEPTED: {
    PREPARING: ['partner', 'admin'],
    CANCELLED: ['admin'],
  },
  PREPARING: {
    READY_FOR_PICKUP: ['partner', 'admin'],
  },
  READY_FOR_PICKUP: {
    OUT_FOR_DELIVERY: ['partner', 'admin'],
  },
  OUT_FOR_DELIVERY: {
    DELIVERED: ['partner', 'admin'],
  },
  DELIVERED: {},
  CANCELLED: {
    REFUND_PENDING: ['system', 'admin'],
  },
  REJECTED: {
    REFUND_PENDING: ['system', 'admin'],
  },
  REFUND_PENDING: {
    REFUNDED: ['system', 'admin'],
  },
  REFUNDED: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  const allowed = ORDER_TRANSITIONS[from][to];
  return Boolean(allowed && allowed.includes(actor));
}

export function nextStatuses(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  return (Object.entries(ORDER_TRANSITIONS[from]) as [OrderStatus, readonly OrderActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([status]) => status);
}

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'REFUNDED'];

export function isTerminal(status: OrderStatus): boolean {
  return Object.keys(ORDER_TRANSITIONS[status]).length === 0;
}

/** Orders the kitchen still has to act on. */
export const KITCHEN_ACTIVE_STATUSES: readonly OrderStatus[] = [
  'ORDER_PLACED',
  'RESTAURANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
];

/** The happy-path steps shown on the tracking timeline. */
export const TRACKING_STEPS: readonly OrderStatus[] = [
  'ORDER_PLACED',
  'RESTAURANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export type StatusTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusMeta {
  label: string;
  /** Short, playful line for notifications and the tracking screen. */
  message: string;
  tone: StatusTone;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PAYMENT_PENDING: { label: 'Awaiting payment', message: 'Payment complete kar do, phir kitchen shuru 💳', tone: 'warning' },
  PAYMENT_FAILED: {
    label: 'Payment failed',
    message: 'Payment nahi hua. If money was deducted, it is refunded automatically by your bank.',
    tone: 'danger',
  },
  PAYMENT_CONFIRMED: { label: 'Payment confirmed', message: 'Paisa aa gaya, order bhej rahe hain ✅', tone: 'success' },
  ORDER_PLACED: { label: 'Order placed', message: 'Bhai order nikal gaya! Restaurant ko bata diya 🚀', tone: 'info' },
  RESTAURANT_ACCEPTED: { label: 'Accepted', message: 'Bhai, order kitchen mein pahunch gaya 🔥', tone: 'info' },
  PREPARING: { label: 'Preparing', message: 'Food is getting ready 👨‍🍳', tone: 'info' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', message: 'Packed and ready. Bas nikalne wala hai 📦', tone: 'info' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', message: 'Bas thoda sa wait... food aa raha hai 🚀', tone: 'info' },
  DELIVERED: { label: 'Delivered', message: 'Order delivered. Ab mast khao 😋', tone: 'success' },
  CANCELLED: { label: 'Cancelled', message: 'Order cancelled.', tone: 'neutral' },
  REJECTED: { label: 'Rejected by restaurant', message: 'Restaurant could not take this order right now.', tone: 'danger' },
  REFUND_PENDING: { label: 'Refund in progress', message: 'Refund initiated. It usually reaches you in 5–7 working days.', tone: 'warning' },
  REFUNDED: { label: 'Refunded', message: 'Refund processed. Paisa wapas aa gaya ✅', tone: 'success' },
};
