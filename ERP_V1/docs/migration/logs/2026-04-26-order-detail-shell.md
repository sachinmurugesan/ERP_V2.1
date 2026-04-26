# Page Migration — Order Detail Shell

## Header

- **Page name:** Order Detail Shell (`/orders/:id`) — internal portal
- **Date started:** 2026-04-26
- **Date completed:** — (in progress)
- **Audit profile:** none dedicated; subsumed by [orders complete audit 2026-04-26](../research/orders-complete-audit-2026-04-26.md)
- **Vue source:** [frontend/src/views/orders/OrderDetail.vue](../../../frontend/src/views/orders/OrderDetail.vue) — 956 lines
- **Tab files (out of scope):** 14 components in `frontend/src/components/order/` — read-headers-only for shell-boundary discovery
- **Reference image:** none provided
- **Closest reference screens:** [`Design/screens/procurement.jsx`](../../../Design/screens/procurement.jsx) (workflow stepper + line items + sidebar) and [`Design/screens/settings.jsx`](../../../Design/screens/settings.jsx) (tab-style sub-nav). No dedicated order-detail screen exists.
- **Foundation PR:** [#1 Orders foundation](https://github.com/sachinmurugesan/ERP_V2.1/pull/1) merged at `50d4c4a` (Tabs primitive + 3 ui-gallery lifts + StageChip 0-17 + 4 API proxies).
- **Branch:** _(not created — Phase 1+2 only, awaiting approval before Phase 3)_
- **Scope:** Order detail PAGE SHELL only — header (order identity + stage + page-level actions), tab navigation, stage-transition UI. **Excludes:** all 14 tab content panels (deferred to Phases 2-4 of the orders module rollout).

---

## Phase 1 — Discovery findings

### 1. OrderDetail.vue confirmed line count: **956 lines**

`<script setup>` lines 1–429 + `<template>` lines 431–828 + 6 page-level modals at 830–954. Single-file Vue 3 composition.

### 2. Order header — every field shown above the tab bar

| Field | Source binding | Conditional | Lines |
|---|---|---|---|
| Back arrow | `router.push('/orders')` | always | 441–443 |
| Order number / "DRAFT ORDER" | `order.order_number` (falls back to literal `'DRAFT ORDER'` when null) | always | 446–448 |
| Stage chip `S{n} · {name}` | `order.stage_number` + `order.stage_name`, styled via `stageStyles` map | always | 449–451 |
| "Transparency Client" indigo badge | `order.client_type === 'TRANSPARENCY'` | only when `isSuperAdmin` AND client type matches | 452–454 |
| Client display | `order.client_name` | always | 457 |
| Factory display | `· {factory_name}` | only when `factory_name` truthy | 458 |
| PO reference | `· PO: {po_reference}` | only when `po_reference` truthy | 459 |
| Delete button | `showDeleteConfirm = true` | only if `isDraft` (status === 'DRAFT') | 466–468 |
| Re-open button | `showReopenModal = true` | only if `isCompleted` (status === 'COMPLETED') | 469–471 |

**Notable absences in the header:** no Edit button, no CNY/INR totals, no separate status badge, no Approve Inquiry button (lives inside the CLIENT_DRAFT inline banner at 476–536). No factory cost or margin numbers in the header.

### 3. Tab list — 14 internal tabs (progressive visibility)

Built in `availableTabs` (lines 312–334), rendered at 740–765. Visibility is stage-driven (more tabs appear as the order progresses).

| # | Display label | `?tab=` value | Component | Visibility condition |
|---|---|---|---|---|
| 1 | Dashboard | `dashboard` | `OrderDashboardTab` | always |
| 2 | Order Items | `items` | `OrderItemsTab` | always |
| 3 | Payments | `payments` | `PaymentsTab` | `isPostPI` (PI_SENT…COMPLETED_EDITING set) |
| 4 | Production | `production` | `ProductionTab` | `isProductionStage` (FACTORY_ORDERED…PRODUCTION_100) |
| 5 | Packing List | `packing` | `PackingListTab` | `showPackingSection` (PLAN_PACKING+) |
| 6 | Booking | `booking` | `BookingTab` | `isBookingStage` (BOOKED+) |
| 7 | Sailing | `sailing` | `SailingTab` | `isSailingStage` (LOADED+) |
| 8 | Shipping Docs | `shipping-docs` | `ShippingDocsTab` | same as Sailing |
| 9 | Customs/BOE | `customs` | `CustomsTab` | `isCustomsStage` (ARRIVED+) |
| 10 | After-Sales | `after-sales` | `AfterSalesTab` | `isAfterSalesStage` (AFTER_SALES+) |
| 11 | Final Draft | `final-draft` | `FinalDraftTab` | status in `{COMPLETED, COMPLETED_EDITING}` |
| 12 | Queries | `queries` | `QueriesTabInline` | always — has badge `tab.badge = order.query_counts.total`; red pulse for `query_counts.open`, blue dot for `query_counts.replied` |
| 13 | Files | `files` | `FilesTab` | always |
| 14 | Landed Cost | `landed-cost` | `LandedCostTab` | `client_type === 'TRANSPARENCY'` AND status in `{CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING}` AND `user.role` in `{SUPER_ADMIN, ADMIN, FINANCE}` |

Active-tab styling (lines 746–752): emerald underline + emerald-50 background.

### 4. Stage display + transitions

**Two parallel surfaces for the current stage:**
- **Header chip** (lines 449–451) — single pill `S{n} · {name}` matching the existing migrated `<StageChip>` component.
- **Full horizontal stepper** (lines 539–596) — every stage from `timeline.timeline` rendered as 32×32 circles. Statuses: `completed` (solid emerald + check), `current` (white + emerald border), `unlocked` (amber + open-padlock — high-water-mark for jump-forward), `locked` (slate). Connector bars colored per same status. Override warnings render as small amber dots top-right with tooltips.

**Stage Override History card** (lines 599–631) — collapsible, only when `timeline?.overrides?.length > 0`.

**Transition action bar** (lines 680–717) — dedicated card, conditional on `nextStages.length > 0 || prevStage || reachableForward.length > 0`:
- "Go back" button (`v-if="prevStage"`) → `confirmGoBack()` → `executeGoBack()` → `ordersApi.goBack(orderId, { reason: 'Stage reversal' })`
- "Return to S{n}" forward-jump button (`v-if="reachableForward.length > 0"`) → `confirmJumpToStage()` → `ordersApi.jumpToStage(orderId, { target_status, reason: 'Direct stage navigation' })`
- "Next: S{n} · {name}" buttons (one per `nextStages` entry) → `confirmTransition(ns)` → `executeTransition()` → `ordersApi.transition(orderId, ns.status, { acknowledge_warnings: false })`
- On `status === 'warnings'` response, opens warning-acknowledge modal for ack-with-reason flow.

**Stepper inline jumps** (lines 560–566) — clicking a `completed` node in `reachablePrevious` triggers backward jump; clicking an `unlocked` node in `reachableForward` triggers forward jump. **Two trigger surfaces (stepper + button) point at the same `confirmJumpToStage` flow.**

**Reopen** (lines 469–471 + modal at 846–857) — only when `isCompleted`. Modal collects required `reopenReason`, then `ordersApi.reopen(orderId, { reason })`.

**Disable-while-busy:** all transition buttons use `:disabled="transitioning"`.

**Transition error banner** (lines 634–647) — `transitionError` displayed as a red clickable banner that calls `navigateToFix(transitionError)` (lines 95–115) to auto-switch the active tab and set `highlightSection` for a flash animation. Maps "Client is required" → items/client, "missing selling prices" → items/pricing, "payment must be recorded" → payments/add-payment, etc.

### 5. Page-level modals — 6 total (NOT tab-specific)

| Modal | Trigger | Purpose | Lines |
|---|---|---|---|
| Delete Confirmation | Header Delete button | "Delete Draft Order?" → `deleteDraft()` → `ordersApi.delete(orderId)` then push to `/orders` | 834–844 |
| Re-open | Header Re-open button | Reason textarea (required) + Cancel/Re-open → `handleReopen()` | 846–857 |
| Stage Transition Confirm | "Next" button per `nextStages` | "Advance Stage? Move to S{n} · {name}" → `executeTransition()` | 859–872 |
| Go Back Confirm | Go-back button | "Go Back? Revert to S{n} · {name}" → `executeGoBack()` | 874–887 |
| Underpayment / Warning Acknowledge | When transition response has `status === 'warnings'` | Lists warnings + required reason textarea + Proceed Anyway → `executeTransitionWithWarnings()` calling `ordersApi.transition(..., { acknowledge_warnings: true, transition_reason })` | 889–926 |
| Jump-to-Stage Confirm | Stepper click OR "Return to" button | Conditional copy/colour for forward vs backward; → `executeJumpToStage()` | 928–954 |

**Inline shell banners (NOT modals):**
- CLIENT_DRAFT inquiry banner (lines 476–536) — factory `<select>` + currency `<select>` + "Approve & Create Order" button. Lazy-loads factories on focus.
- "Factory Not Assigned" amber banner (lines 650–677) — for DRAFT-without-factory orders. Inline factory-pick + `assignFactory()` → `ordersApi.update(order.id, { factory_id })`.
- Carried-items dismissable amber alert (lines 720–735) — read-once from `?carried=N` query param on mount.

### 6. Page state handling

Top-level template chain at lines 432–828:

```
<div>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <i class="pi pi-spin pi-spinner text-3xl text-emerald-500" />
  </div>
  <template v-else-if="order">
    [header + banner + stepper + override history + error banner + assign-factory banner + transition bar + carried alert + tabs + tab content]
  </template>
  [modals]
</div>
```

- **Loading**: full-bleed centered emerald spinner. Gated by `loading.value` (init `true`, reset `false` in `loadOrder()` finally block).
- **Error / 404 / 403**: **🚨 NO EXPLICIT ERROR BRANCH.** `loadOrder()` catch logs `console.error('Failed to load order:', err)` and lets `loading` resolve to `false` with `order.value` still null. Because the chain ends with `<template v-else-if="order">`, a failed load (404, 403, network) falls through to render an **empty `<div>`** with no user-facing message. **This is a real shell-level gap to fix in the Next.js port.** The `transitionError` banner only handles errors from the transition/go-back/jump APIs, not initial load.
- **Per-action errors:** `transitionError` ref is set from `err.response?.data?.detail` for transition/go-back/jump and rendered as the clickable red banner. Reopen failures only `console.error`. Delete failures only `console.error`. Assign-factory and approve-inquiry use blocking `alert()` — should become toasts in the port.

### 7. Endpoint verification — live, 2026-04-26

Seeded one DRAFT order (`6bab7e14...`) with `client_id` + `factory_id`, probed each endpoint, then deleted.

| # | Method | URL | Status | Notes |
|---|---|---|---|---|
| 1 | GET | `/api/orders/{id}/` | **200** | Returns ~30-field envelope including `id, order_number, client_id, factory_id, status, currency, po_reference, stage_number, stage_name, highest_unlocked_stage, version, client_name, factory_name, total_value_cny, item_count, items[], query_counts, client_type, completed_at, deletion_reason, created_at, updated_at`. |
| 2 | GET | `/api/orders/{id}/timeline/` | **200** | **Wrapped shape — NOT a bare array.** Returns `{current_status, current_stage, current_name, timeline: [{stage, name, status}], overrides?}`. Each entry's `status` is one of `current`, `pending`, `completed`, `unlocked`, `locked`. |
| 3 | GET | `/api/orders/{id}/next-stages/` | **200** | **Wrapped shape — NOT `{options}` and NOT a bare array.** Returns `{current_status, current_stage: [n, name], next_stages: [{status, stage, name}], prev_stage: null\|{...}, reachable_previous: [], reachable_forward: [], highest_unlocked_stage}`. **One endpoint, four lists in one shot** — confirms the OrderDetail.vue analysis. |
| 4 | PUT | `/api/orders/{id}/transition/?target_status=PENDING_PI` (body: `{acknowledge_warnings}`) | **400** | Validation error from stage engine ("Order must have at least one item") — endpoint live. **`target_status` is a QUERY PARAM, body must contain `acknowledge_warnings`.** |
| 5 | PUT | `/api/orders/{id}/go-back/` (body: `{reason}`) | **400** | Validation: "Cannot go back from DRAFT — no previous status defined" — endpoint live. |
| 6 | PUT | `/api/orders/{id}/jump-to-stage/` (body: `{target_status, reason}`) | **400** | Validation: "Cannot jump from DRAFT to DRAFT. Not in reachable range." — endpoint live. |
| 7 | GET | `/api/orders/{id}/stage-history/` | **404** | **Does NOT exist.** Stage history is delivered via `/timeline/`. Drop from spec. |

### 7a. ⚠️ Foundation-PR proxy shape mismatches — must fix in Phase 3

The 4 proxies built in PR #1 (foundation) have shape contracts that **do not match the actual backend response shapes** verified above. Each will silently swallow the rich data and return empty arrays:

| Proxy | Built-with shape | Backend actually returns | Impact |
|---|---|---|---|
| `GET /api/orders/[id]/timeline` | Returns `{events: []}` from `result?.events ?? []` | `{current_status, current_stage, current_name, timeline: [...], overrides: [...]}` — there is no `events` field | UI gets `{events: []}` → empty stepper. Need to read `result.timeline` (not `events`) and pass through `overrides` too. |
| `GET /api/orders/[id]/next-stages` | Returns `{options: []}` from `result?.options ?? []` | `{current_status, current_stage, next_stages, prev_stage, reachable_previous, reachable_forward, highest_unlocked_stage}` — there is no `options` field | UI gets `{options: []}` → can't render any next-stage button. Need to forward all 7 fields. |
| `PUT /api/orders/[id]/transition` | Sends `target_status` in body | Backend reads it from query string; rejects with 422 | Every transition would fail in production. Need to pass `target_status` as a query param. |
| `GET /api/orders/[id]/` | Generic local `OrderDetail` interface with `[key: string]: unknown` pass-through | Returns the ~30-field envelope above with full type info | Functionally OK (pass-through works) but the typed fields are slightly misaligned. Tighten the local interface. |

These mismatches were not caught by the foundation-PR proxy tests because the tests mocked the upstream-fetch return values to match the *expected* shape rather than probing the live backend. Phase 3 of THIS migration must include proxy-shape fixes as the first step OR they happen as a separate hot-fix PR before any consumer tries to call them. **Recommendation:** fix the proxies inside this Phase 3 (they're prerequisites for the shell anyway). Document explicitly in the Phase 3 plan.

### 8. Tab-prop contract (from header scan of all 14 tabs)

**Universal contract:** every tab takes `{ orderId: string, order: Order }`. Beyond that, four divergences:

| Add-on prop | Tabs that take it |
|---|---|
| `highlightSection: string` | OrderItemsTab, PackingListTab, PaymentsTab |
| `isSuperAdmin: boolean` | OrderItemsTab |
| `timeline: Object` | OrderDashboardTab |
| `documents: Array` | FilesTab |

**Self-fetching status:**
- **Prop-only (the only "dumb" tab):** FilesTab — receives `documents` and renders. The shell must own that fetch.
- **Definitely self-fetching:** AfterSales, Booking, Customs, FinalDraft, LandedCost, OrderDashboard, Production, Sailing, ShippingDocs (all confirmed via `onMounted` + API import in first 60 lines).
- **Likely self-fetching:** OrderItems, PackingList, Payments, Queries (load function past line 60 but APIs imported + `onMounted`).

**Universal emit:** every tab emits `'reload'`. The shell must implement a `reload()` callback that re-fetches the top-level `order` envelope and pushes the new value down. **`OrderItemsTab` additionally emits `'open-query'`** — implies cross-tab navigation (jump from items → queries). Shell handles by switching the active tab and appending `?query=<id>`.

**Implicit shell coupling to flag:**
- QueriesTab uses `useRoute()` and `useNotifications()` directly — needs router + notifications context in the Next.js port.
- BookingTab uses `useRouter()` for programmatic nav — same.
- SailingTab has a `refreshInterval` polling timer — needs cleanup on unmount/route change to avoid leaks.

### 9. Role gating at the page level

Imported from `useAuth()` (line 21): `isSuperAdmin`, `isAdmin`, `isFinance`, `user`.

| Flag | What it gates |
|---|---|
| `isSuperAdmin` | Transparency Client indigo badge in header (line 452); also passed as `:is-super-admin` prop into `OrderItemsTab` (line 808) |
| `user.value?.role` ∈ {SUPER_ADMIN, ADMIN, FINANCE} | Landed Cost tab visibility (lines 330–332) |

`isAdmin` and `isFinance` are imported but **not directly referenced** in the template — dead imports at the shell level.

**D-004:** no factory cost or margin fields in the header itself. Only D-004-relevant header surface is the Transparency Client badge (super-admin only) and the Landed Cost tab gate (super-admin/admin/finance). All cost/margin-relevant rendering is delegated into the tab components.

### 10. Deep-linking / URL surface

- `route.query.tab` — read at line 29 (eager) + lines 405–409 (validated against `availableTabs` after order load); fallback to `getDefaultTab(order.status)` (lines 336–349).
- `route.query.carried` — one-shot consumed in `onMounted` (lines 411–414), strips itself from URL via `router.replace`.
- `route.query.query` — written by `handleOpenQuery(queryId)` (lines 424–427) when child emits `@open-query`; switches to `tab=queries` and appends `query=<id>`.

Watchers keep URL in sync (lines 358–362 + 351–356 + 418–422):
- `activeTab` change → `router.replace({ query: { ...route.query, tab } })`
- `order.status` change → forces `activeTab = getDefaultTab(newStatus)` and writes to URL
- External `route.query.tab` change → re-syncs `activeTab`

`/orders/{id}?tab=payments&query=q1` restores: order loaded via `route.params.id`, `activeTab = payments` (assuming visible for current status), `query=q1` left in URL for QueriesTab to consume.

### 11. Design reference availability

10 design screens at `Design/screens/`. **None dedicated to order detail.** Closest analogs:
- `procurement.jsx` — workflow stepper + line-items table + sidebar panel. Best precedent for the order-detail header + stage UI.
- `settings.jsx` — sub-nav with chip-style tab triggers + content card. Useful pattern for the tab navigation bar.
- `finance.jsx` — invoice line items + status chips + actions card.

`Design/components/` has `primitives.jsx` and `shell.jsx` (Topbar / Sidebar reference). No tab pattern there beyond what `settings.jsx` shows.

### 12. StageChip 17-stage coverage — confirmed

`harvesterp-web/apps/web/src/components/composed/stage-chip.tsx` has all 18 entries (stages 0..17 inclusive) added in foundation PR #1:
- 0: `chip` (CLIENT_DRAFT — neutral, pre-pipeline)
- 1: `chip` (DRAFT)
- 2-4: `chip chip-warn` (PENDING_PI / PI_SENT / ADVANCE_*)
- 5-10: `chip chip-info` (FACTORY_ORDERED → FINAL_PI)
- 11-12: `chip chip-accent` (PRODUCTION_100 / BOOKED)
- 13-14: `chip chip-ok` (LOADED/SAILED/ARRIVED → CUSTOMS)
- 15-16: `chip chip-ok` (DELIVERED / AFTER_SALES)
- 17: `chip chip-accent` (COMPLETED — terminal good)

### 13. Stop-condition check

| Condition | Status |
|---|---|
| OrderDetail.vue not found | ✅ Found at expected path, 956 lines |
| Backend not responding | ✅ Live; all 4 foundation endpoints + go-back + jump-to-stage probed |
| Tab component missing | ✅ All 14 internal tabs present in `components/order/` |
| Design reference for order-detail page | ⚠️ None dedicated. Phase 2 will derive from `procurement.jsx` + `settings.jsx` cadence — flagged. |

All clear to proceed to Phase 2 UX reasoning.

---

## Phase 2 — UX Reasoning (shell only)

### 2.1 Shell layout — header + tab area

The order-detail page has two distinct zones:
- **A — Page header:** order identity (back arrow, order number, stage chip, Transparency badge, client/factory/PO line, page-level action buttons) + status-conditional banners (CLIENT_DRAFT inquiry, factory-not-assigned, carried-items alert) + stage stepper + transition action bar + transition error banner.
- **B — Tab content area:** active tab's content, with the tab nav bar floating at the top of this zone.

**Recommendation:** **Don't make the header sticky.** The full header with stepper + action bar is ~350-450 px tall on desktop — sticky would eat half the viewport. Instead:
- Header scrolls naturally with content.
- The **tab nav bar alone becomes sticky** at the top of zone B (`sticky top-0 z-10 bg-white`). User can be deep inside Items pricing rows and still switch tabs without scrolling back up.
- Stage transition buttons live in the header (NOT sticky) — same as Vue. Triggering a transition is intentional, infrequent, and benefits from forcing the user to see the full stage stepper and transition error banner before clicking. Sticky transition bar would encourage accidental clicks.

**Vertical space budget:**
- Order-identity row: ~64 px
- CLIENT_DRAFT banner (when present): ~120 px
- Factory-not-assigned banner (when present): ~80 px
- Stage stepper (always when `timeline` available): ~110 px (single row of 17 circles + labels)
- Transition action bar (always when `nextStages.length > 0`): ~70 px
- Override history (collapsed by default): ~40 px when collapsed
- Tab nav bar: ~48 px (sticky)
- Total: ~370 px when nothing is collapsed and no banner is showing; up to ~570 px on a CLIENT_DRAFT order.

### 2.2 Stage display — recommendation: **Option B + C combined**

Vue already shows BOTH a stage chip (header) AND a full stepper (separate row). The user's audit flagged this as the canonical UX. I recommend keeping both:

**Header chip** (existing `<StageChip stageNumber stageName />`): 
- Compact identity at the top — answers "where am I in the workflow?" at a glance.
- Already covers all 17 stages with correct tones (foundation PR).

**Below the identity row, a full 17-stage stepper:**
- Powered by `<CarryForwardStepper>` (lifted in foundation PR — has the four statuses we need: complete/current/upcoming/blocked).
- One step per backend timeline entry (all 17 stages, plus optional override badges).
- Maps backend `timeline[].status` → stepper `StepStatus`:
  - `completed` → `complete`
  - `current` → `current`
  - `pending` / `locked` → `upcoming`
  - `unlocked` (high-water-mark amber) → custom — extend `CarryForwardStepper` with a fifth status `unlocked` OR pass `blocked` and re-style. Recommend extending the prototype with one new status to preserve semantic clarity.
- Stepper circles are clickable when in `reachable_previous` (backward jump) or `reachable_forward` (forward jump). Clicking opens the same `JumpToStageDialog` that the action-bar "Return to" button opens — keeping the two trigger surfaces consistent (Vue parity).

**Transition action bar below the stepper:**
- "Go back" pill button (when `prev_stage` truthy)
- "Return to S{n}" pill button (when `reachable_forward` non-empty)
- One "Next: S{n} · {name}" button per `next_stages` entry (forward chain)
- Disabled while `transitioning` is `true`

**Why not just the chip?** Detail pages need more context than list pages. Users on a detail page are about to act on the order; they need to see what stage comes next and whether they can move there.

**Why not just the stepper?** The chip is a stable identity affordance — it stays visible (in the header) while the stepper moves with scroll. Mobile use case especially benefits from the chip.

**Why not a mini progress bar (Option D)?** A 17-step linear progress bar collapses too much information. Users care about specific stage names ("are we at Plan Packing yet?") not just a percent.

### 2.3 Tab navigation — recommendation: **horizontal scrollable tab bar, no icons, no grouping**

**Vue uses:** horizontal flex bar with emerald underline + emerald-50 background on the active tab. No icons. Visibility is stage-driven so the bar widens as the order progresses.

**Foundation PR provides:** `<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>` from Radix. The `TabsList` styling I built uses pill-shape with white background on active — slightly different from Vue's underline. Recommendation: **adapt the existing primitive's styling once, here, to match the Vue active-state look (emerald underline + brand-50 background)** — that becomes the canonical tab look for all detail-shaped pages going forward.

**Why horizontal scrollable, not grouped?** The Vue source has 14 tabs in a single bar and users have learned the linear stage-flow ordering (Dashboard → Items → Payments → Production → Packing → Booking → Sailing → Shipping Docs → Customs → After-Sales → Final Draft → Queries → Files → Landed Cost). Grouping ("workflow / docs / comms") would force users to re-learn navigation. The progressive visibility (tabs only appear when stage allows) keeps the bar short until late stages — typically 4-7 visible tabs at any given stage.

**Why no icons?** None of the prior migrated pages use tab icons. The labels are short ("Items", "Payments") and clear. Icons would add visual noise without disambiguating.

**Tablet + mobile:** the tab bar overflows horizontally with `overflow-x-auto` + `scroll-snap-type: x mandatory` on the list. Active tab auto-scrolls into view when changed via URL deep-link. Mobile users get a scroll-by-touch tab bar — no hamburger / no separate nav drawer.

### 2.4 Deferred-tab fallback — recommendation: **Option B (per-tab redirect to Vue)**

Most tabs are NOT migrated in this Phase 1 shell. The user has to be able to view them via the Vue app while the shell renders the Next.js header/stage UI.

**Recommendation: server-side per-tab routing fallback.** Implementation:

1. The Next.js shell renders the page header + stage UI for ALL tabs (since it owns the URL `/orders/{id}`).
2. Inside the active tab's `<TabsContent>`, the shell decides:
   - If the tab is **migrated** (only Dashboard? maybe Items in a later phase), render the React tab component.
   - If **not migrated** (the other 13 in Phase 1), render a fallback panel that immediately redirects to the Vue app at `/orders/{id}?tab={value}`. Use `useEffect` + `window.location.assign('http://[host]/orders/{id}?tab={value}')` since this isn't a Next.js route.
3. **Visual continuity:** before the redirect fires (a few hundred ms), show a friendly "Loading {Tab Name}…" skeleton so users don't see a blank flash.

**Why not Option A ("Coming soon" panel):** stops users from doing real work for months until every tab is migrated. The orders module is 140-260h of work — users can't wait.

**Why not Option C (iframe):** session cookies, scrollbars, focus management, and CSS isolation all become problems. Iframes inside SPAs are messy and break stage transitions because the iframe doesn't know about the parent's stage state.

**Why not Option D (disabled tabs):** functionally identical to Option A from the user's perspective.

**Edge case:** what about the URL? The shell at `/orders/{id}?tab=payments` redirects to Vue `/orders/{id}?tab=payments`. nginx then needs to route `/orders/{id}` to **Vue** (current behavior — `/orders` is migrated as a list-only path, `/orders/{id}` falls through). After Phase 1 lands, we have to flip this: nginx routes `/orders/{id}` exact OR with query-tab to Next.js, EXCEPT when the tab is unmigrated → still Vue. Cleanest implementation: nginx routes `/orders/{id}` always to Next.js, and Next.js's redirect on unmigrated tabs uses a different URL like `/orders/{id}/_legacy?tab=...` that nginx reroutes to Vue. **This needs a Phase 3 nginx-config decision** — flagged for user approval.

Alternative simpler approach: Phase 1 just doesn't migrate the shell route at all. Phase 1 is tabs-primitive-validation only via a sandbox page (no live route change). Real shell migration waits for Phase 2 (when at least Dashboard tab is also migrated). **This is a viable simplification — flagged in §2.8.**

### 2.5 Role-based header elements

Same as Vue:
- **Transparency Client badge** — `isSuperAdmin` only
- **Delete button** — already gated by `isDraft`; additionally wrap in `<RoleGate resource={Resource.ORDER_UPDATE}>` (matrix already has ORDER_UPDATE = `[ADMIN, OPERATIONS]`)
- **Re-open button** — gated by `isCompleted`; additionally `<RoleGate>` for ORDER_REOPEN. **`ORDER_REOPEN` does NOT exist in matrix.ts** — needs to be added in Phase 3 Step 1 (Layer 1 commit, mirroring `CLIENT_DELETE` cadence). Backend gates reopen to `[ADMIN, SUPER_ADMIN]`. Matrix entry should be `[ADMIN]`.
- **Stage transition buttons** — proxy already enforces `[ADMIN, OPERATIONS, SUPER_ADMIN]` (foundation PR). UI should *also* hide the buttons for FINANCE/CLIENT/FACTORY (defense in depth) via `<RoleGate>` keyed to the same proxy-allowed set. Need to expose this set as a permission constant — recommend `Resource.ORDER_TRANSITION` added in Phase 3 Step 1.
- **Approve Inquiry button** (CLIENT_DRAFT banner) — `isAdmin` (or rather: needs a new `Resource.ORDER_APPROVE_INQUIRY`). Backend gating unknown — verify in Phase 3 Step 3 endpoint check.
- **Assign Factory button** (factory-not-assigned banner) — uses `ordersApi.update()` which already has matrix entry `ORDER_UPDATE = [ADMIN, OPERATIONS]`. Reuse.

**D-004:** no header element exposes factory cost or margin. `client_type === 'TRANSPARENCY'` badge is visible only to SUPER_ADMIN — preserve. Landed Cost tab (which would expose cost data) is gated by both stage + role at the tab-availability level (already correct in Vue logic).

### 2.6 Mobile + tablet behavior

**Desktop (≥1024 px):** full layout as described in §2.1. Stepper renders as horizontal 17-circle row with labels below.

**Tablet (768-1023 px):** 
- Stepper switches to compact mode (`<CarryForwardStepper compact={true}>`) — narrower labels.
- Tab nav bar overflows with horizontal scroll.
- Header remains non-sticky.

**Mobile (<768 px):**
- Stage stepper switches to **vertical orientation** (`<CarryForwardStepper orientation="vertical">`) inside a collapsed `<details>` element. Header shows just the chip + a "View progress (S{n}/17)" link that expands the vertical stepper.
- Transition buttons collapse into a single primary action button + `<DropdownMenu>` for go-back / jump-to-stage / next-stages.
- Tab nav bar scrolls horizontally with `scroll-snap-type`.
- Page-level action buttons (Delete, Re-open) move into the header `<DropdownMenu>`.

This is more aggressive responsive behavior than the Vue source has — Vue is desktop-first. Worth confirming with the user that mobile/tablet polish is in-scope for the shell migration or deferred.

### 2.7 Recommendation: **POLISH** with security + correctness improvements

The Vue shell is structurally sound but has gaps the Next.js port should fix:

**Carried over from Vue (LIFT):**
- 6-modal confirmation pattern
- Two trigger surfaces for jump-to-stage (stepper click + button)
- Status-aware default tab via `getDefaultTab(status)`
- `?tab=` and `?query=` deep-link surface
- Stepper inline jump UX
- Transition error banner with auto-tab-switch + section highlight

**Polished (NEW in port):**
- **Add an explicit error/404/403 state** — replaces the empty-`<div>` failure mode (current Vue silently renders blank).
- **Replace blocking `alert()` with toasts** for assign-factory + approve-inquiry errors.
- **Add `<RoleGate>` to write actions** — defense in depth (current Vue UI shows buttons that backend would reject).
- **Add `Resource.ORDER_REOPEN`, `Resource.ORDER_TRANSITION`, `Resource.ORDER_APPROVE_INQUIRY`** to matrix.ts in Phase 3 Step 1 — Layer 1 commit, same cadence as TRANSPORT_*.
- **Fix the 4 foundation-PR proxy shape mismatches** (§7a above) before any consumer reads from them — this is the FIRST step of Phase 3, ahead of any UI work.
- **Mobile/tablet responsive behavior** described in §2.6 (Vue is desktop-only).
- **Active-tab styling adapt** — match Vue's emerald-underline + brand-50-background look on the new `<TabsTrigger>`, replacing the foundation PR's pill-shape default.

**No REDESIGN.** The Vue layout (header → stepper → action bar → tab bar → content) is fundamentally right. Don't change the structure.

### 2.8 Awaiting user decisions

Eight questions before Phase 3 kicks off:

1. **Sticky tab nav vs sticky full header?** Recommend: only the tab nav is sticky; header scrolls. Confirm.
2. **Stage display:** Option B + C combined (chip + full 17-step stepper + action bar)? Confirm.
3. **`<CarryForwardStepper>` extension:** add a fifth `unlocked` status (amber high-water-mark, clickable for forward jump) or reuse `blocked` (red X) and re-style? Recommend ADD new `unlocked` status — preserves semantic clarity. Confirm.
4. **Tab nav style:** adapt `<TabsTrigger>` to emerald-underline + brand-50-background (Vue parity), replacing the current pill+white-bg styling? This is a one-time foundation-component edit. Confirm.
5. **Deferred-tab fallback strategy** — Option B (per-tab redirect to Vue) per §2.4? This needs an nginx-config decision: how should the redirect URL look so nginx routes correctly?
   - Sub-option B1: Next.js `useEffect` does `window.location.assign("http://[host]/_legacy/orders/{id}?tab=...")`, nginx routes `/_legacy/*` to Vue. Cleanest.
   - Sub-option B2: shell only migrates the route itself (no tab content rendered in Next.js); when user clicks an unmigrated tab, the shell stays on the Next.js URL but renders an `<iframe>` with the Vue page (per §2.4 — discouraged, listed for completeness).
   - Sub-option B3: deferred entirely — Phase 1 builds the shell as a sandbox-only page (e.g. `/orders-shell-preview/{id}`) and doesn't take over `/orders/{id}` until at least one real tab is migrated. **My preferred path** — eliminates the nginx complexity and lets us ship the shell + Dashboard tab together as a coherent unit.
6. **Mobile/tablet polish in-scope or deferred?** Vue is desktop-only. Recommend in-scope for Phase 3 (the responsive behavior in §2.6) since it's foundational to the new shell.
7. **3 new permissions in Phase 3 Step 1** — `ORDER_REOPEN: [ADMIN]`, `ORDER_TRANSITION: [ADMIN, OPERATIONS]`, `ORDER_APPROVE_INQUIRY: [ADMIN, OPERATIONS]`? Same `matrix.ts` cadence as `TRANSPORT_*`. Confirm scopes.
8. **Foundation-PR proxy hot-fix** (§7a): include the 4 proxy fixes inside this Phase 3 (so they ship with the consumer that needs them) or bundle as a separate hot-fix PR landing first? Recommend: **include in this Phase 3** as commit #1 (before any UI). Confirm.

Once these eight are answered, Phase 3 implementation can proceed with no ambiguity.

**Phase 3 commit order (proposed):**
1. `fix(api): correct order proxy shapes — timeline, next-stages, transition` (the §7a hot-fix)
2. `feat(lib): add ORDER_REOPEN, ORDER_TRANSITION, ORDER_APPROVE_INQUIRY permissions`
3. `feat(composed): extend CarryForwardStepper with 'unlocked' status`
4. `style(primitives): switch Tabs active state to emerald-underline + brand-50 (Vue parity)`
5. `feat(orders): build OrderDetail shell — header + stepper + transition bar + tab nav`
6. `feat(orders): per-tab fallback strategy + deep-link surface`
7. Tests + nginx + MIGRATED_PATHS update + migration log Phase 3 sections.

---

## Phase 2 — User decisions (recorded 2026-04-26)

All eight Phase-2 questions answered by user:

1. **Sticky tab nav only** (header scrolls with content; stepper + transition bar NOT sticky). ✅
2. **Stage display:** chip + full 17-step `<CarryForwardStepper>` + transition action bar. Vue parity. ✅
3. **CarryForwardStepper:** add new `unlocked` status (amber, open-padlock, clickable). Updated status set is now `completed | current | unlocked | locked | blocked` (5 total). ✅
4. **Tabs active state:** adapt `<TabsTrigger>` to emerald-underline + brand-50 background. Replace foundation-PR pill+white styling. ✅
5. **Deferred-tab fallback:** **B3 — sandbox preview.** Phase 1 builds shell at `/orders-shell-preview/[id]` (not at `/orders/[id]`). No nginx change, no MIGRATED_PATHS update, no `/orders/[id]` takeover in this Phase 3. Phase 2 (shell + Dashboard tab) will do the takeover when product is ready. ✅
6. **Mobile/tablet polish:** in-scope. Desktop ≥1024 full layout / Tablet 768-1023 compact stepper + horizontal scroll tabs / Mobile <768 vertical stepper inside `<details>` + transitions collapse to primary CTA + DropdownMenu. ✅
7. **3 new permissions:** `ORDER_REOPEN: [ADMIN]`, `ORDER_TRANSITION: [ADMIN, OPERATIONS]`, `ORDER_APPROVE_INQUIRY: [ADMIN, OPERATIONS]` (subject to Phase 3 Step 3 backend verification). ✅
8. **Proxy fixes:** include in this Phase 3 as commit #1, before any UI consumer reads from the proxies. ✅

**Deviation from decision #7:** Phase 1.6 + Phase 3 Step 3 live verification found that `backend/routers/orders.py:835-836 approve_inquiry` only checks `current_user.user_type == "INTERNAL"` — accepts ADMIN, OPERATIONS, **and FINANCE**. Per the user's stop condition ("adjust scope if backend is more or less restrictive"), `Resource.ORDER_APPROVE_INQUIRY` was set to `[ADMIN, OPERATIONS, FINANCE]` to match backend exactly, NOT `[ADMIN, OPERATIONS]` as proposed. Documented inline in `matrix.ts`.

---

## Phase 3 — Implementation notes

### Commits on the branch (7)

| # | Hash | Subject |
|---|---|---|
| 1 | `0642f23` | fix(api): correct order proxy shapes and add go-back + jump-to-stage routes |
| 2 | `4d102c1` | feat(lib): add ORDER_REOPEN, ORDER_TRANSITION, ORDER_APPROVE_INQUIRY permissions |
| 3 | `a9ec6f8` | feat(composed): add 'unlocked' status to CarryForwardStepper for forward-jump affordance |
| 4 | `7b4c000` | style(primitives): switch Tabs active state to emerald-underline + brand-50 (Vue parity) |
| 5 | `1970018` | feat(orders): build order detail shell at /orders-shell-preview/:id (B3 sandbox) |
| 6 | `75d9a9f` | test(orders): order detail shell test suite |
| 7 | _this commit_ | docs: order shell tech debt + migration log Phase 3 notes |

### Shell components built (12 source files, ~2,370 lines)

- `page.tsx` (165) — RSC wrapper. Resolves user role, fetches order, branches to NotFound / Forbidden / Error / OK cards. **Replaces Vue's silent empty-`<div>` failure mode.**
- `_components/types.ts` (125) — local TypeScript interfaces for the 4 corrected proxy shapes.
- `_components/order-shell-client.tsx` (440) — TanStack-Query orchestrator. 4 queries + 6 modal states + transition pending flag.
- `_components/order-header.tsx` (115) — Page identity row.
- `_components/client-draft-banner.tsx` (115) — CLIENT_DRAFT amber banner with factory + currency selectors.
- `_components/factory-not-assigned-banner.tsx` (95) — DRAFT-without-factory amber warning + inline picker.
- `_components/stage-stepper-section.tsx` (155) — 17-step `<CarryForwardStepper>` + override history. 3 responsive variants.
- `_components/transition-action-bar.tsx` (165) — Go-back + Return-to + Next-stage buttons. Mobile collapses to primary + DropdownMenu.
- `_components/transition-error-banner.tsx` (85) — Clickable red banner. `navigateToFix(message)` maps known error substrings to (tab, highlightSection) pairs.
- `_components/carried-items-alert.tsx` (70) — Dismissable banner from `?carried=N`. Self-strips param on dismiss.
- `_components/order-tabs.tsx` (245) — Sticky tab nav, 14 tabs with stage-driven visibility, query badge with red-pulse, `<DeferredTabFallback>` redirects to Vue.
- `_components/order-modals.tsx` (300) — All 6 page-level modals.

### nginx config — unchanged (per decision #5)

Sandbox path lives directly under Next.js's app/ matcher; no nginx route added. `/orders/{id}` still falls through to Vue.

### `MIGRATED_PATHS.md` — unchanged

Sandbox is intentionally undocumented as "migrated" until Phase 2 promotion.

### Tests added (per-suite delta)

| Suite | Before | After | Δ |
|---|---|---|---|
| `tests/api/orders-detail-routes.test.ts` | 26 | 40 | **+14** (replaced wrong-shape assertions; +13 new for go-back + jump-to-stage; net +14) |
| `tests/components/carry-forward-stepper.test.tsx` | 10 | 19 | **+9** (unlocked status + onStepClick) |
| `tests/components/tabs.test.tsx` | 11 | 11 | 0 (1 updated assertion only) |
| `tests/app/order-detail-shell.test.tsx` (new) | — | 37 | **+37** |
| Total new | — | — | **+60** |

### R-16 + R-17 deferred to user verification

This Phase 3 is infrastructure + sandbox preview only — no production user flow disrupted. R-16 + R-17 should be performed by the user during sandbox QA after merge, before any decision to promote to `/orders/{id}`.

---

## Issues encountered and resolutions

### Issue 1: 4 ESLint errors after building order-modals.tsx + page.tsx

- **Date raised:** 2026-04-26 (Phase 3 Step 5 first lint run)
- **Problems:** (a) `setState`-in-`useEffect` rule on warning-ack reset logic; (b) unused `navigateToFix` import in order-shell-client; (c) two unescaped apostrophes in JSX text.
- **Fix applied:** Refactored WarningAckModal to use a key-based remount (inner `WarningAckForm` sub-component mounts/unmounts on `open` toggle, naturally resetting state). Removed unused import. Replaced `'` with `&apos;`.
- **Date resolved:** 2026-04-26 Step 5
- **Tests added:** none (lint-only fixes).

### Issue 2: Build failure — Next.js page.tsx may not export non-canonical names

- **Date raised:** 2026-04-26 (Phase 3 Step 5 first build run)
- **Problem:** `OrderShellLoadingSkeleton` was exported from page.tsx for test convenience. Next.js's strict page-export validator only allows `default`, `dynamic`, `config`, `generateStaticParams`, etc. Build failed with `Type … is not assignable to type 'never'`.
- **Fix applied:** Removed the unused export. Streaming-RSC fallback should live in a sibling `loading.tsx` (Next.js convention) — deferred.
- **Date resolved:** 2026-04-26
- **Tests added:** none.

### Issue 3: GoBackConfirmModal type mismatch in order-shell-client

- **Date raised:** 2026-04-26 (Phase 3 Step 5 second build run)
- **Problem:** Passed `isPending={pending}` to `GoBackConfirmModal`, but the modal's interface didn't include `isPending` (the simpler `<AlertDialog>` primitive has no pending state).
- **Fix applied:** Removed the `isPending` pass-through at the call site. Acceptable for sandbox; revisit if shell promotes to production.
- **Date resolved:** 2026-04-26
- **Tests added:** none.

### Issue 4: Foundation-PR proxy shape mismatches (3 endpoints)

- **Date raised:** 2026-04-26 (Phase 1.6 live endpoint verification)
- **Problem:** 3 of 4 proxies built in foundation PR #1 had shape contracts that didn't match actual backend responses. Tests passed because they mocked inferred shapes, not live shapes.
- **Fix applied:** All three corrected in commit `0642f23`. Tests rewritten to assert against actual live shapes. Postmortem at [`docs/tech-debt/foundation-proxy-shape-mismatch.md`](../../tech-debt/foundation-proxy-shape-mismatch.md).
- **Date resolved:** 2026-04-26 (commit `0642f23`)
- **Tests added:** Net +14 tests across the 3 affected proxies + 2 new go-back / jump-to-stage routes.

---

## Proposed rules for CONVENTIONS.md (if any)

### Proposed P-026: Proxy-test fidelity rule

When writing or reviewing tests for a Next.js API proxy route under `apps/web/src/app/api/`:

1. The mocked upstream-fetch return value MUST match an actual captured backend response, not an inferred shape from the OpenAPI spec or research doc.
2. Capture is done via `curl` against the running backend with a real auth token and real entity id. Save to `/tmp/probe-{endpoint}.json` or paste into the test file as a fixture.
3. The test must assert at least one wrapper-level field unique to the actual backend shape (not just that the bare list field is forwarded).

Surfaced after foundation PR #1's three proxy shapes turned out to be wrong. The foundation tests passed because they mocked inferred shapes; live consumers would have hit 422s and empty arrays in production. (Deferred to user discussion at end of migration.)

---

## Open questions deferred

- **R-16 + R-17 sandbox QA:** the user should run live verification against `/orders-shell-preview/[id]` after merge.
- **Streaming `loading.tsx`:** if streaming UX matters for the shell page, add a sibling `app/(app)/orders-shell-preview/[id]/loading.tsx` in a follow-up.
- **Promotion to `/orders/[id]`:** when at least one tab content panel is migrated (Dashboard recommended first), schedule a separate PR to (a) move the shell route to `/orders/[id]`, (b) add an nginx `location = /orders/{id}` block, (c) update `MIGRATED_PATHS.md`, (d) extend `nginx-config.test.ts`.
- **`<AlertDialog>` enhancement:** consider extending the primitive to support a `pending` prop so the simple confirms can disable their button while the upstream PUT is in flight (Issue 3 above).

---

## Final status

- **Tests passing:** lib 280/280 ✅. web ~693 expected (633 baseline + 60 new); will confirm in final-verification step.
- **Build:** ✅ — `/orders-shell-preview/[id]` route weighs 12.6 kB / 167 kB first-load.
- **Lint:** ✅ — 0 errors, 0 warnings.
- **nginx config:** UNCHANGED (B3 sandbox).
- **MIGRATED_PATHS.md:** UNCHANGED.
- **Branch:** `feat/order-detail-shell` (7 commits).
- **Push:** pending (after this commit lands).
- **Merged:** NOT YET — PR will be created via `gh pr create` for user review.

