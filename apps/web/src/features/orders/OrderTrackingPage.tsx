import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, CreditCard, RotateCcw, Sparkles, Star, Wifi, WifiOff, XCircle } from 'lucide-react';
import { STATUS_META, canTransition } from '@novafood/shared';
import { useCancelOrder, useOrder, useReorder, useRetryPayment } from '../../api/orders';
import { FoodArt } from '../../components/food/FoodArt';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { ErrorState, PageLoader } from '../../components/States';
import { useOrderLive } from '../../hooks/useRealtime';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { clock, dateTime, minutesUntil, money } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { confirm } from '../../stores/confirm';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Card, VegMark } from '../../ui/primitives';
import { BillDetails } from '../cart/CartPage';
import { usePayForOrder } from '../checkout/usePayment';
import { DeliveryProgress, OrderTimeline, StatusBadge } from './OrderStatus';
import { mascotFor } from './statusMood';
import { ReviewModal } from './ReviewModal';
import { ShareCardButton } from './ShareCard';

function Eta({ iso, delivered }: { iso: string | null; delivered: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (delivered || !iso) return null;
  const mins = minutesUntil(iso);
  if (mins === null) return null;
  return (
    <p className="text-sm font-semibold text-ink-soft">
      {mins > 0 ? `Arriving in about ${mins} min · by ${clock(iso)}` : `Expected around ${clock(iso)}. Almost there!`}
    </p>
  );
}

export function OrderTrackingPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data, isLoading, error, refetch } = useOrder(id);
  const live = useOrderLive(id);
  const cancel = useCancelOrder();
  const reorder = useReorder();
  const retry = useRetryPayment();
  const pay = usePayForOrder();
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [reviewing, setReviewing] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <div className="container-nf"><ErrorState error={error} onRetry={() => refetch()} /></div>;

  const { order, payment } = data;
  const meta = STATUS_META[order.status];
  const delivered = order.status === 'DELIVERED';
  const canCancel = canTransition(order.status, 'CANCELLED', 'customer');
  const awaitingPayment = order.status === 'PAYMENT_PENDING' || order.status === 'PAYMENT_FAILED';
  const justPlaced = params.get('placed') === '1';

  const doCancel = async () => {
    if (!(await confirm({ title: 'Cancel this order?', body: order.payment.status === 'PAID' ? 'Your payment will be refunded automatically.' : 'The restaurant has not started on it yet.', confirmLabel: 'Cancel order', danger: true, cancelLabel: 'Keep it' }))) return;
    cancel.mutate({ id: order._id }, { onError: (err) => toast.error(errorMessage(err)) });
  };

  const doPay = async () => {
    try {
      let init = payment;
      if (!init || order.status === 'PAYMENT_FAILED') init = (await retry.mutateAsync(order._id)).payment ?? null;
      if (init) await pay(order, init, order.customer?.phone ?? user?.phone ?? '');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="container-nf py-8">
      <Seo title={`Order ${order.orderNumber}`} noindex />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-faint">
            <Link to="/orders" className="hover:text-ink">Orders</Link> / {order.orderNumber}
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{justPlaced && order.status === 'ORDER_PLACED' ? 'Scene sorted! 🎉' : meta.label}</h1>
        </div>
        <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold', live ? 'bg-success/12 text-success' : 'bg-surface-2 text-ink-faint')} aria-live="polite">
          {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {live ? 'Live updates on' : 'Reconnecting…'}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-brand-soft via-surface to-grape-soft p-6 text-center sm:flex-row sm:text-left dark:from-brand/15 dark:to-grape/15">
              <Nova mood={mascotFor(order.status)} size={120} />
              <div className="flex-1">
                <StatusBadge status={order.status} />
                <p className="mt-2 font-display text-2xl font-bold">{meta.message}</p>
                <Eta iso={order.estimatedDeliveryAt} delivered={delivered} />
                {delivered && order.deliveredAt ? <p className="text-sm text-ink-soft">Delivered at {clock(order.deliveredAt)}</p> : null}
              </div>
            </div>
            {!awaitingPayment && !['CANCELLED', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'].includes(order.status) ? (
              <div className="px-6 pb-2 pt-4">
                <DeliveryProgress status={order.status} />
                <p className="pb-2 text-center text-xs text-ink-faint">Progress follows the restaurant’s real status updates. Live rider location is not available yet.</p>
              </div>
            ) : null}
          </Card>

          {awaitingPayment ? (
            <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <AlertTriangle className="h-8 w-8 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="font-bold">{order.status === 'PAYMENT_FAILED' ? 'Payment nahi hua. Paisa gaya nahi hai.' : 'Waiting for your payment'}</p>
                <p className="text-sm text-ink-soft">Nothing reaches the kitchen until the payment is verified by our server. If money left your account for a failed attempt, your bank reverses it automatically.</p>
              </div>
              <Button leftIcon={<CreditCard className="h-4 w-4" />} loading={retry.isPending} onClick={doPay}>
                {order.status === 'PAYMENT_FAILED' ? 'Retry payment' : 'Complete payment'}
              </Button>
            </Card>
          ) : null}

          {order.status === 'CANCELLED' || order.status === 'REJECTED' || order.status === 'REFUND_PENDING' || order.status === 'REFUNDED' ? (
            <Card className="flex items-start gap-3 p-6">
              <XCircle className="h-6 w-6 shrink-0 text-danger" />
              <div>
                <p className="font-bold">{meta.label}</p>
                <p className="text-sm text-ink-soft">{order.statusHistory.at(-1)?.note ?? meta.message}</p>
                {order.payment.status === 'REFUND_PENDING' || order.status === 'REFUND_PENDING' ? <p className="mt-1 text-sm text-ink-soft">{STATUS_META.REFUND_PENDING.message}</p> : null}
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <h2 className="mb-5 text-xl font-extrabold">Timeline</h2>
              <OrderTimeline order={order} />
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            {canCancel ? <Button variant="outline" onClick={doCancel} loading={cancel.isPending}>Cancel order</Button> : null}
            {delivered && !order.reviewed ? <Button leftIcon={<Star className="h-4 w-4" />} onClick={() => setReviewing(true)}>Rate this order</Button> : null}
            {delivered || order.status === 'CANCELLED' || order.status === 'REJECTED' ? (
              <Button
                variant="secondary"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                loading={reorder.isPending}
                onClick={() =>
                  reorder.mutate(order._id, {
                    onSuccess: (res) => {
                      if (res.skipped.length) toast.info('Some items are no longer available', res.skipped.join(', '));
                      navigate('/cart');
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                Order again
              </Button>
            ) : null}
            {delivered ? (
              <ShareCardButton
                label="Share what I ate"
                content={{
                  eyebrow: 'What I ordered 😋',
                  title: order.restaurant.name,
                  lines: order.lines.map((l) => `${l.quantity}× ${l.name}`),
                  footer: `${order.pointsEarned ? `+${order.pointsEarned} Nova Points · ` : ''}novafood`,
                  hue: order.restaurant.art.hue,
                }}
              />
            ) : null}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <Link to={`/r/${order.restaurant.slug}`} className="mb-4 flex items-center gap-3">
              <span className="h-12 w-12 overflow-hidden rounded-md"><FoodArt art={order.restaurant.art} rounded="rounded-md" /></span>
              <span>
                <span className="block font-bold">{order.restaurant.name}</span>
                <span className="text-sm text-ink-faint">{order.restaurant.area} · {dateTime(order.createdAt)}</span>
              </span>
            </Link>
            <ul className="mb-4 space-y-2 text-sm">
              {order.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="flex items-start gap-2">
                    <VegMark veg={l.isVeg} className="mt-0.5" />
                    <span>
                      {l.quantity} × {l.name}
                      {l.variantName || l.addOns.length ? <span className="block text-xs text-ink-faint">{[l.variantName, ...l.addOns.map((a) => a.name)].filter(Boolean).join(' · ')}</span> : null}
                    </span>
                  </span>
                  <span>{money(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <BillDetails pricing={order.pricing} />
            <p className="mt-3 text-sm text-ink-soft">
              Paid via {order.payment.method === 'COD' ? 'cash on delivery' : 'Razorpay'} · <span className="font-semibold">{order.payment.status.replace('_', ' ').toLowerCase()}</span>
            </p>
            {order.pointsEarned ? (
              <p className="mt-3 flex items-center gap-2 rounded-md bg-lime/40 px-3 py-2 text-sm font-semibold text-[#1b0f3b]">
                <Sparkles className="h-4 w-4" /> +{order.pointsEarned} Nova Points earned
              </p>
            ) : null}
          </Card>
          <Card className="p-6 text-sm">
            <p className="font-bold">Delivering to {order.deliveryAddress.label}</p>
            <p className="mt-1 text-ink-soft">{[order.deliveryAddress.line1, order.deliveryAddress.line2, order.deliveryAddress.landmark, order.deliveryAddress.city, order.deliveryAddress.pincode].filter(Boolean).join(', ')}</p>
            {order.deliveryInstructions ? <p className="mt-2 text-ink-soft">“{order.deliveryInstructions}”</p> : null}
          </Card>
        </aside>
      </div>
      {reviewing ? <ReviewModal order={order} open={reviewing} onClose={() => setReviewing(false)} /> : null}
    </div>
  );
}
