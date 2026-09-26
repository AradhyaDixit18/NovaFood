import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CouponDTO,
  FoodDTO,
  RecommendationDTO,
  RestaurantDTO,
  RestaurantSummaryDTO,
  ReviewDTO,
  SearchSuggestionsDTO,
} from '@novafood/shared';
import { api, apiPaged } from '../lib/api';
import { useIsAuthed } from '../stores/auth';
import { keys } from './keys';

export interface AppConfig {
  onlinePayments: boolean;
  razorpayKeyId: string | null;
  uploads: boolean;
  requireEmailVerification: boolean;
}

export const useConfig = () => useQuery({ queryKey: keys.config, queryFn: () => api<AppConfig>('/config'), staleTime: 10 * 60_000 });

export type RestaurantFilters = {
  q?: string;
  cuisine?: string[];
  pureVeg?: boolean;
  minRating?: number;
  maxDeliveryTime?: number;
  maxCostForTwo?: number;
  hasOffers?: boolean;
  openNow?: boolean;
  sort?: string;
  limit?: number;
};

export function useRestaurants(filters: RestaurantFilters) {
  return useInfiniteQuery({
    queryKey: keys.restaurants(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => apiPaged<RestaurantSummaryDTO[]>('/restaurants', { query: { ...filters, page: pageParam }, signal }),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export interface MenuSection {
  section: string;
  items: FoodDTO[];
}

export interface RestaurantPage {
  restaurant: RestaurantDTO;
  menu: MenuSection[];
  offers: { code: string; description: string; type: 'PERCENT' | 'FLAT'; value: number; minOrderPaise: number; maxDiscountPaise: number | null; firstOrderOnly: boolean }[];
}

export const useRestaurant = (slug: string) =>
  useQuery({ queryKey: keys.restaurant(slug), queryFn: () => api<RestaurantPage>(`/restaurants/${slug}`), enabled: Boolean(slug) });

export type FoodFilters = {
  q?: string;
  veg?: boolean;
  diet?: string[];
  tags?: string[];
  cuisine?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  mood?: string;
  sort?: string;
  limit?: number;
};

export function useFoods(filters: FoodFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.foods(filters),
    initialPageParam: 1,
    enabled,
    queryFn: ({ pageParam, signal }) => apiPaged<FoodDTO[]>('/foods', { query: { ...filters, page: pageParam }, signal }),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export const useFood = (id: string) => useQuery({ queryKey: keys.food(id), queryFn: () => api<FoodDTO>(`/foods/${id}`), enabled: Boolean(id) });

export const useSuggest = (q: string) =>
  useQuery({
    queryKey: keys.suggest(q),
    queryFn: ({ signal }) => api<SearchSuggestionsDTO>('/search/suggest', { query: { q }, signal }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: keys.search(q),
    queryFn: ({ signal }) => api<{ restaurants: RestaurantSummaryDTO[]; dishes: FoodDTO[] }>('/search', { query: { q }, signal }),
    enabled: q.trim().length >= 1,
  });

export const useTrending = () => useQuery({ queryKey: keys.trending, queryFn: () => api<{ term: string; count: number }[]>('/search/trending'), staleTime: 5 * 60_000 });

export const useCoupons = () => {
  const authed = useIsAuthed();
  return useQuery({ queryKey: [...keys.coupons, authed], queryFn: () => api<CouponDTO[]>('/coupons') });
};

export const useForYou = () => {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.forYou(authed), queryFn: () => api<{ greeting: string; items: RecommendationDTO[] }>('/recommendations/for-you') });
};

export interface SmartReorder {
  orderId: string;
  restaurant: { _id: string; name: string; slug: string; isOpen: boolean };
  items: { name: string; quantity: number; isVeg: boolean; art: { kind: string; hue: number } }[];
  timesOrdered: number;
  headline: string;
}

export const useSmartReorder = () => {
  const authed = useIsAuthed();
  return useQuery({ queryKey: keys.smartReorder, queryFn: () => api<SmartReorder | null>('/recommendations/smart-reorder'), enabled: authed });
};

export const useAlsoOrdered = (foodId: string) =>
  useQuery({ queryKey: keys.alsoOrdered(foodId), queryFn: () => api<{ food: FoodDTO; timesTogether: number }[]>(`/recommendations/also-ordered/${foodId}`), enabled: Boolean(foodId) });

export function useReviews(q: { restaurantId?: string; foodId?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: keys.reviews(q),
    queryFn: () => apiPaged<ReviewDTO[]>('/reviews', { query: { ...q } }),
    enabled: Boolean(q.restaurantId || q.foodId),
    placeholderData: keepPreviousData,
  });
}

export function useHelpful() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ helpful: boolean; helpfulCount: number }>(`/reviews/${id}/helpful`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}
