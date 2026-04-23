# Profile: internal_order_detail

## Metadata
- **Source file:** `frontend/src/views/orders/OrderDetail.vue`
- **Lines:** 956
- **Type:** page (shell)
- **Portal:** internal
- **Route:** `/orders/:id`
- **Wave:** Wave 8
- **Profile generated:** 2026-04-22

---

## Purpose

Central order management shell for the internal ERP. Hosts 14 sub-tabs, orchestrates all order-level state (status, factory assignment, stage progression, documents), and exposes a unified action surface for advancing, reverting, reopening, and deleting orders. Sub-tab components are rendered inside a dynamic `<component :is="...">` block driven by `activeTab`. All tab-switching, stage-transition modals, and factory assignment live in this shell; sub-tabs only emit events (`reload`, `open-query`) upward.

---

## Layout / visual structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Order header bar                                                │
│   Order number · Status badge (stageStyles color) · Client    │
│   ← Back to Orders  |  [Factory Assign] [Transition] [Reopen] │
│   [Delete]  [GoBack]  [JumpToStage] (role-gated)              │
├─────────────────────────────────────────────────────────────────┤
│ Sub-tab strip (horizontal scroll)                               │
│  [Dashboard] [Items] [Payments?] [Production?] … [Landed Cost?]│
│  Tabs added progressively as order advances through statuses    │
├─────────────────────────────────────────────────────────────────┤
│ Active tab component (dynamic)                                  │
│  Receives: orderId, order, timeline, highlightSection, etc.    │
│  Emits: reload → refetches entire order                        │
└─────────────────────────────────────────────────────────────────┘
```

Stage timeline panel: shown as a sidebar or collapsible section displaying each past stage with timestamp and actor. Not a separate tab — rendered inline in the shell around the tab strip.

---

## Data displayed

- Order header: `order.order_number`, `order.status`, `order.client_name`, `order.factory_name`, `order.stage_number`, `order.created_at`, `order.reopen_count`
- Status badge: colored by `stageStyles[order.stage_number]` (inline object; see **Quirks**)
- Stage timeline: `timeline.stages[]` — each entry shows stage name, completed_at, actor
- Available next stages: `nextStages[]` — dropdown for transition target
- Documents list: `documents[]` — file names / download links, accessible from all tabs via shell state
- Factory dropdown: `factoriesRef[]` — list from `factoriesApi.list()` for assignment

---

## Interactions

| Interaction | Handler | API call |
|---|---|---|
| Navigate back | `router.push('/orders')` | none |
| Switch sub-tab | `activeTab = slug` | none (reactive) |
| Advance stage | `openTransitionModal()` → confirm → `transitionOrder()` | `ordersApi.transition(orderId, { stage })` |
| Go back stage | `openGoBackModal()` → confirm (reason required) → `goBackOrder()` | `ordersApi.goBack(orderId, { reason })` |
| Jump to stage | `openJumpModal()` → select stage → confirm | `ordersApi.jumpToStage(orderId, { stage })` |
| Reopen order | `openReopenModal()` → reason required → `reopenOrder()` | `ordersApi.reopen(orderId, { reason })` |
| Delete order | `openDeleteModal()` → confirm → `deleteOrder()` | `ordersApi.delete(orderId)` |
| Assign factory | `assignFactory(factoryId)` → `alert()` on error | `ordersApi.update(orderId, { factory_id })` |
| Approve inquiry | `approveInquiry()` → `alert()` on error | `ordersApi.approveInquiry(orderId)` |
| Reload (from sub-tab emit) | `loadOrder()` | `ordersApi.get(orderId)` |

---

## Modals / dialogs triggered

Six custom overlay modals (fixed-overlay Tailwind divs — not PrimeVue Dialog):

1. **Delete Confirm** — "Are you sure?" with irreversible warning. Confirmed with button click. Closes on `.self` click.
2. **Reopen** — Free-text reason input (required). Submit disabled until reason non-empty.
3. **Stage Transition Confirm** — Shows current → next stage label. User selects target from `nextStages` dropdown, then confirms.
4. **Go Back Confirm** — Shows current → previous stage. Reason input required.
5. **Warning / Outstanding Balance** — Shown when transition is blocked by unpaid balance or other business rule. Requires reason to proceed (override path).
6. **Jump to Stage Confirm** — Select arbitrary target stage from list. SUPER_ADMIN only (client-side guard, verify server-side enforcement).

All modals controlled by boolean refs (`showDeleteModal`, `showReopenModal`, `showTransitionModal`, `showGoBackModal`, `showWarningModal`, `showJumpModal`).

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /api/orders/{id}/` | ordersApi.get | Load full order object on mount and after mutations |
| `GET /api/orders/{id}/timeline/` | ordersApi.timeline | Stage history for timeline sidebar |
| `GET /api/orders/{id}/next-stage/` | ordersApi.nextStage | Available transition targets |
| `GET /api/documents/?order_id={id}` | documentsApi.list | Documents list passed to Files tab |
| `POST /api/orders/{id}/transition/` | ordersApi.transition | Advance order stage |
| `POST /api/orders/{id}/go-back/` | ordersApi.goBack | Revert to prior stage |
| `POST /api/orders/{id}/jump-to-stage/` | ordersApi.jumpToStage | Admin-only direct jump |
| `POST /api/orders/{id}/reopen/` | ordersApi.reopen | Reopen completed order |
| `DELETE /api/orders/{id}/` | ordersApi.delete | Soft-delete order |
| `PUT /api/orders/{id}/` | ordersApi.update | Factory assignment |
| `POST /api/orders/{id}/approve-inquiry/` | ordersApi.approveInquiry | Approve factory inquiry |
| `GET /api/factories/` | factoriesApi.list | Factory dropdown for assignment |

---

## Composables consumed

| Composable | Symbols used |
|---|---|
| `useAuth` | `isSuperAdmin`, `isAdmin`, `isFinance`, `user` |
| `useRoute` (Vue Router) | `route.params.id` (captured as non-reactive const — see Quirks) |
| `useRouter` | `router.push()` for navigation |

---

## PrimeVue components consumed

None observed as component-level imports. Tab navigation bar and all 6 modals are custom Tailwind/HTML. PrimeVue Icons (`<i class="pi pi-...">`) are used throughout for iconography.

---

## Local state

```javascript
const orderId = route.params.id          // NON-REACTIVE — P-011 instance
const order = ref(null)
const timeline = ref(null)
const nextStages = ref([])
const documents = ref([])
const loading = ref(true)
const transitioning = ref(false)
const activeTab = ref('dashboard')       // Active tab slug

// Modal state (10+ boolean refs)
const showDeleteModal = ref(false)
const showReopenModal = ref(false)
const showTransitionModal = ref(false)
const showGoBackModal = ref(false)
const showWarningModal = ref(false)
const showJumpModal = ref(false)
// + associated form/input refs per modal

// Inline display config
const stageStyles = {                    // P-001: inline style map
  1: { color: '...', label: '...' },
  // ... 17 entries
}
const factoriesRef = ref([])            // Factory dropdown options
```

---

## Permissions / role gating

| Feature | Gate |
|---|---|
| View order | Any INTERNAL role (router-level auth) |
| Advance / go-back stage | Implied ADMIN/OPERATIONS (not fully audited from shell code) |
| Jump to stage | SUPER_ADMIN implied (client-side check `isSuperAdmin`) |
| Reopen order | ADMIN/SUPER_ADMIN implied |
| Delete order | SUPER_ADMIN/ADMIN implied |
| Factory assignment | ADMIN/OPERATIONS implied |
| Payments tab (progressive) | Post-PI status; no role gate — all INTERNAL |
| Production tab (progressive) | Production statuses; no role gate — all INTERNAL |
| Landed-cost tab | `client_type === 'TRANSPARENCY' && status in CLEARED_STAGES && role in (SUPER_ADMIN, ADMIN, FINANCE)` |

**[UNCLEAR]** — Client-side role guards for transition/delete/reopen are not fully captured. Server-side enforcement for `jump-to-stage` and `delete` should be cross-checked against AUTHZ_SURFACE.md and backend router checks.

---

## Bilingual labels (InternalString)

No bilingual label system observed. All labels are English-only strings hardcoded in the template. Stage names and status labels are rendered from `stageStyles` inline object using keys like `'DRAFT'`, `'PENDING_PI'`, etc.

---

## Empty / error / loading states

- **Loading:** Full-page `loading` ref — sub-tab area hidden or replaced with spinner while `loadOrder()` resolves.
- **Order not found:** No explicit 404 handling observed; likely renders null-reference errors in template. [UNCLEAR — confirm if router redirects on 404 response from `ordersApi.get`]
- **Transition error:** Error from `ordersApi.transition` shown inline in transition modal.
- **Go-back / reopen errors:** Similar inline display in respective modals.
- **Factory assign error:** `alert()` called — D-003 violation.
- **Approve inquiry error:** `alert()` called — D-003 violation.
- **Document list error:** Not observed — silent on fetch failure.

---

## Business rules

1. **Progressive tabs**: `availableTabs` computed determines which slugs appear based on `order.status`. Minimum tabs (dashboard + items) always present. Payments appear post-PI. Production appears in production statuses. Other tabs added as order advances. Landed-cost gated by both client type and role.
2. **D-002 slug contract**: The 14 tab slugs are a URL-addressable contract — `dashboard, items, payments, production, packing, booking, sailing, shipping-docs, customs, after-sales, final-draft, queries, files, landed-cost`. All must be preserved exactly in the Next.js rebuild for bookmark / notification deep-link compatibility.
3. **Stage reversion requires reason**: `goBack` and `reopen` modals enforce a non-empty free-text reason before submission.
4. **Reload contract**: All sub-tabs that mutate order state emit a `reload` event that re-fetches the full order via `ordersApi.get`. This keeps the shell as single source of truth for the `order` object.
5. **Factory assignment**: Assigning a factory is a `PUT /api/orders/{id}/` call with `{ factory_id }` — not a dedicated endpoint. This reuses the general update endpoint.
6. **Timeline is fetched once**: `ordersApi.timeline()` is called on mount and not re-fetched after transitions. After a stage change the timeline displayed may be stale until a full page reload.
7. **Documents list**: `documentsApi.list()` called on mount; passed down to the Files sub-tab as prop. Not re-fetched unless user manually reloads.

### Tab visibility by order status

Tabs are pushed to the strip in a fixed order by `availableTabs` (source: `OrderDetail.vue:312–334`). The table below enumerates every `OrderStatus` value and the slugs present at that status. Tabs appear in strip order left-to-right.

| Order status | Visible tabs (slugs, in strip order) |
|---|---|
| `CLIENT_DRAFT` | dashboard, items, queries, files |
| `DRAFT` | dashboard, items, queries, files |
| `PENDING_PI` | dashboard, items, queries, files |
| `PI_SENT` | dashboard, items, payments, queries, files |
| `ADVANCE_PENDING` | dashboard, items, payments, queries, files |
| `ADVANCE_RECEIVED` | dashboard, items, payments, queries, files |
| `FACTORY_ORDERED` | dashboard, items, payments, production, queries, files |
| `PRODUCTION_60` | dashboard, items, payments, production, queries, files |
| `PRODUCTION_80` | dashboard, items, payments, production, queries, files |
| `PRODUCTION_90` | dashboard, items, payments, production, queries, files |
| `PLAN_PACKING` | dashboard, items, payments, production, packing, queries, files |
| `FINAL_PI` | dashboard, items, payments, production, packing, queries, files |
| `PRODUCTION_100` | dashboard, items, payments, production, packing, queries, files |
| `BOOKED` | dashboard, items, payments, packing, booking, queries, files |
| `LOADED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, queries, files |
| `SAILED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, queries, files |
| `ARRIVED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, queries, files |
| `CUSTOMS_FILED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, queries, files |
| `CLEARED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, queries, files [¹] |
| `DELIVERED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, queries, files [¹] |
| `AFTER_SALES` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, after-sales, queries, files [¹] |
| `COMPLETED` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, after-sales, final-draft, queries, files [¹] |
| `COMPLETED_EDITING` | dashboard, items, payments, packing, booking, sailing, shipping-docs, customs, after-sales, final-draft, queries, files [¹] |

**[¹] `landed-cost`** is appended only when ALL THREE conditions hold simultaneously:
- `order.client_type === 'TRANSPARENCY'`
- `order.status` ∈ {CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING}
- `user.role` ∈ {SUPER_ADMIN, ADMIN, FINANCE}

When any condition is false, `landed-cost` is absent regardless of status. This is the only tab with a combined data-condition + role gate enforced at the shell level.

**Gate definitions** (source: `OrderDetail.vue:269–307`):

| Computed | Gates tab(s) | Status list |
|---|---|---|
| `isPostPI` | payments | PI_SENT, ADVANCE_PENDING, ADVANCE_RECEIVED, FACTORY_ORDERED, PRODUCTION_60–90, PLAN_PACKING, FINAL_PI, PRODUCTION_100, BOOKED, LOADED, SAILED, ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING (20 statuses) |
| `isProductionStage` | production | FACTORY_ORDERED, PRODUCTION_60, PRODUCTION_80, PRODUCTION_90, PLAN_PACKING, FINAL_PI, PRODUCTION_100 (7 statuses) |
| `showPackingSection` | packing | PLAN_PACKING, FINAL_PI, PRODUCTION_100, BOOKED, LOADED, SAILED, ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING (13 statuses) |
| `isBookingStage` | booking | BOOKED, LOADED, SAILED, ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING (10 statuses) |
| `isSailingStage` | sailing, shipping-docs | LOADED, SAILED, ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING (9 statuses) |
| `isCustomsStage` | customs | ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING (7 statuses) |
| `isAfterSalesStage` | after-sales | AFTER_SALES, COMPLETED, COMPLETED_EDITING (3 statuses) |
| inline status check | final-draft | COMPLETED, COMPLETED_EDITING (2 statuses) |
| inline check + `client_type` + role | landed-cost | see [¹] above |

---

## Known quirks / bugs

### Q-001 — P-011: Non-reactive orderId capture
```javascript
const orderId = route.params.id   // line 24
```
Captured once at setup. If Vue Router reuses the OrderDetail component instance for two different order IDs (navigating between `/orders/A` and `/orders/B`), `loadOrder()` does not re-fire. Stale order data persists without a full page reload. Matches the P-011 pattern documented in Wave 3 (FactoryOrderDetail).

### Q-002 — D-003: alert() on factory assignment error
```javascript
// assignFactory()
} catch (err) {
  alert('Failed to assign factory: ...')
}
```
Native browser `alert()` used for error feedback. Violates D-003 (no native alert/confirm in production UI). Replace with toast notification or inline error state.

### Q-003 — D-003: alert() on approve inquiry error
```javascript
// approveInquiry()
} catch (err) {
  alert('Failed to approve inquiry: ...')
}
```
Same D-003 violation as Q-002. Two D-003 instances in the shell.

### Q-004 — P-001: stageStyles inline object
```javascript
const stageStyles = {
  1: { color: '...', label: 'Draft' },
  2: { color: '...', label: 'Pending PI' },
  // … 17 entries
}
```
Stage style map defined inline in the component. The same concept exists in `utils/constants.js` as `getStageInfo()` (confirmed in Wave 7 via OrderList.vue profile). This is a P-001 (duplicate utility) violation. `stageStyles` in OrderDetail is a parallel implementation of the constants module.

### Q-005 — Stale timeline after stage transition
After a successful `transitionOrder()` call, `timeline.value` is not re-fetched. The stage history display shows the pre-transition state until a manual reload. This is a known UX regression — the timeline sidebar appears frozen immediately after a transition.

---

## Dead code / unused state

- `const factoriesRef = ref([])` is loaded by `factoriesApi.list()` but rendered only in the factory assignment section. If the order already has a factory assigned, the dropdown may never open and the factory list fetch is wasted on every mount.
- `documentsApi.list()` is called on mount and the result is passed to the Files sub-tab. If the user never visits the Files tab, the fetch was unnecessary. No lazy loading for sub-tab data.

---

## Duplicate or inline utilities

- **stageStyles** — Inline stage color/label map. Duplicate of `getStageInfo()` from `utils/constants.js`. Action: replace with shared constant. (P-001 instance #N; first seen in `OrderList.vue` Wave 7.)
- **No inline formatters** observed in the shell script block beyond stageStyles; formatting delegated to sub-tab components.

---

## Migration notes

### Architecture
1. **Tab routing**: In the Next.js rebuild, replace the single `/orders/[id]` route with a nested route structure: `/orders/[id]/[tab]`. Each tab is a route segment; the active tab is URL-driven. This resolves P-011, enables browser back/forward navigation between tabs, and makes tab deep-links first-class.
2. **Shell as layout**: In Next.js App Router, OrderDetail becomes a layout component (`layout.tsx`) wrapping the active tab page. The `order` object is fetched once server-side and passed via context or as a shared layout fetch; sub-pages receive it as a prop.
3. **Progressive tab visibility**: Move the `availableTabs` logic to a server component that computes available tabs based on order status. Client-side tab rendering becomes purely display.
4. **Stage transition**: Wrap `ordersApi.transition` in a Next.js Server Action. Redirect to updated order URL on success. No client-side refetch loop needed.
5. **D-002 slug contract**: Preserve all 14 slugs exactly. Define them as a const enum in the shared SDK type system. Any tab addition in the Next.js rebuild must add to this enum and announce as a breaking URL contract change.

### Patterns to fix
- **P-011**: Use `useParams()` hook in Next.js App Router — params are always reactive.
- **P-001 (stageStyles)**: Replace with `getStageInfo(stageNumber)` from shared constants. One canonical source.
- **D-003 (×2)**: Replace `alert()` calls in `assignFactory()` and `approveInquiry()` with toast notifications (shadcn/ui `Toast` or similar).
- **Q-005 (stale timeline)**: After any stage mutation, re-fetch timeline alongside order. Or use a combined `GET /api/orders/{id}/full/` endpoint that returns order + timeline in one call.
- **Lazy sub-tab data**: Move `documentsApi.list()` into the Files sub-tab component (or page) rather than the shell. The shell should only fetch the order object.

### API consolidation
Consider a single `/api/orders/{id}/detail/` endpoint returning `{ order, timeline, next_stages }` to replace three sequential fetches on mount. Reduces waterfall from 4 requests to 2 (detail + documents-lazily).
