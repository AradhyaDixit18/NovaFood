import type { OrderStatus } from '@novafood/shared';
import type { MascotMood } from '../../stores/mascot';

/** How Nova feels about each order status. */
export function mascotFor(status: OrderStatus): MascotMood {
  if (status === 'DELIVERED') return 'celebrate';
  if (status === 'PREPARING' || status === 'RESTAURANT_ACCEPTED') return 'hungry';
  if (status === 'OUT_FOR_DELIVERY' || status === 'READY_FOR_PICKUP') return 'happy';
  if (status === 'PAYMENT_FAILED' || status === 'REJECTED' || status === 'CANCELLED') return 'worried';
  if (status === 'PAYMENT_PENDING') return 'curious';
  return 'curious';
}
