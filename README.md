# NovaFood

A full-stack food ordering platform with a playful, Gen-Z personality: mood-based discovery, a 3D mascot, live order tracking, and honest engineering underneath. Customers browse fictional Bengaluru kitchens, customise dishes, pay, and watch the order move from kitchen to doorstep in real time. Partners run a live order board and their menu. Admins approve restaurants, moderate reviews, and see platform analytics.

> Portfolio project. Restaurants, dishes and reviews in the demo data are fictional.

## Highlights

- **Real ordering pipeline.** Server-side pricing (GST, fees, coupons, points) from one shared function, idempotent checkout, an explicit order state machine with atomic transitions, automatic refunds on cancellation.
- **Live tracking.** Socket.IO rooms per user, order, restaurant and admin. The customer's tracking page updates the moment the kitchen moves the order; the partner board chimes on new orders.
- **Payments.** Razorpay (test mode) with server-side signature verification and deduplicated webhooks. Cash on delivery works without any keys.
- **Taste Engine.** Explainable recommendations ("Your Friday mood looks like Biryani 👀"), smart reorder, "people also ordered", and mood discovery that maps moods to flavour tags.
- **Nova Points and streaks.** A debit/credit ledger, capped redemption, weekly streaks, achievements and shareable cards.
- **Security.** Short-lived JWT access tokens in memory, rotating httpOnly refresh cookies with reuse detection, CSRF header check, per-endpoint rate limits, strict CSP with hashed inline scripts, bcrypt, zod validation on every input, role-based access.
- **3D without the cost.** The React Three Fiber hero is lazy-loaded, pauses off-screen, and falls back to an SVG mascot on low-end devices or with reduced motion.

## Stack

| Layer | Choices |
| --- | --- |
| Web | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Zustand, React Hook Form + zod, Motion, React Three Fiber |
| API | Node 22, Express 5, Mongoose 8 (MongoDB), Socket.IO, zod, pino |
| Shared | `packages/shared`: types, zod schemas, pricing, order state machine, coupon rules, copy |
| Services | MongoDB Atlas, Razorpay (test), Cloudinary (uploads), Resend (email) |
| Quality | Vitest (unit + API integration), Testing Library, Playwright E2E, ESLint, GitHub Actions |

## Repository layout

```
apps/api        Express API, Socket.IO, seed script, integration tests
apps/web        React app
packages/shared Code both sides import (one source of truth for prices and statuses)
e2e             Playwright tests of the full ordering flow
docs            Architecture decisions
render.yaml     One-click deployment
```

## Run it locally

Requirements: Node 22+, and a MongoDB (Atlas free tier or local).

```bash
npm install
cp apps/api/.env.example apps/api/.env    # then set MONGODB_URI and JWT_ACCESS_SECRET
npm run seed -- --reset                   # demo restaurants, dishes, orders, reviews
npm run dev                               # API on :4000, website on http://localhost:5173
```

Demo logins created by the seed:

| Role | Email | Password |
| --- | --- | --- |
| Customer | demo@novafood.dev | NovaDemo@123 |
| Partner (Handi & Hustle, Crust Club 42) | partner@novafood.dev | NovaDemo@123 |
| Admin | admin@novafood.dev | printed by the seed, or `SEED_ADMIN_PASSWORD` |

Coupons: `NOVA50` (first order), `BHOOK75`, `CRUST30`, `LATENIGHT`.

Try it with two windows: place an order as the customer, then open **Partner > Live orders** as the partner and move it along. The customer's tracking page updates without a refresh.

### Production mode on one origin

```bash
npm run build
WEB_DIST_DIR=../web/dist NODE_ENV=production COOKIE_SECURE=true CLIENT_URL=http://localhost:4000 npm start
# open http://localhost:4000
```

With `WEB_DIST_DIR` set, the API serves the website itself, so there is no CORS, no cross-site cookie, and Socket.IO shares the host.

## Environment variables

Documented in [`apps/api/.env.example`](apps/api/.env.example) and [`apps/web/.env.example`](apps/web/.env.example). Everything optional degrades honestly: no Razorpay keys means cash on delivery only, no Cloudinary means uploads are disabled, the console email provider prints emails to the terminal.

## Testing

```bash
npm test          # shared + API integration (in-memory MongoDB) + web unit tests
npm run test:e2e  # Playwright: guest cart -> register -> coupon -> checkout -> partner kitchen -> live tracking -> review
npm run check     # lint, typecheck, tests, build
```

CI runs all of it, including the E2E suite against the production build with a real MongoDB service.

## Deployment

`render.yaml` deploys the whole app as one Render web service. In Render: **New > Blueprint**, pick the repository, then fill in `MONGODB_URI`, `CLIENT_URL` (the service's own URL) and any optional keys. In MongoDB Atlas, allow the service to connect under **Network Access**. Seed once from your machine with the production `MONGODB_URI`:

```bash
SEED_ALLOW_RESET=true npm run seed -- --reset
```

## API overview

All routes are under `/api` and return `{ data, meta? }` or `{ error: { code, message, details? } }`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register, /login, /refresh, /logout, /logout-all, /forgot-password, /reset-password, /verify-email, /change-password`, `GET /auth/me` |
| Catalog | `GET /restaurants, /restaurants/:slug, /foods, /foods/:id, /search, /search/suggest, /search/trending` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:lineId`, `POST/DELETE /cart/coupon`, `POST /cart/merge` |
| Orders | `POST /orders`, `GET /orders, /orders/:id`, `POST /orders/:id/cancel, /reorder, /payment/verify, /payment/retry` |
| Account | `/users/me`, addresses, data export, `/favorites`, `/notifications`, `/rewards`, `/reviews` |
| Discovery | `/recommendations/for-you, /smart-reorder, /also-ordered/:foodId` |
| Partner | `/partner/restaurants`, menu CRUD, `/partner/orders`, status updates, analytics |
| Admin | `/admin/analytics, /users, /restaurants, /orders, /orders/:id/status, /orders/:id/refund, /coupons, /reviews` (every admin write is audit-logged) |
| Webhooks | `POST /payments/webhooks/razorpay` |

## Roadmap

- Live rider location (the tracker is stage-based today and says so).
- Push notifications, and scheduled orders.
- Verified sending domain for email to any address.
