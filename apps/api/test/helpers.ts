import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { Types } from 'mongoose';
import { type Role, WEEKDAYS } from '@novafood/shared';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';
import { type AppContext, createContext } from '../src/context';
import { ConsoleEmailProvider } from '../src/integrations/email';
import { RazorpayProvider, hmacHex } from '../src/integrations/payments';
import { createLogger } from '../src/lib/logger';
import { FoodItem } from '../src/models/FoodItem';
import { Restaurant } from '../src/models/Restaurant';
import { User } from '../src/models/User';
import { RecordingHub } from '../src/realtime/hub';

/** Saturday 13:30 IST: every 24x7 test restaurant is open. */
export const FIXED_NOW = new Date('2026-09-26T08:00:00Z');

export const TEST_KEY_SECRET = 'test_key_secret_123';
export const TEST_WEBHOOK_SECRET = 'test_webhook_secret_456';

/**
 * Uses the real Razorpay signature verification; only the two network calls are replaced so
 * tests run offline.
 */
export class OfflineRazorpay extends RazorpayProvider {
  readonly refunds: { paymentId: string; amount: number }[] = [];
  private counter = 0;
  constructor() {
    super('rzp_test_offline', TEST_KEY_SECRET, TEST_WEBHOOK_SECRET);
  }
  override async createOrder(input: { amountPaise: number }) {
    this.counter += 1;
    return { providerOrderId: `order_test_${this.counter}_${randomUUID().slice(0, 6)}`, amountPaise: input.amountPaise, currency: 'INR' as const };
  }
  override async refund(paymentId: string, amount: number) {
    this.refunds.push({ paymentId, amount });
    return { refundId: `rfnd_${this.refunds.length}` };
  }
}

export function checkoutSignature(providerOrderId: string, paymentId: string): string {
  return hmacHex(TEST_KEY_SECRET, `${providerOrderId}|${paymentId}`);
}

export function webhookSignature(body: string): string {
  return hmacHex(TEST_WEBHOOK_SECRET, body);
}

export interface TestKit {
  ctx: AppContext;
  request: supertest.Agent;
  hub: RecordingHub;
  email: ConsoleEmailProvider;
  payments: OfflineRazorpay | null;
}

export function createTestKit(options: { payments?: boolean; now?: () => Date; rateLimits?: boolean } = {}): TestKit {
  const env = loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://unused',
    JWT_ACCESS_SECRET: 'test-secret-that-is-definitely-long-enough-123',
    CLIENT_URL: 'http://localhost:5173',
  });
  const logger = createLogger(env);
  const hub = new RecordingHub();
  const email = new ConsoleEmailProvider(logger);
  const payments = options.payments ? new OfflineRazorpay() : null;
  const ctx = createContext(env, {
    logger,
    realtime: hub,
    email,
    storage: null,
    payments,
    now: options.now ?? (() => FIXED_NOW),
    rateLimits: options.rateLimits ?? false,
  });
  const app = createApp(ctx);
  return { ctx, request: supertest.agent(app), hub, email, payments };
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  agent: supertest.Agent;
}

/** Registers through the real endpoint, then optionally promotes the role in the database. */
export async function createUser(kit: TestKit, options: { role?: Role; name?: string } = {}): Promise<TestUser> {
  const email = `user_${unique()}@test.dev`;
  const password = 'Password123';
  const agent = supertest.agent(createApp(kit.ctx));
  const res = await agent.post('/api/auth/register').send({ name: options.name ?? 'Test User', email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const id = res.body.data.user._id as string;
  if (options.role && options.role !== 'customer') await User.updateOne({ _id: id }, { $set: { role: options.role } });
  return { id, email, password, token: res.body.data.accessToken, agent };
}

export async function addAddress(user: TestUser): Promise<string> {
  const res = await user.agent
    .post('/api/users/me/addresses')
    .set('authorization', `Bearer ${user.token}`)
    .send({ label: 'Home', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' });
  if (res.status !== 201) throw new Error(`address failed: ${JSON.stringify(res.body)}`);
  return res.body.data._id as string;
}

const allDay = WEEKDAYS.map((day) => ({ day, open: '00:00', close: '23:59' }));

export async function createRestaurant(overrides: Record<string, unknown> = {}) {
  const name = `Test Kitchen ${unique()}`;
  return Restaurant.create({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: 'A restaurant used by the automated tests.',
    cuisines: ['North Indian'],
    address: { line1: '1 Test Road', area: 'Testpur', city: 'Bengaluru', pincode: '560001' },
    costForTwoPaise: 50000,
    deliveryTimeMins: 30,
    deliveryFeePaise: 4000,
    freeDeliveryAbovePaise: null,
    minOrderPaise: 0,
    openingHours: allDay,
    status: 'APPROVED',
    isAcceptingOrders: true,
    ownerIds: [],
    ...overrides,
  });
}

export async function createFood(restaurantId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  const name = `Test Dish ${unique()}`;
  return FoodItem.create({
    restaurantId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: 'Tasty test food.',
    section: 'Mains',
    cuisine: 'North Indian',
    pricePaise: 20000,
    isVeg: true,
    tags: ['comfort'],
    ...overrides,
  });
}

/** A dish with sizes and a constrained add-on group, for pricing and validation tests. */
export async function createConfigurableFood(restaurantId: Types.ObjectId) {
  return createFood(restaurantId, {
    name: 'Configurable Burger',
    slug: `configurable-burger-${unique()}`,
    pricePaise: 20000,
    variants: [
      { name: 'Single', pricePaise: 20000 },
      { name: 'Double', pricePaise: 28000 },
    ],
    addOnGroups: [
      {
        name: 'Extras',
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: 'Cheese', pricePaise: 3000 },
          { name: 'Egg', pricePaise: 3500, isVeg: false },
          { name: 'Jalapeño', pricePaise: 2000 },
        ],
      },
    ],
  });
}

export async function createPartnerWithRestaurant(kit: TestKit) {
  const partner = await createUser(kit, { role: 'partner' });
  const restaurant = await createRestaurant({ ownerIds: [new Types.ObjectId(partner.id)] });
  return { partner, restaurant };
}

export const auth = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

/** Puts one dish in the user's cart and places a cash-on-delivery order. */
export async function placeCodOrder(kit: TestKit, user: TestUser, foodId: string, extra: Record<string, unknown> = {}) {
  const addressId = await addAddress(user);
  const add = await user.agent.post('/api/cart/items').set(auth(user)).send({ foodId, quantity: 1, ...extra });
  if (add.status !== 201) throw new Error(`add to cart failed: ${JSON.stringify(add.body)}`);
  const res = await user.agent
    .post('/api/orders')
    .set(auth(user))
    .send({ addressId, paymentMethod: 'COD', contactPhone: '9876543210', idempotencyKey: randomUUID() });
  if (res.status !== 201) throw new Error(`checkout failed: ${JSON.stringify(res.body)}`);
  return res.body.data.order as { _id: string; status: string; pricing: { totalPaise: number } };
}

export async function hashFast(password: string) {
  return bcrypt.hash(password, 4);
}
