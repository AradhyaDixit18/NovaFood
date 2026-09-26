import { useSearchParams } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';
import { COPY, CUISINES } from '@novafood/shared';
import { type RestaurantFilters, useRestaurants } from '../../api/catalog';
import { RestaurantCard } from '../../components/food/cards';
import { Seo } from '../../components/Seo';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/States';
import { Button } from '../../ui/Button';
import { Chip, Select } from '../../ui/primitives';

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Rating' },
  { value: 'deliveryTime', label: 'Delivery time' },
  { value: 'costLow', label: 'Cost: low to high' },
  { value: 'costHigh', label: 'Cost: high to low' },
  { value: 'popularity', label: 'Most ordered' },
];

export function RestaurantsPage() {
  const [params, setParams] = useSearchParams();
  const filters: RestaurantFilters = {
    cuisine: params.get('cuisine')?.split(',').filter(Boolean),
    pureVeg: params.get('pureVeg') === 'true',
    minRating: params.get('minRating') ? Number(params.get('minRating')) : undefined,
    maxDeliveryTime: params.get('fast') === 'true' ? 30 : undefined,
    maxCostForTwo: params.get('budget') === 'true' ? 40000 : undefined,
    hasOffers: params.get('offers') === 'true',
    openNow: params.get('openNow') === 'true',
    sort: params.get('sort') ?? 'relevance',
    limit: 12,
  };
  const query = useRestaurants(filters);
  const restaurants = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? 0;

  const toggle = (key: string, value = 'true') => {
    const next = new URLSearchParams(params);
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const toggleCuisine = (c: string) => {
    const current = new Set(filters.cuisine ?? []);
    if (current.has(c)) current.delete(c);
    else current.add(c);
    const next = new URLSearchParams(params);
    if (current.size) next.set('cuisine', [...current].join(','));
    else next.delete('cuisine');
    setParams(next, { replace: true });
  };

  return (
    <div className="container-nf py-8">
      <Seo title="Restaurants near you" description="Browse restaurants, filter by cuisine, rating, delivery time and offers." path="/restaurants" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">Explore kitchens</h1>
          <p className="mt-1 text-ink-soft">{query.isLoading ? 'Finding the good stuff…' : `${total} restaurants delivering in Bengaluru`}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Sort
          <Select
            aria-label="Sort restaurants"
            value={filters.sort}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set('sort', e.target.value);
              setParams(next, { replace: true });
            }}
            className="w-52"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filters">
        <Chip active={filters.openNow} onClick={() => toggle('openNow')}>Open now</Chip>
        <Chip active={filters.pureVeg} onClick={() => toggle('pureVeg')}>🟢 Pure veg</Chip>
        <Chip active={filters.minRating === 4} onClick={() => toggle('minRating', '4')}>⭐ 4.0+</Chip>
        <Chip active={filters.maxDeliveryTime === 30} onClick={() => toggle('fast')}>⚡ Under 30 min</Chip>
        <Chip active={filters.maxCostForTwo === 40000} onClick={() => toggle('budget')}>💸 Under ₹400 for two</Chip>
        <Chip active={filters.hasOffers} onClick={() => toggle('offers')}>🏷️ Offers</Chip>
      </div>
      <div className="scrollbar-none -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Cuisines">
        {CUISINES.map((c) => (
          <Chip key={c} active={filters.cuisine?.includes(c)} onClick={() => toggleCuisine(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {query.isLoading ? (
        <CardGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : restaurants.length === 0 ? (
        <EmptyState title={COPY.empty.search.title} body="No restaurants match these filters. Try removing one." action={<Button onClick={() => setParams({})}>Clear filters</Button>} />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {restaurants.map((r, i) => <RestaurantCard key={r._id} restaurant={r} index={i} />)}
          </div>
          {query.hasNextPage ? (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                Show more kitchens
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
