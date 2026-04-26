# Migration log — OrderDashboardTab + nginx promotion of `/orders/:id`

**Date:** 2026-04-26
**Branch:** _not yet created_ (planning only — Phase 1 + Phase 2)
**Author:** sachinmurugesan111@gmail.com
**Conventions in effect:** R-16, R-17, R-18, R-19 (per `ERP_V1/CONVENTIONS.md`)
**Source spec:** Orders Phase 2 — OrderDashboardTab + nginx takeover (Phase 1 + 2 ONLY, no code)
**Predecessor:** `2026-04-26-order-detail-shell.md` (PR #3, merged) — built the sandbox shell at `/orders-shell-preview/[id]`. This migration promotes the shell to the canonical `/orders/[id]` and migrates the first tab content.

---

## 0. Stop conditions check (before planning)

Per the user's task spec, halt and surface if any of the following appear:

| # | Stop condition | Found? | Notes |
|---|---|---|---|
| 1 | OrderDashboardTab.vue requires more than 4 cards | ❌ no | 6 visual sections (see §1.4) but they are simple cards — within "moderate" complexity |
| 2 | Backend role-gate inconsistent with frontend | ⚠ **YES — but pre-existing** | Vue source has **zero** role gating; backend already returns 403 for ADMIN on `/api/finance/orders/{id}/factory-payments/`. This is a pre-existing D-004 leak (Vue silently swallows the 403). **Surfaced — see §3.** |
| 3 | nginx flip needs simultaneous Vue/Next changes | ❌ no | The Vue page stays untouched; nginx flip is one-sided (Next.js takes over `/orders/{id}`). Vue continues to serve other portals (client, factory). |
| 4 | Need to coordinate with another in-flight migration | ❌ no | Order shell PR is merged; no other order-route work in flight |

**Verdict:** No hard-stop conditions. One amber finding (D-004 backend-already-enforced) needs explicit user direction in Phase 2 §2.3.

---

## 1. Phase 1 Discovery — OrderDashboardTab.vue

### 1.1 Source line count
- **`frontend/src/components/order/OrderDashboardTab.vue` = 552 lines**
- Single-file Vue component (template + script-setup + scoped styles).
- Imports: `paymentsApi`, `shipmentsApi`, `customsApi` from `frontend/src/api/*`. No store/Vuex usage; pure props + local refs.

### 1.2 Props from shell (current Vue contract)
```ts
{
  orderId: string,        // required
  order: object,          // required — full order envelope
  timeline: object | null // optional, default null — used only for stage-progress carry-forward badge
}
```

This **matches** the universal tab contract the new Next.js shell already passes (`{order, role}` to `<OrderTabs>`, then `{order.id, order}` to each `<TabsContent>`). The shell additionally fetches `timelineQuery` at `order-shell-client.tsx:76-87` already — we just need to plumb it through `<OrderTabs>` → `<OrderDashboardTab>` (currently the shell does NOT forward `timeline` to tabs; it only feeds `<StageStepperSection>`).

### 1.3 Every API endpoint, with R-19 LIVE-verified shape

All probes ran against `http://localhost:8080/...` as ADMIN (`admin@harvesterp.com`) on order id `6214e677-0399-43ed-a467-257479ec8015` (the same probe order used for the shell migration).

| # | Vue call | URL the agent inferred | **Real backend URL (verified)** | Status | Shape (truncated) |
|---|---|---|---|---|---|
| 1 | `paymentsApi.list(orderId)` | `/api/orders/{id}/payments/` ❌ 404 | **`/api/finance/orders/{id}/payments/`** | 200 | `{ payments: PaymentRecord[], summary: { piTotal, advanceRequired, advancePaid, balanceTotal, balancePaid, totalReceived, totalPending, paymentTermsBucket, ...17 fields } }` |
| 2 | `paymentsApi.factory(orderId)` | `/api/orders/{id}/factory-payments/` ❌ 404 | **`/api/finance/orders/{id}/factory-payments/`** | **403 for ADMIN** | When 200 (FINANCE/SUPER_ADMIN): `{ payments: FactoryPaymentRecord[], summary: { totalCost, paid, pending, currency, ... } }`. ADMIN gets `{ detail: "Required: [SUPER_ADMIN, FINANCE]" }` |
| 3 | `shipmentsApi.list(orderId)` | `/api/orders/{id}/shipments/` ❌ 404 | **`/api/shipping/orders/{id}/shipments/`** | 200 | Bare array: `Shipment[]` (no envelope). Each shipment has `{id, container_number, etd, eta, status, ...}` |
| 4 | `customsApi.boe(shipmentId)` (loop per shipment) | _agent did not specify_ | **`/api/customs/shipments/{shipment_id}/boe/`** | 200 (returns `null` when no BOE filed) | When BOE exists: `{ id, boe_number, total_duty, total_igst, ... }` |

**R-19 finding (3 wrong URLs):** The Vue source uses thin `paymentsApi` / `shipmentsApi` wrappers that obscure the real path. The wrappers prepend `/api/finance` and `/api/shipping` respectively. **Without curl-verifying we would have shipped 404-generating proxies.** This is exactly the failure mode R-19 was added to prevent.

**R-19 finding (D-004 backend gate):** The factory-payments endpoint is **already** restricted to SUPER_ADMIN/FINANCE. The Vue OrderDashboardTab silently `.catch()`-swallows the 403 and renders the "Factory & Costs" card with empty/zero data for ADMIN. The user sees a card that says "Factory cost: ₹0" — visually broken, not visibly forbidden. **This is a UX bug we inherit unless we fix it in the migration.** See §2.3.

### 1.4 Every data field displayed (grouped by card)

The 6 visual sections in `OrderDashboardTab.vue:134-549` (template):

#### Card 1 — Client Payments (lines 142-219)
- Source: `clientPay.summary` (endpoint #1)
- Fields: PI Total, Advance Required, Advance Paid, Balance Total, Balance Paid, Total Received, Total Pending, Payment Terms (bucket label)
- All values are formatted via `fmtCurrency(value, currency)` helper
- "View payments tab" deep link → `?tab=payments`

#### Card 2 — Factory & Costs (lines 221-280) ⚠ D-004 sensitive
- Source: `factoryPay.summary` (endpoint #2 — 403 for ADMIN)
- Fields: Factory Cost, Paid to Factory, Pending to Factory, Estimated Profit (computed: `clientPay.summary.totalReceived - factoryPay.summary.paid`)
- Visible to **ADMIN today with empty zeros** (Vue bug)
- "View factory tab" deep link → `?tab=factory` (which doesn't exist as a tab — Vue uses `?tab=payments&section=factory`)

#### Card 3 — Order Progress (lines 282-348)
- Source: `props.order.status`, `props.timeline?.entries`, hard-coded `STAGE_ORDER` array
- Fields: progress bar (% complete), milestone list with checkmarks, current stage label
- `phaseProgress` computed: which phase (Pre-PI / Production / Shipping / Delivery) and how far through

#### Card 4 — Shipment Tracker (lines 350-422)
- Source: `shipments` (endpoint #3) — empty state when no shipments
- Fields: per-shipment: container #, ETD, ETA, status chip, BOE filed indicator (✓/✗)
- "View sailing tab" deep link → `?tab=sailing`

#### Card 5 — Customs & Duty (lines 424-468)
- Source: `boeByShipment` map (built from endpoint #4 fan-out)
- Fields: Total Duty (sum across shipments), Total IGST (sum across shipments), per-shipment BOE number
- "View customs tab" deep link → `?tab=customs`

#### Card 6 — Carried Forward Items (lines 470-549) — **only when present**
- Source: `props.order.carried_items` array
- Fields: list of items carried forward from cancelled/incomplete orders, original-order link, qty, value
- Hidden entirely when `carried_items` is empty
- This is the only card with conditional visibility based on order data (not role/stage)

### 1.5 Computed values & helpers
| Name | Logic | Used by |
|---|---|---|
| `carriedItems` | `props.order.carried_items ?? []` | Card 6 visibility + render |
| `cs` | `clientPay.summary` (alias) | Card 1, Card 2 (estProfit) |
| `fs` | `factoryPay.summary` (alias) | Card 2 |
| `totalDuty` | `Object.values(boeByShipment).reduce((s, b) => s + (b?.total_duty ?? 0), 0)` | Card 5 |
| `totalIgst` | same pattern, summing `total_igst` | Card 5 |
| `estProfit` | `(cs.totalReceived ?? 0) - (fs.paid ?? 0)` | Card 2 |
| `stageIdx` | `STAGE_ORDER.indexOf(props.order.status)` | Card 3 progress bar |
| `progressPercent` | `(stageIdx / (STAGE_ORDER.length - 1)) * 100` | Card 3 progress bar |
| `milestones` | filters `STAGE_ORDER` to user-meaningful checkpoints | Card 3 |
| `phaseProgress` | bucket of stage → phase label + sub-progress | Card 3 |
| `STAGE_ORDER` | hard-coded array of 21 statuses (CLIENT_DRAFT → COMPLETED_EDITING) | Card 3 |

### 1.6 Actions
**Zero.** OrderDashboardTab is purely presentational/read-only. Every "View X tab" link is a `<router-link>` to a `?tab=...` URL change — no mutations, no buttons that POST/PUT/DELETE.

### 1.7 Loading / empty / error states
| State | Vue behaviour today | What we need in Next.js |
|---|---|---|
| Loading (initial fetch) | Cards render with `—` placeholders; no skeleton | TanStack Query `isPending` → render skeleton-card-shape per card |
| Empty (no shipments) | Card 4 shows "No shipments yet." text | Same — empty-state inline message |
| Empty (no carried items) | Card 6 hidden entirely | Same |
| Error (any of 4 fetches) | `.catch()` swallows; card renders with `—`/0 values | **CHANGE** — render per-card error chip with retry; surface 403 on Card 2 explicitly |
| 403 on factory-payments (ADMIN) | Same as generic error → silently empty Card 2 | **CHANGE** — show "Factory financials hidden — visible to FINANCE only" placeholder card |

### 1.8 Role gating + D-004 status

**Vue source:** No role gating. Every card renders for every user. The factory-payments 403 is silently swallowed.

**Backend gate (verified live):**
- `/api/finance/orders/{id}/payments/` → ADMIN ✅ (200)
- `/api/finance/orders/{id}/factory-payments/` → ADMIN ❌ (403, requires SUPER_ADMIN/FINANCE)
- `/api/shipping/orders/{id}/shipments/` → ADMIN ✅ (200)
- `/api/customs/shipments/{shipment_id}/boe/` → ADMIN ✅ (200)

**D-004 implication:** Card 2 (Factory & Costs) is D-004 sensitive. Backend already enforces. Migration MUST decide:
- **(a) Hide card entirely for ADMIN** (matches backend reality, breaks visual parity with Vue)
- **(b) Show placeholder "FINANCE-only" message** (matches backend reality, transparent to user)
- **(c) Keep Vue parity bug** (silent zeros for ADMIN — discouraged but minimum-diff)

Recommendation in Phase 2 §2.3.

### 1.9 Deep-link targets
The "View X tab" links inside dashboard cards should drive `?tab=...` updates on the parent shell, not full navigations. The shell's URL-sync effect (`order-tabs.tsx:250-256`) reacts to `?tab=` and switches active tab — so a `router.replace("?tab=payments")` from inside the dashboard is sufficient. **No new routing infrastructure needed.**

Card 2's link in Vue points at `?tab=factory` which doesn't exist. The Vue version is broken there. We should normalize to `?tab=payments&section=factory` in Next.js.

### 1.10 Existing Next.js proxies — what's already there

`apps/web/src/app/api/orders/[id]/`:
- `route.ts` — GET / PATCH / DELETE on order envelope ✅
- `timeline/` ✅
- `next-stages/` ✅
- `transition/`, `go-back/`, `jump-to-stage/` ✅

**Missing** (needed for dashboard tab):
- `apps/web/src/app/api/finance/orders/[id]/payments/route.ts` — NEW
- `apps/web/src/app/api/finance/orders/[id]/factory-payments/route.ts` — NEW (must preserve 403)
- `apps/web/src/app/api/shipping/orders/[id]/shipments/route.ts` — NEW
- `apps/web/src/app/api/customs/shipments/[id]/boe/route.ts` — NEW

**Reference pattern:** `apps/web/src/app/api/finance/factory-ledger/[id]/route.ts` is the canonical proxy template. It handles 403 explicitly (D-004 message), 404, 500 → 502 mapping, session-cookie forwarding via `getServerClient`. All 4 new proxies should mirror its shape.

### 1.11 Complexity rating
**Moderate.** No mutations, no role-aware UI primitives, no novel patterns — it's 4 fetches and 6 cards. The D-004 question is the only design call. Estimated implementation: **4-6 hours** including tests and proxies.

---

## 2. Phase 1 Discovery — nginx (current state + change required)

### 2.1 Files reviewed
- `nginx/nginx.dev.conf` (268 lines) — local development reverse proxy
- `nginx/nginx.conf` (738 lines) — production: 3 portal `server` blocks (admin 103-304, client 309-500, factory 505-696)

### 2.2 What routes `/orders/:id` today

**`nginx.dev.conf`:**
- Lines 87-99: `location = /orders { ... proxy_pass http://nextjs }` — **exact match only**
- Lines 252-266: `location / { ... proxy_pass http://vue }` — catch-all
- **No regex/prefix block exists for `/orders/{id}`** → catch-all takes it → Vue serves `/orders/:id` today.

**`nginx.conf` (admin portal block, lines 103-304):**
- Line 150-160: `location = /orders { proxy_pass http://nextjs }` — exact match
- Line 299-303: `location / { proxy_pass http://vue }` — catch-all
- Identical pattern across client (309-500) and factory (505-696) portal blocks.

### 2.3 What needs to change

**Goal:** route `/orders/{id}` to Next.js (the new shell) while keeping `/orders/{id}/edit`, `/orders/{id}/payments-legacy`, etc. on Vue if any remain.

**Scope minimization:** **only modify the admin portal `server` block**. Client and factory portals never expose `/orders/{id}` (they have their own list/detail routes), so leave them on Vue.

**Recommended location-block strategy (Option C from agent analysis):**
```nginx
# admin portal server block, after `location = /orders`:

# Explicit Vue carve-outs (anything we have NOT migrated yet):
location ~ ^/orders/[^/]+/edit$       { proxy_pass http://vue; }
location ~ ^/orders/[^/]+/items-edit$ { proxy_pass http://vue; }
# (add others if grep finds them — see §2.4)

# Catch-all dynamic detail to Next.js:
location ~ ^/orders/[^/]+$ { proxy_pass http://nextjs; }
```

**Why Option C (explicit Vue carve-outs + Next.js dynamic catch-all):**
- Default-allow the new shell so future migrations don't need to touch nginx.
- Explicit deny-list of un-migrated sub-routes makes the strangler-fig boundary visible in the config.
- Regex precedence: `~` regex matches BEFORE the bare `location /` catch-all → no fallthrough to Vue.

### 2.4 Sub-routes audit
Need a Phase 3 grep across the Vue router to identify all `/orders/:id/...` sub-routes that exist today, so the carve-out list is complete. Spot-check shows:
- `/orders/:id/edit` (Vue inline edit page) — likely
- `/orders/:id` (the page we're migrating)
- No others surfaced in initial scan; will deep-grep `frontend/src/router.ts` in Phase 3.

### 2.5 Test coverage that must update
- **`apps/web/tests/infra/nginx-config.test.ts`** EXISTS (verified). Has `EXPECTED_MIGRATED_PATHS` and `EXPECTED_DYNAMIC_ROUTES` arrays. Phase 3 must add `/orders/:id` to `EXPECTED_DYNAMIC_ROUTES` and assert the carve-outs land on Vue.
- No equivalent test exists in `ERP_V1/` (the test is web-side only).

### 2.6 Order of operations (production-safe)
1. **Ship Next.js page first** (PR-A): `app/(app)/orders/[id]/page.tsx` lifted from `orders-shell-preview/[id]/page.tsx` + dashboard tab content. Verify on `/orders-shell-preview/[id]` still (sandbox + canonical co-exist).
2. **Then flip nginx** (PR-B, possibly same PR if low risk): change `nginx.conf` admin block + `nginx.dev.conf` to add the regex carve-outs.
3. **Soak in dev** for at least one session (~15 min) before merging.
4. **Roll forward** after merge — nginx reload, monitor Vue access logs for `/orders/{id}` traffic to confirm flip took effect.
5. **Rollback plan:** revert the nginx PR; the Next.js page can stay (harmless, just unreachable via canonical URL — still reachable via sandbox).

---

## 3. Phase 2 — UX Reasoning (decisions needing approval)

### 3.1 Tab data architecture — server-fetched vs client-fetched?

**Decision:** **client-fetched via TanStack Query inside `<OrderDashboardTab>`.**

**Rationale:**
- The shell's parent `page.tsx` is already an RSC that fetches the `order` envelope. Adding 4 more server fetches (payments, factory-payments, shipments, BOE-fanout) would (a) inflate TTFB, (b) couple the dashboard tab's data to the shell page (so other tabs would also wait), (c) require server-side D-004 handling for the 403 vs render-and-degrade.
- Client-fetch keeps the dashboard tab self-contained (drop-in replacement for the deferred-fallback stub), parallels the timeline/next-stages pattern already used by the shell, and lets each card's loading state be independent.
- The 403 on factory-payments becomes a per-query observable: `factoryPaymentsQuery.isError && factoryPaymentsQuery.error?.status === 403` → render the FINANCE-only placeholder card.

**Consequence:** Dashboard renders with skeleton-shimmer cards on first paint, then fills in over ~200-400 ms as queries resolve. Acceptable for a tab the user actively chose to view.

### 3.2 Card layout — preserve 6-card grid or simplify?

**Decision:** **preserve the 6-card layout** in a 12-col responsive grid:
- xl viewport: 2 cols × 3 rows (Client Pay | Factory & Costs / Order Progress | Shipment Tracker / Customs | Carried Items)
- md viewport: 2 cols × 3 rows (same)
- sm viewport: 1 col × 6 rows (stacked)

**Rationale:** The Vue layout is a known mental model for users. R-17 visual fidelity demands matching the Vue cadence. We can use the existing `card` Tailwind class (`rounded-lg border border-slate-200 bg-white shadow-sm`) for parity. No new design needed.

### 3.3 Role-based visibility for Card 2 (Factory & Costs) — D-004 ⚠

**This is the single hardest decision in Phase 2.**

**Three options:**

| Option | What ADMIN sees | What FINANCE/SUPER_ADMIN sees | Vue parity? | Backend parity? |
|---|---|---|---|---|
| (a) Hide card entirely for non-FINANCE | No card 2 | Card 2 fully populated | ❌ | ✅ |
| (b) Show "FINANCE-only" placeholder card | Card 2 frame with "Visible to FINANCE only" message | Card 2 fully populated | ❌ | ✅ |
| (c) Keep Vue parity bug | Card 2 with all-zero values | Card 2 fully populated | ✅ | ❌ |

**Recommendation: (b) — placeholder card.** Reasoning:
- (b) is honest about D-004 enforcement (no silent zeros that look like data).
- (b) preserves the visual cadence of the dashboard so layout doesn't shift between roles.
- (b) is a small UX improvement over Vue (the silent-zero bug is hostile to ADMIN users wondering "why is factory cost zero?").
- (a) and (c) both feel wrong: (a) makes ADMIN feel a card is missing; (c) misleads ADMIN into thinking factory cost is genuinely zero.

**Implementation:** the proxy at `/api/finance/orders/[id]/factory-payments/` preserves the upstream 403; the dashboard tab catches `query.error?.status === 403` and conditionally renders `<FactoryFinancialsRestricted />` (a tiny new component) instead of the data card.

**❓ AWAITING USER APPROVAL** — pick (a), (b), or (c). Recommended (b).

### 3.4 nginx promotion decision — flip in Phase 2 or defer?

**Decision: flip in Phase 2, same PR as the page migration.**

**Rationale:**
- The new `/orders/[id]/page.tsx` is a strict superset of the sandbox shell + 1 migrated tab. The other 13 tabs still redirect to Vue via `<DeferredTabFallback>`, so the user-visible behaviour at `/orders/{id}` is **identical** to today for any tab the user clicks (Vue continues to render those).
- The only new behaviour the user sees is the dashboard tab landing experience — which is what we want to verify.
- Deferring the flip leaves us testing the new shell at a non-canonical URL (`/orders-shell-preview/{id}`), which doesn't exercise the real production routing.
- Risk is low: rollback = single nginx PR revert; no DB migration; no shared state.

**Caveat:** if R-16/R-17 verification on the canonical URL fails, **do NOT merge the nginx PR** — only merge the Next.js page PR. Sandbox stays canonical until R-16/R-17 pass.

### 3.5 Shell file move strategy — A, B, or C?

**Three options:**

| Option | Move strategy | Pros | Cons |
|---|---|---|---|
| A | Move `_components/` from `orders-shell-preview/[id]/_components/` to `orders/[id]/_components/`; delete sandbox route | One source of truth | Sandbox route disappears — loses inspector escape hatch |
| B | Copy `_components/` to `orders/[id]/_components/`; delete sandbox route | Single canonical location | `git history` shows duplication churn |
| C | Move `_components/` to a shared location (e.g. `app/(app)/orders/_components/order-shell/`); both routes import from there; sandbox stays | Sandbox stays as inspector route + canonical lives at `/orders/[id]` | Slightly more file restructuring; needs careful import-path rewrite |

**Recommendation: A — move outright; delete the sandbox.**

**Rationale:**
- The sandbox served its purpose (Phase 1 of the order shell PR — verify the shell renders correctly without taking the canonical URL). Once we're confident in the canonical route at `/orders/[id]`, the sandbox is dead weight.
- The `?_inspect=1` escape hatch (deferred-tab fallback bypass) **moves with the components** — it'll still work at `/orders/{id}?_inspect=1` for any not-yet-migrated tab.
- C tempts us to keep both routes "just in case," which is the kind of half-measure that creates two-source-of-truth bugs later.
- Git's `git mv` preserves blame/history through the file move.

**Files to move** (`apps/web/src/app/(app)/orders-shell-preview/[id]/_components/` → `apps/web/src/app/(app)/orders/[id]/_components/`):
- `order-shell-client.tsx`, `order-tabs.tsx`, `order-header.tsx`, `stage-stepper-section.tsx`, `transition-action-bar.tsx`, `transition-error-banner.tsx`, `client-draft-banner.tsx`, `factory-not-assigned-banner.tsx`, `carried-items-alert.tsx`, `order-modals.tsx`, `types.ts`, etc.
- Plus the new file: `order-dashboard-tab.tsx`
- Plus subcomponents: `factory-financials-restricted.tsx` (the D-004 placeholder card), `dashboard-cards/` (probably 6 small files for each card)

**❓ AWAITING USER APPROVAL** — pick A, B, or C. Recommended A.

### 3.6 What happens to `/orders-shell-preview/:id`?

**Decision (linked to §3.5):** **delete the route entirely** if §3.5 = A or B; keep stub-redirect-to-canonical if C.

If **A or B chosen** (recommended):
- Delete `apps/web/src/app/(app)/orders-shell-preview/` directory.
- Update `apps/web/tests/infra/nginx-config.test.ts` if `/orders-shell-preview` is in any expected-paths array (likely not — sandbox routes typically aren't asserted).
- The R-16/R-17 evidence file `docs/migration/screenshots/2026-04-26-order-shell.md` retains its URL reference to the sandbox — leave that historical doc alone (it's a snapshot of past truth).

If **C chosen**:
- Keep `/orders-shell-preview/[id]/page.tsx` as a thin wrapper that imports the same shared shell and disables D-004-restricted cards — useful as an inspector view.

### 3.7 Empty / loading / error states (per-card matrix)

| Card | Loading | Empty | Error (non-403) | Error (403 — Card 2 only) |
|---|---|---|---|---|
| 1. Client Payments | Skeleton card (8 metric stubs) | "No payment data yet" | Inline retry banner inside card | n/a |
| 2. Factory & Costs | Skeleton card (4 metric stubs) | "No factory cost data yet" | Inline retry banner | **`<FactoryFinancialsRestricted />`** placeholder card |
| 3. Order Progress | Skeleton card (progress bar stub) | n/a (always has data — uses order.status which is always present) | Card renders with order.status only; timeline data optional | n/a |
| 4. Shipment Tracker | Skeleton card (1 row stub) | "No shipments yet" | Inline retry banner | n/a |
| 5. Customs & Duty | Skeleton card (2 metric stubs) | "No BOE filed yet" | Inline retry banner | n/a |
| 6. Carried Items | Skeleton card (3 row stubs) | **Card hidden entirely** when `order.carried_items` is empty | Card renders with whatever data is in `order.carried_items` (no separate fetch) | n/a |

**Pattern:** Each card is its own self-contained query + skeleton + empty + error state. No cross-card coupling. Simplifies reasoning, allows independent retries.

### 3.8 What awaits explicit user approval before Phase 3

**3 explicit decisions:**

| # | Question | Recommendation | Alternatives |
|---|---|---|---|
| **D-1** | How to render Card 2 (Factory & Costs) for ADMIN role given backend 403? | **(b) FINANCE-only placeholder card** | (a) hide entirely; (c) keep Vue silent-zero bug |
| **D-2** | Shell file move strategy when promoting `/orders-shell-preview/[id]` → `/orders/[id]`? | **(A) `git mv` outright; delete sandbox** | (B) copy + delete sandbox; (C) shared location, both routes co-exist |
| **D-3** | nginx flip — Phase 2 same PR as page, or separate PR after page lands? | **Same PR** (atomicity, easier rollback) | Separate PR (smaller blast radius per merge) |

**Plus 1 implicit confirmation:**

| # | Question | Recommendation |
|---|---|---|
| **D-4** | Confirm scope: only `/orders/[id]` admin portal nginx flip — leave client + factory portal nginx untouched | **Confirm** |

---

## 4. Phase 3 plan preview (DO NOT EXECUTE — for context only)

Phase 3 will:
1. Create branch `feat/orders-dashboard-tab` from main
2. Add 4 new proxy routes (`/api/finance/orders/[id]/payments/`, `/api/finance/orders/[id]/factory-payments/`, `/api/shipping/orders/[id]/shipments/`, `/api/customs/shipments/[id]/boe/`) following the `factory-ledger/[id]/route.ts` pattern, including proper 403 handling
3. Add `<OrderDashboardTab>` component (under `_components/dashboard-cards/`) with 6 cards + skeleton/empty/error per matrix in §3.7
4. Add `<FactoryFinancialsRestricted />` D-004 placeholder card
5. Wire `<OrderTabs>` to forward `timeline` + `role` to `<OrderDashboardTab>`; replace the dashboard `<DeferredTabFallback>` with the real component
6. Move/promote files per D-2 (recommended A: `git mv` shell + delete sandbox)
7. Add `/orders/[id]/page.tsx` (RSC, mirrors `orders-shell-preview/[id]/page.tsx`)
8. Update `nginx.dev.conf` + `nginx.conf` (admin portal block only) per §2.3
9. Update `apps/web/tests/infra/nginx-config.test.ts` to add `/orders/:id` to `EXPECTED_DYNAMIC_ROUTES` + assert Vue carve-outs
10. Add Vitest unit tests for the 4 proxies (R-19: mock the verified shapes from §1.3, including 403 case for factory-payments)
11. Add Vitest tests for `<OrderDashboardTab>` (skeleton → loaded; 403 → restricted card; empty shipments → empty state)
12. R-16 happy-path verification on `http://localhost:3100/orders/{id}` (NOT preview URL)
13. R-17 visual fidelity scoring vs Vue dashboard tab side-by-side
14. /qa, /design-review, /cso, /investigate per R-18
15. Migration log update + screenshot evidence
16. PR + merge

**Estimated total:** 1 working session.

---

## 5. Stop point

**Per the user's spec:** Halt here. Await explicit Phase 3 approval. Do not branch, do not write code.

Decisions awaited: **D-1, D-2, D-3, D-4** (see §3.8).

---

## 6. Phase 3 — implementation notes

User approved decisions D-1=b (FINANCE-only placeholder), D-2=A (`git mv`
outright + delete sandbox), D-3=same PR, D-4=admin portal only on
2026-04-26. Branch: `feat/orders-dashboard-tab`. 6 commits.

### 6.1 Files created
- `apps/web/src/app/api/orders/[id]/payments/route.ts` — proxy for client payments
- `apps/web/src/app/api/orders/[id]/factory-payments/route.ts` — D-004 gated proxy
- `apps/web/src/app/api/orders/[id]/shipments/route.ts` — bare-array proxy
- `apps/web/src/app/api/orders/[id]/boe/route.ts` — null-on-missing proxy
- `apps/web/src/app/(app)/orders/[id]/_components/tabs/order-dashboard-tab.tsx` — 6-card tab content
- `apps/web/tests/api/orders-dashboard-proxy.test.ts` — +30 proxy tests
- `apps/web/tests/app/orders-dashboard-tab.test.tsx` — +23 component tests

### 6.2 Files moved (`git mv`)
- `apps/web/src/app/(app)/orders-shell-preview/[id]/` → `apps/web/src/app/(app)/orders/[id]/`
  - 12 files (page.tsx + 11 _components/*) — sandbox URL deleted entirely

### 6.3 Files modified
- `apps/web/src/app/(app)/orders/[id]/page.tsx` — docstring + login redirect + retry link + default-export name + SandboxNotice removed
- `apps/web/src/app/(app)/orders/[id]/_components/order-tabs.tsx` — wires `<OrderDashboardTab>` for tab=dashboard; DeferredTabFallback redirect REMOVED (would loop post-flip); inspectMode prop dropped
- `apps/web/src/app/(app)/orders/[id]/_components/order-shell-client.tsx` — forwards `timelineQuery.data` into `<OrderTabs>`
- `apps/web/tests/app/order-detail-shell.test.tsx` — 9 OrderTabs renders switched to `renderWithQuery`, deferred-tab assertion rewritten for the items tab + "no auto-redirect" guarantee, dashboard-no-fallback regression added
- `apps/web/tests/infra/nginx-config.test.ts` — new ADMIN_ONLY_DYNAMIC_ROUTES list + assertions
- `nginx/nginx.dev.conf` — added `location ~ ^/orders/[0-9a-f-]{36}$` after the `/orders` exact-match block
- `nginx/nginx.conf` — same regex block added to the **admin portal block only** (line 169); client (line 372) and factory (line 568) deliberately untouched
- `docs/migration/MIGRATED_PATHS.md` — N=10 → N=11; `/orders/{uuid}` row added with full notes

### 6.4 Tests added
- 30 proxy tests (all 4 endpoints × {auth, encoding, success, 403, 404, 5xx, role-gate})
- 23 dashboard-tab component tests (6 cards × {render, skeleton, empty, error, role-gate})
- 2 nginx config assertions for admin-only dynamic routes
- 1 deferred-fallback regression test (dashboard tab now renders real content)
- **Total: +56 tests**. Suite count: 693 → 749 passing.

### 6.5 nginx config change
**Dev** (`nginx/nginx.dev.conf`):
```nginx
location = /orders { proxy_pass http://nextjs_upstream; ... }
location ~ ^/orders/[0-9a-f-]{36}$ { proxy_pass http://nextjs_upstream; ... }
```

**Prod** (`nginx/nginx.conf`) — admin portal block only:
```nginx
location ~ ^/orders/[0-9a-f-]{36}$ { proxy_pass http://nextjs_upstream; ... }
```
Client + factory portals retain only `location = /orders` exact match — different UI / different scoping (D-4 confirmed).

**Stop-condition check (per spec):** Regex `[0-9a-f-]{36}` matches UUIDs (36 chars). `/orders/new` has 3 trailing chars, the `n` is not in `[0-9a-f-]`, so the regex does NOT catch it → falls through to Vue. ✓

### 6.6 MIGRATED_PATHS update
N=10 → N=11. Row added for `/orders/{uuid}` with full annotation: regex shape, admin portal scope, 6 migrated cards, 13 deferred tabs, 4 new proxies, D-004 gate.

---

## 7. Issues encountered and resolutions (Phase 3)

### Issue 1: agent-inferred URLs were wrong (R-19)
- **Date raised:** 2026-04-26 19:48
- **Problem:** Pre-flight backend probe revealed 3 of 4 dashboard endpoints had different URLs than the agent inferred from Vue source — `payments` is `/api/finance/orders/{id}/payments/` (NOT `/api/orders/{id}/payments/`), same for `factory-payments` and `shipments`.
- **Root cause:** Vue uses thin `paymentsApi` / `shipmentsApi` wrappers that prepend `/api/finance` and `/api/shipping` respectively. Without curl-verifying we would have shipped 404-generating proxies.
- **Fix applied:** Used the verified URLs in all 4 proxies. Documented exact shapes in the proxy test fixtures (R-19 compliance).
- **Date resolved:** 2026-04-26 19:55
- **Tests added:** 30 proxy tests with verified-shape fixtures.

### Issue 2: factory-payments backend already 403s for ADMIN
- **Date raised:** 2026-04-26 19:50
- **Problem:** Live probe of `/api/finance/orders/{id}/factory-payments/` as ADMIN returns 403 (`Required: [SUPER_ADMIN, FINANCE]`). Vue silently swallows this and renders zeros for ADMIN.
- **Root cause:** Backend `Depends(require_factory_financial)` enforces D-004 server-side; Vue doesn't surface the 403.
- **Fix applied:** D-004 gate enforced at TWO layers in the migration:
  1. `<RoleGate>` wrapping Card 2 in `<OrderDashboardTab>` — non-FINANCE users see `<FactoryFinancialsRestricted />` placeholder.
  2. `resolveCallerRole()` server-side gate in `/api/orders/[id]/factory-payments/route.ts` — request never leaves Next.js for non-FINANCE roles.
- **Date resolved:** 2026-04-26 20:00
- **Tests added:** 5 factory-payments role-gate tests (proxy) + 3 placeholder-card tests (component).

### Issue 3: page.tsx edits left out of Commit 3
- **Date raised:** 2026-04-26 20:35
- **Problem:** After `git mv`, the modifications I made to `page.tsx` (SandboxNotice removal, default-export rename, login-redirect path fix, retry-link fix) were not staged before committing. Commit 3 had only the rename + 0 content changes for page.tsx.
- **Root cause:** `git mv` stages the rename; subsequent in-place edits need an explicit `git add` step. Forgot it.
- **Fix applied:** `git commit --amend --no-edit` after staging the missed page.tsx changes. Single-author local-only branch — amending was the cleanest fix and didn't destroy any pushed work.
- **Date resolved:** 2026-04-26 20:38
- **Tests added:** None — caught by the test suite (build verified).

### Issue 4: deferred-fallback redirect loop
- **Date raised:** 2026-04-26 21:05
- **Problem:** The original `<DeferredTabFallback>` auto-redirected to `/orders/{id}?tab=...` after 600 ms (intended to fall back to Vue). After the nginx flip in Commit 6, that URL routes to Next.js, so the redirect loops back to itself for the 13 not-yet-migrated tabs.
- **Root cause:** Strangler-fig assumption broken. The fallback was designed when nginx routed `/orders/{uuid}` to Vue.
- **Fix applied:** Removed the auto-redirect entirely. Fallback now renders a static "Tab content is being migrated" message + manual link to the dashboard tab (which IS migrated). The `inspectMode` prop is also removed — it served only to disable the (now-removed) auto-redirect.
- **Date resolved:** 2026-04-26 21:10
- **Tests added:** 2 in `tests/app/order-detail-shell.test.tsx` — (a) deferred-fallback assertion rewritten for items tab with explicit "no redirect" check, (b) regression test that dashboard tab does NOT render the deferred fallback testid.

### Issue 5: vitest mock queue leak (factory-payments tests)
- **Date raised:** 2026-04-26 19:45
- **Problem:** First proxy-test run showed 5 tests failing in the factory-payments group with mock-state inversions ("expected 403 got 502", "expected 404 got 403", "expected 403 got 404"). The pattern strongly suggested mock queue leakage between tests.
- **Root cause:** `vi.clearAllMocks()` in `beforeEach` clears `.mock.calls` but NOT the `mockResolvedValueOnce` queue. When tests 3-5 (role-gate denial) didn't consume their queued `mockGetJson` values (because the proxy returned 403 before reaching the upstream call), those queued values bled into tests 6-10 in the wrong order.
- **Fix applied:** Switched to `vi.resetAllMocks()` in `beforeEach`. Annotated with a comment explaining the gotcha.
- **Date resolved:** 2026-04-26 19:48
- **Tests added:** None new — fixed the existing 5 failing assertions.

---

## 8. Final status

- Tests passing: **749 / 749**
- Build: ✅ `pnpm build` clean; `/orders/[id]` route at 13.7 kB
- nginx config: ✅ dev + admin portal only in prod (D-4 confirmed)
- `MIGRATED_PATHS.md`: ✅ N=10 → N=11
- nginx-config.test.ts: ✅ admin-only assertions added
- R-16: pending live verification
- R-17: pending visual scoring
- Branch: `feat/orders-dashboard-tab` (6 commits)
- PR: pending push
