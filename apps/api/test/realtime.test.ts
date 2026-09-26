import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type Socket, io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { attachRealtime } from '../src/realtime/socket';
import { auth, createFood, createPartnerWithRestaurant, createTestKit, createUser, placeCodOrder, type TestUser } from './helpers';

const kit = createTestKit();
let server: Server;
let url = '';
let partner: TestUser;
let foodId: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = createServer(createApp(kit.ctx));
  attachRealtime(kit.ctx, server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const setup = await createPartnerWithRestaurant(kit);
  partner = setup.partner;
  foodId = String((await createFood(setup.restaurant._id))._id);
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise((resolve) => server.close(resolve));
});

function open(token: string | null): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

const next = <T>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

describe('real-time order updates', () => {
  it('refuses unauthenticated connections', async () => {
    await expect(open(null)).rejects.toThrow('UNAUTHORIZED');
  });

  it('pushes new orders to the kitchen and status changes to the customer', async () => {
    const customer = await createUser(kit);
    const kitchen = await open(partner.token);
    const newOrder = next<{ orderNumber: string; customer: { name: string } }>(kitchen, 'order:new');
    const order = await placeCodOrder(kit, customer, foodId);
    expect((await newOrder).customer.name).toBe('Test User');

    const socket = await open(customer.token);
    const ack = await socket.emitWithAck('order:subscribe', order._id);
    expect(ack).toEqual({ ok: true });

    const update = next<{ status: string; estimatedDeliveryAt: string }>(socket, 'order:updated');
    const notification = next<{ title: string }>(socket, 'notification:new');
    await partner.agent.post(`/api/partner/orders/${order._id}/status`).set(auth(partner)).send({ status: 'RESTAURANT_ACCEPTED' });
    const pushed = await update;
    expect(pushed.status).toBe('RESTAURANT_ACCEPTED');
    expect(pushed.estimatedDeliveryAt).toBeTruthy();
    expect((await notification).title).toBe('Accepted');
  });

  it('does not let a stranger subscribe to someone else’s order', async () => {
    const owner = await createUser(kit);
    const order = await placeCodOrder(kit, owner, foodId);
    const stranger = await createUser(kit);
    const socket = await open(stranger.token);
    expect(await socket.emitWithAck('order:subscribe', order._id)).toEqual({ ok: false });
    expect(await socket.emitWithAck('order:subscribe', 'not-an-id')).toEqual({ ok: false });
  });
});
