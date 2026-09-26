import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FoodDTO, FoodInput, OrderDTO, OrderStatus, RestaurantDTO, RestaurantInput } from '@novafood/shared';
import { create } from 'zustand';
import { api, apiPaged } from '../../lib/api';
import { safeStorage } from '../../lib/storage';

export interface Analytics {
  rangeDays: number;
  totals: { orders: number; revenuePaise: number; averageOrderValuePaise: number };
  statusCounts: Record<OrderStatus, number>;
  topFoods: { foodId: string; name: string; quantity: number; revenuePaise: number }[];
  topRestaurants: { restaurantId: string; name: string; orders: number; revenuePaise: number }[];
  daily: { date: string; orders: number; revenuePaise: number }[];
}

export const useSelectedRestaurant = create<{ id: string | null; set: (id: string) => void }>((set) => ({
  id: safeStorage.get<string | null>('nf-partner-restaurant', null),
  set: (id) => {
    safeStorage.set('nf-partner-restaurant', id);
    set({ id });
  },
}));

export const pk = {
  restaurants: ['partner', 'restaurants'] as const,
  restaurant: (id: string) => ['partner', 'restaurant', id] as const,
  orders: (id: string, active: boolean) => ['partner', 'orders', id, active] as const,
  analytics: (id: string, days: number) => ['partner', 'analytics', id, days] as const,
};

export const useMyRestaurants = () => useQuery({ queryKey: pk.restaurants, queryFn: () => api<RestaurantDTO[]>('/partner/restaurants') });

export const usePartnerRestaurant = (id: string | null) =>
  useQuery({ queryKey: pk.restaurant(id ?? ''), queryFn: () => api<{ restaurant: RestaurantDTO; foods: FoodDTO[] }>(`/partner/restaurants/${id}`), enabled: Boolean(id) });

export const usePartnerOrders = (id: string | null, active: boolean) =>
  useQuery({
    queryKey: pk.orders(id ?? '', active),
    queryFn: () => apiPaged<OrderDTO[]>('/partner/orders', { query: { restaurantId: id, active: active ? 'true' : undefined, limit: 50 } }),
    enabled: Boolean(id),
    refetchInterval: 60_000,
  });

export const usePartnerAnalytics = (id: string | null, days: number) =>
  useQuery({ queryKey: pk.analytics(id ?? '', days), queryFn: () => api<Analytics & { rating: number; ratingCount: number }>(`/partner/restaurants/${id}/analytics`, { query: { days } }), enabled: Boolean(id) });

export function useUpdateOrderStatus(scope: 'partner' | 'admin' = 'partner') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      api<OrderDTO>(`/${scope}/orders/${id}/status`, { method: 'POST', body: { status, reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [scope] }),
  });
}

export function useUpdateRestaurant(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RestaurantInput> & { isAcceptingOrders?: boolean }) => api<RestaurantDTO>(`/partner/restaurants/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });
}

export function useSaveFood(restaurantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<FoodInput> & { id?: string }) =>
      id ? api<FoodDTO>(`/partner/foods/${id}`, { method: 'PATCH', body: input }) : api<FoodDTO>(`/partner/restaurants/${restaurantId}/foods`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/partner/foods/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner'] }),
  });
}

export const useApplyRestaurant = () => useMutation({ mutationFn: (input: RestaurantInput) => api<RestaurantDTO>('/partner/apply', { method: 'POST', body: input }) });

export async function uploadImage(file: File, purpose: 'restaurant' | 'food' | 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const image = await api<{ url: string }>('/uploads/image', { method: 'POST', body: form, query: { purpose } });
  return image.url;
}
