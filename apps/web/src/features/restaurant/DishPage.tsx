import { useRef } from 'react';
import { Link, useParams } from 'react-router';
import { Clock, Flame, Leaf, Store } from 'lucide-react';
import { useAlsoOrdered, useFood } from '../../api/catalog';
import { DishCard, FavoriteButton } from '../../components/food/cards';
import { useDishAdder } from '../../components/food/useDishAdder';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { ErrorState, PageLoader } from '../../components/States';
import { money } from '../../lib/format';
import { Button } from '../../ui/Button';
import { SectionHeading } from '../../ui/controls';
import { Badge, Price, Rating, VegMark } from '../../ui/primitives';
import { ReviewsSection } from './ReviewsSection';

export function DishPage() {
  const { id = '' } = useParams();
  const { data: food, isLoading, error, refetch } = useFood(id);
  const also = useAlsoOrdered(id);
  const adder = useDishAdder();
  const art = useRef<HTMLDivElement>(null);

  if (isLoading) return <PageLoader />;
  if (error || !food) return <div className="container-nf"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  const restaurant = food.restaurant;
  const closed = !restaurant?.isOpen;

  return (
    <div className="container-nf py-8">
      <Seo
        title={`${food.name} from ${restaurant?.name ?? 'NovaFood'}`}
        description={food.description}
        path={`/dish/${food._id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'MenuItem',
          name: food.name,
          description: food.description,
          offers: { '@type': 'Offer', price: (food.pricePaise / 100).toFixed(2), priceCurrency: 'INR' },
          suitableForDiet: food.isVeg ? 'https://schema.org/VegetarianDiet' : undefined,
          ...(food.nutrition ? { nutrition: { '@type': 'NutritionInformation', calories: `${food.nutrition.calories} calories` } } : {}),
        }}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <div ref={art} className="relative aspect-square overflow-hidden rounded-xl shadow-lift">
          <FoodArt art={food.art} imageUrl={food.imageUrl} alt={food.name} width={900} />
          <FavoriteButton kind="food" id={food._id} name={food.name} className="absolute right-4 top-4 h-11 w-11" />
        </div>
        <div>
          {restaurant ? (
            <Link to={`/r/${restaurant.slug}`} className="inline-flex items-center gap-2 font-semibold text-brand hover:underline">
              <Store className="h-4 w-4" /> {restaurant.name}
            </Link>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VegMark veg={food.isVeg} />
            {food.isBestseller ? <Badge tone="brand"><Flame className="h-3 w-3" /> Bestseller</Badge> : null}
            {food.dietTags.map((t) => <Badge key={t} tone="success"><Leaf className="h-3 w-3" /> {t}</Badge>)}
            <Badge>{food.cuisine}</Badge>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{food.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Price paise={food.pricePaise} compareAt={food.compareAtPricePaise} className="text-2xl" />
            <Rating value={food.rating} count={food.ratingCount} />
            {restaurant ? <span className="inline-flex items-center gap-1 text-sm text-ink-soft"><Clock className="h-4 w-4" /> {restaurant.deliveryTimeMins} min</span> : null}
          </div>
          <p className="mt-4 text-lg text-ink-soft">{food.description}</p>

          <Button
            size="lg"
            className="mt-6 w-full sm:w-auto"
            disabled={!food.isAvailable || closed}
            onClick={() => restaurant && adder.add(food, { _id: restaurant._id, name: restaurant.name, slug: restaurant.slug }, art.current?.getBoundingClientRect())}
          >
            {!food.isAvailable ? 'Sold out' : closed ? 'Restaurant closed now' : `Add to cart · ${money(food.pricePaise)}`}
          </Button>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {food.variants.length ? (
              <div className="rounded-lg border border-line p-4">
                <dt className="font-semibold">Sizes</dt>
                <dd className="mt-1 text-sm text-ink-soft">{food.variants.map((v) => `${v.name} ${money(v.pricePaise)}`).join(' · ')}</dd>
              </div>
            ) : null}
            {food.ingredients.length ? (
              <div className="rounded-lg border border-line p-4">
                <dt className="font-semibold">Ingredients</dt>
                <dd className="mt-1 text-sm text-ink-soft">{food.ingredients.join(', ')}</dd>
              </div>
            ) : null}
            <div className="rounded-lg border border-line p-4">
              <dt className="font-semibold">Allergens</dt>
              <dd className="mt-1 text-sm text-ink-soft">{food.allergens.length ? food.allergens.join(', ') : 'None declared by the restaurant'}</dd>
            </div>
            {food.nutrition ? (
              <div className="rounded-lg border border-line p-4">
                <dt className="font-semibold">Nutrition (approx.)</dt>
                <dd className="mt-1 text-sm text-ink-soft">
                  {food.nutrition.calories} kcal · P {food.nutrition.proteinG}g · C {food.nutrition.carbsG}g · F {food.nutrition.fatG}g
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {also.data?.length ? (
        <section className="mt-14">
          <SectionHeading eyebrow="Pairs well" title="People also ordered" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {also.data.map((a, i) => (
              <DishCard key={a.food._id} food={{ ...a.food, restaurant: food.restaurant }} reason={`Ordered together ${a.timesTogether}×`} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      <ReviewsSection foodId={food._id} rating={food.rating} count={food.ratingCount} />
    </div>
  );
}
