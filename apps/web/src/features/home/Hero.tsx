import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Bike, Radio, Sparkles } from 'lucide-react';
import { FoodArt } from '../../components/food/FoodArt';
import { Nova } from '../../components/mascot/Nova';
import { SearchBox } from '../../components/SearchBox';
import { canRender3D, useInView, useReducedMotion } from '../../lib/device';
import { ButtonLink } from '../../ui/Button';

const HeroScene = lazy(() => import('../../components/three/HeroScene'));

const HEADLINES = ['Bhook lagi? 👀', 'Aaj diet cancel?', 'Mood = food.', 'Kya scene hai?'];

/** Lightweight stand-in used on low-end devices, with reduced motion, or while 3D loads. */
function FlatHero() {
  const reduced = useReducedMotion();
  const stickers = [
    { art: { kind: 'burger', hue: 30 }, className: 'left-2 top-6 h-20 w-20 -rotate-12' },
    { art: { kind: 'pizza', hue: 8 }, className: 'right-4 top-2 h-24 w-24 rotate-12' },
    { art: { kind: 'icecream', hue: 330 }, className: 'bottom-10 left-6 h-20 w-20 rotate-6' },
    { art: { kind: 'shake', hue: 260 }, className: 'bottom-4 right-8 h-20 w-20 -rotate-6' },
  ];
  return (
    <div className="relative grid h-full place-items-center">
      {stickers.map((s, i) => (
        <motion.div
          key={i}
          className={`absolute overflow-hidden rounded-full border-4 border-surface shadow-lift ${s.className}`}
          animate={reduced ? undefined : { y: [0, -12, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
        >
          <FoodArt art={s.art} rounded="rounded-full" />
        </motion.div>
      ))}
      <Nova size={260} />
    </div>
  );
}

export function Hero() {
  const [headline, setHeadline] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, '0px');
  const [use3D] = useState(canRender3D);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setHeadline((h) => (h + 1) % HEADLINES.length), 3200);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 top-10 h-[24rem] w-[24rem] rounded-full bg-grape/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-lime/30 blur-3xl" />

      <div className="container-nf relative grid items-center gap-8 pb-10 pt-6 md:pt-10 lg:grid-cols-[1.1fr_1fr] lg:pb-20">
        <div>
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sticker inline-flex -rotate-2 items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Bengaluru ka naya food scene
          </motion.span>
          <h1 id="hero-title" className="mt-5 font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
            <span className="sr-only">NovaFood. </span>
            <motion.span key={headline} initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="block text-balance">
              {HEADLINES[headline]}
            </motion.span>
            <span className="mt-2 block bg-gradient-to-r from-brand via-bubble to-grape bg-clip-text text-transparent">Order kar, chill kar.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Discover dishes by mood, customise every bite, pay securely and watch your order move from kitchen to doorstep in real time.
          </p>
          <SearchBox size="lg" className="mt-7 max-w-xl" />
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink to="/restaurants" size="lg">
              Order now
            </ButtonLink>
            <ButtonLink to="/moods" size="lg" variant="sticker">
              Mood se dhoondo 🎭
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft">
            <li className="inline-flex items-center gap-2"><Bike className="h-4 w-4 text-brand" /> Fast local kitchens</li>
            <li className="inline-flex items-center gap-2"><Radio className="h-4 w-4 text-brand" /> Live order tracking</li>
            <li className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Nova Points on every order</li>
          </ul>
        </div>

        <div ref={stage} className="relative h-[340px] sm:h-[420px] lg:h-[520px]">
          {use3D ? (
            <Suspense fallback={<FlatHero />}>{inView ? <HeroScene active={inView} /> : <FlatHero />}</Suspense>
          ) : (
            <FlatHero />
          )}
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-ink-soft backdrop-blur">
            {use3D ? 'Hover the snacks. Nova gets hungry 😋' : 'Nova is watching your cursor 👀'}
          </p>
        </div>
      </div>
    </section>
  );
}
