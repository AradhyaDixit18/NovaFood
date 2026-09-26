# NovaFood — Architecture & Audit

_Phase 1 audit, 2026-09-26. Living document: updated at the end of every phase._

---

## 1. Current state (as found)

### Snapshot
| Area | Reality |
|---|---|
| Git | 1 commit (`first commit`), pushed to **public** `github.com/AradhyaDixit18/NovaFood` |
| Tracked files | 3,509, of which **3,404 are `backend/node_modules`** |
| Source code | ~1,200 lines JSX/CSS (frontend) + ~60 lines JS (backend) |
| Frontend | React 18 + Vite 5 + React Router 6, plain JS, per-component CSS, Context API |
| Backend | Express 4 + Mongoose 8 (ESM), MongoDB Atlas |
| Tests / CI / types / docs | None / none / none / `README.md` is one line |
| Origin | Structure, copy, and all images match the public "Tomato" food-delivery tutorial (footer still reads `Tomato.com`) |

### Frontend inventory
- **Routes:** `/` (Home), `/cart`, `/order`. No 404, no restaurant/food/profile/auth routes.
- **Components:** Navbar, Header, ExploreMenu, FoodDisplay, FoodItem, LoginPopup, AppDownload, Footer.
- **State:** `StoreContext` holds `cartItems` (`{id: qty}`) and a hardcoded `food_list` (32 items) imported from `assets/assets.js`. Nothing is fetched from the API.
- **Assets:** 80 PNGs, 7.8 MB total (`header_img.png` alone is 1.8 MB). No WebP/AVIF, no lazy loading.
- **Styling:** Global `Outfit` font, `.app { width: 80% }`, a few `@media` breakpoints. `App.css` and `react.svg` are unused Vite boilerplate.

### Backend inventory
- `server.js` → mounts `/api/food`, hardcoded port 4000, `cors()` open to all origins.
- `models/foodModel.js` → `name, description, price, image, category`.
- `controllers/foodController.js` → `addFood` is an **empty function**.
- `routes/foodRoutes.js` → `POST /api/food/add` registered **twice** (once without multer).
- Dependencies installed but unused: `bcrypt`, `jsonwebtoken`, `stripe`, `validator`, `dotenv`, `sendmail`, `body-parser`.

---

## 2. Defects (verified)

### Critical
1. **Database credentials are public.** `backend/config/db.js` hardcodes the Atlas connection string including username and password, and it is committed and pushed to a public repo. The credential must be rotated in Atlas; it remains in git history until history is rewritten.
2. **Backend cannot start.** `foodModel.js` has `mongoose-model(...)` (minus sign, not a dot). Verified: importing the model throws `ReferenceError: model is not defined`, so `server.js` crashes on boot.
3. **Frontend crashes after the first add-to-cart.** `getTotalCartAmount()` references `food` / `list.find` (a broken `food_list`), and Navbar calls it on every render → `ReferenceError` → white screen.
4. **Cart page is unreachable.** `onClick={navigate('/order')}` calls `navigate` during render, redirecting away immediately.
5. **`node_modules` and `.env` are tracked in git.** No root `.gitignore`; the backend has none.

### High
- `addToCart` increments twice on first add (sets 1, then `prev + 1`).
- Login/Sign-up has no submit handler (form reloads the page); `setCurrState("Login ")` has a trailing space, so the Login view never renders correctly.
- Checkout form has no state, validation, or submission. Totals are computed client-side, in USD, with a hardcoded `$2` fee even for an empty cart.
- No authentication, authorization, users, carts, orders, payments, or restaurants exist on the server.
- `connectDB()` is not awaited and has no error handling (unhandled rejection on failure).
- Multer: unsanitized `originalname` in filenames, no MIME/size limits, local-disk storage (does not survive a Render/Heroku-style redeploy).

### Medium / Low
- No security middleware (helmet, rate limiting, CORS allowlist, input validation, central error handler).
- `nodemon` in `dependencies`; no `start` script; `sendmail` (direct SMTP, unmaintained, poor deliverability).
- Accessibility: every `<img>` has `alt=""`, clickable `<img>`/`<p>`/`<span>` elements are not keyboard-operable, `href='#'` links, missing list keys.
- SEO: only a `<title>`; Vite favicon; no meta, OG, sitemap, robots.
- Content: lorem ipsum in footer, placeholder phone number, "Tomato.com" copyright.

---

## 3. Preserve vs replace

| Keep | Refactor | Replace |
|---|---|---|
| React + Vite + React Router | Component breakdown (Navbar, FoodItem, Cart, Checkout) as a starting map | Hardcoded catalog → API + seed script |
| Express + MongoDB/Mongoose | Food model (extend with restaurant, variants, add-ons, diet tags) | StoreContext cart → server cart + client store |
| Category concept (8 categories) as seed data | Folder layout → feature-based | Tutorial images/icons/copy → original NovaFood brand |
| | | `db.js`, route double-registration, empty controller |

Honest scale: roughly 90% of the final code will be new. What carries over is the stack choice, the page map, and the catalog shape.

---

## 4. Proposed architecture

### Repository
```
NovaFood/
├── apps/
│   ├── web/          React + Vite + TypeScript (customer, admin, partner via route groups)
│   └── api/          Express + TypeScript (REST + Socket.IO)
├── packages/
│   └── shared/       zod schemas, types, order state machine, pricing constants
├── docker-compose.yml  local MongoDB (+ optional Mailpit for dev email)
├── .github/workflows/ci.yml   lint, typecheck, test, build
└── README.md, NOVAFOOD_ARCHITECTURE.md, docs/adr/
```
npm workspaces; shared zod schemas validate the same payload on client and server.

### Backend layering
`routes → middleware (auth, rbac, validate, rateLimit) → controllers → services → models`
- Uniform response envelope: `{ data, meta }` / `{ error: { code, message, details } }`.
- Central error handler with typed `AppError`s; `pino` structured logging with request IDs.
- Config loaded and validated from env at boot (fail fast on missing secrets).

### Data model (MongoDB)
`User` (roles: customer | partner | admin; embedded addresses & preferences) · `Restaurant` · `MenuCategory` · `FoodItem` (variants, add-on groups, diet/allergen tags, availability) · `Cart` · `Order` (embedded line-item snapshots, status history) · `Payment` · `Coupon` + `CouponRedemption` · `Review` · `Favorite` · `Notification` · `PointsLedger` · `AuditLog`.
Indexes: text index on restaurant/food names + cuisines, geo index on restaurant location, compound indexes on `orders(userId, createdAt)` and `orders(restaurantId, status)`.

### Auth
- Short-lived access JWT (memory) + rotating refresh token in an httpOnly, Secure, SameSite cookie, hashed server-side for revocation.
- bcrypt password hashing, email verification and password reset via signed single-use tokens.
- RBAC middleware; partners scoped to their own restaurant(s).
- Google OAuth / phone OTP deferred until credentials are approved.

### Orders & payments
- Server computes every total (items, variants, add-ons, coupon, fees, GST) from DB prices; client totals are display-only.
- Order state machine in `packages/shared`, enforced server-side with an allowed-transitions table; every transition is appended to `statusHistory` and emitted over Socket.IO.
- Payment gateway behind a `PaymentProvider` interface. Order is marked paid **only** after signature verification or a verified webhook. Idempotency keys prevent duplicate orders.

### Real-time
Socket.IO rooms per order and per restaurant. Tracking reflects real status changes made by the partner/admin; a `DeliveryProvider` interface leaves room for rider GPS later. No timer-driven fake progress.

### Frontend
- Feature folders (`features/cart`, `features/restaurants`, ...), `ui/` primitives, `lib/api` client.
- TanStack Query for server state, Zustand for client state (cart UI, theme), React Hook Form + zod for forms.
- Design tokens as CSS variables (light/dark), Tailwind for layout utilities.
- Motion: Framer Motion for UI transitions; React Three Fiber + drei for 3D, lazy-loaded, with a static fallback on `prefers-reduced-motion`, low-memory devices, or WebGL failure.
- Mascot built procedurally in R3F (no licensing risk), with an emotion state machine (idle, curious, hungry, celebrating, worried) driven by app events.

---

## 5. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Security hotfix | Rotate Atlas credential (owner action), move secrets to `.env`, add `.gitignore`, untrack `node_modules`/`.env`, optional history purge | No secret in the working tree; repo < 200 tracked files |
| 3. Foundation | Monorepo + TS, config, error handling, logging, security middleware, design system, CI | `lint`, `typecheck`, `test`, `build` green in CI |
| 4. Core ordering | Auth, restaurants, menu, search/filters, cart, checkout, coupons, orders, payments, tracking, notifications | Full customer flow passes an end-to-end test |
| 5. Admin + partner | Dashboards, RBAC, analytics from real aggregates | RBAC tests pass; analytics match DB |
| 6. 3D + Gen-Z layer | Mascot, hero scene, micro-interactions, Hinglish copy system | Lighthouse perf ≥ 85 mobile with 3D lazy-loaded |
| 7. Differentiators | Mood discovery, recommender, smart reorder, Nova Points, streaks, share cards | Each feature backed by real data and tests |
| 8. QA + docs + deploy | Playwright E2E, a11y audit, security review, README, deployment | All critical flows tested; deployed |

---

## 6. Decision log
_Entries added as decisions are approved._
