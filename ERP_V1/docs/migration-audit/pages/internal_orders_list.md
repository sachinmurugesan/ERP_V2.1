## Metadata

| Field | Value |
|-------|-------|
| Type | page |
| Portal | internal |
| Route | `/orders` → `OrderList` (meta.title: 'Orders') |
| Source file | `frontend/src/views/orders/OrderList.vue` |
| Line count | 438 |
| Migration wave | Wave 7 |
| Risk | low |

---

## Purpose

Paginated master list of all internal orders. Provides stage-grouped filter tabs (9 groups, each covering one or more order statuses) with live count badges, a debounced text search, an 8-column summary table with client avatar, stage badge, CNY value, and per-row delete action. The only internal list page that implements true server-side pagination (as opposed to the P-009 `limit:N` truncation pattern seen in portal pages).

---

## Layout

Top-to-bottom single column within the internal sidebar layout:

1. **Page header** — "Orders" title + `totalItems` subtitle + "New Order" CTA button (→ `/orders/new`)
2. **Status filter tab bar** — 9 pill-shaped tabs with PrimeVue icons and count badges; horizontally scrollable; active tab highlights in emerald
3. **Toolbar row** — search input (full-width up to max-w-2xl) + "Filters" button + "Export" button (both non-functional — see Dead code)
4. **Table card** — `bg-white rounded-xl shadow-sm`
   - Loading skeleton (spinner + text)
   - Empty state (cart icon + "No orders found" + "Create your first order" link)
   - Data table: 8 columns (Order #, Client, Factory, Stage, Items, Value (CNY), Created, Actions)
   - Pagination bar (prev / numbered pages with ellipsis / next) — shown only when `totalPages > 1`
5. **Delete Order modal** — inline `fixed inset-0 z-50` overlay; reason textarea; Cancel + "Delete Order" buttons

---

## Data displayed

| Field | Source field | Format | Notes |
|-------|-------------|--------|-------|
| Order number | `order.order_number` | `font-mono` | Renders `'DRAFT'` when null |
| PO reference | `order.po_reference` | `text-xs text-slate-400` below order number | Optional |
| Client avatar | `order.client_name` | Initials + deterministic color | `getInitials` + `getAvatarColor` inline |
| Client name | `order.client_name` | `text-sm font-medium` | Falls back to `'—'` |
| Client location | `order.client_location` | `text-xs text-slate-400` | Optional sub-line |
| Factory name | `order.factory_name` | plain text | Falls back to `'—'` |
| Stage badge | `order.stage_number` + `order.stage_name` | Colored pill; `S{n} {name}` | Color from `stageStyles[stage_number]`; 14 stages mapped |
| Item count | `order.item_count` | integer | Center-aligned |
| Value (CNY) | `order.total_value_cny` | `toLocaleString()` with box icon | Hidden (`—`) when 0; shows factory cost aggregate — INTERNAL-only (G-010 CLOSED; field stripped from CLIENT responses) |
| Created date | `order.created_at` | `formatDate()` from `utils/formatters` | |
| Status tab counts | `statusCounts` dict from `/api/orders/status-counts/` | Badge numbers per tab | `getGroupCount` sums statuses per group |
| Pagination totals | `totalItems`, `page`, `perPage` | "Showing X to Y of Z results" | |

---

## Interactions

| Action | Trigger | Outcome |
|--------|---------|---------|
| Page mount | `onMounted` | `loadOrders()` + `loadStatusCounts()` in parallel |
| Status tab click | `setStatusFilter(value)` | Resets `page` to 1; calls `loadOrders()` |
| Search input | `@input` → `onSearchInput` | 400 ms debounce; resets `page` to 1; calls `loadOrders()` |
| Row click | `@click` on `<tr>` | `router.push(`/orders/${order.id}`)` |
| View button | `@click.stop` in Actions cell | `router.push(`/orders/${order.id}`)` (redundant with row click) |
| Delete button | `@click.stop` → `confirmDelete(order)` | Sets `deleteTarget`; shows delete modal |
| Delete modal confirm | "Delete Order" button → `executeDelete()` | `ordersApi.delete(id)` → `ordersApi.setDeletionReason(id, reason)` (if reason non-empty) → reload list + counts |
| Delete modal cancel | "Cancel" button or backdrop click | Closes modal; no action |
| Pagination prev | `goToPage(page - 1)` | Disabled when `page === 1` |
| Pagination next | `goToPage(page + 1)` | Disabled when `page === totalPages` |
| Pagination page number | `goToPage(p)` | Updates `page`; reloads |
| "Filters" button | `@click` — no handler | Dead button — see Dead code |
| "Export" button | `@click` — no handler | Dead button — see Dead code |

---

## Modals / dialogs triggered

| Modal | Trigger | Notes |
|-------|---------|-------|
| Delete Order (inline) | Delete button on any row | Inline `fixed inset-0 z-50` overlay; includes reason `<textarea>`; calls DELETE then PUT delete-reason; no `requireTypedConfirmation` — D-003 instance; should use `<ConfirmDialog destructive requireTypedConfirmation="DELETE" />` in Next.js |

---

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|--------|----------|-----|--------|-------|
| GET | `/api/orders/` | `ordersApi.list(params)` | `page`, `per_page`, `search?`, `status?` | Returns `{items, total}`; `status` param accepts comma-separated status values (used by tab groups) |
| GET | `/api/orders/status-counts/` | `ordersApi.statusCounts()` | None | Returns per-status count dict; loaded once on mount and after delete |
| DELETE | `/api/orders/{id}/` | `ordersApi.delete(id)` | — | CUSTOM manage_orders check (`orders.py:1053`) — OK per AUTHZ_SURFACE.md |
| PUT | `/api/orders/{id}/delete-reason/` | `ordersApi.setDeletionReason(id, reason)` | `reason` (string) | AUTH_ONLY — no role check (`orders.py:1145`); see Known quirks |

**Security cross-reference:**
- `GET /api/orders/` — AUTH_ONLY with `get_scoped_query` tenant scoping; INTERNAL users see all orders (no restriction); CLIENT/FACTORY users scoped to their own. INTERNAL-only page — no cross-tenant risk. OK.
- `GET /api/orders/status-counts/` — AUTH_ONLY (`orders.py:366`) — listed OK in AUTHZ_SURFACE.md.
- `DELETE /api/orders/{id}/` — CUSTOM manage_orders check — OK.
- `PUT /api/orders/{id}/delete-reason/` — AUTH_ONLY with no role check. Any authenticated user (including CLIENT/FACTORY with a valid token) can call this endpoint directly and set an arbitrary `delete_reason` on any order, regardless of whether the order has been deleted. Operational impact only (text field on a deleted record); no data exposure. LOW risk — not a new P-014 candidate (no sensitive data involved), but noted as a quirk.
- `order.total_value_cny` rendered in table — per D-004, this is factory cost aggregate (CNY). Visible to all INTERNAL users (ADMIN, OPERATIONS, FINANCE, SUPER_ADMIN). D-004 restricts `view_factory_real_pricing` to SUPER_ADMIN only, but `total_value_cny` on the order list has historically been visible to all INTERNAL roles. Clarify during Wave 0 whether OPERATIONS should see CNY values here — see Migration notes.

---

## Composables consumed

| Composable | Source | Used for |
|------------|--------|---------|
| `useRouter` | vue-router | `router.push()` for navigation to order detail and new order |

---

## PrimeVue components consumed

None — fully custom Tailwind table and inline modal. PrimeVue icons (`pi-*`) used via class names only (not as components).

---

## Local state

| Variable | Type | Initial | Purpose |
|----------|------|---------|---------|
| `orders` | `ref([])` | `[]` | Current page of order rows |
| `loading` | `ref(false)` | `false` | Table loading spinner |
| `search` | `ref('')` | `''` | Search input value |
| `statusFilter` | `ref('')` | `''` | Active status group value (comma-separated statuses or `''` for All) |
| `statusCounts` | `ref({})` | `{}` | Per-status count dict from `/api/orders/status-counts/` |
| `page` | `ref(1)` | `1` | Current page number |
| `perPage` | `ref(25)` | `25` | Page size (fixed — no UI control to change) |
| `totalItems` | `ref(0)` | `0` | Total count from last `ordersApi.list()` response |
| `totalPages` | `computed` | — | `Math.ceil(totalItems / perPage)` |
| `showDeleteModal` | `ref(false)` | `false` | Delete modal visibility |
| `deleteTarget` | `ref(null)` | `null` | Order object staged for deletion |
| `deleteReason` | `ref('')` | `''` | Cancellation reason text |
| `deleting` | `ref(false)` | `false` | Delete in-progress spinner |

---

## Permissions / role gating

- Route has no `meta.roles` — all INTERNAL users can access (portal guard enforces `user_type === 'INTERNAL'`).
- No client-side role check for the delete action — any INTERNAL user can open the delete modal. Backend `DELETE /api/orders/{id}/` enforces `manage_orders` (ADMIN|OPERATIONS inline check per AUTHZ_SURFACE.md).
- `total_value_cny` column visible to all INTERNAL roles. Per D-004, factory cost data should be restricted to SUPER_ADMIN|FINANCE for detailed views. The order list CNY column shows aggregated factory cost to ADMIN and OPERATIONS. **Clarification needed in Wave 0** — either strip the column for OPERATIONS/ADMIN (align with D-004) or explicitly document that aggregated CNY on the list view is acceptable for all INTERNAL roles (different from ledger-level detail).

---

## Bilingual labels (InternalString)

All strings English-only. No i18n infrastructure.

| Key | en | ta | Type |
|-----|----|----|------|
| `internal.orders_list.title` | "Orders" | "" | `InternalString` |
| `internal.orders_list.new_order` | "New Order" | "" | `InternalString` |
| `internal.orders_list.search_placeholder` | "Search by order number or PO reference..." | "" | `InternalString` |
| `internal.orders_list.filters_btn` | "Filters" | "" | `InternalString` |
| `internal.orders_list.export_btn` | "Export" | "" | `InternalString` |
| `internal.orders_list.col_order` | "Order #" | "" | `InternalString` |
| `internal.orders_list.col_client` | "Client" | "" | `InternalString` |
| `internal.orders_list.col_factory` | "Factory" | "" | `InternalString` |
| `internal.orders_list.col_stage` | "Stage" | "" | `InternalString` |
| `internal.orders_list.col_items` | "Items" | "" | `InternalString` |
| `internal.orders_list.col_value_cny` | "Value (CNY)" | "" | `InternalString` |
| `internal.orders_list.col_created` | "Created" | "" | `InternalString` |
| `internal.orders_list.col_actions` | "Actions" | "" | `InternalString` |
| `internal.orders_list.loading` | "Loading orders..." | "" | `InternalString` |
| `internal.orders_list.empty` | "No orders found" | "" | `InternalString` |
| `internal.orders_list.empty_cta` | "+ Create your first order" | "" | `InternalString` |
| `internal.orders_list.delete_title` | "Delete Order" | "" | `InternalString` |
| `internal.orders_list.delete_warning` | "This will cancel the order. The client will be notified." | "" | `InternalString` |
| `internal.orders_list.delete_reason_label` | "Reason for cancellation" | "" | `InternalString` |
| `internal.orders_list.delete_reason_placeholder` | "e.g. Client requested cancellation, duplicate order..." | "" | `InternalString` |
| `internal.orders_list.tab_all` | "All" | "" | `InternalString` |
| `internal.orders_list.tab_draft` | "Draft" | "" | `InternalString` |
| `internal.orders_list.tab_pricing` | "Pricing" | "" | `InternalString` |
| `internal.orders_list.tab_payment` | "Payment" | "" | `InternalString` |
| `internal.orders_list.tab_production` | "Production" | "" | `InternalString` |
| `internal.orders_list.tab_shipping` | "Shipping" | "" | `InternalString` |
| `internal.orders_list.tab_customs` | "Customs" | "" | `InternalString` |
| `internal.orders_list.tab_delivered` | "Delivered" | "" | `InternalString` |
| `internal.orders_list.tab_completed` | "Completed" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|-------|---------|-------------------|-------|
| Loading | `loading === true` | Yes — centered spinner + "Loading orders..." | |
| Empty — no results | `orders.length === 0 && !loading` | Yes — cart icon + "No orders found" + CTA link | Shown for both genuinely empty DB and zero search/filter results |
| Load error (orders) | `catch (err)` in `loadOrders()` | **No — P-002:** `console.error` only; table stays empty | |
| Load error (status counts) | `catch (err)` in `loadStatusCounts()` | **No — P-002:** `console.error` only; all tab badges show 0 | |
| Delete error | `catch (err)` in `executeDelete()` | **No — P-002:** `console.error` only; modal stays open; `deleting` spinner resets | User sees no feedback on delete failure |

---

## Business rules

1. **Status groups:** 9 tab groups map sets of status strings to human labels. The `status` query param sent to the backend contains the raw comma-separated status values (e.g., `'BOOKED,LOADED,SAILED,ARRIVED'` for the Shipping tab). The "All" tab sends no `status` param.
2. **Tab count derivation:** Each tab's badge is computed by `getGroupCount(groupValue)` — summing per-status counts from the `statusCounts` dict. The "All" tab badge shows `totalItems` (the total from the most recent `loadOrders()` call), not the sum of all `statusCounts` entries. These diverge while a filter is active.
3. **Pagination:** Real server-side pagination at `per_page: 25`. `ordersApi.list()` returns `{items, total}`. `totalPages = Math.ceil(total / 25)`. This is the positive model for list pages — contrast with P-009 (portal pages using `limit: 50` with no pagination UI).
4. **Search debounce:** 400 ms `setTimeout`; resets page to 1 on each new search.
5. **Delete flow — two calls:** `ordersApi.delete(id)` first (soft-delete + status change); then `ordersApi.setDeletionReason(id, reason)` only if reason is non-empty. The reason call is fire-and-forget — no separate error handling.
6. **`stageStyles` maps 14 stages (1–14) to Tailwind bg/text class pairs.** Stages 5–9 share the same blue-100/blue-700 style (Production through Sailing sub-stages). Fallback for unknown stage: `stageStyles[1]` (slate).
7. **Delete reason is optional** — the user can delete without providing a reason. Only the text trim check `deleteReason.value.trim()` gates the second API call.

---

## Known quirks

| # | Quirk | Impact |
|---|-------|--------|
| Q-1 | "All" tab badge shows `totalItems` (current filter's total), not the grand total | While a status filter is active and before clicking "All", the "All" badge displays the filtered count, not the true all-orders count. Confusing when toggling between tabs. |
| Q-2 | `PUT /api/orders/{id}/delete-reason/` is AUTH_ONLY — no role check | Any authenticated user with a valid token can set a `delete_reason` on any order (including orders that are not deleted). Operational text-field impact only; no data exposure. |
| Q-3 | Delete modal has no typed confirmation | Cancelling an order is a high-stakes irreversible action. D-003 specifies `requireTypedConfirmation="DELETE"` for such operations. Currently just a textarea for reason — user can delete with a single click after dismissing the reason field. |
| Q-4 | Delete error swallowed — modal stays open with spinner reset | User cannot tell whether the delete succeeded or failed. P-002 instance. |
| Q-5 | Pagination ellipsis renders for pages already in the visible window | When `totalPages` is small (e.g., 4), the `...` span condition (`p === page - 2 || p === page + 2`) can trigger for a page that was already rendered by the window condition (`p >= page - 1 && p <= page + 1`), causing a momentary duplicate-then-hidden button. Cosmetic. |
| Q-6 | View button in Actions column is redundant with row click | Both navigate to `/orders/${order.id}`. The view button exists to give a visible affordance but fires the same action. |
| Q-7 | `perPage` is fixed at 25 — no UI to change page size | Users cannot adjust the page size. Low impact for current dataset; note for Wave 0 UX decision. |

---

## Dead code / unused state

| Item | Notes |
|------|-------|
| "Filters" button (toolbar) | Renders with `pi-sliders-h` icon; no `@click` handler; no filter panel shown; entirely dead UI |
| "Export" button (toolbar) | Renders with `pi-download` icon; no `@click` handler; no export logic anywhere in file; entirely dead UI |

---

## Duplicate or inline utilities

- **`stageStyles` / `getStageStyle(stage)`** — inline stage-number-to-Tailwind-classes mapping for 14 stages. `utils/constants.js` already exports `getStageInfo()` (per 00_INVENTORY.md). These are parallel implementations with different shapes. **P-001 instance.** In Next.js, consolidate into a single `lib/orders/stageStyles.ts` that is the canonical stage-to-style map, consumed by both the list and detail pages.
- **`getInitials(name)`** — inline function; splits name on spaces, takes first character of each word, joins, uppercases, limits to 2. No equivalent in `utils/formatters.js`. Likely to recur wherever client/factory names appear (ClientList, OrderDetail, etc.). **P-020 candidate** — see Cross-cutting patterns.
- **`getAvatarColor(name)`** — inline deterministic color picker from name hash over `avatarColors[]` (8 hex values). Same recurrence risk as `getInitials`. **P-020 candidate.**
- `formatDate` imported from `utils/formatters` — correct, no duplication.

---

## Migration notes

1. **Replace delete modal with `<ConfirmDialog>`** — per D-003, use `<ConfirmDialog destructive requireTypedConfirmation="DELETE" consequenceText={...} onConfirm={executeDelete} />`. The current modal's reason textarea becomes a `preserveContext` field or a secondary input inside the dialog. For order cancellation (irreversible at business level), typed confirmation is warranted.
2. **Add error states** — surface delete failures and load failures to the user (P-002). Use a toast notification for delete error; inline banner for load error.
3. **Preserve real pagination** — this page correctly implements server-side pagination. Port using TanStack Query with `keepPreviousData` for smooth page transitions. Do not regress to a `limit:N` pattern.
4. **Extract stage styles** — consolidate `stageStyles` with `getStageInfo()` from `constants.js` into `lib/orders/stageStyles.ts`. Feed both `OrderList` and `OrderDetail` (and all 14 tab components) from this single source.
5. **Extract avatar utilities** — move `getInitials` and `getAvatarColor` to `lib/avatar.ts`; expose as a shared `<ClientAvatar name={name} size="sm" />` React component (P-020). Used by order list, client list, and potentially order detail.
6. **Implement Filters and Export** — both buttons are dead in Vue. Decide in Wave 0 whether to implement advanced filtering (date range, factory, client) and CSV/Excel export. If not implementing, remove the buttons; do not carry dead UI forward.
7. **Clarify `total_value_cny` visibility for OPERATIONS/ADMIN** — per D-004, factory cost data (CNY) has restricted visibility. The order list currently shows CNY aggregates to all INTERNAL roles. Wave 0 decision: either (a) strip the column for ADMIN/OPERATIONS and show only to SUPER_ADMIN/FINANCE, or (b) document that order-level CNY aggregates are acceptable for all INTERNAL users (distinct from ledger-level factory cost detail). Update the D-004 permission matrix accordingly.
8. **`PUT /api/orders/{id}/delete-reason/` AUTH_ONLY gap** — add `current_user` + manage_orders check to this endpoint in the Next.js backend so the role required to set a deletion reason matches the role required to delete. Low priority; operational impact only.
9. **D-001:** `ordersApi.list()` → `client.orders.list({page, perPage, search, status})` via generated SDK; `ordersApi.delete()` → `client.orders.delete(id)`; `ordersApi.setDeletionReason()` → `client.orders.setDeletionReason(id, reason)`.
10. **D-005:** All `InternalString`; Tamil can remain `""`.
