import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { COPY, KITCHEN_ACTIVE_STATUSES } from '@novafood/shared';
import { useOrders, useReorder } from '../../api/orders';
import { FoodArt } from '../../components/food/FoodArt';
import { Seo } from '../../components/Seo';
import { EmptyState, ErrorState, PageLoader } from '../../components/States';
import { errorMessage } from '../../lib/api';
import { dateTime, money } from '../../lib/format';
import { toast } from '../../stores/toast';
import { Button, ButtonLink } from '../../ui/Button';
import { Pagination } from '../../ui/controls';
import { Card } from '../../ui/primitives';
import { StatusBadge } from './OrderStatus';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useOrders({ page });
  const reorder = useReorder();
  const navigate = useNavigate();

  if (isLoading) return <PageLoader />;
  if (error) return <div className="container-nf"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  const orders = data?.data ?? [];

  return (
    <div className="container-nf py-8">
      <Seo title="Your orders" noindex />
      <h1 className="mb-6 text-4xl font-extrabold">Orders</h1>
      {orders.length === 0 ? (
        <EmptyState title={COPY.empty.orders.title} body={COPY.empty.orders.body} action={<ButtonLink to="/restaurants">Order kar bhai 😭</ButtonLink>} />
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const active = (KITCHEN_ACTIVE_STATUSES as readonly string[]).includes(o.status) || o.status === 'PAYMENT_PENDING';
            return (
              <li key={o._id}>
                <Card className={active ? 'border-brand/40 p-5 ring-2 ring-brand/20' : 'p-5'}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="h-14 w-14 overflow-hidden rounded-md"><FoodArt art={o.restaurant.art} rounded="rounded-md" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-bold">{o.restaurant.name}</p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="truncate text-sm text-ink-soft">{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}</p>
                      <p className="text-xs text-ink-faint">{o.orderNumber} · {dateTime(o.createdAt)} · {money(o.pricing.totalPaise)}</p>
                    </div>
                    <div className="flex gap-2">
                      {o.status === 'DELIVERED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<RotateCcw className="h-4 w-4" />}
                          onClick={() =>
                            reorder.mutate(o._id, {
                              onSuccess: (res) => {
                                if (res.skipped.length) toast.info('Some items are unavailable', res.skipped.join(', '));
                                navigate('/cart');
                              },
                              onError: (err) => toast.error(errorMessage(err)),
                            })
                          }
                        >
                          Reorder
                        </Button>
                      ) : null}
                      <ButtonLink to={`/orders/${o._id}`} size="sm" variant={active ? 'primary' : 'ghost'}>
                        {active ? 'Track' : 'Details'} <ChevronRight className="h-4 w-4" />
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {data ? <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /> : null}
      <p className="mt-6 text-center text-sm text-ink-faint">
        Need help with an order? <Link to="/about" className="font-semibold text-brand">Contact support</Link>
      </p>
    </div>
  );
}
