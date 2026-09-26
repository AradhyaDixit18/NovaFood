import type { ReactNode } from 'react';
import { COPY } from '@novafood/shared';
import { ApiError, errorMessage } from '../lib/api';
import type { MascotMood } from '../stores/mascot';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/primitives';
import { Nova } from './mascot/Nova';

export function EmptyState({ title, body, action, mood = 'curious', compact }: { title: string; body?: string; action?: ReactNode; mood?: MascotMood; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-col items-center py-8 text-center' : 'flex flex-col items-center py-16 text-center'}>
      <Nova mood={mood} size={compact ? 96 : 140} />
      <h2 className="mt-4 text-2xl font-extrabold">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <EmptyState
      mood="worried"
      title={notFound ? COPY.error.notFound : 'Oops, kuch gadbad ho gayi'}
      body={errorMessage(error)}
      action={onRetry && !notFound ? <Button onClick={onRetry}>Try again</Button> : undefined}
    />
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3 text-ink-soft">
        <Nova mood="sleepy" size={96} track={false} />
        <p className="font-semibold">{COPY.loading[0]}</p>
      </div>
    </div>
  );
}
