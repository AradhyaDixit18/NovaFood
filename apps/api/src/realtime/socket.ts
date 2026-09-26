import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { allowedOrigins } from '../config/env';
import type { AppContext } from '../context';
import { resolveUser } from '../middleware/auth';
import { Order } from '../models/Order';
import { Restaurant } from '../models/Restaurant';
import { canViewOrder } from '../modules/orders/orders.service';
import { SocketHub, rooms } from './hub';

/**
 * Socket.IO carries server-to-client pushes only (order status, new kitchen orders,
 * notifications). Every state change still goes through the REST API and the state machine.
 * Horizontal scaling would add the Redis adapter; the RealtimeHub interface stays the same.
 */
export function attachRealtime(ctx: AppContext, httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: allowedOrigins(ctx.env), credentials: true },
  });

  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
    const user = await resolveUser(ctx, token);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = user;
    next();
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as Express.AuthUser;
    await socket.join(rooms.user(user.id));
    if (user.role === 'admin') await socket.join(rooms.admins);
    if (user.role === 'partner' || user.role === 'admin') {
      const owned = await Restaurant.find(user.role === 'admin' ? {} : { ownerIds: user.id }).select('_id').lean();
      await socket.join(owned.map((r) => rooms.restaurant(String(r._id))));
    }

    socket.on('order:subscribe', async (orderId: unknown, ack?: (result: { ok: boolean }) => void) => {
      if (typeof orderId !== 'string' || !/^[a-f0-9]{24}$/i.test(orderId)) return ack?.({ ok: false });
      const order = await Order.findById(orderId).select('userId restaurantId').lean();
      if (!order || !(await canViewOrder(order, user))) return ack?.({ ok: false });
      await socket.join(rooms.order(orderId));
      ack?.({ ok: true });
    });

    socket.on('order:unsubscribe', async (orderId: unknown) => {
      if (typeof orderId === 'string') await socket.leave(rooms.order(orderId));
    });
  });

  ctx.realtime = new SocketHub(io);
  return io;
}
