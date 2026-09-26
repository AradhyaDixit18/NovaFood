import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, ChefHat, RotateCcw } from 'lucide-react';
import { CUISINES, MOODS } from '@novafood/shared';
import { useCoupons, useForYou, useRestaurants, useSmartReorder } from '../../api/catalog';
import { useReorder } from '../../api/orders';
import { CouponTicket, DishCard, RestaurantCard } from '../../components/food/cards';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { CardGridSkeleton } from '../../components/States';
import { errorMessage } from '../../lib/api';
import { useMascot } from '../../stores/mascot';
import { toast } from '../../stores/toast';
import { Button, ButtonLink } from '../../ui/Button';
import { SectionHeading } from '../../ui/controls';
import { Hero } from './Hero';

const CUISINE_ART: Record<string, { kind: string; hue: number }> = {
  'North Indian': { kind: 'curry', hue: 20 },
  'South Indian': { kind: 'dosa', hue: 42 },
  Biryani: { kind: 'biryani', hue: 28 },
  Chinese: { kind: 'noodles', hue: 355 },
  Italian: { kind: 'pasta', hue: 10 },
  Pizza: { kind: 'pizza', hue: 5 },
  Burgers: { kind: 'burger', hue: 30 },
  'Street Food': { kind: 'chaat', hue: 90 },
  Healthy: { kind: 'salad', hue: 120 },
  Desserts: { kind: 'cake', hue: 330 },
  Beverages: { kind: 'shake', hue: 260 },
  Mexican: { kind: 'taco', hue: 45 },
  Korean: { kind: 'ramen', hue: 0 },
  Momos: { kind: 'momo', hue: 200 },
};

function MoodStrip() {
  const react = useMascot((s) => s.react);
  return (
    <section aria-labelledby="moods-title" className="container-nf py-10">
      <SectionHeading id="moods-title" eyebrow="Mood discovery" title="Aaj ka mood kya hai?" action={<Link to="/moods" className="text-sm font-bold text-brand hover:underline">All moods</Link>} />
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {MOODS.map((m, i) => (
          <motion.div key={m.id} whileHover={{ y: -4, rotate: i % 2 ? 2 : -2 }} whileTap={{ scale: 0.95 }}>
            <Link
              to={`/moods/${m.id}`}
              onMouseEnter={() => react(m.id === 'sad' || m.id === 'comfort' ? 'curious' : m.id === 'party' ? 'celebrate' : 'happy', 1200)}
              className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_0_var(--nf-ink)] transition-shadow hover:shadow-[6px_6px_0_0_var(--nf-ink)]"
            >
              <span className="text-4xl" aria-hidden>{m.emoji}</span>
              <span className="font-display font-bold">{m.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SmartReorderCard() {
  const { data } = useSmartReorder();
  const reorder = useReorder();
  const navigate = useNavigate();
  if (!data) return null;
  return (
    <section className="container-nf py-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-grape to-[#3b1a8a] p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-lime/30 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex -space-x-4">
            {data.items.slice(0, 3).map((item, i) => (
              <div key={i} className="h-16 w-16 overflow-hidden rounded-full border-4 border-[#4b22a8]">
                <FoodArt art={item.art} rounded="rounded-full" />
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white/70">Smart reorder · ordered {data.timesOrdered}×</p>
            <h2 className="text-2xl font-extrabold">{data.headline} 👀</h2>
            <p className="mt-1 text-white/80">
              {data.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')} from {data.restaurant.name}
            </p>
          </div>
          <Button
            variant="sticker"
            size="lg"
            leftIcon={<RotateCcw className="h-4 w-4" />}
            loading={reorder.isPending}
            disabled={!data.restaurant.isOpen}
            onClick={() =>
              reorder.mutate(data.orderId, {
                onSuccess: (res) => {
                  if (res.skipped.length) toast.info('Some items are unavailable', res.skipped.join(', '));
                  navigate('/cart');
                },
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            {data.restaurant.isOpen ? 'Same again' : 'Closed right now'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ForYou() {
  const { data, isLoading } = useForYou();
  return (
    <section aria-labelledby="for-you-title" className="container-nf py-10">
      <SectionHeading id="for-you-title" eyebrow={data?.greeting ?? 'Picked for you'} title="Ye wala try kar 🔥" />
      {isLoading ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data?.items.slice(0, 8).map((r, i) => <DishCard key={r.food._id} food={r.food} reason={r.reason} index={i} />)}
        </div>
      )}
    </section>
  );
}

function Offers() {
  const { data } = useCoupons();
  if (!data?.length) return null;
  return (
    <section aria-labelledby="offers-title" className="container-nf py-10">
      <SectionHeading id="offers-title" eyebrow="Offers" title="Paisa bachao, pet bharo 💸" action={<Link to="/offers" className="text-sm font-bold text-brand hover:underline">All offers</Link>} />
      <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {data.map((c) => (
          <CouponTicket key={c._id} coupon={c} />
        ))}
      </div>
    </section>
  );
}

function Cuisines() {
  return (
    <section aria-labelledby="cuisines-title" className="container-nf py-10">
      <SectionHeading id="cuisines-title" eyebrow="Categories" title="Kya khaoge?" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-7">
        {CUISINES.map((c) => (
          <Link key={c} to={`/restaurants?cuisine=${encodeURIComponent(c)}`} className="group flex flex-col items-center gap-2 text-center">
            <span className="aspect-square w-full max-w-28 overflow-hidden rounded-full shadow-soft transition-transform duration-300 group-hover:-translate-y-1">
              <FoodArt art={CUISINE_ART[c] ?? { kind: 'bowl', hue: 20 }} rounded="rounded-full" />
            </span>
            <span className="text-sm font-semibold">{c}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TopRestaurants() {
  const { data, isLoading } = useRestaurants({ limit: 8, sort: 'relevance' });
  const restaurants = data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <section aria-labelledby="top-title" className="container-nf py-10">
      <SectionHeading id="top-title" eyebrow="Near you" title="Top kitchens right now" action={<Link to="/restaurants" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">See all <ArrowRight className="h-4 w-4" /></Link>} />
      {isLoading ? <CardGridSkeleton /> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {restaurants.map((r, i) => <RestaurantCard key={r._id} restaurant={r} index={i} />)}
        </div>
      )}
    </section>
  );
}

function PartnerCta() {
  return (
    <section className="container-nf py-10">
      <div className="flex flex-col items-start gap-5 rounded-xl border-2 border-ink bg-lime p-8 text-[#1b0f3b] shadow-[6px_6px_0_0_var(--nf-ink)] sm:flex-row sm:items-center">
        <ChefHat className="h-12 w-12 shrink-0" />
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold">Kitchen chalate ho?</h2>
          <p className="mt-1 font-medium">List your restaurant, manage your menu and take live orders from one dashboard.</p>
        </div>
        <ButtonLink to="/partner/apply" variant="secondary" size="lg">
          Partner with us
        </ButtonLink>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Seo
        title="NovaFood · Bhook lagi? Order in minutes"
        description="Discover food by mood, customise every bite, pay securely and track your order live with NovaFood."
        path="/"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'NovaFood', potentialAction: { '@type': 'SearchAction', target: '/search?q={query}', 'query-input': 'required name=query' } }}
      />
      <Hero />
      <SmartReorderCard />
      <MoodStrip />
      <ForYou />
      <Offers />
      <Cuisines />
      <TopRestaurants />
      <PartnerCta />
    </>
  );
}
