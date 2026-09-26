import { Link } from 'react-router';
import { cn } from '../../lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#ff4d2e" />
      <path d="M32 12l5.6 13.2L52 27l-11 9.4L44.4 51 32 43.2 19.6 51 23 36.4 12 27l14.4-1.8z" fill="#fff7f0" />
      <circle cx="27" cy="31" r="2.6" fill="#1b0f3b" />
      <circle cx="37" cy="31" r="2.6" fill="#1b0f3b" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="NovaFood home" className={cn('group flex shrink-0 items-center gap-2', className)}>
      <LogoMark className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-12" />
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Nova<span className="text-brand">Food</span>
      </span>
    </Link>
  );
}
