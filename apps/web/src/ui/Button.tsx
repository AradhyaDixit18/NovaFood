import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'sticker';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_10px_24px_-10px_rgb(255_77_46/0.8)] hover:-translate-y-0.5 hover:bg-brand-strong',
  secondary: 'bg-ink text-canvas hover:-translate-y-0.5 hover:opacity-90',
  ghost: 'text-ink hover:bg-surface-2',
  outline: 'border-2 border-line bg-surface text-ink hover:border-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  sticker:
    'border-2 border-ink bg-lime font-display text-[#1b0f3b] shadow-[3px_3px_0_0_var(--nf-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_var(--nf-ink)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-full px-4 text-sm',
  md: 'h-11 rounded-full px-5 text-[15px]',
  lg: 'h-14 rounded-full px-7 text-base',
  icon: 'h-10 w-10 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, leftIcon, rightIcon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
