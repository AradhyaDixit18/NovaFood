# Architecture decisions

Short records of the choices that shape NovaFood, and why.

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Monorepo with `packages/shared` consumed as TypeScript source | Prices, coupon rules, order statuses and zod schemas are defined once. The web app previews the bill with the same function the server charges with, so they cannot drift. |
| 2 | Money is integer paise everywhere | No floating-point rounding in totals, refunds or points. Formatting happens only at the edge. |
| 3 | The server is the only pricing authority | The client sends dish, variant and add-on ids; the server recomputes every price from the database. A tampered request cannot change what is charged. |
| 4 | Explicit order state machine with conditional updates | `findOneAndUpdate({ _id, status: from })` makes each transition atomic, so a double tap or two staff members cannot move an order twice. Side effects (points, coupon usage, refunds) hang off transitions. |
| 5 | Idempotent checkout with compensating rollback | A unique `(userId, idempotencyKey)` index turns retries into the same order. If a later step fails, reserved points and coupon usage are released. |
| 6 | Access token in memory, rotating refresh token in an httpOnly cookie | XSS cannot read a long-lived credential. Refresh-token reuse revokes the whole session family. A `X-Requested-With` header check blocks cross-site refresh calls. |
| 7 | Readable `nf_session` hint cookie | Lets the site skip the refresh call for visitors who were never signed in. It carries no secret. |
| 8 | Separate rate-limit budget per endpoint | A shared auth budget let ordinary page loads (each calls refresh) lock people out of logging in. Failed logins, sign-ups and refreshes are now counted independently. |
| 9 | API can serve the website (`WEB_DIST_DIR`) | One origin in production: no CORS, no cross-site cookies, Socket.IO on the same host, one service to deploy. The web pages get their own CSP with hashed inline scripts. |
| 10 | Stage-based tracking instead of simulated GPS | The tracker reflects real kitchen status changes and says that live rider location is not available. Nothing is faked. |
| 11 | 3D is progressive enhancement | The R3F scene is a lazy chunk that only loads on capable devices without reduced motion, and pauses when off-screen. Everyone else gets the SVG mascot. |
| 12 | Realtime hub behind an interface | Services publish through `ctx.realtime`; tests use a recording hub, production uses Socket.IO. Business logic has no socket code in it. |
| 13 | FerretDB for sandboxed local tests, mongodb-memory-server in CI | Tests run against a real MongoDB wire protocol everywhere. A compatibility flag disables TTL indexes where FerretDB lacks them. |
