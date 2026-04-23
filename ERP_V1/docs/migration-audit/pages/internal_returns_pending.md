# Internal Returns & Pending

**Type:** page (list — dual-API merge, read-only)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/returns-pending` → `ReturnsPending` (meta.title: `'Returns & Pending'`, meta.icon: `'pi-replay'`)
**Vue file:** [frontend/src/views/ReturnsPending.vue](../../../frontend/src/views/ReturnsPending.vue)
**Line count:** 633
**Migration wave:** Wave 5 (internal tracking)
**Risk level:** low — read-only; `factory_price` rendered in Unloaded tab is acceptable on INTERNAL-only pages per D-004; backend G-007 patch strips `factory_price` from CLIENT/FACTORY callers

> **Distinct from client portal:** This is the internal version at `views/ReturnsPending.vue`. The client portal version at `views/client/ClientReturnsPending.vue` (Wave 2) shows only the client's own data and omits factory pricing.

---

## Purpose

Unified read-only tracking dashboard for all unloaded items and carry-forward after-sales returns across all orders, with factory/client/status filters, three-tab switching (All / Unloaded Items / After-Sales Returns), product-level consolidation grouping, and a 3-step carry-forward stepper.

---

## Layout

### Outer container
`div` (no wrapper classes — relies on app shell padding)

**Zone 1 — Header + Search bar** (`flex items-center justify-between mb-6`)
- `h1` "Returns & Pending"
- Sub-text: "Track pending, unloaded & returning items across orders"
- Right: search input (`pl-9 w-64`, search icon, `searchQuery` model) + Refresh button (`pi-refresh`)

**Zone 2 — Dashboard cards** (`grid grid-cols-2 md:grid-cols-5 gap-4 mb-6`)

| Card | Metric | Color |
|---|---|---|
| Total Items | `dashboard.total` | slate |
| Pending | `dashboard.totalPending` | amber |
| Unloaded | `dashboard.unloaded` | orange |
| After-Sales Returns | `dashboard.aftersales` | rose |
| Fulfilled / Shipped | `dashboard.totalFulfilled` | green |

**Zone 3 — Tab switcher** (`flex gap-1 bg-slate-100 rounded-lg p-1 w-fit`)
- All (count: `allItems.length`)
- Unloaded Items (count: `unloadedItems.length`)
- After-Sales Returns (count: `aftersalesItems.length`)

Active tab: `bg-white text-emerald-700 shadow-sm`

**Zone 4 — Filter panel** (`bg-white rounded-xl shadow-sm p-4 mb-6`)
- Factory dropdown (from `factoriesApi.list()`)
- Client dropdown (from `clientsApi.list()`)
- Status dropdown: All / Pending / Added to Order / Shipped (Fulfilled)
- "Filter" button → `applyFilters()` — triggers `loadAll()` with current filter values
- "Clear" button → `clearFilters()` — resets all three filters then reloads

**Zone 5 — All tab table** (shown when `activeTab === 'all'`)

| Col | Header | Content |
|---|---|---|
| 1 | Order | `_orderRefs` links → `/orders/{id}` (stacked if multiple) |
| 2 | Type | `_type` badge (orange "Unloaded" / rose "After-Sales") |
| 3 | Part Code | `product_code` |
| 4 | Product Name | `product_name` truncated; "+ N orders" badge if consolidated |
| 5 | Qty | `_totalQty` |
| 6 | Detail | Unloaded: reason label; After-Sales: issue type label |
| 7 | Progress | 3-step stepper (P-005) |
| 8 | Added To | `_addedToRefs` links (stacked if multiple) → `/orders/{id}` |

**Zone 6 — Unloaded tab table** (shown when `activeTab === 'unloaded'`)

| Col | Header | Content |
|---|---|---|
| 1 | Original Order | `_orderRefs` → navigate |
| 2 | Part Code | `product_code` |
| 3 | Product Name | `product_name` + "N orders" badge |
| 4 | Qty | `_totalQty` |
| 5 | Reason | `NOT_PRODUCED` (red) / `NO_SPACE` (orange) badge |
| 6 | **Factory Price (CNY)** | `¥{item.factory_price.toFixed(2)}` or `—` |
| 7 | Progress | 3-step stepper |
| 8 | Added To | `_addedToRefs` → navigate |

**Zone 7 — After-Sales tab table** (shown when `activeTab === 'aftersales'`)

| Col | Header | Content |
|---|---|---|
| 1 | Order | `_orderRefs` → navigate |
| 2 | Client | `client_name` |
| 3 | Part Code | `product_code` |
| 4 | Product Name | `product_name` + "N orders" badge |
| 5 | Issue Type | rose badge |
| 6 | Claim Qty | `_totalQty` — red-700 |
| 7 | Resolution | text label |
| 8 | Progress | 3-step stepper |
| 9 | Added To | `_addedToRefs` → navigate |

Each zone shows a loading spinner, empty state, or table depending on `loading` and `consolidatedItems.length`.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `product_code` | `unloadedApi.list()` / `afterSalesApi.list()` | font-mono xs | |
| `product_name` | both APIs | text truncated | |
| `original_order_number` | `unloadedApi.list()` | link | P-006: fallback `|| item.order_number` |
| `order_number` | `afterSalesApi.list()` | link | |
| `quantity` | `unloadedApi.list()` | integer | Unloaded item qty |
| `affected_quantity` | `afterSalesApi.list()` | integer | After-sales claim qty |
| `reason` | `unloadedApi.list()` | badge | NOT_PRODUCED / NO_SPACE |
| `factory_price` | `unloadedApi.list()` | `¥{val.toFixed(2)}` | **Unloaded tab only; INTERNAL-safe per D-004; G-007 strips for CLIENT/FACTORY** |
| `objection_type` | `afterSalesApi.list()` | label | |
| `resolution_type` | `afterSalesApi.list()` | label | |
| `status` | `unloadedApi.list()` | badge (via stepper) | PENDING / ADDED_TO_ORDER / SHIPPED |
| `carry_forward_status` | `afterSalesApi.list()` | stepper | PENDING / ADDED_TO_ORDER / FULFILLED |
| `added_to_order_number` | both APIs | link | |
| `_totalQty` | `consolidateByProduct()` | integer | Summed across consolidated records |
| `_orderRefs` | `consolidateByProduct()` | links | All source orders for the consolidated group |
| `_addedToRefs` | `consolidateByProduct()` | links | All destination orders |
| Dashboard `totalPending`, `totalFulfilled`, etc. | `dashboard` computed | integers | |

**P-007 checklist:** `factory_price` is rendered in the Unloaded tab column "Factory Price (CNY)". Backend `unloaded.py:79` conditionally includes `factory_price` only when `current_user.user_type == "INTERNAL"` — this is the G-007 patch. INTERNAL callers correctly receive it; CLIENT and FACTORY callers do not. This page is INTERNAL-only. Rendering `factory_price` here is **acceptable per D-004**. No `markup_*` or other cost fields present.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadFilters()` + `loadAll()` | `GET /api/factories/` + `GET /api/clients/` + `GET /api/unloaded-items/` + `GET /api/aftersales/` | Populates dropdowns and both item lists |
| Tab click | `activeTab = tab.key` | None | Switches displayed table; `consolidatedItems` recomputes from `tabItems` |
| Search input | `searchQuery` model | None | `filteredItems` computed re-filters `tabItems` by product code/name/order number |
| Refresh icon | `loadAll()` | Same as mount data calls | Reloads both item lists |
| Filter + Apply | `applyFilters()` → `loadAll()` | Both APIs with filter params | Reloads with factory/client/status filters |
| Filter + Clear | `clearFilters()` → `loadAll()` | Both APIs, no params | Resets and reloads |
| Order link click | `router.push('/orders/{id}')` | None | Navigates to source order detail |
| "Added To" link click | `router.push('/orders/{id}')` | None | Navigates to destination order detail |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/unloaded-items/` | `unloadedApi.list(params)` | `factory_id`, `client_id`, `status` (optional) | Returns `{items, total, page, per_page, pages}`; `factory_price` included for INTERNAL only (G-007). Status filter applies to `unloaded` status only — not compatible with after-sales `carry_forward_status`. |
| GET | `/api/aftersales/` | `afterSalesApi.list(asParams)` | `carry_forward_only: true`, `client_id`, `factory_id` | Returns carry-forward after-sales items only; `factory_price` not in `_serialize_item` |
| GET | `/api/factories/` | `factoriesApi.list()` | None | Filter dropdown |
| GET | `/api/clients/` | `clientsApi.list()` | None | Filter dropdown |

> Per D-001 (Option B): in Next.js these become `client.unloaded.list(...)`, `client.afterSales.list(...)`, etc. via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline for row click navigation.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-list`, `pi-clock`, `pi-inbox`, `pi-replay`, `pi-check-circle`, `pi-search`, `pi-refresh`, `pi-spin`, `pi-spinner`, `pi-shopping-cart`, `pi-check`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(true)` | `true` | Spinner / table gate |
| `activeTab` | `ref('all')` | `'all'` | Tab switcher |
| `searchQuery` | `ref('')` | `''` | Inline search filter |
| `unloadedItems` | `ref([])` | `[]` | Items tagged `_type: 'unloaded'` |
| `aftersalesItems` | `ref([])` | `[]` | Items tagged `_type: 'aftersales'` |
| `factories` | `ref([])` | `[]` | Factory filter dropdown |
| `clients` | `ref([])` | `[]` | Client filter dropdown |
| `filterFactory` | `ref('')` | `''` | Factory filter model |
| `filterClient` | `ref('')` | `''` | Client filter model |
| `filterStatus` | `ref('')` | `''` | Status filter model |

**Computed:**
| Name | Derived from | Purpose |
|---|---|---|
| `allItems` | `[...unloadedItems, ...aftersalesItems]` | Combined item list for All tab |
| `tabItems` | `allItems` / `unloadedItems` / `aftersalesItems` per `activeTab` | Source for filtering and consolidation |
| `filteredItems` | `tabItems` filtered by `searchQuery` | Search-filtered item list |
| `consolidatedItems` | `consolidateByProduct(filteredItems)` | Groups items by `item.id` with `_totalQty`, `_orderRefs`, `_addedToRefs` |
| `dashboard` | `unloadedItems` + `aftersalesItems` | 5 counter values for dashboard cards |

**Constants (not reactive):**
- `STEPPER_STEPS` — `[{label:'Pending',icon:'pi-clock'},{label:'In Order',icon:'pi-shopping-cart'},{label:'Fulfilled',icon:'pi-check'}]` — **P-005 instance #4**
- `issueLabels` — objection type → display string map — P-015
- `resolutionLabels` — resolution type → display string map — P-015

No `watch`. `onMounted` calls `loadFilters()` + `loadAll()`.

---

## Permissions / role gating

- Route `/returns-pending` has **no `meta.roles`** — all INTERNAL users reach this page.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- **Backend `GET /api/unloaded-items/`:** Auth only (`get_current_user`); RLS enforced inline — CLIENT scoped to own `client_id`, FACTORY scoped to own `factory_id`, INTERNAL unrestricted. `factory_price` included only for INTERNAL callers (G-007 patch confirmed in unloaded.py:60).
- **Backend `GET /api/aftersales/`:** Auth only (`get_current_user`); RLS enforced inline for CLIENT/FACTORY; INTERNAL sees all carry-forward claims.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.returns_pending.title` | "Returns & Pending" | "" | `InternalString` |
| `internal.returns_pending.subtitle` | "Track pending, unloaded & returning items across orders" | "" | `InternalString` |
| `internal.returns_pending.search_placeholder` | "Search product, order..." | "" | `InternalString` |
| `internal.returns_pending.tab_all` | "All" | "" | `InternalString` |
| `internal.returns_pending.tab_unloaded` | "Unloaded Items" | "" | `InternalString` |
| `internal.returns_pending.tab_aftersales` | "After-Sales Returns" | "" | `InternalString` |
| `internal.returns_pending.col_order` | "Order" | "" | `InternalString` |
| `internal.returns_pending.col_type` | "Type" | "" | `InternalString` |
| `internal.returns_pending.col_part_code` | "Part Code" | "" | `InternalString` |
| `internal.returns_pending.col_product_name` | "Product Name" | "" | `InternalString` |
| `internal.returns_pending.col_qty` | "Qty" | "" | `InternalString` |
| `internal.returns_pending.col_detail` | "Detail" | "" | `InternalString` |
| `internal.returns_pending.col_progress` | "Progress" | "" | `InternalString` |
| `internal.returns_pending.col_added_to` | "Added To" | "" | `InternalString` |
| `internal.returns_pending.col_factory_price` | "Factory Price (CNY)" | "" | `InternalString` |
| `internal.returns_pending.col_reason` | "Reason" | "" | `InternalString` |
| `internal.returns_pending.col_client` | "Client" | "" | `InternalString` |
| `internal.returns_pending.col_issue_type` | "Issue Type" | "" | `InternalString` |
| `internal.returns_pending.col_claim_qty` | "Claim Qty" | "" | `InternalString` |
| `internal.returns_pending.col_resolution` | "Resolution" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — centred spinner per tab panel | |
| Empty (All tab) | `consolidatedItems.length === 0 && !loading` | Yes — `pi-inbox` + "No items found" | |
| Empty (Unloaded tab) | same condition | Yes — `pi-inbox` + "No unloaded items found" | |
| Empty (After-Sales tab) | same condition | Yes — `pi-replay` + "No after-sales return items found" | |
| Load error | `catch (err)` in `loadAll()` | **No — P-002 (swallow):** `console.error` only; items stay `[]`; empty states shown | |
| Filter load error | `catch (err)` in `loadFilters()` | **No — P-002 (swallow):** dropdowns stay empty | |

---

## Business rules

1. **Filters require explicit Apply.** Filter changes do NOT trigger automatic reloads. The user must click "Filter" to apply changes, or "Clear" to reset. There is no `watch` on filter values.
2. **Search is client-side only.** `searchQuery` filters `tabItems` in `filteredItems` computed — no API call. Searches `product_code`, `product_name`, and `original_order_number || order_number`.
3. **Status filter semantics differ by item type.** The `filterStatus` param is sent only to `unloadedApi.list()` (where it maps to `UnloadedItem.status`). For after-sales items, `carry_forward_status` is a different field with different values, but the same filter value is NOT sent — `afterSalesApi.list({carry_forward_only: true, ...})` receives factory/client filters only, not status.
4. **Consolidation groups by `item.id`**, not by `product_id`. The comment in the source says "same product can have multiple independent claims from different orders." In practice, `consolidateByProduct` with `item.id` as key means each row stays independent — items are only merged if they share the same `item.id`, which is unique per record. The consolidation accumulates `_totalQty`, `_orderRefs`, and `_addedToRefs` across same-id records — but since IDs are unique, consolidation has no effect on individual items. This is a no-op consolidation. See Known quirks.
5. **`factory_price` rendered on INTERNAL-only page.** Acceptable per D-004; G-007 backend patch ensures CLIENT/FACTORY callers never receive this field.

---

## Known quirks

- **`consolidateByProduct` is effectively a no-op.** The grouping key is `item.id || product_key_type`, but `item.id` is always present and unique per record — so every item gets its own group with `_totalQty = getQty(item)` and `_orderRefs = [{id, number}]`. No cross-order merging occurs in practice. The function name and comment ("groups same product across orders") describe the intended behaviour, not the actual behaviour.
- **P-006 — field name fallback:** `getOrderNumber(item)` returns `item.original_order_number || item.order_number` — one of these is undefined depending on item type (`unloaded` has `original_order_number`; `aftersales` has `order_number`). The `||` pattern masks which field the API actually emits.
- **Status filter only applies to unloaded items.** After-sales carry-forward status is not filterable from this UI — `carry_forward_only: true` is always sent to `afterSalesApi.list()` regardless of `filterStatus`.
- **P-002 — errors swallowed.** Both `loadAll()` and `loadFilters()` suppress errors silently.
- **No search debounce.** `searchQuery` is client-side filtering only — no API call on keystroke, so no debounce needed. Acceptable as-is.
- **Dashboard counts reflect full loaded dataset, not filtered view.** The 5 counter cards count all `unloadedItems` and `aftersalesItems`; search/tab filters do not affect the counters.

---

## Dead code / unused state

None observed — all refs, computed properties, and methods are referenced in the template.

---

## Duplicate or inline utilities

- **P-005 (instance #4):** `STEPPER_STEPS` constant and `stepperState(item)` duplicated from `AfterSales.vue` (internal), `ClientAfterSales.vue`, and `ClientReturnsPending.vue`. This is the 4th instance. Extract to shared `<CarryForwardStepper>` component in Wave 0.
- **P-006:** `getOrderNumber(item)` = `item.original_order_number || item.order_number` field-name fallback — same pattern as `ClientReturnsPending.vue`. Normalise at the SDK adapter layer in Next.js; do not carry the `||` forward.
- **P-015:** `issueLabels` and `resolutionLabels` — hardcoded inline maps. Should be shared enum-derived constants used across AfterSales, ReturnsPending, and ClientReturnsPending.

---

## Migration notes

1. **Extract `<CarryForwardStepper>`** component (P-005). All 4 instances in internal and client portal pages should use the shared component.
2. **Normalise field names at adapter layer** (P-006). Define a discriminated union type: `UnloadedItem | AfterSalesCarryForward` with a canonical `order_number` field and `qty` field. Remove `||` fallbacks.
3. **Fix `consolidateByProduct` or remove it.** Either make grouping by `product_id + _type` work correctly across orders (as intended), or remove the wrapper and use `filteredItems` directly.
4. **TanStack Query with parallel fetching.** Replace `Promise.all([unloadedApi.list(), afterSalesApi.list()])` with two parallel `useQuery` hooks.
5. **Add reactive filter auto-reload.** In Next.js, encode filters in URL search params so that filter state is shareable and browser back/forward works. Auto-refetch on filter change.
6. **Add error states** for `loadAll()` and `loadFilters()` failures (P-002).
7. **Unify status filter** across both item types or provide separate status filters per tab.
8. **D-001:** `unloadedApi.list()` → `client.unloaded.list(...)`, `afterSalesApi.list()` → `client.afterSales.list(...)`, etc. via generated SDK.
9. **D-005:** All `InternalString`; Tamil can remain `""`.
