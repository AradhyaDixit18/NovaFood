import { type ReactNode, useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/cn';

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
  size = 'md',
  busy,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
  busy?: boolean;
}) {
  const h = size === 'sm' ? 'h-8' : 'h-10';
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn('inline-flex items-center overflow-hidden rounded-full border-2 border-brand bg-surface font-bold text-brand', h, busy && 'opacity-70')}
    >
      <button type="button" aria-label={`Remove one ${label}`} disabled={busy || value <= min} onClick={() => onChange(value - 1)} className={cn('grid place-items-center px-2.5 hover:bg-brand-soft disabled:opacity-40 dark:hover:bg-brand/20', h)}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="relative w-7 overflow-hidden text-center tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} className="block">
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label={`Add one more ${label}`} disabled={busy || value >= max} onClick={() => onChange(value + 1)} className={cn('grid place-items-center px-2.5 hover:bg-brand-soft disabled:opacity-40 dark:hover:bg-brand/20', h)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  const id = useId();
  return (
    <div role="tablist" className={cn('inline-flex gap-1 rounded-full bg-surface-2 p-1', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          id={`${id}-${item.value}`}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn('relative rounded-full px-4 py-2 text-sm font-semibold transition-colors', value === item.value ? 'text-canvas' : 'text-ink-soft hover:text-ink')}
        >
          {value === item.value ? <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 35 }} /> : null}
          <span className="relative">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-4">
      <button type="button" className="rounded-full border-2 border-line px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-ink-soft">
        Page {page} of {totalPages}
      </span>
      <button type="button" className="rounded-full border-2 border-line px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function SectionHeading({ eyebrow, title, action, id }: { eyebrow?: string; title: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-sm font-bold uppercase tracking-wider text-brand">{eyebrow}</p> : null}
        <h2 id={id} className="text-2xl font-extrabold sm:text-3xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
