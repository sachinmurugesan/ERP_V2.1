# Internal After-Sales

**Type:** page (list, read-only)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/after-sales` → `AfterSales` (meta.title: `'After-Sales'`, meta.icon: `'pi-exclamation-triangle'`)
**Vue file:** [frontend/src/views/AfterSales.vue](../../../frontend/src/views/AfterSales.vue)
**Line count:** 328
**Migration wave:** Wave 5 (internal tracking)
**Risk level:** low — read-only page; all after-sales write endpoints guarded by `_require_admin` (ADMIN|SUPER_ADMIN|OPERATIONS|FINANCE)

---

## Purpose

Global read-only list of after-sales claims across all orders for INTERNAL users, with inline summary cards, three client-side filters, and a carry-forward stepper column that links to the originating order.

---

## Layout

### Outer container
`div.space-y-6`

**Zone 1 — Page header**
- `h1` "After-Sales Claims"
- Sub-text: "Track quality issues, resolutions, and carry-forward across all orders"
- Right: Refresh button (`pi-refresh` — spins while loading)

**Zone 2 — Summary cards** (`grid grid-cols-2 md:grid-cols-5 gap-3`)

| Card | Metric | Source |
|---|---|---|
| Total Claims | `summary.open + summary.in_progress + summary.resolved` | computed |
| Open | `summary.open` | amber left-border |
| In Progress | `summary.in_progress` | blue left-border |
| Resolved | `summary.resolved` | emerald left-border |
| Claim Value | `summary.total_claim_value` (formatted INR) + `summary.pending_carry_forward` count | rose left-border |

**Zone 3 — Filter bar** (`bg-white rounded-xl shadow-sm p-4`)
- Status select (All / Open / In Progress / Resolved)
- Issue Type select (All / Product Missing / Product Mismatch / Quality Issue / Price Mismatch)
- Resolution select (All / Replace Next Order / Compensate Balance / Partial Compensate / Partial Replacement)
- Result count label (right-aligned): "N claims"

**Zone 4 — Loading state**
Centred spinner `pi-spin pi-spinner` + "Loading claims..."

**Zone 5 — Claims table** (shown when `filteredItems.length > 0`)

| Col | Header | Content |
|---|---|---|
| 1 | Order | `item.order_number` — font-mono emerald-700; click → `goToOrder()` |
| 2 | Client | `item.client_name` |
| 3 | Factory | `item.factory_name` or `—` |
| 4 | Product | `item.product_code` (mono xs slate-400) + `item.product_name` (truncated max-w-[180px]) |
| 5 | Issue | `item.objection_type` — colour badge per `issueColor()` |
| 6 | Qty | `item.affected_quantity || 0` |
| 7 | Claim Value | `item.claim_value` — rose-600 if >0 else `—` |
| 8 | Resolution | `item.resolution_type` text or "Pending" slate-300 |
| 9 | Status | `item.status` badge via `statusColor()` |
| 10 | Carry Fwd | 3-step stepper (`STEPPER_STEPS`) with hover tooltip |

Row background: `bg-amber-50/20` for OPEN, `bg-rose-50/20` for `carry_forward_status === 'PENDING'`

Carry-forward hover tooltip (when `item.added_to_order_number` present):
- `item.added_to_order_number` in bold
- `stageCategory(item.added_to_order_status).label` coloured + `orderStageLabel(item.added_to_order_status)` text

**Zone 6 — Empty state**
`pi-check-circle` icon + "No active claims"

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `order_number` | `afterSalesApi.list()` | font-mono emerald-700 | |
| `client_name` | `afterSalesApi.list()` | text | |
| `factory_name` | `afterSalesApi.list()` | text or `—` | Added by backend `list_all_aftersales` — not in base `_serialize_item` |
| `product_code` | `afterSalesApi.list()` | mono xs | |
| `product_name` | `afterSalesApi.list()` | truncated | |
| `objection_type` | `afterSalesApi.list()` | colour badge | PRODUCT_MISSING / PRODUCT_MISMATCH / QUALITY_ISSUE / PRICE_MISMATCH |
| `affected_quantity` | `afterSalesApi.list()` | integer | |
| `claim_value` | `afterSalesApi.list()` | formatINR (inline) | Computed by backend: `selling_price_inr × affected_quantity` |
| `resolution_type` | `afterSalesApi.list()` | text | humanised via `formatType()` |
| `status` | `afterSalesApi.list()` | badge | OPEN / IN_PROGRESS / RESOLVED |
| `carry_forward_status` | `afterSalesApi.list()` | stepper icon | PENDING / ADDED_TO_ORDER / FULFILLED |
| `added_to_order_number` | `afterSalesApi.list()` | tooltip | |
| `added_to_order_status` | `afterSalesApi.list()` | tooltip | |
| Summary stats | `data.summary` | cards | `open`, `in_progress`, `resolved`, `pending_carry_forward`, `total_claim_value` |

**P-007 checklist:** No `*_cny`, `factory_price`, or `markup_*` fields observed in `_serialize_item` (backend) or rendered in the template. Backend `list_all_aftersales` (aftersales.py:904) only exposes `selling_price_inr`, `total_value_inr` (client-side INR pricing). Clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `fetchItems()` | `GET /api/aftersales/` | Populates `items` and `summary` |
| Refresh button | `fetchItems()` | `GET /api/aftersales/` | Reloads all items |
| Status / Issue / Resolution filter change | None (client-side only) | None | `filteredItems` computed re-evaluates |
| Row click | `goToOrder(item)` | None | Navigate to `/orders/{item.order_id}?tab=after-sales` |
| Hover on carry-forward stepper | Tooltip shown | None | Displays destination order + stage |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/aftersales/` | `afterSalesApi.list(params)` | `status`, `objection_type`, `resolution_type` (all optional) | Returns `{items, total, summary}`; filters also passed but `filteredItems` re-applies them client-side (double-filtering — see Known quirks) |

> Per D-001 (Option B): in Next.js this becomes `client.afterSales.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-exclamation-triangle`, `pi-refresh`, `pi-spin`, `pi-spinner`, `pi-list`, `pi-clock`, `pi-shopping-cart`, `pi-check`, `pi-check-circle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `items` | `ref([])` | `[]` | Raw item list from API |
| `summary` | `ref({open,in_progress,resolved,pending_carry_forward,total_claim_value})` | all 0 | Summary stat cards |
| `loading` | `ref(false)` | `false` | Spinner / refresh button disabled state |
| `statusFilter` | `ref('')` | `''` | Status select model |
| `objectionFilter` | `ref('')` | `''` | Issue type select model |
| `resolutionFilter` | `ref('')` | `''` | Resolution select model |

**Computed:**
| Name | Derived from | Purpose |
|---|---|---|
| `filteredItems` | `items` filtered by `statusFilter`, `objectionFilter`, `resolutionFilter` | Controls table rows |

**Constants (not reactive):**
- `statusOptions` — 4-entry array (All + 3 status values) — P-015
- `objectionOptions` — 5-entry array (All + 4 objection types) — P-015
- `resolutionOptions` — 5-entry array (All + 4 resolution types) — P-015
- `STEPPER_STEPS` — 3-entry array `[{label,icon}]` — **P-005 instance #3**

No `watch`, no `onUnmounted`.

---

## Permissions / role gating

- Route `/after-sales` has **no `meta.roles`** — all INTERNAL users reach this page.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- **Backend `GET /api/aftersales/`:** Router mounted with `dependencies=[Depends(get_current_user)]` in `main.py`. No per-endpoint role check on the list handler — any valid authenticated user can call it. However, RLS is applied inline:
  - CLIENT: only sees claims where `client_id == current_user.client_id` (and `show_after_sales` portal permission required)
  - FACTORY: only sees claims where `factory_id == current_user.factory_id`
  - INTERNAL: sees all claims (no filter applied)

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.aftersales.title` | "After-Sales Claims" | "" | `InternalString` |
| `internal.aftersales.subtitle` | "Track quality issues, resolutions, and carry-forward across all orders" | "" | `InternalString` |
| `internal.aftersales.refresh` | "Refresh" | "" | `InternalString` |
| `internal.aftersales.col_order` | "Order" | "" | `InternalString` |
| `internal.aftersales.col_client` | "Client" | "" | `InternalString` |
| `internal.aftersales.col_factory` | "Factory" | "" | `InternalString` |
| `internal.aftersales.col_product` | "Product" | "" | `InternalString` |
| `internal.aftersales.col_issue` | "Issue" | "" | `InternalString` |
| `internal.aftersales.col_qty` | "Qty" | "" | `InternalString` |
| `internal.aftersales.col_claim_value` | "Claim Value" | "" | `InternalString` |
| `internal.aftersales.col_resolution` | "Resolution" | "" | `InternalString` |
| `internal.aftersales.col_status` | "Status" | "" | `InternalString` |
| `internal.aftersales.col_carry_fwd` | "Carry Fwd" | "" | `InternalString` |
| `internal.aftersales.empty_title` | "No active claims" | "" | `InternalString` |
| `internal.aftersales.empty_body` | "All after-sales issues have been resolved or no claims have been filed yet." | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — centred spinner | |
| Empty | `filteredItems.length === 0 && !loading` | Yes — `pi-check-circle` + "No active claims" | Does not distinguish "no claims exist" from "all filtered out" |
| Load error | `catch (err)` in `fetchItems()` | **No — P-002 (swallow variant):** `console.error` only; `items = []`; empty state shown | No user-visible error indicator |

---

## Business rules

1. **Read-only list.** No mutations are initiated from this page. All writes (save, resolve, photo upload) occur on the order detail page's After-Sales tab.
2. **Filters are sent to the API AND re-applied client-side.** `fetchItems()` passes `status`, `objection_type`, `resolution_type` to the backend query; `filteredItems` computed also re-applies the same conditions on the returned `items` array. This is redundant but harmless — the client-side filter ensures immediate UI response without a round-trip when filter values change.
3. **Only original claims shown.** Backend `list_all_aftersales` filters `source_aftersales_id IS NULL` — carry-forward tracking records on destination orders are hidden. Only the original source claims appear.
4. **No pagination.** All claims are returned in a single response. High-volume deployments may hit performance limits.
5. **Summary stats come from the API**, not computed client-side — `summary` is populated from `data.summary` returned by the backend and reflects the full unfiltered dataset, not the current `filteredItems`.

---

## Known quirks

- **Double-filtering:** Filters are sent as API params (reducing the server response) AND re-evaluated client-side in `filteredItems`. If filters are changed without re-fetching (`fetchItems` is only called on mount and on the Refresh button, not on filter change), the client-side filter runs against a stale `items` array. There is no `watch` on filter changes to trigger a re-fetch.
- **Summary stats do not reflect applied filters.** The 5 summary cards always show the unfiltered totals from the API response, regardless of what filters the user has set.
- **Empty state conflates "no results" with "filter zero."** Filtering to a non-existent combination shows the same "No active claims" card as a genuinely empty database.
- **P-002 load error swallowed.** A network failure shows the empty state with no indication that load failed.

---

## Dead code / unused state

None observed — all refs and computed properties are used in the template.

---

## Duplicate or inline utilities

- **P-001:** `formatINR(val)` defined inline (lines 93–95). Identical function exists in `utils/formatters.js` as `formatINR` (or `formatCurrency`). Should import from shared util.
- **P-005 (instance #3):** `STEPPER_STEPS` constant and `stepperState(item)` function duplicated from `ClientAfterSales.vue` and `ClientReturnsPending.vue`. Fourth instance also exists in `ReturnsPending.vue` (internal). Extract to a shared `<CarryForwardStepper>` component in Wave 0.
- **P-015:** `statusOptions`, `objectionOptions`, `resolutionOptions` — hardcoded filter option arrays. Canonical values should come from shared enum definitions.
- `orderStageLabel(status)` and `stageCategory(status)` — inline order-status mapping functions. Likely duplicated in other order-related pages.

---

## Migration notes

1. **Import `formatINR` from shared utils** (P-001). Do not re-declare inline.
2. **Extract `<CarryForwardStepper>`** component (P-005). Accept `carry_forward_status` as prop; use in AfterSales, ReturnsPending (internal), ClientAfterSales, ClientReturnsPending. Hover tooltip should also be encapsulated.
3. **Fix filter-then-fetch pattern.** In the Next.js rebuild, use TanStack Query with filter state as query key dependencies so that filter changes auto-trigger a server re-fetch rather than relying on client-side `filteredItems`. Remove the redundant client-side filtering pass.
4. **Add error state** to replace the silent swallow of `fetchItems()` failure (P-002).
5. **Add pagination** (P-009 pattern). Backend `list_all_aftersales` returns all records; large deployments will see slow load.
6. **Summary card coupling.** Make clear in the UI (or fix) that summary counts reflect the full dataset, not the filtered view.
7. **Replace hardcoded option arrays** with enum-derived constants (P-015).
8. **D-001:** `afterSalesApi.*` → `client.afterSales.*` via generated SDK.
9. **D-005:** All `InternalString`; Tamil can remain `""`.
