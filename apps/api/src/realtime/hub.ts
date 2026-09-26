import type { Server } from 'socket.io';

export type RealtimeEvent = 'order:updated' | 'order:new' | 'notification:new';

/** The API's only dependency on the transport, so services stay testable without sockets. */
export interface RealtimeHub {
  toUser(userId: string, event: RealtimeEvent, payload: unknown): void;
  toOrder(orderId: string, event: RealtimeEvent, payload: unknown): void;
  toRestaurant(restaurantId: string, event: RealtimeEvent, payload: unknown): void;
  toAdmins(event: RealtimeEvent, payload: unknown): void;
}

export const rooms = {
  user: (id: string) => `user:${id}`,
  order: (id: string) => `order:${id}`,
  restaurant: (id: string) => `restaurant:${id}`,
  admins: 'admins',
} as const;

export class SocketHub implements RealtimeHub {
  constructor(private readonly io: Server) {}
  toUser(userId: string, event: RealtimeEvent, payload: unknown) {
    this.io.to(rooms.user(userId)).emit(event, payload);
  }
  toOrder(orderId: string, event: RealtimeEvent, payload: unknown) {
    this.io.to(rooms.order(orderId)).emit(event, payload);
  }
  toRestaurant(restaurantId: string, event: RealtimeEvent, payload: unknown) {
    this.io.to(rooms.restaurant(restaurantId)).emit(event, payload);
  }
  toAdmins(event: RealtimeEvent, payload: unknown) {
    this.io.to(rooms.admins).emit(event, payload);
  }
}

/** Records emissions; used before the socket server is attached and in tests. */
export class RecordingHub implements RealtimeHub {
  readonly events: { room: string; event: RealtimeEvent; payload: unknown }[] = [];
  toUser(userId: string, event: RealtimeEvent, payload: unknown) {
    this.events.push({ room: rooms.user(userId), event, payload });
  }
  toOrder(orderId: string, event: RealtimeEvent, payload: unknown) {
    this.events.push({ room: rooms.order(orderId), event, payload });
  }
  toRestaurant(restaurantId: string, event: RealtimeEvent, payload: unknown) {
    this.events.push({ room: rooms.restaurant(restaurantId), event, payload });
  }
  toAdmins(event: RealtimeEvent, payload: unknown) {
    this.events.push({ room: rooms.admins, event, payload });
  }
}
