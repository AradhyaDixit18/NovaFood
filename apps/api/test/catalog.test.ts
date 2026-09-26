import { beforeAll, describe, expect, it } from 'vitest';
import { WEEKDAYS } from '@novafood/shared';
import { createFood, createRestaurant, createTestKit } from './helpers';

const kit = createTestKit();
let vegSlug = '';
let biryaniFoodId = '';

beforeAll(async () => {
  const veg = await createRestaurant({ name: 'Green Leaf Kitchen', slug: 'green-leaf', pureVeg: true, cuisines: ['South Indian'], deliveryTimeMins: 20, costForTwoPaise: 30000 });
  vegSlug = veg.slug;
  await createFood(veg._id, { name: 'Masala Dosa', slug: 'masala-dosa', section: 'Dosas', cuisine: 'South Indian', tags: ['crunchy', 'breakfast'], isBestseller: true });
  await createFood(veg._id, { name: 'Filter Coffee', slug: 'filter-coffee', section: 'Drinks', cuisine: 'Beverages', tags: ['beverage'] });

  const biryani = await createRestaurant({ name: 'Royal Biryani House', slug: 'royal-biryani', cuisines: ['Biryani'], deliveryTimeMins: 45, costForTwoPaise: 70000, rating: 4.6, ratingCount: 40 });
  const food = await createFood(biryani._id, { name: 'Chicken Dum Biryani', slug: 'chicken-dum-biryani', section: 'Biryani', cuisine: 'Biryani', isVeg: false, tags: ['spicy', 'comfort'], pricePaise: 29900 });
  biryaniFoodId = String(food._id);

  // Closed all day, and a pending application: neither should show up where it must not.
  await createRestaurant({ name: 'Closed Cafe', slug: 'closed-cafe', openingHours: WEEKDAYS.map((day) => ({ day, open: '03:00', close: '04:00' })) });
  await createRestaurant({ name: 'Pending Place', slug: 'pending-place', status: 'PENDING' });
});

describe('restaurant discovery', () => {
  it('lists only approved restaurants, open ones first', async () => {
    const res = await kit.request.get('/api/restaurants');
    expect(res.status).toBe(200);
    const names = res.body.data.map((r: { name: string }) => r.name);
    expect(names).not.toContain('Pending Place');
    expect(names.at(-1)).toBe('Closed Cafe');
    expect(res.body.meta).toMatchObject({ page: 1, total: 3 });
  });

  it('filters by pure veg, cuisine and delivery time', async () => {
    const veg = await kit.request.get('/api/restaurants?pureVeg=true');
    expect(veg.body.data.map((r: { slug: string }) => r.slug)).toEqual([vegSlug]);
    const cuisine = await kit.request.get('/api/restaurants?cuisine=Biryani');
    expect(cuisine.body.data).toHaveLength(1);
    const fast = await kit.request.get('/api/restaurants?maxDeliveryTime=25');
    expect(fast.body.data.map((r: { slug: string }) => r.slug)).toEqual([vegSlug]);
  });

  it('sorts by cost and supports openNow', async () => {
    const res = await kit.request.get('/api/restaurants?sort=costHigh&openNow=true');
    expect(res.body.data.map((r: { slug: string }) => r.slug)).toEqual(['royal-biryani', vegSlug]);
  });

  it('finds restaurants through the dishes they serve', async () => {
    const res = await kit.request.get('/api/restaurants?q=dosa');
    expect(res.body.data.map((r: { slug: string }) => r.slug)).toEqual([vegSlug]);
  });

  it('rejects bad query parameters', async () => {
    const res = await kit.request.get('/api/restaurants?minRating=9');
    expect(res.status).toBe(422);
  });

  it('returns a restaurant with its menu grouped by section, bestsellers first', async () => {
    const res = await kit.request.get(`/api/restaurants/${vegSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurant.isOpen).toBe(true);
    expect(res.body.data.menu.map((s: { section: string }) => s.section)).toEqual(['Dosas', 'Drinks']);
  });

  it('hides unapproved restaurants', async () => {
    expect((await kit.request.get('/api/restaurants/pending-place')).status).toBe(404);
  });
});

describe('dish search', () => {
  it('filters vegetarian dishes', async () => {
    const res = await kit.request.get('/api/foods?veg=true');
    expect(res.body.data.every((f: { isVeg: boolean }) => f.isVeg)).toBe(true);
  });

  it('ranks dishes for a mood and returns the mood headline', async () => {
    const res = await kit.request.get('/api/foods?mood=spicy');
    expect(res.body.data[0].name).toBe('Chicken Dum Biryani');
    expect(res.body.meta.headline).toContain('Spicy');
  });

  it('returns a dish with its restaurant', async () => {
    const res = await kit.request.get(`/api/foods/${biryaniFoodId}`);
    expect(res.body.data.restaurant.slug).toBe('royal-biryani');
  });

  it('suggests restaurants, dishes and cuisines while typing, and records full searches', async () => {
    const suggest = await kit.request.get('/api/search/suggest?q=bir');
    expect(suggest.body.data.restaurants[0].slug).toBe('royal-biryani');
    expect(suggest.body.data.dishes[0].restaurantSlug).toBe('royal-biryani');
    expect(suggest.body.data.cuisines).toContain('Biryani');

    await kit.request.get('/api/search?q=Biryani');
    await kit.request.get('/api/search?q=biryani ');
    const trending = await kit.request.get('/api/search/trending');
    expect(trending.body.data[0]).toEqual({ term: 'biryani', count: 2 });
  });

  it('safely handles regex characters in search', async () => {
    const res = await kit.request.get('/api/search/suggest?q=(.*');
    expect(res.status).toBe(200);
    expect(res.body.data.restaurants).toEqual([]);
  });
});
