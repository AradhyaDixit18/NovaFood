import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ChevronRight, Clock, Flame, Info, MapPin, Search, ShoppingBag, Ticket } from 'lucide-react';
import { COPY, type FoodDTO, WEEKDAY_LABEL, describeCoupon } from '@novafood/shared';
import { type RestaurantPage as RestaurantData, useRestaurant } from '../../api/catalog';
import { useServerCart, useUpdateLine } from '../../api/cart';
import { useDishAdder } from '../../components/food/useDishAdder';
import { FavoriteButton } from '../../components/food/cards';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { EmptyState, ErrorState, PageLoader } from '../../components/States';
import { money } from '../../lib/format';
import { useIsAuthed } from '../../stores/auth';
import { useGuestCart } from '../../stores/guestCart';
import { QuantityStepper } from '../../ui/controls';
import { Badge, Input, Price, Rating, Switch, VegMark } from '../../ui/primitives';
import { ReviewsSection } from './ReviewsSection';

/** How many of a dish are in the cart (any configuration), and a handle to adjust simple ones. */
function useCartQuantity(foodId: string) {
  const authed = useIsAuthed();
  const server = useServerCart();
  const guest = useGuestCart();
  const update = useUpdateLine();
  const serverLines = server.data?.lines.filter((l) => l.foodId === foodId) ?? [];
  const guestLines = guest.lines.filter((l) => l.foodId === foodId);
  const lines = authed ? serverLines : guestLines;
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);
  const single = lines.length === 1 ? lines[0] : undefined;
  const setQuantity = (q: number) => {
    if (!single) return;
    if (authed) update.mutate({ lineId: (single as { _id: string })._id, quantity: q });
    else guest.setQuantity((single as { key: string }).key, q);
  };
  return { quantity, canAdjust: Boolean(single), setQuantity, busy: update.isPending };
}

function DishRow({ food, restaurant, closed }: { food: FoodDTO; restaurant: RestaurantData['restaurant']; closed: boolean }) {
  const adder = useDishAdder();
  const { quantity, canAdjust, setQuantity, busy } = useCartQuantity(food._id);
  const ref = useRef<HTMLDivElement>(null);
  const configurable = food.variants.length > 0 || food.addOnGroups.length > 0;
  const add = () => adder.add(food, { _id: restaurant._id, name: restaurant.name, slug: restaurant.slug }, ref.current?.getBoundingClientRect());

  return (
    <article className="flex gap-4 border-b border-line py-6 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <VegMark veg={food.isVeg} />
          {food.isBestseller ? <Badge tone="brand"><Flame className="h-3 w-3" /> Bestseller</Badge> : null}
          {food.spiceLevel >= 2 ? <Badge tone="danger">{'🌶️'.repeat(food.spiceLevel)}</Badge> : null}
          {food.dietTags.map((t) => (
            <Badge key={t} tone="success">{t}</Badge>
          ))}
        </div>
        <Link to={`/dish/${food._id}`} className="mt-1 block font-display text-xl font-bold hover:underline">
          {food.name}
        </Link>
        <Price paise={food.pricePaise} compareAt={food.compareAtPricePaise} className="mt-1" />
        {food.ratingCount ? <Rating value={food.rating} count={food.ratingCount} className="ml-2" /> : null}
        <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{food.description}</p>
        {food.nutrition ? <p className="mt-1 text-xs text-ink-faint">{food.nutrition.calories} kcal · {food.nutrition.proteinG}g protein</p> : null}
      </div>
      <div className="relative w-32 shrink-0 sm:w-40">
        <div ref={ref} className="aspect-square overflow-hidden rounded-lg">
          <FoodArt art={food.art} imageUrl={food.imageUrl} width={320} alt="" />
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
          {!food.isAvailable ? (
            <span className="rounded-full bg-surface px-3 py-2 text-xs font-bold text-ink-faint shadow-soft">Sold out</span>
          ) : quantity > 0 && canAdjust && !configurable ? (
            <div className="rounded-full bg-surface shadow-soft">
              <QuantityStepper value={quantity} onChange={setQuantity} label={food.name} busy={busy} />
            </div>
          ) : (
            <button
              type="button"
              disabled={closed}
              onClick={add}
              className="rounded-full border-2 border-brand bg-surface px-6 py-2 font-display font-extrabold text-brand shadow-soft transition-transform hover:scale-105 active:scale-95 disabled:border-line disabled:text-ink-faint"
            >
              {quantity > 0 ? `ADD · ${quantity}` : 'ADD'}
            </button>
          )}
          {configurable && food.isAvailable ? <p className="mt-1 text-center text-[11px] text-ink-faint">customisable</p> : null}
        </div>
      </div>
    </article>
  );
}

function FloatingCartBar({ restaurantId }: { restaurantId: string }) {
  const authed = useIsAuthed();
  const server = useServerCart();
  const guest = useGuestCart((s) => s.lines);
  const inThisRestaurant = authed ? server.data?.restaurant?._id === restaurantId : guest[0]?.snapshot.restaurantId === restaurantId;
  const count = authed ? (server.data?.itemCount ?? 0) : guest.reduce((s, l) => s + l.quantity, 0);
  const subtotal = authed ? (server.data?.pricing.itemsSubtotalPaise ?? 0) : guest.reduce((s, l) => s + l.quantity * l.snapshot.unitPricePaise, 0);
  if (!inThisRestaurant || count === 0) return null;
  return (
    <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-6">
      <Link to="/cart" className="mx-auto flex max-w-xl items-center justify-between rounded-full bg-success px-6 py-4 font-bold text-white shadow-lift">
        <span className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" /> {count} item{count > 1 ? 's' : ''} · {money(subtotal)}
        </span>
        <span className="flex items-center gap-1">
          View cart <ChevronRight className="h-5 w-5" />
        </span>
      </Link>
    </motion.div>
  );
}

export function RestaurantPage() {
  const { slug = '' } = useParams();
  const { data, isLoading, error, refetch } = useRestaurant(slug);
  const [vegOnly, setVegOnly] = useState(false);
  const [filter, setFilter] = useState('');

  const menu = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    return data.menu
      .map((s) => ({ ...s, items: s.items.filter((f) => (!vegOnly || f.isVeg) && (!q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))) }))
      .filter((s) => s.items.length > 0);
  }, [data, vegOnly, filter]);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <div className="container-nf"><ErrorState error={error} onRetry={() => refetch()} /></div>;

  const { restaurant, offers } = data;
  const closed = !restaurant.isOpen || !restaurant.isAcceptingOrders;
  const hours = restaurant.openingHours[0];

  return (
    <div className="pb-24">
      <Seo
        title={`${restaurant.name}, ${restaurant.area}`}
        description={`${restaurant.description} Order ${restaurant.cuisines.join(', ')} online from ${restaurant.name} on NovaFood.`}
        path={`/r/${restaurant.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          name: restaurant.name,
          servesCuisine: restaurant.cuisines,
          address: { '@type': 'PostalAddress', streetAddress: restaurant.address.line1, addressLocality: restaurant.address.city, postalCode: restaurant.address.pincode, addressCountry: 'IN' },
          priceRange: money(restaurant.costForTwoPaise) + ' for two',
          ...(restaurant.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: restaurant.rating, reviewCount: restaurant.ratingCount } } : {}),
        }}
      />

      <header className="relative">
        <div className="h-44 overflow-hidden sm:h-60">
          <FoodArt art={restaurant.art} imageUrl={restaurant.coverUrl} rounded="rounded-none" className="scale-110 blur-[1px]" />
        </div>
        <div className="container-nf">
          <div className="relative -mt-20 rounded-xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <FavoriteButton kind="restaurant" id={restaurant._id} name={restaurant.name} className="absolute right-5 top-5" />
            <p className="text-sm font-semibold text-ink-faint">
              <Link to="/restaurants" className="hover:text-ink">Restaurants</Link> / {restaurant.area}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-5xl">{restaurant.name}</h1>
            <p className="mt-2 text-ink-soft">{restaurant.cuisines.join(' · ')}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
              <Rating value={restaurant.rating} count={restaurant.ratingCount} />
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4 text-brand" /> {restaurant.deliveryTimeMins} min</span>
              <span>{money(restaurant.costForTwoPaise)} for two</span>
              <span className="inline-flex items-center gap-1 text-ink-soft"><MapPin className="h-4 w-4" /> {restaurant.address.area}</span>
              {restaurant.pureVeg ? <Badge tone="success">Pure veg</Badge> : null}
              {closed ? <Badge tone="danger">{restaurant.isOpen ? 'Not taking orders' : 'Closed now'}</Badge> : <Badge tone="success">Open now</Badge>}
            </div>
            <p className="mt-3 text-sm text-ink-faint">
              Delivery {money(restaurant.deliveryFeePaise)}
              {restaurant.freeDeliveryAbovePaise ? ` · free above ${money(restaurant.freeDeliveryAbovePaise)}` : ''}
              {restaurant.minOrderPaise ? ` · minimum order ${money(restaurant.minOrderPaise)}` : ''}
            </p>
            {offers.length ? (
              <div className="scrollbar-none -mx-2 mt-5 flex gap-3 overflow-x-auto px-2 pb-1">
                {offers.map((o) => (
                  <div key={o.code} className="flex shrink-0 items-center gap-3 rounded-md border-2 border-dashed border-grape/40 px-4 py-2">
                    <Ticket className="h-5 w-5 text-grape" />
                    <div>
                      <p className="text-sm font-bold">{o.description || describeCoupon(o)}</p>
                      <p className="text-xs font-semibold text-ink-faint">Use {o.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="container-nf mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Menu sections" className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Menu</p>
            {data.menu.map((s) => (
              <a key={s.section} href={`#section-${s.section}`} className="block rounded-md px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-2 hover:text-ink">
                {s.section} <span className="text-ink-faint">({s.items.length})</span>
              </a>
            ))}
          </div>
        </nav>

        <div>
          {closed ? (
            <div role="status" className="mb-6 rounded-lg bg-warning/12 p-4 font-semibold text-warning">
              {restaurant.isOpen ? COPY.error.restaurantOffline : COPY.error.restaurantClosed}
            </div>
          ) : null}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="relative flex-1">
              <span className="sr-only">Search this menu</span>
              <Search aria-hidden className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search in menu" className="pl-10" />
            </label>
            <div className="w-40">
              <Switch checked={vegOnly} onChange={setVegOnly} label="Veg only" />
            </div>
          </div>

          {menu.length === 0 ? (
            <EmptyState compact title={data.menu.length ? COPY.empty.search.title : COPY.empty.menu.title} body={data.menu.length ? 'Nothing in this menu matches.' : COPY.empty.menu.body} />
          ) : (
            menu.map((s) => (
              <section key={s.section} id={`section-${s.section}`} aria-labelledby={`h-${s.section}`} className="scroll-mt-28">
                <h2 id={`h-${s.section}`} className="mt-6 text-2xl font-extrabold">
                  {s.section} <span className="text-base font-semibold text-ink-faint">({s.items.length})</span>
                </h2>
                {s.items.map((f) => <DishRow key={f._id} food={f} restaurant={restaurant} closed={closed} />)}
              </section>
            ))
          )}

          <ReviewsSection restaurantId={restaurant._id} rating={restaurant.rating} count={restaurant.ratingCount} />

          <section aria-labelledby="info-title" className="mt-12 grid gap-4 rounded-lg border border-line bg-surface p-6 md:grid-cols-2">
            <h2 id="info-title" className="flex items-center gap-2 text-xl font-extrabold md:col-span-2">
              <Info className="h-5 w-5" /> Restaurant info
            </h2>
            <div>
              <p className="font-semibold">Address</p>
              <p className="text-sm text-ink-soft">{restaurant.address.line1}, {restaurant.address.area}, {restaurant.address.city} {restaurant.address.pincode}</p>
            </div>
            <div>
              <p className="font-semibold">Hours</p>
              <p className="text-sm text-ink-soft">
                {restaurant.openingHours.length === 7 && restaurant.openingHours.every((h) => h.open === hours?.open && h.close === hours?.close)
                  ? hours?.open === '00:00' && hours?.close === '23:59'
                    ? 'Open 24 hours, every day'
                    : `Every day, ${hours?.open} – ${hours?.close}`
                  : restaurant.openingHours.map((h) => `${WEEKDAY_LABEL[h.day].slice(0, 3)} ${h.open}–${h.close}`).join(', ')}
              </p>
            </div>
            {restaurant.policies ? (
              <div className="md:col-span-2">
                <p className="font-semibold">Policies</p>
                <p className="text-sm text-ink-soft">{restaurant.policies}</p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <FloatingCartBar restaurantId={restaurant._id} />
    </div>
  );
}
