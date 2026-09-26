import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { COPY } from '@novafood/shared';
import { useHelpful, useReviews } from '../../api/catalog';
import { EmptyState } from '../../components/States';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';
import { useIsAuthed } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { Pagination } from '../../ui/controls';
import { Rating } from '../../ui/primitives';

export function ReviewsSection({ restaurantId, foodId, rating, count }: { restaurantId?: string; foodId?: string; rating: number; count: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviews({ restaurantId: foodId ? undefined : restaurantId, foodId, page, limit: 6 });
  const helpful = useHelpful();
  const authed = useIsAuthed();

  return (
    <section aria-labelledby="reviews-title" className="mt-12">
      <div className="mb-5 flex items-center gap-3">
        <h2 id="reviews-title" className="text-2xl font-extrabold">
          Reviews
        </h2>
        <Rating value={rating} count={count} />
      </div>
      {isLoading ? null : !data?.data.length ? (
        <EmptyState compact mood="curious" title={COPY.empty.reviews.title} body="Reviews come only from customers whose order was delivered." />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2">
            {data.data.map((r) => (
              <li key={r._id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-grape-soft font-display font-bold text-grape dark:bg-grape/25 dark:text-[#c9b2ff]">{r.user.name[0]}</span>
                    <div>
                      <p className="font-semibold">{r.user.name}</p>
                      <p className="text-xs text-ink-faint">
                        {timeAgo(r.createdAt)}
                        {r.foodName ? ` · ${r.foodName}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-success px-2 py-0.5 text-sm font-bold text-white">{r.rating}★</span>
                </div>
                {r.comment ? <p className="mt-3 text-ink-soft">{r.comment}</p> : null}
                <button
                  type="button"
                  aria-pressed={r.markedHelpful}
                  onClick={() => (authed ? helpful.mutate(r._id) : toast.info('Log in to vote on reviews'))}
                  className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', r.markedHelpful ? 'bg-grape text-white' : 'bg-surface-2 text-ink-soft hover:text-ink')}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Helpful{r.helpfulCount ? ` · ${r.helpfulCount}` : ''}
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
