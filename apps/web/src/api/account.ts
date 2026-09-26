import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Achievement,
  ActivityStats,
  AddressDTO,
  AddressInput,
  FoodDTO,
  LoyaltyEntryDTO,
  NotificationDTO,
  RestaurantSummaryDTO,
  UpdateProfileInput,
  UserDTO,
} from '@novafood/shared';
import { api, apiPaged } from '../lib/api';
import { useAuth, useIsAuthed } from '../stores/auth';
import { keys } from './keys';

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<{ user: UserDTO }>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: ({ user }) => useAuth.getState().setUser(user),
  });
}

async function refreshMe() {
  const { user } = await api<{ user: UserDTO }>('/auth/me');
  useAuth.getState().setUser(user);
}

export function useSaveAddress() {
  return useMutation({
    mutationFn: ({ id, ...input }: AddressInput & { id?: string }) =>
      id ? api<AddressDTO>(`/users/me/addresses/${id}`, { method: 'PATCH', body: input }) : api<AddressDTO>('/users/me/addresses', { method: 'POST', body: input }),
    onSuccess: refreshMe,
  });
}

export function useDeleteAddress() {
  return useMutation({ mutationFn: (id: string) => api(`/users/me/addresses/${id}`, { method: 'DELETE' }), onSuccess: refreshMe });
}

/* -------------------------------- Notifications ------------------------------- */

export function useNotifications() {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.notifications, queryFn: () => apiPaged<NotificationDTO[]>('/notifications', { query: { limit: 30 } }), enabled: authed });
}

export function useUnreadCount() {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.unread, queryFn: () => api<{ unread: number }>('/notifications/unread-count'), enabled: authed, refetchInterval: 120_000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => (id ? api(`/notifications/${id}/read`, { method: 'POST' }) : api('/notifications/read-all', { method: 'POST' })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

/* ---------------------------------- Favorites --------------------------------- */

export function useFavoriteIds() {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.favoriteIds, queryFn: () => api<{ restaurantIds: string[]; foodIds: string[] }>('/favorites/ids'), enabled: authed });
}

export function useFavorites() {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.favorites, queryFn: () => api<{ restaurants: RestaurantSummaryDTO[]; foods: FoodDTO[] }>('/favorites'), enabled: authed });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, on }: { kind: 'restaurant' | 'food'; id: string; on: boolean }) =>
      api(`/favorites/${kind}/${id}`, { method: on ? 'PUT' : 'DELETE' }),
    onMutate: async ({ kind, id, on }) => {
      await qc.cancelQueries({ queryKey: keys.favoriteIds });
      const prev = qc.getQueryData<{ restaurantIds: string[]; foodIds: string[] }>(keys.favoriteIds);
      if (prev) {
        const field = kind === 'restaurant' ? 'restaurantIds' : 'foodIds';
        qc.setQueryData(keys.favoriteIds, { ...prev, [field]: on ? [...prev[field], id] : prev[field].filter((x) => x !== id) });
      }
      return { prev };
    },
    onError: (_e, _v, context) => context?.prev && qc.setQueryData(keys.favoriteIds, context.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.favorites }),
  });
}

/* ----------------------------------- Rewards ---------------------------------- */

export interface RewardsSummary {
  balance: number;
  pointValuePaise: number;
  earnRule: string;
  redeemRule: string;
  history: LoyaltyEntryDTO[];
  stats: ActivityStats;
  achievements: Achievement[];
}

export function useRewards() {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.rewards, queryFn: () => api<RewardsSummary>('/rewards'), enabled: authed });
}
