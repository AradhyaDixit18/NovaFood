/**
 * Demo catalogue. Every restaurant, dish, person and review here is fictional and exists only
 * to make a fresh NovaFood install explorable. Prices are in rupees and converted to paise.
 */
import type { Allergen, Cuisine, DietTag, FoodTag, Weekday } from '@novafood/shared';

export interface SeedDish {
  name: string;
  description: string;
  section: string;
  price: number;
  compareAt?: number;
  veg: boolean;
  art: [kind: string, hue: number];
  tags: FoodTag[];
  diet?: DietTag[];
  allergens?: Allergen[];
  spice?: number;
  ingredients?: string[];
  nutrition?: [calories: number, protein: number, carbs: number, fat: number];
  variants?: [name: string, price: number][];
  addOns?: { name: string; min?: number; max?: number; options: [name: string, price: number, veg?: boolean][] }[];
  bestseller?: boolean;
  cuisine?: Cuisine;
}

export interface SeedRestaurant {
  name: string;
  description: string;
  cuisines: Cuisine[];
  area: string;
  line1: string;
  pincode: string;
  location: [lat: number, lng: number];
  pureVeg?: boolean;
  costForTwo: number;
  deliveryTime: number;
  deliveryFee: number;
  freeDeliveryAbove?: number;
  minOrder?: number;
  hours: '24x7' | [open: string, close: string];
  offer?: string;
  art: [kind: string, hue: number];
  dishes: SeedDish[];
}

const ALL_DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export function hoursFor(spec: SeedRestaurant['hours']) {
  if (spec === '24x7') return ALL_DAYS.map((day) => ({ day, open: '00:00', close: '23:59' }));
  return ALL_DAYS.map((day) => ({ day, open: spec[0], close: spec[1] }));
}

const cheese: SeedDish['addOns'] = [{ name: 'Extra cheese', max: 1, options: [['Cheese slice', 30], ['Liquid cheese dip', 40]] }];

export const RESTAURANTS: SeedRestaurant[] = [
  {
    name: 'Handi & Hustle',
    description: 'Slow-cooked dum biryanis and rich curries from a cloud kitchen that never sleeps.',
    cuisines: ['Biryani', 'North Indian'],
    area: 'Koramangala',
    line1: '5th Block, 80 Feet Road',
    pincode: '560095',
    location: [12.9352, 77.6245],
    costForTwo: 550,
    deliveryTime: 35,
    deliveryFee: 39,
    freeDeliveryAbove: 499,
    minOrder: 149,
    hours: '24x7',
    offer: '20% off up to ₹100',
    art: ['biryani', 28],
    dishes: [
      { name: 'Hyderabadi Chicken Dum Biryani', description: 'Long-grain basmati sealed with marinated chicken, saffron and fried onions, cooked dum-style.', section: 'Biryani', price: 299, compareAt: 349, veg: false, art: ['biryani', 30], tags: ['spicy', 'comfort', 'one-bowl'], spice: 2, bestseller: true, ingredients: ['basmati rice', 'chicken', 'saffron', 'yoghurt', 'fried onion'], nutrition: [780, 38, 92, 28], allergens: ['dairy'], variants: [['Half', 299], ['Full', 499]], addOns: [{ name: 'Sides', max: 2, options: [['Mirchi ka salan', 49], ['Raita', 39], ['Double ka meetha', 79]] }] },
      { name: 'Paneer Tikka Biryani', description: 'Smoky paneer tikka layered with fragrant rice and mint.', section: 'Biryani', price: 269, veg: true, art: ['biryani', 45], tags: ['spicy', 'one-bowl'], spice: 2, ingredients: ['basmati rice', 'paneer', 'mint'], nutrition: [720, 26, 90, 26], allergens: ['dairy'], variants: [['Half', 269], ['Full', 449]] },
      { name: 'Mutton Ghee Roast Biryani', description: 'Tender mutton in a Mangalorean-style ghee roast masala, finished with curry leaves.', section: 'Biryani', price: 389, veg: false, art: ['biryani', 12], tags: ['spicy', 'comfort'], spice: 3, nutrition: [860, 42, 88, 36], allergens: ['dairy'] },
      { name: 'Butter Chicken', description: 'Charred tandoori chicken in a silky tomato-butter gravy.', section: 'Curries', price: 319, veg: false, art: ['curry', 18], tags: ['creamy', 'comfort'], spice: 1, bestseller: true, nutrition: [640, 36, 18, 46], allergens: ['dairy', 'nuts'] },
      { name: 'Dal Makhani', description: 'Black lentils slow-simmered overnight with butter and cream.', section: 'Curries', price: 229, veg: true, art: ['curry', 8], tags: ['creamy', 'comfort', 'home-style'], nutrition: [480, 18, 44, 24], allergens: ['dairy'] },
      { name: 'Butter Naan', description: 'Soft tandoor naan brushed with butter.', section: 'Breads', price: 55, veg: true, art: ['bread', 38], tags: ['comfort'], allergens: ['gluten', 'dairy'] },
      { name: 'Garlic Naan', description: 'Naan topped with roasted garlic and coriander.', section: 'Breads', price: 65, veg: true, art: ['bread', 42], tags: ['comfort'], allergens: ['gluten', 'dairy'] },
      { name: 'Phirni', description: 'Chilled ground-rice pudding with cardamom and pistachio.', section: 'Desserts', price: 99, veg: true, art: ['dessert', 50], tags: ['dessert', 'creamy'], allergens: ['dairy', 'nuts'] },
    ],
  },
  {
    name: 'Dosa Dynamo',
    description: 'Crisp dosas, fluffy idlis and filter coffee, the way Bengaluru mornings should taste.',
    cuisines: ['South Indian'],
    area: 'Indiranagar',
    line1: '12th Main, HAL 2nd Stage',
    pincode: '560038',
    location: [12.9719, 77.6412],
    pureVeg: true,
    costForTwo: 300,
    deliveryTime: 25,
    deliveryFee: 29,
    freeDeliveryAbove: 299,
    hours: ['07:00', '22:30'],
    offer: 'Free delivery above ₹299',
    art: ['dosa', 42],
    dishes: [
      { name: 'Ghee Masala Dosa', description: 'Paper-thin dosa roasted in ghee with spiced potato filling, chutney and sambar.', section: 'Dosas', price: 139, veg: true, art: ['dosa', 40], tags: ['crunchy', 'breakfast', 'home-style'], bestseller: true, nutrition: [480, 10, 62, 20], allergens: ['dairy'] },
      { name: 'Mysore Masala Dosa', description: 'Red chilli-garlic chutney spread inside a crisp dosa.', section: 'Dosas', price: 149, veg: true, art: ['dosa', 22], tags: ['spicy', 'crunchy', 'breakfast'], spice: 2, nutrition: [500, 10, 64, 21] },
      { name: 'Rava Onion Dosa', description: 'Lacy semolina dosa with onions, green chilli and cumin.', section: 'Dosas', price: 129, veg: true, art: ['dosa', 48], tags: ['crunchy', 'breakfast'], allergens: ['gluten'] },
      { name: 'Idli Vada Combo', description: 'Two steamed idlis and a crisp medu vada with sambar.', section: 'Idli & Vada', price: 99, veg: true, art: ['idli', 55], tags: ['breakfast', 'light', 'combo'], diet: ['vegan'], nutrition: [380, 12, 58, 10] },
      { name: 'Bisi Bele Bath', description: 'Karnataka-style rice and lentils with tamarind and a spice blend.', section: 'Rice', price: 119, veg: true, art: ['bowl', 30], tags: ['comfort', 'one-bowl', 'home-style'], diet: ['vegan'], spice: 1 },
      { name: 'Curd Rice', description: 'Cooling tempered curd rice with pomegranate.', section: 'Rice', price: 89, veg: true, art: ['bowl', 190], tags: ['comfort', 'light', 'home-style'], allergens: ['dairy'] },
      { name: 'Filter Coffee', description: 'Strong decoction with frothy milk, served in a dabara set.', section: 'Beverages', price: 49, veg: true, art: ['coffee', 25], tags: ['beverage', 'breakfast'], allergens: ['dairy'], cuisine: 'Beverages' },
      { name: 'Kesari Bath', description: 'Semolina halwa with saffron, ghee and cashews.', section: 'Sweets', price: 69, veg: true, art: ['dessert', 38], tags: ['dessert'], allergens: ['dairy', 'nuts', 'gluten'], cuisine: 'Desserts' },
    ],
  },
  {
    name: 'Noodle Nebula',
    description: 'Wok-fired Indo-Chinese and Korean-inspired noodle bowls, open round the clock.',
    cuisines: ['Chinese', 'Korean'],
    area: 'HSR Layout',
    line1: '27th Main, Sector 2',
    pincode: '560102',
    location: [12.9116, 77.6473],
    costForTwo: 450,
    deliveryTime: 30,
    deliveryFee: 35,
    freeDeliveryAbove: 399,
    hours: '24x7',
    offer: 'Flat ₹75 off above ₹349',
    art: ['noodles', 350],
    dishes: [
      { name: 'Chilli Garlic Hakka Noodles', description: 'Wok-tossed noodles with burnt garlic, chilli and crunchy veggies.', section: 'Noodles', price: 189, veg: true, art: ['noodles', 10], tags: ['spicy', 'street-food', 'one-bowl', 'late-night'], spice: 2, bestseller: true, allergens: ['gluten', 'soy'], variants: [['Veg', 189], ['Egg', 209], ['Chicken', 239]] },
      { name: 'Korean Fire Ramen', description: 'Chewy ramen in a gochujang broth with a jammy egg and spring onion.', section: 'Noodles', price: 249, veg: false, art: ['ramen', 0], tags: ['spicy', 'one-bowl', 'late-night'], spice: 3, allergens: ['gluten', 'soy', 'egg'], cuisine: 'Korean', nutrition: [620, 22, 78, 22] },
      { name: 'Veg Manchurian Gravy', description: 'Crisp vegetable dumplings in a tangy soy-garlic gravy.', section: 'Starters', price: 179, veg: true, art: ['bowl', 20], tags: ['spicy', 'shareable'], spice: 1, allergens: ['gluten', 'soy'] },
      { name: 'Chilli Chicken Dry', description: 'Crispy chicken tossed with peppers, onion and green chilli.', section: 'Starters', price: 259, veg: false, art: ['fries', 15], tags: ['spicy', 'crunchy', 'shareable'], spice: 2, bestseller: true, allergens: ['gluten', 'soy'] },
      { name: 'Kimchi Fried Rice', description: 'Fried rice with house kimchi, sesame and a fried egg on top.', section: 'Rice', price: 229, veg: false, art: ['bowl', 5], tags: ['spicy', 'one-bowl'], cuisine: 'Korean', allergens: ['egg', 'sesame', 'soy'] },
      { name: 'Korean Corn Dog', description: 'Mozzarella-stuffed corn dog rolled in panko, sugar and ketchup-mustard.', section: 'Snacks', price: 149, veg: true, art: ['corndog', 40], tags: ['snack', 'crunchy', 'street-food'], cuisine: 'Korean', allergens: ['gluten', 'dairy'] },
      { name: 'Lemon Iced Tea', description: 'House-brewed black tea with fresh lemon.', section: 'Drinks', price: 79, veg: true, art: ['drink', 55], tags: ['beverage', 'light'], diet: ['vegan'], cuisine: 'Beverages' },
    ],
  },
  {
    name: 'Crust Club 42',
    description: 'Hand-stretched sourdough pizzas and cheesy sides for the whole squad.',
    cuisines: ['Pizza', 'Italian'],
    area: 'Indiranagar',
    line1: '100 Feet Road, near Metro',
    pincode: '560038',
    location: [12.9784, 77.6408],
    costForTwo: 700,
    deliveryTime: 40,
    deliveryFee: 49,
    freeDeliveryAbove: 599,
    minOrder: 199,
    hours: ['11:00', '23:59'],
    offer: '30% off on your first order',
    art: ['pizza', 8],
    dishes: [
      { name: 'Margherita Sourdough', description: 'San Marzano tomato, fior di latte and basil on a 48-hour sourdough base.', section: 'Pizzas', price: 349, veg: true, art: ['pizza', 5], tags: ['shareable', 'comfort'], bestseller: true, allergens: ['gluten', 'dairy'], variants: [['Regular 8"', 349], ['Large 12"', 549]], addOns: cheese },
      { name: 'Peri Peri Paneer Pizza', description: 'Peri peri paneer, bell peppers, onion and jalapeño.', section: 'Pizzas', price: 399, veg: true, art: ['pizza', 20], tags: ['spicy', 'shareable'], spice: 2, allergens: ['gluten', 'dairy'], variants: [['Regular 8"', 399], ['Large 12"', 599]], addOns: cheese },
      { name: 'Pepperoni Party', description: 'Double pepperoni, mozzarella and hot honey drizzle.', section: 'Pizzas', price: 459, veg: false, art: ['pizza', 355], tags: ['shareable', 'spicy'], spice: 1, bestseller: true, allergens: ['gluten', 'dairy'], variants: [['Regular 8"', 459], ['Large 12"', 699]], addOns: cheese },
      { name: 'Truffle Mushroom Pizza', description: 'Wild mushrooms, truffle oil and parmesan on a white sauce base.', section: 'Pizzas', price: 499, veg: true, art: ['pizza', 35], tags: ['creamy'], allergens: ['gluten', 'dairy'], variants: [['Regular 8"', 499], ['Large 12"', 749]] },
      { name: 'Garlic Knots', description: 'Buttery knots with roasted garlic and marinara dip.', section: 'Sides', price: 169, veg: true, art: ['bread', 40], tags: ['snack', 'shareable'], allergens: ['gluten', 'dairy'] },
      { name: 'Penne Arrabbiata', description: 'Penne in a fiery tomato and garlic sauce.', section: 'Pasta', price: 289, veg: true, art: ['pasta', 8], tags: ['spicy', 'one-bowl'], diet: ['vegan'], spice: 2, allergens: ['gluten'], cuisine: 'Italian' },
      { name: 'Tiramisu Jar', description: 'Espresso-soaked sponge layered with mascarpone cream.', section: 'Desserts', price: 199, veg: true, art: ['dessert', 28], tags: ['dessert', 'creamy'], allergens: ['gluten', 'dairy', 'egg'], cuisine: 'Desserts' },
    ],
  },
  {
    name: 'Stack Attack Burgers',
    description: 'Smashed patties, toasted brioche and fries that stay crunchy till they reach you.',
    cuisines: ['Burgers'],
    area: 'Koramangala',
    line1: '7th Block, Jyoti Nivas College Road',
    pincode: '560095',
    location: [12.9365, 77.6139],
    costForTwo: 500,
    deliveryTime: 28,
    deliveryFee: 35,
    freeDeliveryAbove: 399,
    hours: '24x7',
    offer: 'Buy 2 burgers, get fries at ₹49',
    art: ['burger', 30],
    dishes: [
      { name: 'Double Smash Burger', description: 'Two smashed chicken patties, American cheese, pickles and house sauce.', section: 'Burgers', price: 279, veg: false, art: ['burger', 25], tags: ['comfort', 'late-night'], bestseller: true, allergens: ['gluten', 'dairy', 'egg'], nutrition: [820, 44, 52, 48], variants: [['Single', 229], ['Double', 279], ['Triple', 349]], addOns: [{ name: 'Add-ons', max: 3, options: [['Extra cheese', 30], ['Fried egg', 35, false], ['Jalapeños', 20]] }, { name: 'Make it a meal', max: 1, options: [['Fries + Coke', 119], ['Peri peri fries + Lemonade', 139]] }] },
      { name: 'Crispy Paneer Burger', description: 'Crumb-fried paneer slab with sriracha mayo and slaw.', section: 'Burgers', price: 219, veg: true, art: ['burger', 45], tags: ['crunchy', 'spicy'], spice: 1, allergens: ['gluten', 'dairy'], addOns: [{ name: 'Make it a meal', max: 1, options: [['Fries + Coke', 119], ['Peri peri fries + Lemonade', 139]] }] },
      { name: 'Aloo Tikki Crunch', description: 'Spiced potato tikki with mint mayo and onions.', section: 'Burgers', price: 149, veg: true, art: ['burger', 50], tags: ['crunchy', 'street-food'], allergens: ['gluten'] },
      { name: 'Peri Peri Fries', description: 'Skin-on fries dusted with peri peri.', section: 'Sides', price: 129, veg: true, art: ['fries', 30], tags: ['snack', 'crunchy', 'spicy', 'shareable'], diet: ['vegan'], spice: 1 },
      { name: 'Loaded Cheese Fries', description: 'Fries buried in cheese sauce, jalapeño and crispy onions.', section: 'Sides', price: 179, veg: true, art: ['fries', 45], tags: ['snack', 'shareable', 'late-night'], allergens: ['dairy'] },
      { name: 'Oreo Thick Shake', description: 'Vanilla ice cream blended with Oreo crumble.', section: 'Shakes', price: 169, veg: true, art: ['shake', 260], tags: ['dessert', 'beverage'], allergens: ['dairy', 'gluten'], cuisine: 'Beverages' },
    ],
  },
  {
    name: 'Chaat Chakra',
    description: 'Mumbai and Delhi street chaat, packed so the crunch survives the ride.',
    cuisines: ['Street Food'],
    area: 'Jayanagar',
    line1: '4th Block, 11th Main',
    pincode: '560011',
    location: [12.9299, 77.5838],
    pureVeg: true,
    costForTwo: 250,
    deliveryTime: 22,
    deliveryFee: 25,
    hours: ['12:00', '23:00'],
    art: ['chaat', 90],
    dishes: [
      { name: 'Pani Puri (8 pcs)', description: 'Crisp puris with spiced potato, tangy mint water and sweet chutney, packed separately.', section: 'Chaat', price: 79, veg: true, art: ['chaat', 100], tags: ['street-food', 'spicy', 'crunchy', 'snack'], diet: ['vegan'], spice: 2, bestseller: true, allergens: ['gluten'] },
      { name: 'Dahi Papdi Chaat', description: 'Papdi topped with yoghurt, chutneys, sev and pomegranate.', section: 'Chaat', price: 99, veg: true, art: ['chaat', 80], tags: ['street-food', 'snack'], allergens: ['dairy', 'gluten'] },
      { name: 'Pav Bhaji', description: 'Buttery mashed vegetable bhaji with two toasted pav.', section: 'Mains', price: 149, veg: true, art: ['curry', 15], tags: ['street-food', 'comfort', 'spicy'], spice: 1, bestseller: true, allergens: ['gluten', 'dairy'], addOns: [{ name: 'Extras', max: 2, options: [['Extra pav', 25], ['Extra butter', 15]] }] },
      { name: 'Vada Pav', description: 'Spiced potato fritter in pav with dry garlic chutney.', section: 'Mains', price: 49, veg: true, art: ['burger', 38], tags: ['street-food', 'snack', 'spicy'], diet: ['vegan'], allergens: ['gluten'] },
      { name: 'Samosa Chaat', description: 'Crushed samosas under chole, yoghurt and chutneys.', section: 'Chaat', price: 109, veg: true, art: ['chaat', 45], tags: ['street-food', 'comfort'], allergens: ['gluten', 'dairy'] },
      { name: 'Masala Chaas', description: 'Spiced buttermilk with roasted cumin.', section: 'Drinks', price: 39, veg: true, art: ['drink', 150], tags: ['beverage', 'light'], allergens: ['dairy'], cuisine: 'Beverages' },
    ],
  },
  {
    name: 'Green Rebellion',
    description: 'Protein bowls, salads and smoothies that actually keep you full.',
    cuisines: ['Healthy'],
    area: 'HSR Layout',
    line1: '19th Main, Sector 4',
    pincode: '560102',
    location: [12.9121, 77.6389],
    costForTwo: 600,
    deliveryTime: 30,
    deliveryFee: 35,
    freeDeliveryAbove: 449,
    hours: ['08:00', '22:00'],
    offer: '15% off on bowls',
    art: ['salad', 120],
    dishes: [
      { name: 'Grilled Chicken Power Bowl', description: 'Herb chicken, quinoa, roasted veg, hummus and tahini.', section: 'Bowls', price: 349, veg: false, art: ['salad', 110], tags: ['healthy', 'high-protein', 'one-bowl'], diet: ['high-protein', 'gluten-free'], bestseller: true, nutrition: [540, 46, 42, 18], allergens: ['sesame'] },
      { name: 'Tofu Teriyaki Bowl', description: 'Glazed tofu, brown rice, edamame and pickled carrots.', section: 'Bowls', price: 319, veg: true, art: ['salad', 140], tags: ['healthy', 'high-protein', 'one-bowl'], diet: ['vegan', 'high-protein'], nutrition: [510, 28, 64, 14], allergens: ['soy', 'sesame'] },
      { name: 'Paneer Tikka Salad', description: 'Tandoori paneer over greens with mint-yoghurt dressing.', section: 'Salads', price: 289, veg: true, art: ['salad', 95], tags: ['healthy', 'high-protein', 'light'], diet: ['high-protein', 'gluten-free'], nutrition: [420, 30, 18, 24], allergens: ['dairy'] },
      { name: 'Keto Egg Avocado Toast', description: 'Seeded low-carb bread, smashed avocado and two poached eggs.', section: 'All Day Breakfast', price: 299, veg: false, art: ['toast', 80], tags: ['healthy', 'breakfast', 'light'], diet: ['keto'], allergens: ['egg', 'nuts'] },
      { name: 'Peanut Butter Banana Smoothie', description: 'Banana, peanut butter, oats and almond milk.', section: 'Smoothies', price: 179, veg: true, art: ['shake', 40], tags: ['healthy', 'beverage', 'breakfast'], diet: ['vegan', 'dairy-free'], allergens: ['peanuts', 'nuts'], cuisine: 'Beverages' },
      { name: 'Millet Khichdi Bowl', description: 'Foxtail millet and moong dal khichdi with ghee and pickled onions.', section: 'Bowls', price: 229, veg: true, art: ['bowl', 55], tags: ['healthy', 'comfort', 'home-style'], diet: ['gluten-free'], allergens: ['dairy'] },
    ],
  },
  {
    name: 'Sugar Rush Lab',
    description: 'Dessert experiments: gooey brownies, cheesecakes and very serious ice cream.',
    cuisines: ['Desserts'],
    area: 'Koramangala',
    line1: '6th Block, 17th Main',
    pincode: '560095',
    location: [12.9392, 77.6200],
    pureVeg: true,
    costForTwo: 400,
    deliveryTime: 25,
    deliveryFee: 30,
    hours: ['12:00', '02:00'],
    offer: 'Late-night dessert drop',
    art: ['cake', 330],
    dishes: [
      { name: 'Molten Lava Brownie', description: 'Warm fudge brownie with a gooey centre and vanilla scoop.', section: 'Brownies', price: 179, veg: true, art: ['cake', 20], tags: ['dessert', 'comfort', 'late-night'], bestseller: true, allergens: ['gluten', 'dairy', 'egg'] },
      { name: 'Biscoff Cheesecake Slice', description: 'Baked cheesecake on a Biscoff crumb with caramelised biscuit spread.', section: 'Cheesecakes', price: 229, veg: true, art: ['cake', 32], tags: ['dessert', 'creamy'], allergens: ['gluten', 'dairy', 'egg'] },
      { name: 'Gulab Jamun Sundae', description: 'Warm gulab jamuns over kesar pista ice cream.', section: 'Sundaes', price: 169, veg: true, art: ['icecream', 35], tags: ['dessert', 'comfort'], allergens: ['dairy', 'nuts'] },
      { name: 'Belgian Chocolate Scoop', description: 'Dense 70% chocolate ice cream.', section: 'Ice Cream', price: 129, veg: true, art: ['icecream', 15], tags: ['dessert'], allergens: ['dairy'], variants: [['Single scoop', 129], ['Double scoop', 219]], addOns: [{ name: 'Toppings', max: 3, options: [['Hot fudge', 30], ['Roasted almonds', 35], ['Sprinkles', 15]] }] },
      { name: 'Mango Mastani', description: 'Thick mango shake topped with ice cream and dry fruit.', section: 'Shakes', price: 159, veg: true, art: ['shake', 45], tags: ['dessert', 'beverage'], allergens: ['dairy', 'nuts'], cuisine: 'Beverages' },
    ],
  },
  {
    name: 'Momo Mission',
    description: 'Steamed, fried and tandoori momos with a chutney for every mood.',
    cuisines: ['Momos', 'Chinese'],
    area: 'BTM Layout',
    line1: '2nd Stage, 16th Main',
    pincode: '560076',
    location: [12.9166, 77.6101],
    costForTwo: 300,
    deliveryTime: 26,
    deliveryFee: 25,
    freeDeliveryAbove: 299,
    hours: ['12:00', '23:30'],
    art: ['momo', 200],
    dishes: [
      { name: 'Steamed Chicken Momos', description: 'Juicy chicken momos with fiery red chutney.', section: 'Momos', price: 139, veg: false, art: ['momo', 210], tags: ['snack', 'light', 'comfort'], bestseller: true, allergens: ['gluten'], variants: [['6 pcs', 139], ['10 pcs', 209]] },
      { name: 'Paneer Tandoori Momos', description: 'Paneer momos marinated in tandoori masala and charred.', section: 'Momos', price: 169, veg: true, art: ['momo', 20], tags: ['snack', 'spicy', 'shareable'], spice: 2, allergens: ['gluten', 'dairy'], variants: [['6 pcs', 169], ['10 pcs', 249]] },
      { name: 'Veg Fried Momos', description: 'Golden fried vegetable momos with mayo dip.', section: 'Momos', price: 129, veg: true, art: ['momo', 45], tags: ['snack', 'crunchy', 'street-food'], allergens: ['gluten', 'egg'], variants: [['6 pcs', 129], ['10 pcs', 189]] },
      { name: 'Jhol Momos', description: 'Chicken momos swimming in a tangy sesame-tomato broth.', section: 'Momos', price: 179, veg: false, art: ['ramen', 25], tags: ['spicy', 'comfort', 'one-bowl'], spice: 2, allergens: ['gluten', 'sesame'] },
      { name: 'Thukpa', description: 'Tibetan noodle soup with vegetables and herbs.', section: 'Soups', price: 159, veg: true, art: ['ramen', 60], tags: ['comfort', 'one-bowl', 'light'], allergens: ['gluten'], cuisine: 'Chinese' },
    ],
  },
  {
    name: 'Taco Tantra',
    description: 'Indian-Mexican mashups: tacos, burritos and loaded nachos.',
    cuisines: ['Mexican'],
    area: 'Whitefield',
    line1: 'ITPL Main Road, Phase 1',
    pincode: '560066',
    location: [12.9698, 77.7500],
    costForTwo: 550,
    deliveryTime: 35,
    deliveryFee: 45,
    freeDeliveryAbove: 499,
    hours: ['12:00', '23:30'],
    offer: 'Flat ₹100 off above ₹599',
    art: ['taco', 45],
    dishes: [
      { name: 'Butter Chicken Tacos', description: 'Three soft tacos with butter chicken, pickled onion and coriander crema.', section: 'Tacos', price: 299, veg: false, art: ['taco', 25], tags: ['comfort', 'shareable'], bestseller: true, allergens: ['gluten', 'dairy'] },
      { name: 'Paneer Chipotle Burrito', description: 'Chipotle paneer, rice, beans, salsa and cheese in a big tortilla.', section: 'Burritos', price: 279, veg: true, art: ['burrito', 30], tags: ['one-bowl', 'spicy', 'high-protein'], spice: 1, allergens: ['gluten', 'dairy'] },
      { name: 'Loaded Nachos', description: 'Corn chips, cheese sauce, beans, jalapeño and salsa fresca.', section: 'Sharing', price: 249, veg: true, art: ['nachos', 48], tags: ['shareable', 'snack', 'crunchy'], allergens: ['dairy'] },
      { name: 'Burrito Bowl', description: 'Everything in a burrito, minus the tortilla.', section: 'Bowls', price: 269, veg: true, art: ['salad', 60], tags: ['healthy', 'one-bowl'], diet: ['gluten-free'] },
      { name: 'Churros with Chocolate', description: 'Cinnamon-sugar churros with dark chocolate dip.', section: 'Desserts', price: 159, veg: true, art: ['churros', 30], tags: ['dessert', 'snack'], allergens: ['gluten', 'dairy'], cuisine: 'Desserts' },
    ],
  },
  {
    name: 'Chai Circuit',
    description: 'Cutting chai, bun maska and snacks, brewing 24x7.',
    cuisines: ['Beverages', 'Street Food'],
    area: 'Electronic City',
    line1: 'Phase 1, Neeladri Road',
    pincode: '560100',
    location: [12.8456, 77.6603],
    pureVeg: true,
    costForTwo: 200,
    deliveryTime: 20,
    deliveryFee: 19,
    freeDeliveryAbove: 199,
    hours: '24x7',
    offer: 'Chai + snack combos from ₹99',
    art: ['chai', 28],
    dishes: [
      { name: 'Masala Cutting Chai', description: 'Strong ginger-cardamom chai.', section: 'Chai', price: 39, veg: true, art: ['chai', 30], tags: ['beverage', 'late-night', 'breakfast'], bestseller: true, allergens: ['dairy'], variants: [['Cutting', 39], ['Full kettle (4 cups)', 139]] },
      { name: 'Bun Maska', description: 'Soft bun with a generous slab of salted butter.', section: 'Snacks', price: 49, veg: true, art: ['bread', 45], tags: ['snack', 'breakfast', 'comfort'], allergens: ['gluten', 'dairy'] },
      { name: 'Onion Pakoda', description: 'Crisp onion fritters with green chutney.', section: 'Snacks', price: 69, veg: true, art: ['fries', 40], tags: ['snack', 'crunchy', 'late-night'], diet: ['vegan', 'gluten-free'] },
      { name: 'Chai + Samosa Combo', description: 'Two samosas and a masala chai.', section: 'Combos', price: 99, veg: true, art: ['samosa', 35], tags: ['combo', 'snack', 'late-night'], allergens: ['gluten', 'dairy'] },
      { name: 'Cold Coffee', description: 'Blended cold coffee with a scoop of vanilla ice cream.', section: 'Cold Drinks', price: 99, veg: true, art: ['shake', 25], tags: ['beverage', 'dessert'], allergens: ['dairy'] },
    ],
  },
  {
    name: 'Midnight Paratha Co.',
    description: 'Stuffed parathas, egg bhurji and chai for the 2 a.m. crowd.',
    cuisines: ['North Indian'],
    area: 'Marathahalli',
    line1: 'Outer Ring Road, near Kalamandir',
    pincode: '560037',
    location: [12.9569, 77.7011],
    costForTwo: 350,
    deliveryTime: 30,
    deliveryFee: 35,
    hours: ['20:00', '05:00'],
    offer: 'After-midnight combos',
    art: ['paratha', 35],
    dishes: [
      { name: 'Aloo Pyaaz Paratha', description: 'Two parathas stuffed with spiced potato and onion, with curd and pickle.', section: 'Parathas', price: 149, veg: true, art: ['paratha', 38], tags: ['comfort', 'late-night', 'home-style'], bestseller: true, allergens: ['gluten', 'dairy'], addOns: [{ name: 'Extras', max: 2, options: [['White butter', 25], ['Extra curd', 30]] }] },
      { name: 'Paneer Paratha', description: 'Parathas loaded with spiced paneer.', section: 'Parathas', price: 179, veg: true, art: ['paratha', 44], tags: ['comfort', 'late-night', 'high-protein'], allergens: ['gluten', 'dairy'] },
      { name: 'Egg Bhurji Pav', description: 'Street-style spicy scrambled eggs with butter pav.', section: 'Egg Specials', price: 129, veg: false, art: ['curry', 48], tags: ['spicy', 'late-night', 'street-food'], spice: 2, allergens: ['egg', 'gluten', 'dairy'] },
      { name: 'Rajma Chawal', description: 'Punjabi rajma with steamed rice.', section: 'Rice', price: 159, veg: true, art: ['curry', 5], tags: ['comfort', 'home-style', 'one-bowl'], diet: ['gluten-free'] },
      { name: 'Kulhad Chai', description: 'Smoky chai served in a clay kulhad.', section: 'Drinks', price: 45, veg: true, art: ['chai', 25], tags: ['beverage', 'late-night'], allergens: ['dairy'], cuisine: 'Beverages' },
    ],
  },
];

export const REVIEW_COMMENTS: Record<number, string[]> = {
  5: [
    'Bhai, full paisa vasool. Ordering again this weekend 🔥',
    'Arrived hot and packed really well. Easily the best in the area.',
    'Portion was huge and the flavours were spot on.',
    'Exactly what I needed after a long day 😋',
    'Consistent every single time. Our office favourite.',
  ],
  4: [
    'Really good, slightly late but worth the wait.',
    'Tasty and fresh. Would love a little more spice.',
    'Solid choice for the price.',
    'Packaging could be better, food was great.',
  ],
  3: ['Decent, nothing extraordinary.', 'Okay-ish. Was better last time.', 'Good taste, portion felt small.'],
  2: ['Arrived cold, taste was average.', 'Too oily for me this time.'],
  1: ['Order was missing an item. Support sorted it, but disappointing.'],
};

export const DEMO_DINERS = [
  'Aarav Mehta',
  'Diya Sharma',
  'Kabir Rao',
  'Ananya Iyer',
  'Vihaan Kapoor',
  'Ishita Nair',
  'Arjun Bhat',
  'Meera Pillai',
  'Rohan Das',
  'Sana Qureshi',
  'Neel Joshi',
  'Tara Menon',
];
