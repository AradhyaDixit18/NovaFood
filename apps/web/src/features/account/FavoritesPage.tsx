import { useState } from 'react';
import { COPY } from '@novafood/shared';
import { useFavorites } from '../../api/account';
import { DishCard, RestaurantCard } from '../../components/food/cards';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';
import { ButtonLink } from '../../ui/Button';
import { Tabs } from '../../ui/controls';

export function FavoritesPage() {
  const { data, isLoading } = useFavorites();
  const [tab, setTab] = useState<'food' | 'restaurants'>('food');
  if (isLoading) return <PageLoader />;
  const foods = data?.foods ?? [];
  const restaurants = data?.restaurants ?? [];
  return (
    <div className="container-nf py-8">
      <Seo title="Favourites" noindex />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold">Favourites ❤️</h1>
        <Tabs value={tab} onChange={setTab} items={[{ value: 'food', label: `Dishes (${foods.length})` }, { value: 'restaurants', label: `Restaurants (${restaurants.length})` }]} />
      </div>
      {tab === 'food' ? (
        foods.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{foods.map((f, i) => <DishCard key={f._id} food={f} index={i} />)}</div>
        ) : (
          <EmptyState title={COPY.empty.favorites.title} body={COPY.empty.favorites.body} action={<ButtonLink to="/restaurants">Find something tasty</ButtonLink>} />
        )
      ) : restaurants.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{restaurants.map((r, i) => <RestaurantCard key={r._id} restaurant={r} index={i} />)}</div>
      ) : (
        <EmptyState title={COPY.empty.favorites.title} body={COPY.empty.favorites.body} />
      )}
    </div>
  );
}
