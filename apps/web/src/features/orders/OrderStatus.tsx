import { motion } from 'motion/react';
import { Bike, Check, ChefHat, ClipboardCheck, Home, Package, Store } from 'lucide-react';
import { type OrderDTO, type OrderStatus, STATUS_META, TRACKING_STEPS } from '@novafood/shared';
import { cn } from '../../lib/cn';
import { clock } from '../../lib/format';
import { Badge } from '../../ui/primitives';

const STEP_ICON: Partial<Record<OrderStatus, typeof Check>> = {
  ORDER_PLACED: ClipboardCheck,
  RESTAURANT_ACCEPTED: Store,
  PREPARING: ChefHat,
  READY_FOR_PICKUP: Package,
  OUT_FOR_DELIVERY: Bike,
  DELIVERED: Home,
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  const tone = meta.tone === 'success' ? 'success' : meta.tone === 'danger' ? 'danger' : meta.tone === 'warning' ? 'warning' : meta.tone === 'info' ? 'grape' : 'neutral';
  return <Badge tone={tone}>{meta.label}</Badge>;
}

/** Stage-based progress from the real status history; no simulated GPS. */
export function OrderTimeline({ order }: { order: OrderDTO }) {
  const reached = new Map(order.statusHistory.map((e) => [e.status, e.at]));
  const currentIndex = TRACKING_STEPS.findIndex((s) => s === order.status);
  const offPath = currentIndex === -1;

  return (
    <ol className="relative space-y-6" aria-label="Order progress">
      {TRACKING_STEPS.map((step, i) => {
        const Icon = STEP_ICON[step] ?? Check;
        const at = reached.get(step);
        const done = Boolean(at) && (offPath || i <= currentIndex);
        const current = !offPath && i === currentIndex;
        return (
          <li key={step} className="relative flex gap-4" aria-current={current ? 'step' : undefined}>
            {i < TRACKING_STEPS.length - 1 ? (
              <span aria-hidden className={cn('absolute left-5 top-11 h-[calc(100%-8px)] w-1 -translate-x-1/2 rounded-full', done && i < currentIndex ? 'bg-brand' : 'bg-line')} />
            ) : null}
            <span className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors', done ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-faint')}>
              {current ? <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-brand" animate={{ scale: [1, 1.5], opacity: [0.8, 0] }} transition={{ duration: 1.4, repeat: Infinity }} /> : null}
              <Icon className="h-5 w-5" />
            </span>
            <div className="pt-1.5">
              <p className={cn('font-semibold', !done && 'text-ink-faint')}>{STATUS_META[step].label}</p>
              {at ? <p className="text-sm text-ink-faint">{clock(at)}</p> : null}
              {current ? <p className="mt-1 text-sm font-medium text-ink-soft">{STATUS_META[step].message}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A road with the rider icon placed by stage: honest progress until live rider GPS exists. */
export function DeliveryProgress({ status }: { status: OrderStatus }) {
  const index = TRACKING_STEPS.indexOf(status);
  const progress = index < 0 ? 0 : index / (TRACKING_STEPS.length - 1);
  return (
    <div className="relative h-16" aria-hidden>
      <div className="absolute inset-x-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-line" />
      <motion.div className="absolute left-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand to-bubble" initial={{ width: 0 }} animate={{ width: `calc((100% - 3rem) * ${progress})` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
      <Store className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 text-grape" />
      <Home className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 text-grape" />
      <motion.div
        className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-lift"
        initial={{ left: '1.5rem' }}
        animate={{ left: `calc(1.5rem + (100% - 3rem) * ${progress})` }}
        transition={{ type: 'spring', stiffness: 80, damping: 18 }}
      >
        <Bike className="h-5 w-5 text-brand" />
      </motion.div>
    </div>
  );
}
