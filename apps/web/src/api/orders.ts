import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartDTO, CheckoutInput, CheckoutResultDTO, OrderDTO, PaymentInitDTO } from '@novafood/shared';
import { api, apiPaged } from '../lib/api';
import { useIsAuthed } from '../stores/auth';
import { keys } from './keys';

export function useOrders(q: { page?: number; active?: 'true' | 'false' } = {}) {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.orders(q), queryFn: () => apiPaged<OrderDTO[]>('/orders', { query: q }), enabled: authed });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api<{ order: OrderDTO; payment: PaymentInitDTO | null }>(`/orders/${id}`),
    enabled: Boolean(id),
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => api<CheckoutResultDTO>('/orders', { method: 'POST', body: input }),
    onSuccess: (result) => {
      qc.setQueryData(keys.order(result.order._id), { order: result.order, payment: result.payment });
      qc.invalidateQueries({ queryKey: keys.cart });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

function useOrderMutation<V>(fn: (v: V) => Promise<{ order: OrderDTO; payment?: PaymentInitDTO | null }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      qc.setQueryData(keys.order(result.order._id), (prev: { payment: PaymentInitDTO | null } | undefined) => ({
        order: result.order,
        payment: result.payment !== undefined ? result.payment : (prev?.payment ?? null),
      }));
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export const useCancelOrder = () =>
  useOrderMutation((v: { id: string; reason?: string }) => api<{ order: OrderDTO }>(`/orders/${v.id}/cancel`, { method: 'POST', body: { reason: v.reason } }));

export const useVerifyPayment = () =>
  useOrderMutation((v: { id: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    api<{ order: OrderDTO }>(`/orders/${v.id}/payment/verify`, { method: 'POST', body: v }),
  );

export const useReportPaymentFailure = () =>
  useOrderMutation((v: { id: string; reason: string }) => api<{ order: OrderDTO }>(`/orders/${v.id}/payment/failed`, { method: 'POST', body: { reason: v.reason } }));

export const useRetryPayment = () =>
  useOrderMutation((id: string) => api<{ order: OrderDTO; payment: PaymentInitDTO | null }>(`/orders/${id}/payment/retry`, { method: 'POST' }));

export function useReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ cart: CartDTO; skipped: string[] }>(`/orders/${id}/reorder`, { method: 'POST' }),
    onSuccess: (res) => qc.setQueryData(keys.cart, res.cart),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; rating: number; comment?: string; dishes: { foodId: string; rating: number }[] }) =>
      api<{ ok: true }>('/reviews', { method: 'POST', body: input }),
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: keys.order(input.orderId) });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: keys.rewards });
    },
  });
}
