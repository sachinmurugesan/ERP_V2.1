# Page Profile 9 of 9 — `client_returns_pending.md`

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/returns-pending` → `ClientReturnsPending`
**Vue file:** [frontend/src/views/client/ClientReturnsPending.vue](../../../frontend/src/views/client/ClientReturnsPending.vue)
**Line count:** 220
**Migration wave:** Wave 2 (client portal)
**Risk level:** medium (no portal permission gates this page — all authenticated CLIENT users can access; G-007 CLOSED 2026-04-22 — CLIENT RLS and `factory_price` stripping applied at backend)

---

## Purpose (one sentence)

Combined carry-forward list of unloaded items and after-sales carry-forwards from previous orders, with tab filtering (All / After-Sales / Unloaded), client-side search, and a 3-step progress stepper showing each item's carry-forward status.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-5xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Header** (`mb-6`)
- `h1` "Returns & Pending" with `pi-replay text-emerald-600` icon (`text-xl md:text-2xl font-bold text-slate-800`).
- `p` subtitle ("Items from previous orders that will be carried forward to your next order with the same factory.", `text-sm text-slate-500`).
- No action buttons.

**Zone 2 — Summary cards** (`grid grid-cols-3 gap-3 mb-5`)
3 cards, each `bg-white rounded-xl border p-4 text-center`:
| Card | Number colour | Label |
|---|---|---|
| Total Pending | `text-slate-800` | "Total Pending" |
| After-Sales | `text-orange-600` | "After-Sales" |
| Unloaded | `text-purple-600` | "Unloaded" |

**Zone 3 — Tab + table card** (`bg-white rounded-xl border shadow-sm`)
- **Tab bar + search row** (`flex items-center justify-between border-b border-slate-100 px-4 pt-3`):
  - Left: 3 tab buttons (All / After-Sales / Unloaded), each with a count badge. Active tab: emerald-50 background + emerald-600 bottom border-2.
  - Right: search input (`pi-search` icon, `pl-8`, placeholder "Search by code, name, or order...", 48-unit wide, `v-model="searchQuery"`).
- **Loading state** (`v-if="loading"`): `pi-spin pi-spinner` + "Loading...".
- **Empty state** (`v-else-if="filteredItems.length === 0"`): `pi-check-circle text-3xl text-emerald-400` + "No pending items found." + "All carry-forward items have been fulfilled." sub-text.
- **Items table** (`v-else overflow-x-auto`):
  - 5 columns: Product | Type | Qty | From Order | Progress
  - **Product cell**: `item.product_code` (`font-medium text-xs`, fallback `'—'`) + `item.product_name` (`text-[11px] text-slate-500 truncate max-w-[200px]`, fallback `'—'`).
  - **Type cell**: coloured rounded badge from `typeBadge(item)` — Unloaded (purple-100) / Replacement (emerald-100) / Compensation (blue-100) / After-Sales (orange-100).
  - **Qty cell**: `item.affected_quantity || item.quantity` (`text-xs font-medium`).
  - **From Order cell**: `item.original_order_number || item.order_number` (`text-xs text-slate-600`).
  - **Progress cell**: 3-step inline stepper (Pending → In Order → Fulfilled) — filled emerald when complete/current, slate when future.

**Zone 4 — Info note footer** (`mt-4 p-3 rounded-lg bg-slate-50 border text-xs text-slate-500`)
- `pi-info-circle` icon + "Pending items are automatically added to your next order when it's assigned to the same factory. You don't need to manually add them."

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `allItems.length` | computed | integer | Summary card: Total Pending |
| `aftersalesItems.length` | computed | integer (orange) | Summary card: After-Sales |
| `unloadedItems.length` | computed | integer (purple) | Summary card: Unloaded |
| `item.product_code` | `unloadedApi.list()` or `afterSalesApi.list()` | `font-medium text-xs` | Fallback `'—'` |
| `item.product_name` | same | `text-[11px] truncated` | Fallback `'—'` |
| `item._type` + `item.carry_forward_type` → `typeBadge()` | computed tag | coloured badge | Unloaded / Replacement / Compensation / After-Sales |
| `item.affected_quantity \|\| item.quantity` | `afterSalesApi.list()` or `unloadedApi.list()` | integer | Dual field name — P-006 |
| `item.original_order_number \|\| item.order_number` | same | `text-xs` | Dual field name — P-006; fallback `'—'` |
| `item.carry_forward_status \|\| item.status` | same | drives `stepperState()` | Dual field path — P-006; unloaded uses `status`, after-sales uses `carry_forward_status` |

**Pricing fields:** `factory_price` was previously transmitted by `unloadedApi` but never rendered. G-007 patch (2026-04-22) strips `factory_price` server-side for CLIENT callers — no longer transmitted.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadAll()` | `GET /api/unloaded-items/?status=PENDING&per_page=200` + `GET /api/aftersales/?carry_forward_only=true&per_page=200` in parallel | Both item lists loaded; `unloadedItems` tagged `_type: 'unloaded'`, `aftersalesItems` tagged `_type: 'aftersales'` |
| Click tab button | `activeTab = tab.id` | None | `tabItems` computed re-filters; `filteredItems` updates |
| Type in search input (`v-model="searchQuery"`) | `searchQuery` updated reactively | None | `filteredItems` recomputes on every keystroke — no debounce |

No navigation, no modals, no expand/collapse interactions.

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/unloaded-items/?status=PENDING&per_page=200` | `unloadedApi.list` | **G-007 CLOSED 2026-04-22:** CLIENT RLS enforced — absent `client_id` forced to own; mismatched `client_id` → 403. `factory_price` stripped from CLIENT/FACTORY responses. Authenticated access required (router-level `get_current_user` dependency). |
| GET | `/api/aftersales/?carry_forward_only=true&per_page=200` | `afterSalesApi.list` | **G-003 CLOSED 2026-04-21:** enforces `portal_permissions.show_after_sales` for CLIENT callers — False → 403. CLIENT RLS scopes to `current_user.client_id`. |

Both calls fire in parallel via `Promise.all`.

---

## Composables consumed

None. `unloadedApi` and `afterSalesApi` imported directly from `../../api`.

---

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-replay`, `pi-spin pi-spinner`, `pi-search`, `pi-check-circle`, `pi-clock`, `pi-shopping-cart`, `pi-check`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(true)` | `true` | Global loading gate; cleared in `finally` |
| `activeTab` | `ref('all')` | `'all'` | Selected tab: `'all'` / `'aftersales'` / `'unloaded'` |
| `searchQuery` | `ref('')` | `''` | Client-side search input |
| `unloadedItems` | `ref([])` | `[]` | Items from `unloadedApi.list`; each tagged `_type: 'unloaded'` |
| `aftersalesItems` | `ref([])` | `[]` | Items from `afterSalesApi.list`; each tagged `_type: 'aftersales'` |

**Computed values:**

| Name | Derives from | Purpose |
|---|---|---|
| `allItems` | `unloadedItems`, `aftersalesItems` | Concatenated list for the "All" tab |
| `tabItems` | `allItems`, `activeTab` | Tab-filtered view of items |
| `filteredItems` | `tabItems`, `searchQuery` | Search-filtered display list (product code, name, order number) |

No `watch` or `onUnmounted`.

---

## Permissions / role gating

**Portal permission:** None defined. No `show_*` field in `portal_permissions` covers returns / unloaded items. This page appears unconditionally in the client portal menu — no `portalPerms` check for this route was found in `ClientLayout.vue`. [UNCLEAR — verify `ClientLayout.vue` menu filtering for `returns-pending`.]

**`unloadedApi.list` — G-007 CLOSED 2026-04-22:**

`GET /api/unloaded-items/` and `GET /api/unloaded-items/pending/` in `backend/routers/unloaded.py` were patched 2026-04-22. Both handlers now declare `current_user: CurrentUser = Depends(get_current_user)` in their signatures:

- **CLIENT RLS:** absent `client_id` param → forced to `current_user.client_id`; mismatched `client_id` → 403.
- **FACTORY RLS:** absent `factory_id` → forced to `current_user.factory_id`; mismatched → 403.
- **`factory_price` stripped:** only serialised when `current_user.user_type == "INTERNAL"` (D-004).

Verification: 9/9 matrix checks pass. See `SECURITY_BACKLOG.md`.

**`afterSalesApi.list` — protected:**

The after-sales half of this page calls the same `GET /api/aftersales/` endpoint as `ClientAfterSales.vue`. G-003 enforcement applies: CLIENT callers without `show_after_sales=True` receive 403. The error is caught silently; `aftersalesItems` stays `[]`. No indication is shown to the user that after-sales carry-forwards were suppressed by a permission check.

**Per D-006:** No `show_*` portal permission gates this page at all. The `G-007` backend fix ensures the data is correctly scoped, but there is no `show_returns` (or equivalent) permission to hide the page from clients who should not see it. This policy gap is a Wave 0 item — see migration note 2.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| String | Location | Type | `en` | `ta` |
|---|---|---|---|---|
| Page title | `<h1>` | PortalString | "Returns & Pending" | "" |
| Page subtitle | `<p>` | PortalString | "Items from previous orders that will be carried forward to your next order with the same factory." | "" |
| Summary card: Total Pending | template | PortalString | "Total Pending" | "" |
| Summary card: After-Sales | template | PortalString | "After-Sales" | "" |
| Summary card: Unloaded | template | PortalString | "Unloaded" | "" |
| Tab: All | tabs array | PortalString | "All" | "" |
| Tab: After-Sales | tabs array | PortalString | "After-Sales" | "" |
| Tab: Unloaded | tabs array | PortalString | "Unloaded" | "" |
| Search placeholder | `<input>` | PortalString | "Search by code, name, or order…" | "" |
| Loading copy | template | PortalString | "Loading…" | "" |
| Empty: primary | `<p>` | PortalString | "No pending items found." | "" |
| Empty: secondary | `<p>` | PortalString | "All carry-forward items have been fulfilled." | "" |
| Table header: Product | `<th>` | PortalString | "Product" | "" |
| Table header: Type | `<th>` | PortalString | "Type" | "" |
| Table header: Qty | `<th>` | PortalString | "Qty" | "" |
| Table header: From Order | `<th>` | PortalString | "From Order" | "" |
| Table header: Progress | `<th>` | PortalString | "Progress" | "" |
| Type badge: Unloaded | `typeBadge` | PortalString | "Unloaded" | "" |
| Type badge: Replacement | `typeBadge` | PortalString | "Replacement" | "" |
| Type badge: Compensation | `typeBadge` | PortalString | "Compensation" | "" |
| Type badge: After-Sales | `typeBadge` | PortalString | "After-Sales" | "" |
| Stepper: Pending | `STEPPER_STEPS` | PortalString | "Pending" | "" |
| Stepper: In Order | `STEPPER_STEPS` | PortalString | "In Order" | "" |
| Stepper: Fulfilled | `STEPPER_STEPS` | PortalString | "Fulfilled" | "" |
| Footer note | `<div>` | PortalString | "Pending items are automatically added to your next order when it's assigned to the same factory. You don't need to manually add them." | "" |

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading…" | `finally` block always clears `loading` |
| Empty (true empty or post-search) | `filteredItems.length === 0` | Yes — "No pending items found." + "All carry-forward items have been fulfilled." | Same copy shown for genuine empty, failed search, and full load failure — no distinction |
| Load failure | `catch (err) { console.error(...) }` | No — **P-002**: logged to console only. User sees "No pending items found." with no error indication. | Unlike other pages which completely swallow errors, this at least calls `console.error` — but the user-visible outcome is identical. |
| `show_after_sales` missing | After-sales API returns 403, caught silently | No — "After-Sales: 0" tab count, no explanation | User cannot distinguish between "you have no carry-forwards" and "you don't have permission to see them" |

---

## Business rules (non-obvious)

- **Dual schema mismatch:** Unloaded items and after-sales carry-forwards have different field names for the same concepts:
  - Order number: `original_order_number` (unloaded) vs `order_number` (after-sales)
  - Quantity: `quantity` (unloaded) vs `affected_quantity` (after-sales)
  The template handles both via `item.original_order_number || item.order_number` and `item.affected_quantity || item.quantity`. In the Next.js rebuild, the SDK types should either unify these shapes at the adapter layer or use a discriminated union (`UnloadedItem | AfterSalesCarryForward`).
- **Stepper dual-path mapping:** `stepperState` reads `item.carry_forward_status || item.status || ''`. For unloaded items, `status` carries the progression values (PENDING / ADDED_TO_ORDER / FULFILLED). For after-sales items, `carry_forward_status` carries them. The `||` fallback makes this implicit and brittle if either item type ever gains a `status` field that conflicts with the expected values.
- **No debounce on search:** `filteredItems` recomputes on every keystroke via reactive `searchQuery`. With up to 400 items (200 per source) this is unlikely to cause perceptible lag today, but the pattern is inconsistent with best practices. **Same pattern as `ClientProducts.vue`.**
- **`show_after_sales` silent partial failure:** When `aftersalesItems` is empty due to a 403, the tab header shows "After-Sales: 0" with no permission indicator. A user who expects carry-forward items from a resolved claim will see nothing and have no way to understand why.
- **Informational footer note:** "Pending items are automatically added to your next order when it's assigned to the same factory. You don't need to manually add them." This is business-critical copy that describes expected system behaviour. Needs accurate Tamil translation and periodic review for accuracy.
- **Insertion order:** `allItems` is `[...unloadedItems, ...aftersalesItems]` — unloaded first, then after-sales. No secondary sort by date or order number. The visual order of items in the "All" tab is determined by API response order within each source.

---

## Known quirks

- **No portal permission gates this page:** There is no `show_returns` (or `show_carry_forward`) flag in `portal_permissions`. The page is accessible to all authenticated CLIENT users unconditionally. This is a policy gap separate from G-007 — the backend data is now correctly scoped, but the page cannot be hidden for clients who should not see it.
- **`show_after_sales` partial failure is silent:** When the after-sales API returns 403, the tab shows "After-Sales: 0" with no explanation. A client who has after-sales carry-forwards but lacks the `show_after_sales` permission will see nothing and have no way to distinguish permission denial from genuinely empty state.
- **Separate internal `ReturnsPending.vue`:** There is a distinct INTERNAL component at route `/returns-pending` (not `/client-portal/returns-pending`). This component is not this one. See migration note 7 for auth verification requirement.
- **No debounce on search:** Reactive `searchQuery` recomputes `filteredItems` on every keystroke with up to 400 combined items.

---

## Dead code / unused state

**`factory_price` field (G-007 CLOSED 2026-04-22):** Prior to the G-007 patch, `list_unloaded_items` serialised `factory_price` into responses for CLIENT callers. The component received this field in `unloadedItems` but never rendered it — it was dead data transmitted over the wire to the CLIENT browser. The G-007 patch (2026-04-22) now strips `factory_price` from CLIENT and FACTORY responses server-side; the field is no longer transmitted. No frontend change was required.

---

## Duplicate or inline utilities

- **`stepperState` function** — logically identical to the same function in `ClientAfterSales.vue`. **Pattern P-005.** Candidate for a shared `<CarryForwardStepper>` component.
- **`STEPPER_STEPS` constant** — identical array `[Pending, In Order, Fulfilled]` to `ClientAfterSales.vue`. Same P-005 instance.
- **`typeBadge` function** — inline display helper that maps `_type` and `carry_forward_type` to label+colour. Page-specific; no known shared equivalent.
- No `formatINR` (no monetary values rendered in this view).
- No `fmtDate` / `formatDate` (no dates rendered in this view).

---

## Migration notes / open questions

1. **G-007 CLOSED (2026-04-22):** CLIENT RLS and `factory_price` stripping applied to `list_unloaded_items` and `get_pending_for_order` in `backend/routers/unloaded.py`. 9/9 verification matrix checks pass. No longer a Wave 0 blocker on the security side; the `show_returns` policy gap (note 2) remains open.
2. **`show_returns` permission decision (Wave 0 item):** Decide whether a `show_returns` (or `show_carry_forward`) portal permission flag should be added to `portal_permissions`. Per D-006, if this page serves sensitive per-client data it should be backend-gated. Raise with Sachin — this is a policy decision, not purely technical.
3. **Unify item schema in SDK:** Define a discriminated union or adapter type: `UnloadedCarryForward | AfterSalesCarryForward`. Normalise `order_number` and `quantity` field names at the adapter layer, not in every consuming component.
4. **Extract `<CarryForwardStepper>` component (P-005):** `STEPPER_STEPS` + `stepperState` are identical here and in `ClientAfterSales.vue`. Extract to a shared component. See also `client_after_sales.md` migration note 4.
5. **`show_after_sales` partial failure UX:** When after-sales carry-forwards are suppressed by a 403, show a visible permission-denied state or suppress the "After-Sales" tab entirely rather than showing count 0 with no explanation.
6. **Search debounce:** Add 300–500ms debounce to `searchQuery` updates for consistency with best practices. Same as `ClientProducts.vue`.
7. **Verify internal `/returns-pending` route auth:** `router/index.js` line 148–153 shows a separate INTERNAL `ReturnsPending.vue` at `/returns-pending`. Verify that this internal page has appropriate authentication before Wave 0.
