import { type MouseEvent, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Bike, Clock, Flame, Heart, Plus, Sparkles, Ticket } from 'lucide-react';
import { type CouponDTO, type FoodDTO, type RestaurantSummaryDTO } from '@novafood/shared';
import { useFavoriteIds, useToggleFavorite } from '../../api/account';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { useIsAuthed } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { Badge, Price, Rating, VegMark } from '../../ui/primitives';
import { useDishAdder } from './useDishAdder';
import { FoodArt } from './FoodArt';

export function FavoriteButton({ kind, id, name, className }: { kind: 'restaurant' | 'food'; id: string; name: string; className?: string }) {
  const authed = useIsAuthed();
  const ids = useFavoriteIds();
  const toggle = useToggleFavorite();
  const navigate = useNavigate();
  const on = (kind === 'restaurant' ? ids.data?.restaurantIds : ids.data?.foodIds)?.includes(id) ?? false;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!authed) {
          toast.info('Log in to save favourites ❤️', undefined, { label: 'Log in', onClick: () => navigate('/login') });
          return;
        }
        toggle.mutate({ kind, id, on: !on });
      }}
      className={cn('grid h-9 w-9 place-items-center rounded-full bg-surface/90 shadow-soft backdrop-blur transition-transform hover:scale-110 active:scale-90', className)}
    >
      <Heart className={cn('h-4.5 w-4.5 transition-colors', on ? 'fill-brand text-brand' : 'text-ink-soft')} />
    </button>
  );
}

export function RestaurantCard({ restaurant, index = 0 }: { restaurant: RestaurantSummaryDTO; index?: number }) {
  const closed = !restaurant.isOpen || !restaurant.isAcceptingOrders;
  return (
    <motion.article
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="group relative"
    >
      <Link to={`/r/${restaurant.slug}`} className="block rounded-lg focus-visible:outline-offset-4">
        <div className={cn('relative aspect-[4/3] overflow-hidden rounded-lg shadow-soft transition-shadow duration-300 group-hover:shadow-lift', closed && 'grayscale-[60%]')}>
          <FoodArt art={restaurant.art} imageUrl={restaurant.coverUrl} alt="" />
          {restaurant.offerText ? (
            <span className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-full bg-ink/85 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              <Ticket className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
              {restaurant.offerText}
            </span>
          ) : null}
          {closed ? <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#1b0f3b]">{restaurant.isOpen ? 'Paused' : 'Closed now'}</span> : null}
        </div>
        <div className="mt-3 space-y-1 px-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-lg font-bold">{restaurant.name}</h3>
            <Rating value={restaurant.rating} count={restaurant.ratingCount} />
          </div>
          <p className="truncate text-sm text-ink-soft">{restaurant.cuisines.join(' · ')}</p>
          <p className="flex items-center gap-3 text-sm text-ink-faint">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {restaurant.deliveryTimeMins} min</span>
            <span>{money(restaurant.costForTwoPaise)} for two</span>
            {restaurant.pureVeg ? <Badge tone="success">Pure veg</Badge> : null}
          </p>
        </div>
      </Link>
      <FavoriteButton kind="restaurant" id={restaurant._id} name={restaurant.name} className="absolute right-3 top-3" />
    </motion.article>
  );
}

/** Grid card for a dish outside its restaurant page (search, moods, recommendations). */
export function DishCard({ food, reason, index = 0 }: { food: FoodDTO; reason?: string; index?: number }) {
  const adder = useDishAdder();
  const button = useRef<HTMLButtonElement>(null);
  const restaurant = food.restaurant;
  const unavailable = !food.isAvailable || (restaurant && !restaurant.isOpen);
  return (
    <motion.article
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <Link to={`/dish/${food._id}`} className="relative block aspect-[4/3]">
        <FoodArt art={food.art} imageUrl={food.imageUrl} rounded="rounded-none" />
        {food.isBestseller ? (
          <span className="sticker absolute left-3 top-3 -rotate-6 text-xs">
            <Flame className="mr-0.5 inline h-3.5 w-3.5 -translate-y-px" />
            Bestseller
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {reason ? (
          <p className="inline-flex items-center gap-1 text-xs font-bold text-grape dark:text-[#c9b2ff]">
            <Sparkles className="h-3.5 w-3.5" /> {reason}
          </p>
        ) : null}
        <div className="flex items-start gap-2">
          <VegMark veg={food.isVeg} className="mt-1" />
          <Link to={`/dish/${food._id}`} className="font-display text-lg font-bold leading-snug hover:underline">
            {food.name}
          </Link>
        </div>
        {restaurant ? (
          <Link to={`/r/${restaurant.slug}`} className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
            {restaurant.name}
            <span className="inline-flex items-center gap-0.5 text-ink-faint"><Bike className="h-3.5 w-3.5" /> {restaurant.deliveryTimeMins}m</span>
          </Link>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <Price paise={food.pricePaise} compareAt={food.compareAtPricePaise} />
          <button
            ref={button}
            type="button"
            disabled={Boolean(unavailable)}
            aria-label={`Add ${food.name} to cart`}
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              if (restaurant) adder.add(food, { _id: restaurant._id, name: restaurant.name, slug: restaurant.slug }, button.current?.getBoundingClientRect());
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white shadow-[0_8px_18px_-8px_rgb(255_77_46/0.9)] transition-transform hover:scale-110 active:scale-90 disabled:bg-line disabled:shadow-none"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {unavailable ? <p className="text-xs font-semibold text-ink-faint">{food.isAvailable ? 'Restaurant closed now' : 'Sold out'}</p> : null}
      </div>
    </motion.article>
  );
}

export function CouponTicket({ coupon, onApply, applying }: { coupon: Pick<CouponDTO, 'code' | 'description' | 'firstOrderOnly' | 'minOrderPaise'>; onApply?: () => void; applying?: boolean }) {
  return (
    <div className="relative flex min-w-64 items-stretch overflow-hidden rounded-lg border-2 border-dashed border-grape/40 bg-grape-soft/60 dark:bg-grape/15">
      <div className="grid w-16 shrink-0 place-items-center bg-grape text-white">
        <Ticket className="h-6 w-6 -rotate-12" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-3">
        <p className="font-display text-lg font-extrabold tracking-wide">{coupon.code}</p>
        <p className="text-sm text-ink-soft">{coupon.description}</p>
        {coupon.firstOrderOnly ? <Badge tone="grape" className="w-fit">First order</Badge> : null}
      </div>
      {onApply ? (
        <button type="button" onClick={onApply} disabled={applying} aria-label={`Apply coupon ${coupon.code}`} className="px-4 text-sm font-bold text-grape hover:underline disabled:opacity-50 dark:text-[#c9b2ff]">
          Apply
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Copy coupon code ${coupon.code}`}
          className="px-4 text-sm font-bold text-grape hover:underline dark:text-[#c9b2ff]"
          onClick={() => {
            void navigator.clipboard?.writeText(coupon.code).then(() => toast.success(`${coupon.code} copied`), () => undefined);
          }}
        >
          Copy
        </button>
      )}
    </div>
  );
}
