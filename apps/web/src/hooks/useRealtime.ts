import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { NotificationDTO, OrderDTO, PaymentInitDTO } from '@novafood/shared';
import { keys } from '../api/keys';
import { getSocket } from '../lib/socket';
import { useAuth } from '../stores/auth';
import { useMascot } from '../stores/mascot';
import { toast } from '../stores/toast';

/** Connects the shared socket for signed-in users and keeps cached data in sync with pushes. */
export function useRealtimeBridge(): void {
  const token = useAuth((s) => s.accessToken);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onOrder = (order: OrderDTO) => {
      qc.setQueryData(keys.order(order._id), (prev: { order: OrderDTO; payment: PaymentInitDTO | null } | undefined) => ({
        order,
        payment: prev?.payment ?? null,
      }));
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (order.status === 'DELIVERED') useMascot.getState().react('celebrate', 4000);
      else if (order.status === 'REJECTED' || order.status === 'PAYMENT_FAILED') useMascot.getState().react('worried', 3000);
    };
    const onNotification = (n: NotificationDTO) => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      qc.setQueryData(keys.unread, (prev: { unread: number } | undefined) => ({ unread: (prev?.unread ?? 0) + 1 }));
      toast.info(n.title, n.body, n.link ? { label: 'View', onClick: () => navigate(n.link!) } : undefined);
    };

    socket.on('order:updated', onOrder);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('order:updated', onOrder);
      socket.off('notification:new', onNotification);
    };
  }, [token, qc, navigate]);
}

/** Joins an order's room so its status updates arrive live. Returns whether the socket is connected. */
export function useOrderLive(orderId: string | undefined): boolean {
  const token = useAuth((s) => s.accessToken);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !orderId) return;
    const subscribe = () => {
      setConnected(true);
      socket.emit('order:subscribe', orderId, () => undefined);
    };
    const onDisconnect = () => setConnected(false);
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.emit('order:unsubscribe', orderId);
      socket.off('connect', subscribe);
      socket.off('disconnect', onDisconnect);
    };
  }, [orderId, token]);

  return connected;
}
