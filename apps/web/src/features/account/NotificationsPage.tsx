import { Link } from 'react-router';
import { Bell, CreditCard, Gift, Package, Store } from 'lucide-react';
import { COPY, type NotificationType } from '@novafood/shared';
import { useMarkRead, useNotifications } from '../../api/account';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';
import { Button } from '../../ui/Button';

const ICONS: Record<NotificationType, typeof Bell> = { ORDER: Package, PAYMENT: CreditCard, OFFER: Gift, RESTAURANT: Store, SYSTEM: Bell, REWARD: Gift };

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const mark = useMarkRead();
  if (isLoading) return <PageLoader />;
  const items = data?.data ?? [];
  const unread = Number(data?.meta.unread ?? 0);
  return (
    <div className="container-nf max-w-3xl py-8">
      <Seo title="Notifications" noindex />
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold">Notifications</h1>
        {unread > 0 ? <Button variant="ghost" size="sm" onClick={() => mark.mutate(undefined)}>Mark all read</Button> : null}
      </div>
      {items.length === 0 ? (
        <EmptyState mood="sleepy" title={COPY.empty.notifications.title} body={COPY.empty.notifications.body} />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type];
            const body = (
              <div className={cn('flex gap-4 rounded-lg border p-4 transition-colors', n.read ? 'border-line bg-surface' : 'border-brand/30 bg-brand-soft/40 dark:bg-brand/10')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2"><Icon className="h-5 w-5 text-brand" /></span>
                <div className="flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-ink-soft">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-faint">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" /> : null}
              </div>
            );
            return (
              <li key={n._id}>
                {n.link ? (
                  <Link to={n.link} onClick={() => !n.read && mark.mutate(n._id)} className="block">
                    {body}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left" onClick={() => !n.read && mark.mutate(n._id)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
