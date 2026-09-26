import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import { MOODS, type MascotMoodHint, getMood } from './moodHints';
import { useFoods } from '../../api/catalog';
import { DishCard } from '../../components/food/cards';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { CardGridSkeleton, EmptyState } from '../../components/States';
import { cn } from '../../lib/cn';
import { useMascot } from '../../stores/mascot';
import { Button } from '../../ui/Button';

export function MoodsPage() {
  const { mood: moodId } = useParams();
  const mood = moodId ? getMood(moodId) : undefined;
  const react = useMascot((s) => s.react);
  const foods = useFoods({ mood: mood?.id, limit: 16 }, Boolean(mood));
  const dishes = foods.data?.pages.flatMap((p) => p.data) ?? [];

  useEffect(() => {
    if (mood) react(mood.mascot as MascotMoodHint, 2500);
  }, [mood, react]);

  return (
    <div className="container-nf py-8">
      <Seo title={mood ? `${mood.label} mood food` : 'Food by mood'} description="Tell NovaFood how you feel and get dishes that match your mood." path={mood ? `/moods/${mood.id}` : '/moods'} />
      <div className="flex flex-col items-center text-center">
        <Nova size={120} />
        <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{mood ? (foods.data?.pages[0]?.meta.headline as string | undefined) ?? mood.headline : 'Aaj ka mood kya hai?'}</h1>
        <p className="mt-2 max-w-lg text-ink-soft">Pick a vibe. We match dishes by flavour tags, not guesswork, and put open kitchens first.</p>
      </div>

      <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-3" role="list">
        {MOODS.map((m) => (
          <motion.div key={m.id} role="listitem" whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
            <Link
              to={`/moods/${m.id}`}
              aria-current={m.id === mood?.id ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full border-2 px-5 py-3 font-display font-bold transition-all',
                m.id === mood?.id ? 'border-ink bg-ink text-canvas shadow-[4px_4px_0_0_var(--color-brand)]' : 'border-line bg-surface hover:border-ink',
              )}
            >
              <span className="text-2xl" aria-hidden>{m.emoji}</span>
              {m.label}
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-10">
        {!mood ? null : foods.isLoading ? (
          <CardGridSkeleton />
        ) : dishes.length === 0 ? (
          <EmptyState title="Is mood ke liye kuch nahi mila 😭" body="Try another mood; menus change through the day." action={<Button onClick={() => foods.refetch()}>Refresh</Button>} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dishes.map((f, i) => <DishCard key={f._id} food={f} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
