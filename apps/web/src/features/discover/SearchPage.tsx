import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { COPY } from '@novafood/shared';
import { useFoods, useSearch, useTrending } from '../../api/catalog';
import { DishCard, RestaurantCard } from '../../components/food/cards';
import { SearchBox } from '../../components/SearchBox';
import { Seo } from '../../components/Seo';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/States';
import { getRecentSearches } from '../../hooks/misc';
import { Button } from '../../ui/Button';
import { Tabs } from '../../ui/controls';
import { Chip, Select } from '../../ui/primitives';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [tab, setTab] = useState<'dishes' | 'restaurants'>('dishes');
  const [veg, setVeg] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const search = useSearch(q);
  const trending = useTrending();

  // With dish filters active, query the filterable endpoint instead of the combined search.
  const filtered = veg || sort !== 'relevance' || maxPrice !== undefined;
  const foods = useFoods({ q, veg: veg || undefined, sort, maxPrice, limit: 24 }, Boolean(q) && filtered);
  const dishes = filtered ? (foods.data?.pages.flatMap((p) => p.data) ?? []) : (search.data?.dishes ?? []);
  const restaurants = search.data?.restaurants ?? [];

  return (
    <div className="container-nf py-8">
      <Seo title={q ? `Search: ${q}` : 'Search'} noindex />
      <h1 className="sr-only">Search</h1>
      <SearchBox autoFocus={!q} size="lg" className="mx-auto max-w-2xl" />

      {!q ? (
        <div className="mx-auto mt-10 max-w-2xl space-y-8">
          {getRecentSearches().length ? (
            <section>
              <h2 className="mb-3 text-lg font-bold">Recent searches</h2>
              <div className="flex flex-wrap gap-2">
                {getRecentSearches().map((t) => (
                  <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="rounded-full border-2 border-line px-4 py-2 text-sm font-semibold hover:border-ink">
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="mb-3 text-lg font-bold">Trending in Bengaluru 🔥</h2>
            <div className="flex flex-wrap gap-2">
              {(trending.data?.length ? trending.data.map((t) => t.term) : ['biryani', 'momos', 'pizza', 'dosa', 'chai']).map((t) => (
                <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong hover:bg-brand hover:text-white dark:bg-brand/20 dark:text-brand">
                  {t}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-soft">
              Results for <strong className="text-ink">“{q}”</strong>
            </p>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'dishes', label: `Dishes (${dishes.length})` },
                { value: 'restaurants', label: `Restaurants (${restaurants.length})` },
              ]}
            />
          </div>

          {tab === 'dishes' ? (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Chip active={veg} onClick={() => setVeg((v) => !v)}>🟢 Veg only</Chip>
              <Chip active={maxPrice === 20000} onClick={() => setMaxPrice((p) => (p === 20000 ? undefined : 20000))}>Under ₹200</Chip>
              <Select aria-label="Sort dishes" value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 w-44 text-sm">
                <option value="relevance">Relevance</option>
                <option value="rating">Top rated</option>
                <option value="priceLow">Price: low to high</option>
                <option value="priceHigh">Price: high to low</option>
                <option value="popularity">Most ordered</option>
              </Select>
            </div>
          ) : null}

          {search.isLoading || (filtered && foods.isLoading) ? (
            <CardGridSkeleton />
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => search.refetch()} />
          ) : tab === 'dishes' ? (
            dishes.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {dishes.map((f, i) => <DishCard key={f._id} food={f} index={i} />)}
              </div>
            ) : (
              <EmptyState title={COPY.empty.search.title} body={COPY.empty.search.body} action={restaurants.length ? <Button onClick={() => setTab('restaurants')}>See matching restaurants</Button> : undefined} />
            )
          ) : restaurants.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {restaurants.map((r, i) => <RestaurantCard key={r._id} restaurant={r} index={i} />)}
            </div>
          ) : (
            <EmptyState title={COPY.empty.search.title} body={COPY.empty.search.body} />
          )}
        </div>
      )}
    </div>
  );
}
