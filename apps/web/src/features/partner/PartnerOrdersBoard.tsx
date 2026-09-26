import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing, Phone } from 'lucide-react';
import { type OrderDTO, type OrderStatus, STATUS_META, nextStatuses } from '@novafood/shared';
import { EmptyState, PageLoader } from '../../components/States';
import { errorMessage } from '../../lib/api';
import { clock, money, timeAgo } from '../../lib/format';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Card, Textarea, VegMark } from '../../ui/primitives';
import { usePartnerOrders, useSelectedRestaurant, useUpdateOrderStatus } from './api';

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'ORDER_PLACED', title: 'New' },
  { status: 'RESTAURANT_ACCEPTED', title: 'Accepted' },
  { status: 'PREPARING', title: 'Preparing' },
  { status: 'READY_FOR_PICKUP', title: 'Ready' },
  { status: 'OUT_FOR_DELIVERY', title: 'Out for delivery' },
];

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  RESTAURANT_ACCEPTED: 'Accept',
  PREPARING: 'Start preparing',
  READY_FOR_PICKUP: 'Mark ready',
  OUT_FOR_DELIVERY: 'Hand to rider',
  DELIVERED: 'Mark delivered',
};

/** A short two-tone chime via Web Audio, so new orders are noticed without an audio file. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* audio unavailable */
  }
}

function OrderCard({ order, onReject }: { order: OrderDTO; onReject: (o: OrderDTO) => void }) {
  const update = useUpdateOrderStatus('partner');
  const actions = nextStatuses(order.status, 'partner').filter((s) => s !== 'REJECTED' && s !== 'CANCELLED');
  const canReject = nextStatuses(order.status, 'partner').includes('REJECTED');
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display font-bold">{order.orderNumber}</p>
          <span className="text-xs text-ink-faint" title={clock(order.createdAt)}>{timeAgo(order.createdAt)}</span>
        </div>
        <p className="text-sm text-ink-soft">{order.customer?.name} · {money(order.pricing.totalPaise)} · {order.payment.method === 'COD' ? 'Cash' : 'Paid online'}</p>
        <ul className="my-3 space-y-1 text-sm">
          {order.lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <VegMark veg={l.isVeg} className="mt-0.5" />
              <span>
                <strong>{l.quantity}×</strong> {l.name}
                {l.variantName || l.addOns.length ? <span className="block text-xs text-ink-faint">{[l.variantName, ...l.addOns.map((a) => a.name)].filter(Boolean).join(', ')}</span> : null}
                {l.note ? <span className="block text-xs font-semibold text-warning">“{l.note}”</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {order.deliveryInstructions ? <p className="mb-2 text-xs text-ink-soft">Delivery note: {order.deliveryInstructions}</p> : null}
        {order.customer?.phone ? (
          <a href={`tel:${order.customer.phone}`} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-grape">
            <Phone className="h-3 w-3" /> {order.customer.phone}
          </a>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {actions.map((s) => (
            <Button
              key={s}
              size="sm"
              loading={update.isPending}
              onClick={() => update.mutate({ id: order._id, status: s }, { onError: (err) => toast.error(errorMessage(err)) })}
            >
              {ACTION_LABEL[s] ?? STATUS_META[s].label}
            </Button>
          ))}
          {canReject ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onReject(order)}>
              Reject
            </Button>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

export function PartnerOrdersBoard() {
  const id = useSelectedRestaurant((s) => s.id);
  const { data, isLoading } = usePartnerOrders(id, true);
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const update = useUpdateOrderStatus('partner');
  const [rejecting, setRejecting] = useState<OrderDTO | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (o: OrderDTO) => {
      qc.invalidateQueries({ queryKey: ['partner', 'orders'] });
      chime();
      toast.info(`New order ${o.orderNumber} 🔔`, `${o.lines.length} item(s) · ${money(o.pricing.totalPaise)}`);
    };
    const onUpdate = () => qc.invalidateQueries({ queryKey: ['partner', 'orders'] });
    socket.on('order:new', onNew);
    socket.on('order:updated', onUpdate);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:updated', onUpdate);
    };
  }, [qc, token]);

  if (isLoading) return <PageLoader />;
  const orders = data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <BellRing className="h-4 w-4 text-brand" /> New orders appear instantly with a chime. Keep this tab open during service.
      </div>
      {orders.length === 0 ? (
        <EmptyState mood="sleepy" title="Kitchen abhi silent hai 👀" body="No active orders right now. New ones will pop up here live." />
      ) : (
        <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
          {COLUMNS.map((col) => {
            const items = orders.filter((o) => o.status === col.status);
            return (
              <section key={col.status} aria-label={`${col.title} orders`} className="w-72 shrink-0">
                <h2 className="mb-3 flex items-center justify-between font-display font-bold">
                  {col.title}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{items.length}</span>
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {items.map((o) => (
                      <OrderCard key={o._id} order={o} onReject={(order) => { setRejecting(order); setReason(''); }} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.orderNumber ?? ''}?`}
        description="The customer is notified with your reason. Online payments are refunded automatically."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Back</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={update.isPending}
              onClick={() =>
                rejecting &&
                update.mutate(
                  { id: rejecting._id, status: 'REJECTED', reason: reason.trim() },
                  { onSuccess: () => setRejecting(null), onError: (err) => toast.error(errorMessage(err)) },
                )
              }
            >
              Reject order
            </Button>
          </div>
        }
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Out of paneer, kitchen closing early" aria-label="Reason" />
      </Modal>
    </div>
  );
}
