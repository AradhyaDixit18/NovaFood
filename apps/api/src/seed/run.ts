/**
 * Seeds a demo dataset.
 *
 *   npm run seed            # refuses if the database already has restaurants
 *   npm run seed -- --reset # wipes NovaFood collections first (blocked in production unless SEED_ALLOW_RESET=true)
 *
 * All seeded people, restaurants, orders and reviews are fictional demo data.
 */
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { type OrderStatus, computeUnitPrice, pointsEarnedFor, priceOrder, rupeesToPaise } from '@novafood/shared';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { loadEnv } from '../config/env';
import { createLogger } from '../lib/logger';
import { orderNumber, randomSuffixSafe, slugify } from './util';
import { randomToken } from '../lib/tokens';
import { FoodItem, type FoodLean } from '../models/FoodItem';
import { Coupon, Favorite, PointsEntry, Review } from '../models/misc';
import '../models/Cart';
import '../models/Session';
import { Order } from '../models/Order';
import { Restaurant, type RestaurantLean } from '../models/Restaurant';
import { User } from '../models/User';
import { refreshRatings } from '../modules/reviews/reviews.service';
import { DEMO_DINERS, RESTAURANTS, REVIEW_COMMENTS, hoursFor } from './catalog';

const DEMO_PASSWORD = 'NovaDemo@123';

/** Deterministic PRNG so every seed produces the same dataset. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

async function main() {
  const env = loadEnv();
  const logger = createLogger({ ...env, NODE_ENV: env.NODE_ENV === 'test' ? 'test' : 'development' });
  const reset = process.argv.includes('--reset');
  await connectDatabase(env.MONGODB_URI, logger);

  const existing = await Restaurant.countDocuments();
  if (existing > 0 && !reset) {
    console.error(`Database already has ${existing} restaurants. Re-run with --reset to wipe and reseed.`);
    await disconnectDatabase();
    process.exit(1);
  }
  if (reset) {
    if (env.NODE_ENV === 'production' && process.env.SEED_ALLOW_RESET !== 'true') {
      throw new Error('Refusing to reset a production database. Set SEED_ALLOW_RESET=true if you really mean it.');
    }
    for (const name of mongoose.modelNames()) await mongoose.model(name).deleteMany({});
    console.warn('Wiped NovaFood collections.');
  }
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

  /* ---------------------------------- People ---------------------------------- */
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? `Nf-${randomToken(9)}`;
  const admin = await User.create({ name: 'Nova Admin', email: 'admin@novafood.dev', passwordHash: await bcrypt.hash(adminPassword, 12), role: 'admin', emailVerified: true });
  const partner = await User.create({ name: 'Priya Partner', email: 'partner@novafood.dev', passwordHash: demoHash, role: 'partner', emailVerified: true, phone: '9876543210' });
  const customer = await User.create({
    name: 'Demo Foodie',
    email: 'demo@novafood.dev',
    passwordHash: demoHash,
    emailVerified: true,
    phone: '9123456780',
    favoriteCuisines: ['Biryani', 'South Indian'],
    addresses: [
      { label: 'Home', line1: 'Flat 402, Sunshine Residency, 3rd Cross', landmark: 'Near Forum Mall', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', isDefault: true, location: { lat: 12.9346, lng: 77.6112 } },
      { label: 'Work', line1: 'Level 6, Embassy Tech Square', city: 'Bengaluru', state: 'Karnataka', pincode: '560103', isDefault: false },
    ],
  });
  // Demo diners exist only to author seed history; they cannot log in (random passwords).
  const diners = await User.insertMany(
    DEMO_DINERS.map((name, i) => ({
      name,
      email: `diner${i + 1}@demo.novafood.dev`,
      passwordHash: bcrypt.hashSync(randomToken(12), 4),
      emailVerified: true,
      addresses: [{ label: 'Home', line1: `${between(1, 99)} ${pick(['MG Road', 'Church Street', 'Brigade Road', 'CMH Road'])}`, city: 'Bengaluru', state: 'Karnataka', pincode: '560001', isDefault: true }],
    })),
  );

  /* --------------------------------- Catalogue -------------------------------- */
  const restaurants: RestaurantLean[] = [];
  const foodsByRestaurant = new Map<string, FoodLean[]>();
  for (const [index, r] of RESTAURANTS.entries()) {
    const owned = index === 0 || index === 3; // partner runs Handi & Hustle and Crust Club 42
    const doc = await Restaurant.create({
      name: r.name,
      slug: slugify(r.name),
      description: r.description,
      cuisines: r.cuisines,
      address: { line1: r.line1, area: r.area, city: 'Bengaluru', pincode: r.pincode },
      location: { lat: r.location[0], lng: r.location[1] },
      phone: '080-4' + String(1000000 + index * 7919).slice(0, 7),
      pureVeg: Boolean(r.pureVeg),
      costForTwoPaise: rupeesToPaise(r.costForTwo),
      deliveryTimeMins: r.deliveryTime,
      deliveryFeePaise: rupeesToPaise(r.deliveryFee),
      freeDeliveryAbovePaise: r.freeDeliveryAbove ? rupeesToPaise(r.freeDeliveryAbove) : null,
      minOrderPaise: rupeesToPaise(r.minOrder ?? 0),
      openingHours: hoursFor(r.hours),
      offerText: r.offer,
      policies: 'Orders can be cancelled free of charge until the restaurant accepts them. Food is prepared fresh; please report any issue within 2 hours of delivery.',
      art: { kind: r.art[0], hue: r.art[1] },
      status: 'APPROVED',
      ownerIds: owned ? [partner._id] : [],
    });
    const foods = await FoodItem.insertMany(
      r.dishes.map((d) => ({
        restaurantId: doc._id,
        name: d.name,
        slug: slugify(d.name),
        description: d.description,
        section: d.section,
        cuisine: d.cuisine ?? r.cuisines[0]!,
        pricePaise: rupeesToPaise(d.variants?.[0]?.[1] ?? d.price),
        compareAtPricePaise: d.compareAt ? rupeesToPaise(d.compareAt) : null,
        art: { kind: d.art[0], hue: d.art[1] },
        isVeg: d.veg,
        dietTags: d.diet ?? [],
        allergens: d.allergens ?? [],
        tags: d.tags,
        spiceLevel: d.spice ?? 0,
        ingredients: d.ingredients ?? [],
        nutrition: d.nutrition ? { calories: d.nutrition[0], proteinG: d.nutrition[1], carbsG: d.nutrition[2], fatG: d.nutrition[3] } : null,
        variants: (d.variants ?? []).map(([name, price]) => ({ name, pricePaise: rupeesToPaise(price) })),
        addOnGroups: (d.addOns ?? []).map((g) => ({
          name: g.name,
          minSelect: g.min ?? 0,
          maxSelect: g.max ?? 1,
          options: g.options.map(([name, price, veg]) => ({ name, pricePaise: rupeesToPaise(price), isVeg: veg ?? true })),
        })),
        isBestseller: Boolean(d.bestseller),
      })),
    );
    restaurants.push(doc.toObject() as RestaurantLean);
    foodsByRestaurant.set(String(doc._id), foods.map((f) => f.toObject() as FoodLean));
  }

  // A pending application so the admin approval queue has something in it.
  await Restaurant.create({
    name: 'Tandoor Theory',
    slug: 'tandoor-theory',
    description: 'Kebabs and tandoori platters, awaiting approval.',
    cuisines: ['North Indian'],
    address: { line1: 'Bellandur Main Road', area: 'Bellandur', city: 'Bengaluru', pincode: '560103' },
    costForTwoPaise: 60000,
    deliveryTimeMins: 40,
    deliveryFeePaise: 4000,
    openingHours: hoursFor(['12:00', '23:00']),
    art: { kind: 'kebab', hue: 15 },
    status: 'PENDING',
    ownerIds: [partner._id],
  });

  /* ---------------------------------- Coupons --------------------------------- */
  const crust = restaurants.find((r) => r.slug === 'crust-club-42')!;
  await Coupon.insertMany([
    { code: 'NOVA50', description: '50% off up to ₹100 on your first order', type: 'PERCENT', value: 50, minOrderPaise: 19900, maxDiscountPaise: 10000, firstOrderOnly: true },
    { code: 'BHOOK75', description: 'Flat ₹75 off on orders above ₹349', type: 'FLAT', value: 7500, minOrderPaise: 34900, perUserLimit: 3 },
    { code: 'CRUST30', description: '30% off up to ₹150 at Crust Club 42', type: 'PERCENT', value: 30, minOrderPaise: 39900, maxDiscountPaise: 15000, restaurantIds: [crust._id] },
    { code: 'LATENIGHT', description: '20% off up to ₹80, midnight munchies special', type: 'PERCENT', value: 20, minOrderPaise: 24900, maxDiscountPaise: 8000, usageLimit: 500 },
  ]);

  /* ------------------------------ Order history ------------------------------- */
  const now = new Date();
  const HAPPY: OrderStatus[] = ['ORDER_PLACED', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const quality = new Map(restaurants.map((r) => [String(r._id), 3.6 + rand() * 1.2]));

  const buildOrder = (user: { _id: Types.ObjectId; name: string; addresses: { label: string; line1: string; city: string; state: string; pincode: string }[] }, restaurant: RestaurantLean, picks: { food: FoodLean; qty: number }[], at: Date, final: OrderStatus) => {
    const lines = picks.map(({ food, qty }) => {
      const variant = food.variants[0] ?? null;
      const unit = computeUnitPrice(food.pricePaise, variant?.pricePaise ?? null, []);
      return {
        foodId: food._id,
        name: food.name,
        isVeg: food.isVeg,
        cuisine: food.cuisine,
        art: food.art,
        variantId: variant ? String(variant._id) : null,
        variantName: variant?.name ?? null,
        addOnIds: [],
        addOns: [],
        quantity: qty,
        unitPricePaise: unit,
        lineTotalPaise: unit * qty,
      };
    });
    const pricing = priceOrder({
      lines: lines.map((l) => ({ unitPricePaise: l.unitPricePaise, quantity: l.quantity })),
      deliveryFeePaise: restaurant.deliveryFeePaise,
      freeDeliveryAbovePaise: restaurant.freeDeliveryAbovePaise,
    });
    const path = final === 'DELIVERED' ? HAPPY : final === 'REJECTED' ? (['ORDER_PLACED', 'REJECTED'] as OrderStatus[]) : (['ORDER_PLACED', 'CANCELLED'] as OrderStatus[]);
    const history = path.map((status, i) => ({ status, at: new Date(at.getTime() + i * 7 * 60_000), by: i === 0 ? 'customer' : status === 'CANCELLED' ? 'customer' : 'partner', byUserId: null }));
    const address = user.addresses[0]!;
    return {
      _id: new Types.ObjectId(),
      orderNumber: orderNumber(),
      userId: user._id,
      customerName: user.name,
      contactPhone: '9000000000',
      restaurantId: restaurant._id,
      restaurantSnapshot: { name: restaurant.name, slug: restaurant.slug, area: restaurant.address.area, art: restaurant.art },
      lines,
      pricing,
      status: final,
      statusHistory: history,
      payment: { method: 'COD', status: final === 'DELIVERED' ? 'PAID' : 'PENDING', paidAt: final === 'DELIVERED' ? history.at(-1)!.at : null },
      deliveryAddress: { label: address.label, line1: address.line1, city: address.city, state: address.state, pincode: address.pincode },
      estimatedDeliveryAt: new Date(at.getTime() + restaurant.deliveryTimeMins * 60_000),
      deliveredAt: final === 'DELIVERED' ? history.at(-1)!.at : null,
      pointsEarned: final === 'DELIVERED' ? pointsEarnedFor(pricing.taxablePaise) : 0,
      idempotencyKey: `seed-${randomSuffixSafe()}`,
      cancelReason: final === 'CANCELLED' ? 'Changed my mind' : final === 'REJECTED' ? 'Kitchen closing early' : null,
      createdAt: at,
      updatedAt: history.at(-1)!.at,
    };
  };

  const orders: ReturnType<typeof buildOrder>[] = [];
  const reviews: Record<string, unknown>[] = [];
  for (let day = 29; day >= 1; day--) {
    const count = between(4, 9);
    for (let i = 0; i < count; i++) {
      const restaurant = pick(restaurants);
      const foods = foodsByRestaurant.get(String(restaurant._id))!;
      const bestsellers = foods.filter((f) => f.isBestseller);
      const picks = Array.from({ length: between(1, 3) }, () => ({ food: rand() < 0.55 && bestsellers.length ? pick(bestsellers) : pick(foods), qty: between(1, 2) }));
      const unique = [...new Map(picks.map((p) => [String(p.food._id), p])).values()];
      const at = new Date(now.getTime() - day * 86_400_000 + between(11, 23) * 3_600_000 - 12 * 3_600_000);
      const roll = rand();
      const final: OrderStatus = roll < 0.9 ? 'DELIVERED' : roll < 0.96 ? 'CANCELLED' : 'REJECTED';
      const diner = pick(diners);
      const order = buildOrder(diner, restaurant, unique, at, final);
      orders.push(order);

      if (final === 'DELIVERED' && rand() < 0.5) {
        const q = quality.get(String(restaurant._id))!;
        const rating = Math.max(1, Math.min(5, Math.round(q + (rand() - 0.5) * 2)));
        const comment = rand() < 0.7 ? pick(REVIEW_COMMENTS[rating]!) : undefined;
        const reviewedAt = new Date(order.deliveredAt!.getTime() + 3_600_000);
        reviews.push({ userId: diner._id, orderId: order._id, restaurantId: restaurant._id, foodId: null, rating, comment, createdAt: reviewedAt, helpfulCount: between(0, 6) });
        for (const line of order.lines.slice(0, 2)) {
          reviews.push({ userId: diner._id, orderId: order._id, restaurantId: restaurant._id, foodId: line.foodId, foodName: line.name, rating: Math.max(1, Math.min(5, rating + (rand() < 0.3 ? 1 : 0))), createdAt: reviewedAt });
        }
        (order as { reviewed?: boolean }).reviewed = true;
      }
    }
  }

  // The demo customer's own history: a repeated Friday biryani order powers "smart reorder".
  const handi = restaurants[0]!;
  const handiFoods = foodsByRestaurant.get(String(handi._id))!;
  const dosa = restaurants[1]!;
  const burgers = restaurants[4]!;
  const lastFriday = (weeksAgo: number) => {
    const d = new Date(now);
    const diff = (d.getDay() - 5 + 7) % 7 || 7;
    d.setDate(d.getDate() - diff - 7 * weeksAgo);
    d.setHours(20, 15, 0, 0);
    return d;
  };
  const usual = [{ food: handiFoods[0]!, qty: 1 }, { food: handiFoods[3]!, qty: 1 }, { food: handiFoods[5]!, qty: 2 }];
  const customerOrders = [
    buildOrder(customer, handi, usual, lastFriday(0), 'DELIVERED'),
    buildOrder(customer, handi, usual, lastFriday(1), 'DELIVERED'),
    buildOrder(customer, dosa, [{ food: foodsByRestaurant.get(String(dosa._id))![0]!, qty: 1 }, { food: foodsByRestaurant.get(String(dosa._id))![6]!, qty: 2 }], new Date(now.getTime() - 9 * 86_400_000), 'DELIVERED'),
    buildOrder(customer, burgers, [{ food: foodsByRestaurant.get(String(burgers._id))![0]!, qty: 1 }], new Date(now.getTime() - 16 * 86_400_000), 'DELIVERED'),
  ];
  orders.push(...customerOrders);

  await Order.insertMany(orders);
  await Review.insertMany(reviews);

  for (const o of customerOrders) {
    await PointsEntry.create({ userId: customer._id, type: 'EARN', points: o.pointsEarned, description: `Earned on ${o.orderNumber}`, orderId: o._id, createdAt: o.deliveredAt });
  }
  await PointsEntry.create({ userId: customer._id, type: 'BONUS', points: 50, description: 'Welcome bonus' });
  await User.updateOne({ _id: customer._id }, { $set: { pointsBalance: customerOrders.reduce((s, o) => s + o.pointsEarned, 0) + 50 } });
  await Favorite.insertMany([
    { userId: customer._id, kind: 'restaurant', targetId: handi._id },
    { userId: customer._id, kind: 'food', targetId: foodsByRestaurant.get(String(dosa._id))![0]!._id },
  ]);

  // Counters and ratings derived from the data we just wrote.
  for (const r of restaurants) {
    const rOrders = orders.filter((o) => String(o.restaurantId) === String(r._id) && o.status === 'DELIVERED');
    await Restaurant.updateOne({ _id: r._id }, { $set: { orderCount: rOrders.length } });
    const foods = foodsByRestaurant.get(String(r._id))!;
    for (const f of foods) {
      const qty = rOrders.reduce((s, o) => s + o.lines.filter((l) => String(l.foodId) === String(f._id)).reduce((a, l) => a + l.quantity, 0), 0);
      await FoodItem.updateOne({ _id: f._id }, { $set: { orderCount: qty } });
    }
    await refreshRatings(r._id, foods.map((f) => f._id));
  }

  console.warn('\n✅ Seed complete');
  console.warn(`   ${restaurants.length} restaurants, ${[...foodsByRestaurant.values()].flat().length} dishes, ${orders.length} orders, ${reviews.length} reviews`);
  console.warn('\n   Demo logins');
  console.warn(`   Customer  demo@novafood.dev     / ${DEMO_PASSWORD}`);
  console.warn(`   Partner   partner@novafood.dev  / ${DEMO_PASSWORD}`);
  console.warn(`   Admin     admin@novafood.dev    / ${adminPassword}${process.env.SEED_ADMIN_PASSWORD ? ' (from SEED_ADMIN_PASSWORD)' : '  <- generated, save it now'}\n`);
  void admin;
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
