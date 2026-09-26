import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '../lib/device';
import { useUi } from '../stores/ui';
import { FoodArt } from './food/FoodArt';

/** A tiny copy of the dish arcs from where it was tapped into the cart button. */
export function FlyToCart() {
  const flights = useUi((s) => s.flights);
  const target = useUi((s) => s.cartTarget);
  const land = useUi((s) => s.land);
  const reduced = useReducedMotion();

  if (reduced || !target) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      <AnimatePresence>
        {flights.map((f) => {
          const startX = f.from.left + f.from.width / 2 - 28;
          const startY = f.from.top + f.from.height / 2 - 28;
          const endX = target.left + target.width / 2 - 28;
          const endY = target.top + target.height / 2 - 28;
          return (
            <motion.div
              key={f.id}
              className="absolute h-14 w-14 overflow-hidden rounded-full shadow-lift"
              initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
              animate={{ x: [startX, (startX + endX) / 2, endX], y: [startY, Math.min(startY, endY) - 120, endY], scale: [1, 1.1, 0.3], rotate: [0, -20, 20], opacity: [1, 1, 0.6] }}
              transition={{ duration: 0.75, ease: 'easeInOut' }}
              onAnimationComplete={() => land(f.id)}
            >
              <FoodArt art={f.art} rounded="rounded-full" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
