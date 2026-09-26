import { type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../lib/cn';
import { money } from '../lib/format';

/* --------------------------------- Surfaces --------------------------------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface shadow-soft', className)} {...rest} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

type BadgeTone = 'neutral' | 'brand' | 'grape' | 'success' | 'warning' | 'danger' | 'lime';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  brand: 'bg-brand-soft text-brand-strong dark:bg-brand/20 dark:text-brand',
  grape: 'bg-grape-soft text-grape dark:bg-grape/25 dark:text-[#c9b2ff]',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  lime: 'bg-lime text-[#1b0f3b]',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>{children}</span>;
}

/** Selectable pill used for filters. */
export function Chip({
  active,
  className,
  children,
  ...rest
}: { active?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold transition-all',
        active ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink-soft hover:border-ink hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------ Food ----------------------------------- */

/** FSSAI-style veg / non-veg mark: a square with a dot (veg) or triangle (non-veg). */
export function VegMark({ veg, className }: { veg: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 bg-white', veg ? 'border-veg' : 'border-nonveg', className)}
    >
      {veg ? (
        <span className="h-1.5 w-1.5 rounded-full bg-veg" />
      ) : (
        <span className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-nonveg" />
      )}
    </span>
  );
}

export function Rating({ value, count, className }: { value: number; count?: number; className?: string }) {
  if (!count) return <Badge tone="lime" className={className}>New ✨</Badge>;
  const tone = value >= 4 ? 'bg-success' : value >= 3 ? 'bg-warning' : 'bg-danger';
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', className)}>
      <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs text-white', tone)}>
        {value.toFixed(1)} <Star aria-hidden className="h-3 w-3 fill-current" />
      </span>
      <span className="text-xs font-medium text-ink-faint">({count})</span>
      <span className="sr-only">rated {value.toFixed(1)} out of 5 from {count} reviews</span>
    </span>
  );
}

export function Price({ paise, compareAt, className }: { paise: number; compareAt?: number | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span className="font-bold">{money(paise)}</span>
      {compareAt && compareAt > paise ? (
        <>
          <span className="text-xs text-ink-faint line-through">{money(compareAt)}</span>
          <span className="text-xs font-bold text-success">{Math.round((1 - paise / compareAt) * 100)}% off</span>
        </>
      ) : null}
    </span>
  );
}

export function StarInput({ value, onChange, label, size = 'md' }: { value: number; onChange: (v: number) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="rounded-full p-0.5 transition-transform hover:scale-110"
        >
          <Star className={cn(size === 'sm' ? 'h-5 w-5' : 'h-8 w-8', n <= value ? 'fill-sun text-sun' : 'text-line')} />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------ Forms ---------------------------------- */

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; id?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-md border-2 border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint transition-colors focus:border-grape focus:outline-none aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, 'h-12', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputBase, 'min-h-24 py-3', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(inputBase, 'h-11 cursor-pointer pr-9', className)} {...rest}>
      {children}
    </select>
  );
});

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description ? <p className="text-sm text-ink-faint">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-line')}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ease-[var(--ease-spring)]', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
