/**
 * NovaFood's voice. Playful Hinglish where it adds personality; plain, precise English wherever
 * money, payment state or account security is involved.
 */

export const COPY = {
  greeting: {
    breakfast: 'Good morning! Nashta kiya? 🍳',
    lunch: 'Lunch time. Bhook lagi? 👀',
    snacks: 'Chai-time cravings? ☕',
    dinner: 'Dinner ka kya scene hai? 🍛',
    'late-night': 'Late night munchies? Hum jaag rahe hain 🌙',
  },
  empty: {
    cart: { title: 'Cart itna empty kyun hai? 👀', body: 'Add something tasty and it will show up here.' },
    search: { title: 'Arre yaar, yahan kuch nahi mila 😭', body: 'Try a different dish, cuisine or restaurant.' },
    orders: { title: 'Abhi tak koi order nahi 🍽️', body: 'Your first order is one tap away.' },
    favorites: { title: 'No favourites yet ❤️', body: 'Tap the heart on a dish or restaurant to save it here.' },
    notifications: { title: 'Sab shaant hai 🤫', body: 'Order updates and offers will appear here.' },
    menu: { title: 'Kitchen abhi silent hai 👀', body: 'This restaurant has not added dishes yet.' },
    reviews: { title: 'No reviews yet', body: 'Be the first to tell others what to order.' },
  },
  loading: ['Bas ek second... 🍜', 'Kitchen se pooch rahe hain 👨‍🍳', 'Menu garam ho raha hai 🔥'],
  error: {
    network: 'Internet ne thoda dhokha de diya 😭 Check your connection and try again.',
    generic: 'Something went wrong on our side. Please try again.',
    notFound: 'Ye page kho gaya 🫠',
    restaurantClosed: 'Ye restaurant abhi band hai. Check back during opening hours.',
    restaurantOffline: 'Ye restaurant abhi orders nahi le raha.',
    itemUnavailable: 'This item just sold out.',
  },
  cart: {
    added: 'Added to cart 🛒',
    full: 'Cart full of vibes 😋',
    otherRestaurant: 'Your cart has items from another restaurant. Start a new cart?',
  },
  success: {
    orderPlaced: 'Scene sorted! Order placed 🎉',
    paymentDone: 'Payment successful ✅',
  },
  tagline: 'Mood = food.',
} as const;
