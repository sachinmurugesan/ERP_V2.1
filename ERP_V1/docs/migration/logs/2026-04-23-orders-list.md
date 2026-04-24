# Migration Log — Internal Orders List

## Header

- **Page name:** Internal Orders List
- **Date started:** 2026-04-23
- **Date completed:** _(pending)_
- **Audit profile:** [docs/migration-audit/pages/internal_orders_list.md](../../migration-audit/pages/internal_orders_list.md)
- **Vue source:** [ERP_V1/frontend/src/views/orders/OrderList.vue](../../../frontend/src/views/orders/OrderList.vue)
- **Reference image:** none — the user did not provide a screen reference. Design authority is the master design folder (`ERP_V1/Design/`); this is a constrained REDESIGN.
- **Branch:** `feat/migrate-orders-list`
- **Scope:** INTERNAL orders list only. Client portal (`ClientOrders.vue`) and factory portal (`FactoryOrders.vue`) are separate follow-up migrations.

---

## Phase 1 — Discovery findings

### What the audit profile says

`/orders` is a paginated master list of every internal order. Header row with filter tabs + search, data table below, numbered pagination at bottom, delete-with-reason modal. Accessible to every authenticated INTERNAL user (no `meta.roles`); portal-level guard blocks CLIENT and FACTORY users. Three `[UNCLEAR]` markers (P-002 error handling, D-004 CNY visibility, D-003 typed-confirmation).

### What the Vue source actually does

Confirmed at `frontend/src/views/orders/OrderList.vue`. **Audit ↔ Vue alignment is exact — no MAJOR drift.** The audit's three `[UNCLEAR]` markers describe real gaps that the Vue code exhibits:

- Errors on all four endpoints are only `console.error`d (no user-visible error UI).
- `total_value_cny` is shown to every INTERNAL role with no `RoleGate`.
- Delete modal uses a free-text reason input, not a typed-confirmation ("DELETE") pattern.

Two dead buttons render with no click handlers: **"Filters"** (`pi-sliders-h`) and **"Export"** (`pi-download`). They have been dead since the page was written; nobody has wired them.

### Columns (8, exhaustive)

| # | Header | Binding | Fallback | Notes |
|---|---|---|---|---|
| 1 | Order # | `order.order_number` | `'DRAFT'` | `font-mono`; `order.po_reference` as sub-line in muted text |
| 2 | Client | `order.client_name` | `'—'` | Avatar (initials + deterministic color via `getAvatarColor`); `order.client_location` as sub-line |
| 3 | Factory | `order.factory_name` | `'—'` | Plain text |
| 4 | Stage | `order.stage_number` + `order.stage_name` | silent slate for stages ≥15 | Inline Tailwind-class chip: `S{n} {name}`; same silent-fallback bug we fixed on the dashboard |
| 5 | Items | `order.item_count` | n/a | Integer, center-aligned |
| 6 | Value (CNY) | `order.total_value_cny` | `'—'` when 0 | `.toLocaleString()`; **flagged by D-004** |
| 7 | Created | `order.created_at` | n/a | `formatDate()` utility |
| 8 | Actions | — | — | Two icon buttons (eye = view, trash = delete); `@click.stop` |

### Filters (exhaustive)

1. **Status tab bar** — 9 pill tabs (All / Draft / Pricing / Payment / Production / Shipping / Customs / Delivered / Completed). Each tab maps to 0–5 `order.status` enum values as a comma-separated list. Live count badges fetched from `GET /api/orders/status-counts/`. Horizontally scrollable on narrow viewports.
2. **Search input** — debounced 400 ms; searches `order_number` and `po_reference`. Max width `max-w-2xl`, left-side search icon.

### Actions (exhaustive)

| Trigger | Handler | Destination |
|---|---|---|
| Click stage tab | `setStatusFilter(group.value)` | reload list with `status=<values>` |
| Type in search | `onSearchInput` (400 ms debounce) | reload list with `search=<query>` |
| Click "+ New Order" (page header) | `router-link` | `/orders/new` |
| Click row | `router.push(/orders/${id})` | order detail |
| Click row eye icon (`@click.stop`) | same as row click | order detail |
| Click row trash icon (`@click.stop`) | `confirmDelete(order)` | open delete modal |
| Confirm delete | `ordersApi.delete(id)` then optional `setDeletionReason(id, reason)` | reload list + status counts |
| Cancel delete / backdrop click | `showDeleteModal = false` | close modal |
| Prev / next / numbered page | `goToPage(p)` | reload list with new `page` |
| "Filters" button | **no handler** | dead code |
| "Export" button | **no handler** | dead code |

### Pagination

Real server-side pagination. `perPage` hardcoded `ref(25)`, no UI to change. Returns `{items, total}`. Pagination bar only renders when `totalPages > 1`. Numbered pages with ellipsis for gaps >2. No infinite scroll, no virtualised list.

### Backend endpoints used

| Endpoint | Usage | Response |
|---|---|---|
| `GET /api/orders/` | List with `{page, per_page, search?, status?}` | `{items, total}` — typed; items untyped (`unknown`) per OpenAPI |
| `GET /api/orders/status-counts/` | Tab count badges | `{DRAFT: {count}, PI_SENT: {count}, ...}` — untyped |
| `DELETE /api/orders/{id}/` | Soft-delete | 204 |
| `PUT /api/orders/{id}/delete-reason/` | Optional reason capture | 204 |

The SDK also exposes `POST /api/orders/`, `GET /api/orders/{id}/`, `PUT /api/orders/{id}/` and bulk helpers — not called by the list page itself but relevant for adjacent flows.

### Permissions

From the Layer 1 permission matrix (`packages/lib/src/auth/*.ts`) and backend `core/security.py`:

| Action | Roles | Gate |
|---|---|---|
| View `/orders` (page + list) | SUPER_ADMIN, ADMIN, OPERATIONS, FINANCE (+ CLIENT/FACTORY at their own portals) | Backend RLS via `get_scoped_query()`; Layer 1 `ORDER_LIST` key |
| Create order | SUPER_ADMIN, ADMIN, OPERATIONS | Backend POST decorator + Layer 1 `ORDER_CREATE` |
| Delete order | SUPER_ADMIN, ADMIN, OPERATIONS | Backend DELETE decorator + implicit `manage_orders` |
| See factory price / markup fields | SUPER_ADMIN, FINANCE (per D-004) | Backend field-stripping in `filter_for_role()` |

**CLIENT** users are blocked at the route level by the Vue portal guard; **FACTORY** users similarly blocked. Route `/orders` has no `meta.roles`, so every INTERNAL user (including VIEWER) currently reaches the page. Create and Delete will 403 from the backend for VIEWER (per the backend decorator).

### Layer 2 components — ready vs needs porting

| Component | Where | For orders list |
|---|---|---|
| `Icon` | apps/web ✓ | row actions (eye, trash, more), search, filter, plus, download |
| `KpiCard` | apps/web ✓ (from dashboard migration) | optional summary row |
| `RoleGate` | apps/web ✓ | gate "+ New order" / delete for VIEWER |
| `Sidebar` / `AppTopbar` | apps/web ✓ | page shell |
| `SparkLine` | apps/web ✓ | optional, probably skip |
| `Card`, `Button`, `Input` (shadcn) | apps/web ✓ | page chrome, filter inputs |
| `.tbl` / `.chip` / `.btn` CSS classes | globals.css ✓ | table + status chips |
| `StageChip` / `stageToneFor` | apps/web ✓ (from dashboard migration) | **reuse** — no new component needed |
| `client-avatar` composed | ui-gallery only | **NEEDS PORT** for Client column |
| `confirm-dialog` composed | ui-gallery only | **NEEDS PORT** for delete flow (or build inline) |
| `page-shell` composed | ui-gallery only | optional — layout already wraps pages |
| shadcn `table` / `badge` / `checkbox` / `skeleton` / `pagination` | missing | not strictly needed — `.tbl` and `.chip` cover it; skeletons and pagination can be small local helpers |

**Minimum porting needed for this migration:** `client-avatar` + `confirm-dialog`. Everything else is already available in apps/web or is covered by the design-system CSS.

### Stop conditions audit

- Audit `[UNCLEAR]` markers affecting core functionality? **No** — each has a safe default (log-only error, preserve current D-004 behaviour, drop typed-confirmation for now).
- Vue source MAJOR drift? **No** — 100% alignment.
- >8 columns? **No** — exactly 8.
- 14-stage workflow with no clear grouping? **No** — 9 meaningful groups already defined (All, Draft, Pricing, Payment, Production, Shipping, Customs, Delivered, Completed).
- Missing SDK endpoint? **No** — all four present.

Phase 1 clears all stop conditions. Proceed to Phase 2.

---

## Phase 2 — UX reasoning report

### User goal

One sentence: **An operations user opening `/orders` wants to triage — find the orders that need their attention right now (stuck stages, new drafts, recent inquiries) and jump into any order in one click — while keeping the list scannable when they're browsing the full catalogue of ~hundreds or thousands of orders.**

This is primarily a **scanning + filtering** page, not a data-entry page. Density matters. Visual rhythm matters. Fast keyboard access matters.

### Information hierarchy (ranked 1 → 5)

1. **Order status (Stage).** The thing a triage user cares about first: "where is this order." The stage chip is the load-bearing visual on each row.
2. **Order identity (Order #, Client).** Identifying which order belongs to which client is the second most important piece — you're rarely scanning by SKU, you're scanning by "whose order is this."
3. **Value / urgency signals (Value CNY, Created date).** Once you've found the rows that match your mental model ("Halder's overdue shipments"), value and age help you prioritise which to open.
4. **Detail fields (Factory, Items).** Useful context, especially for cross-factory triage; not critical for first-glance identification.
5. **Row-level actions.** Should be discoverable but never compete with the row content for attention. Kebab / ghost-icon button is correct.

The current Vue column order — Order#, Client, Factory, Stage, Items, Value(CNY), Created, Actions — is **close but not optimal** because Stage (#1 priority) is 4th. Proposal: **keep the current order** for this migration (lifting it verbatim is safer during a visual migration), but flag a follow-up UX study to consider promoting Stage to 2nd or 3rd column.

### Current layout assessment

**REDESIGN, constrained.** Per the task rulebook there's no reference screen, so the visual layer rebuilds against the design system. The Vue content and behaviour are correct and get lifted verbatim.

Specifically:
- The Vue page's content (columns, filters, actions, pagination, delete flow) is correct and reflects real user behaviour. **LIFT.**
- The Vue page's state handling (no error UI, silent zeros, no skeleton, two dead buttons) is below standard. **POLISH.**
- The Vue page's visual treatment (raw Tailwind class soup, flat white cards, Tailwind-inline stage colours) does not match the design system. **REDESIGN** using `.card` / `.tbl` / `.chip` / `.btn` from `globals.css`, plus `StageChip` from the dashboard migration.

### Filter placement

From the design-language synthesis (Finance + Inventory screens), the established pattern is **"filter row inside the card, above the table, no card-pad on the outer card."** Both screens use a flex header row with:

- left: search input with leading search icon
- middle: filter buttons (`btn btn-sm btn-ghost` with icon + label)
- right: count pills (`btn btn-sm btn-secondary` active / `btn-ghost` inactive)

The orders list has more filter state than Finance or Inventory (9 stage tabs + search, vs. 4-5 status pills + search). Direct translation would overflow horizontally.

**Proposal — two-row header inside the card:**
- **Row A:** 9 stage-group pill tabs, horizontally scrollable on narrow viewports, with live counts. (Matches current Vue behaviour — tabs with counts are good information density for triage.)
- **Row B:** search input (left, ≤640px wide) + optional "Advanced filters" button (ghost) + "Export" button (ghost, if we keep it). The current dead "Filters" button becomes either alive or removed (see "Awaiting decisions" below).

The "+ New order" primary action moves **out of the page card and into the `AppTopbar` right slot**, matching the Finance pattern ("+ New invoice") and the Topbar API. This frees vertical space above the table and gives every module page a consistent primary-action location.

### Status display (stage chip)

Reuse the `StageChip` + `stageToneFor` helpers already shipped in the dashboard migration. This guarantees consistency across pages and silently fixes the stages-≥15 fallback bug (the same bug existed on the orders list, inherited from the Vue `stageStyles` map). No new component to build.

### Actions

- **"+ New order":** Topbar right-slot primary button (`btn btn-primary btn-sm` with `plus` icon). Gated by `RoleGate` (ADMIN / OPERATIONS / SUPER_ADMIN).
- **Row click:** entire row navigates to `/orders/{id}` (preserve current Vue behaviour). Row is a button/link semantically for keyboard accessibility (Tab + Enter); focus ring on hover.
- **Row-level actions:** switch from two visible icon buttons (view + delete) to a single **kebab menu** (`moreV` ghost-icon button) with two options: "View" and "Delete…". Rationale: deletes are rare and dangerous; putting them one click deeper reduces accidental deletes without losing the capability. (This is the Settings screen's pattern — row kebab for tertiary actions.)
- **Bulk actions:** none. The current Vue has no bulk select; we do not add it in this migration. Flag for a future UX study.

### Delete flow

The current modal is a large centered card with a free-text reason textarea and a hard-coded red "Delete" button — low friction, no typed-confirmation guard. This is D-003 unclear territory.

**Proposal:** Port `confirm-dialog` (composed) from ui-gallery. Extend it with an optional `requireTypedConfirmation` prop (e.g., user must type "DELETE" to enable the destructive button). Apply the typed confirmation here. The reason textarea stays — it's useful institutional context even when not required.

Fallback if porting `confirm-dialog` is out of scope: build a minimal inline `DeleteOrderDialog` component as a local helper (same pattern we used for `skeletons.tsx` / `error-card.tsx` in the dashboard migration). Decision deferred to user — either is fine.

### Pagination

**No reference pattern exists in the design system** — none of the 9 design screens render pagination UI. This is a genuine design decision for this migration.

Options:

| Approach | Pros | Cons |
|---|---|---|
| **A. Numbered pagination** (current Vue) | Users know it; matches admin UX pattern | Visual noise; 9 buttons for 10 pages |
| **B. Prev / next + "Page X of Y"** | Compact, accessible | Less random access |
| **C. Load more button** | Clean, plays with infinite scroll | Loses sense of size; hard to return to specific row after reload |
| **D. Virtualised infinite scroll** | Best UX for 1000s of rows | Complex; hard to link to specific page state; anchor loss on reload |

**Recommendation: Option B — prev/next with "Page X of Y · Showing 26–50 of 1,248 results" label.** Matches the design language's visual-minimalism principle, stays accessible (keyboard + screen reader friendly), and lets us add numbered jumping later if users complain. Keep `perPage` hardcoded at 25 for this migration; revisit once we see real usage.

### Empty state

CTA pattern, matching the dashboard migration's convention:
- Icon (`shopping-cart` or `inventory`) in `--fg-muted`
- "No orders yet." as the primary message
- "Create your first order" as the CTA button (`btn btn-primary btn-sm` with `plus` icon) — gated by `RoleGate`
- A muted secondary line: "When you create an order it will appear here."

When there are orders but none match the current search/filter, show a different empty state: "No orders match this filter." + a "Clear filters" ghost button.

### Responsive

- **Desktop (≥ 1024 px):** full 8-column table.
- **Tablet (768–1023 px):** collapse Factory and Items columns (secondary data); keep Order#, Client, Stage, Value, Created, Actions.
- **Mobile (< 768 px):** switch to a **per-row card layout** instead of a horizontally scrolling table — a small `card card-pad-sm` per order with Order# + Client on row 1, Stage + Value on row 2, tap target is the whole card. This is a pattern we set up on the dashboard's Active Shipments section (the structure is ready to reuse).

### Role-based variations

- **SUPER_ADMIN / ADMIN / OPERATIONS:** full view, "+ New order" visible, delete visible.
- **FINANCE:** full view, **no "+ New order" button** (FINANCE doesn't create orders), **no delete button** (FINANCE isn't on the `manage_orders` list). View-only.
- **VIEWER:** view-only; no create, no delete. Stage, Value, Factory visible.
- **CLIENT:** blocked at portal guard — will be handled in the client portal migration. Flag only; do not special-case here.
- **FACTORY:** same as CLIENT — blocked; future migration.

The **CNY Value column visibility is the D-004 question**. Same situation as the dashboard migration. Preserve current Vue behaviour (visible to every INTERNAL role) and flag as a D-010 / D-004 review item. Do not introduce a new role gate here without explicit user decision.

### Accessibility notes

- Every clickable `<tr>` becomes a focusable row with keyboard activation (Enter / Space). The Vue version uses `@click` on `<tr>` which is not keyboard-accessible.
- Stage colour should not be the only signal. The chip always includes text (`S5 Packing`), and the `aria-label` on the chip includes stage number + name (fixed via `StageChip` already).
- Focus ring must be visible on tab through rows (use `outline` or `box-shadow` on `:focus-visible`).
- Pagination controls have `aria-current="page"` on the active page.
- Error banners have `role="alert"`.

### State coverage (required in the migrated version)

- **Loading:** skeleton rows for the table (~10 rows × 8 cells, using the existing `animate-erp-pulse` keyframe); tab counts show muted `—` until loaded.
- **Empty (no data):** CTA empty state as described above.
- **Empty (filtered):** "No orders match this filter" + "Clear filters" button.
- **Error (list):** inline `ErrorCard` with retry button inside the table card.
- **Error (delete):** toast notification + modal stays open so user can retry.
- **Permission-denied:** not needed at page level — route guard and backend RLS handle it.

### Awaiting user decision on

1. **Scope:** INTERNAL orders list only. CLIENT / FACTORY portals deferred. **Confirm.**
2. **"Filters" dead button:** three options — (a) remove, (b) wire it to the existing status tabs and search (redundant but explicit), or (c) build an advanced-filter drawer (date range, client multi-select, factory multi-select). Recommend **(a) remove** for this migration; propose (c) as a separate future task once we have real usage data.
3. **"Export" dead button:** (a) remove, (b) wire to a CSV / XLSX export endpoint. Backend has no export endpoint today. Recommend **(a) remove** for this migration; flag as `/api/orders/export` future backend work.
4. **Delete flow:** (a) port `confirm-dialog` from ui-gallery and extend with typed confirmation, (b) build a minimal local `DeleteOrderDialog` inline helper. Recommend **(b)** to keep the migration self-contained, matching the dashboard approach.
5. **D-004 / `total_value_cny` visibility:** preserve current behaviour (visible to every INTERNAL role) and log as review item, same as dashboard. **Confirm.**
6. **Row-level actions:** switch from two inline icons (view + delete) to a single kebab menu. **Confirm.**
7. **Pagination:** prev / next + "Page X of Y · Showing A–B of N" label instead of numbered pages. Keep `perPage = 25`. **Confirm, or counter.**
8. **Responsive breakpoints:** tablet collapses Factory + Items columns; mobile switches to per-row card. **Confirm, or counter.**
9. **Stage column position:** keep current order (4th) this migration, or move Stage to 3rd to put triage info closer to the front? Recommend **keep current** to minimise the chance of user confusion on migration day.
10. **First-ever-load behaviour:** we can render the dashboard-style WelcomeCard for the very first empty orders list. Recommend **no** — the empty state + CTA already covers first-run guidance.

### Recommendation

**REDESIGN (constrained).** Lift Vue content and behaviour verbatim; rebuild the visual layer against the design system; add proper state coverage and keyboard accessibility; fix the silent stage-≥15 fallback via the already-shipped `StageChip`; remove the two dead buttons; tighten the delete flow.

**STOP.** Awaiting user answers to the ten decision points above before producing a Phase 3 implementation plan.

---

## Phase 2 — user decisions captured

All 10 "Awaiting user decision" questions were answered on 2026-04-23 plus an additional VIEWER-403-fix instruction:

1. **Scope:** internal orders only. Client and factory portal orders logged as deferred.
2. **"Filters" dead button:** removed entirely; advanced-filter drawer deferred to `feat/advanced-order-filters`.
3. **"Export" dead button:** removed entirely; export deferred to backend task `feat/order-export`.
4. **Delete dialog:** local helper `DeleteOrderDialog` with typed confirmation ("DELETE") + optional reason textarea. `confirm-dialog` from ui-gallery NOT ported.
5. **`total_value_cny` visibility:** preserved for all INTERNAL roles; same D-004 review item as the dashboard migration.
6. **Row actions:** kebab menu (moreV ghost). FINANCE/VIEWER see View only; ADMIN/OPERATIONS/SUPER_ADMIN see View + Delete…
7. **Pagination:** Prev/Next + "Page X of Y · Showing A–B of N" label. `perPage = 25`. No numbered buttons.
8. **Responsive:** ≥1024 px full table; 768–1023 px hides Factory + Items; <768 px switches to per-row card.
9. **Stage column:** keep at 4th position; follow-up UX study flagged (promoting to 3rd may improve triage).
10. **Welcome card:** none on orders; empty-state CTA is sufficient.

**Additional decision (VIEWER-403 fix):** the "+ New order" button is wrapped in `<RoleGate permission={Resource.ORDER_CREATE}>` so VIEWER and FINANCE never see it — prevents silent 403s when the button is clicked.

---

## Phase 3 — Implementation notes

### Files created

**Page + orchestrator (`apps/web/src/app/(app)/orders/`):**

- `page.tsx` — async RSC. Reads `/api/auth/me` via `getServerClient()`, resolves the role, renders the page header + `RoleGate`-wrapped "+ New order" link, and mounts `<OrdersClient>` with `canCreate` / `canDelete` flags derived from `canAccess(role, Resource.ORDER_CREATE | ORDER_UPDATE)`.
- `_components/orders-client.tsx` — `"use client"` orchestrator. Owns `activeGroupId`, debounced `searchInput`, `page`, and `pendingDelete` state. Runs two TanStack Queries: orders list (no polling, refetches on filter/page change) and status-counts (`refetchInterval: 60_000`). Renders `FilterTabs`, search row, one of four body states (skeleton / error / empty / table), and `OrdersPagination`. Owns the `DeleteOrderDialog` mount/unmount.
- `_components/filter-tabs.tsx` — 9-tab pill row with live count badges. Active tab picks up a tone-specific solid fill.
- `_components/orders-table.tsx` — responsive container: desktop `.tbl`, mobile `.card-pad-sm` list. Injects one `<style>` block with the breakpoint media queries.
- `_components/order-row.tsx` — single `.tbl` row. `tabIndex=0`, keyboard-activatable (Enter/Space), row-wide click → `/orders/{id}`. Factory + Items cells carry `.orders-col-factory` / `.orders-col-items` classes hidden at 768–1023 px.
- `_components/mobile-card.tsx` — per-order card for <768 px viewports. Same tap target + kebab structure.
- `_components/order-kebab.tsx` — `moreV` ghost menu. `onDelete` optional; when omitted, the Delete menuitem is not rendered. Closes on outside click + Escape.
- `_components/delete-order-dialog.tsx` — typed-confirmation dialog. Inner `DeleteOrderDialogBody` always mounts fresh (parent conditional-renders with `open`) so state resets cleanly without a useEffect-based reset. Submits through `onConfirm(reason)`; surfaces inline error on rejection.
- `_components/stage-chip.tsx` — **copy** of `dashboard/_components/stage-chip.tsx`. Neutral chip for stages ≥15 — preserves the dashboard migration's fix.
- `_components/stage-groups.ts` — the 9 filter-group definitions (id / label / tone / status enum values) + `statusQueryFor(group)` + `groupCounts(raw)` helpers.
- `_components/types.ts` — `OrderListItem`, `OrderListResponse`, `StatusCountsRaw`, `StageGroupCounts`, `OrdersQueryParams`.
- `_components/formatters.ts` — `formatCNY`, `formatCount`, `formatDate`, `avatarBackgroundFor`, `initialsFor`.
- `_components/skeletons.tsx` — `OrderRowsSkeleton`, `FilterTabsSkeleton` (exported though only `OrderRowsSkeleton` is actively used — `FilterTabsSkeleton` kept for future use).
- `_components/empty-state.tsx` — `FreshEmptyState` + `FilteredEmptyState`. Fresh variant's CTA is suppressed when `canCreate` is false.
- `_components/error-card.tsx` — `OrdersErrorCard` with Retry button.
- `_components/pagination.tsx` — `OrdersPagination` with Prev/Next + "Page X of Y · Showing A–B of N".

**Next.js API route handlers (`apps/web/src/app/api/orders/`):**

- `route.ts` — GET /api/orders → proxies FastAPI `/api/orders/` using the session cookie; forwards `page` / `per_page` / `search` / `status` query params verbatim.
- `status-counts/route.ts` — GET /api/orders/status-counts → proxies FastAPI `/api/orders/status-counts/`; wraps response in `{ counts }` envelope.
- `[id]/route.ts` — DELETE /api/orders/[id] → proxies FastAPI DELETE; if `body.reason` is non-empty, best-effort follow-up `PUT /api/orders/{id}/delete-reason/`. Reason-capture failure does not fail the outer delete.

**Tests (2 files, 34 tests added):**

- `tests/app/orders-list.test.tsx` — 23 tests covering OrdersClient happy path, filters, debounced search, empty states (fresh + filtered), loading skeleton, error card with retry, OrderKebab role-gated delete, DeleteOrderDialog typed-confirmation + cancel + error surfacing, OrdersPagination disabled states + label, RoleGate integration for "+ New order", StageChip tones + ≥15 fallback, responsive column class + injected media query, FilterTabs standalone onSelect.
- `tests/api/orders-routes.test.ts` — 11 tests covering 401/200/502 for the three new route handlers plus the reason-capture best-effort path and the DELETE missing-id guard.

### Files modified

- `ERP_V1/nginx/nginx.dev.conf` — added `location = /orders { ... }` exact-match block (one location, between `/dashboard` and `/_next/webpack-hmr`).
- `ERP_V1/nginx/nginx.conf` — added `location = /orders { ... }` exact-match block in each of the three portal server blocks (admin / client / factory).
- `ERP_V1/docs/migration/MIGRATED_PATHS.md` — added `/orders` row; updated "Currently migrated" count to 3.
- `apps/web/tests/infra/nginx-config.test.ts` — extended `EXPECTED_MIGRATED_PATHS` with `"/orders"` so the infra tests enforce the new blocks.

### nginx config — deviation from the Phase 3 plan

The Phase 3 plan proposed adding **both** `location = /orders` (exact) **and** `location /orders/` (prefix) blocks. Only the exact-match block was added. Rationale: the prefix form would route `/orders/{id}` and `/orders/new` to Next.js, but those routes are explicitly out of scope for this migration and still live as Vue pages. Adding the prefix form would 404 every existing detail / new-order link. This deviation is what the strangler-fig pattern requires; when `/orders/{id}` migrates in a future task, that migration will add a path-scoped block.

### Test / lint / build results

- `pnpm lint` — clean (0 errors, 0 warnings). Two fixes needed along the way:
  1. `orders-client.tsx` originally reset `page` inside a `useEffect([activeGroupId, search])`; `react-hooks/set-state-in-effect` flagged this. Refactored to move the reset into the `setActiveGroupId` / `setSearchInput` action wrappers.
  2. `delete-order-dialog.tsx` originally reset its internal state (typed/reason/submitting/error) inside a `useEffect([open])`. Refactored to split the component — parent `DeleteOrderDialog` returns `null` when closed, inner `DeleteOrderDialogBody` mounts fresh each time the dialog opens so local state naturally initialises.
- `pnpm test` — 250 / 250 passing, 17 test files. +34 tests over the previous baseline (216 → 250).
- `pnpm build` — production build succeeded. `/orders` route size **6.87 kB / 124 kB first-load**. New `/api/orders`, `/api/orders/[id]`, `/api/orders/status-counts` routes present.

### Runtime verification (preview)

Logged in as `admin@harvesterp.com` via the Next.js dev server on :3100, navigated to `/orders`.

Observed:
- Page header ("Orders" + description) + role-gated "+ New order" CTA (visible for ADMIN).
- 9 filter tabs with live counts from `/api/orders/status-counts` — all 0 for this dev DB.
- Search input with leading search icon and the ellipsis placeholder.
- Fresh empty state ("No orders yet." + "Create your first order" CTA) since the dev DB has no orders.
- Sidebar + dashboard topbar render around the page.
- 0 browser console errors.

### Phase 2 design decisions preserved in implementation

- No sparklines / Revenue trend / Cash-position content (those remain reserved for a future `/finance-dashboard` migration).
- Stage chip reuses the dashboard migration's semantic mapping and neutral chip for stages ≥15.
- CNY value column is visible to every INTERNAL role — the D-004 review item is re-logged below, not resolved here.
- Row-level actions consolidated into a kebab (View + role-gated Delete…) — no visible inline icons, matching the Settings-screen reference pattern.
- Pagination is Prev/Next + "Page X of Y · Showing A–B of N" — no numbered buttons.
- Responsive breakpoints: ≥1024 px full table, 768–1023 px hides Factory + Items, <768 px switches to per-row card layout.

---

## Issues encountered and resolutions

### Issue 1: `react-hooks/set-state-in-effect` on filter / page reset

- **Date raised:** 2026-04-24 (Phase 3 lint pass).
- **Problem:** `orders-client.tsx` originally wrote `setPage(1)` in a `useEffect([activeGroupId, search])`. `eslint-config-next` v16's `react-hooks/set-state-in-effect` rule flagged this as a cascading-render anti-pattern.
- **Fix:** moved the reset to the action handlers. `setActiveGroupId` and `setSearchInput` are now small wrapper functions that set the raw state and also reset `page` to 1. No useEffect needed.

### Issue 2: Same lint rule on the delete-dialog reset

- **Date raised:** 2026-04-24.
- **Problem:** `delete-order-dialog.tsx` originally reset its four local states (`typed` / `reason` / `submitting` / `error`) inside a `useEffect([open])` when `open` flipped true.
- **Fix:** split into a thin `DeleteOrderDialog` that returns `null` when closed and a `DeleteOrderDialogBody` that mounts fresh each time the dialog opens. React's natural mount/unmount gives the clean state reset without a useEffect.

### Issue 3: jsdom doesn't apply media queries — duplicate text in tests

- **Date raised:** 2026-04-24 (initial test run).
- **Problem:** 15 tests failed with timeouts because `screen.findByText("AB-2026-0001")` matched both the desktop table row AND the mobile-card copy (jsdom renders both since no media queries hide either). The testing-library error message buried the real cause under "timeout".
- **Fix:** tests that assert rendered order rows now scope to the desktop table via `within(screen.getAllByRole('table')[0])` or use `findAllByText` where the count doesn't matter. The single `"responsive orders table"` test was left intentionally global since it asserts DOM classes + the injected media-query `<style>` (validating both layouts render and that the CSS would hide Factory/Items at the right breakpoint).

### Issue 4: Test mock pattern — TanStack Query vs async fetch shape

- **Date raised:** 2026-04-24.
- **Problem:** initial `vi.fn().mockImplementation(async (input, init) => ...)` returned Promises inside Promises in a way TanStack Query's test path didn't like — the `isLoading` flag never flipped.
- **Fix:** rewrote the fetch mock to use the dashboard-migration pattern — `mockImplementation((input, init) => Promise.resolve({ ok, status, json: () => Promise.resolve(payload) }))`. Also dropped `placeholderData: (prev) => prev` from the list query — unnecessary since the UI already renders a skeleton during initial load. Two changes together fixed all four data-dependent test failures.

### Issue 5: Unicode-escape-in-JSX-attribute

- **Date raised:** 2026-04-24 (visual verification).
- **Problem:** the search input's placeholder rendered literally as `Search by order number or PO reference\u2026` — a backslash-u2026 sequence rather than the `…` character. JSX attributes in double quotes don't interpret JS escape sequences; only JSX expressions do.
- **Fix:** replaced the escape with the literal `…` character in the attribute. One-line change, verified in preview.

---

## Proposed rules for CONVENTIONS.md

1. **Responsive-table rule.** When a list page needs both a desktop table and a mobile card layout, render both unconditionally and let CSS media queries pick. Rationale: simpler than JS-based viewport detection, and matches the pattern we landed on here + in the dashboard's Active Shipments section. (Unit tests should scope to one layout — `within(getAllByRole('table')[0])` or similar — to avoid duplicate-text matches in jsdom.)
2. **Local untyped-endpoint interface rule** (re-proposed from the dashboard migration). When a FastAPI endpoint has an untyped OpenAPI response (`"application/json": unknown`), declare a local `interface` under `_components/types.ts` derived from the legacy Vue consumer and use `client.getJson<T>()`. Both migrations have now done this; the pattern has proved.
3. **Delete-with-typed-confirmation rule.** Destructive row-level actions use a dialog with a typed confirmation ("type DELETE to confirm") and optional reason textarea. Matches the D-003 spirit that free-text reasons alone are insufficient for irreversible actions. Encoded in `delete-order-dialog.tsx`; would be worth a shared composed `DestructiveConfirm` component once a third page needs it.

---

## Open questions deferred

- **D-010 / D-004 review of `total_value_cny` dashboard + orders-list visibility.** Preserved as-is for INTERNAL roles. Same unresolved question from the dashboard migration. Owner: Finance / Sachin, before production.
- **`/orders/{id}` migration.** Out of scope for this task. nginx routes it back to Vue. A follow-up migration will take the detail page.
- **`/orders/new` migration.** Same — stays on Vue until migrated.
- **Client + factory portal orders migrations.** Flagged by Phase 1. Separate tasks, bilingual requirements apply to CLIENT portal.
- **Advanced filter drawer.** Replaces the removed "Filters" button. Future task: `feat/advanced-order-filters` — date range, multi-client, multi-factory.
- **CSV / XLSX export.** Replaces the removed "Export" button. Future task: backend `feat/order-export` + frontend wire-up.
- **Stage column position follow-up UX study.** Hypothesis: promoting Stage to 3rd column (ahead of Factory) improves triage speed. Needs real-user validation before adopting.

---

## Final status

- Tests passing: 250 / 250
- Build: passing
- Lint: clean (0 errors, 0 warnings)
- Preview verified: `/orders` renders end-to-end with a real login; empty-state + filters + search + CTA all wired.
- nginx config: updated in both `nginx.dev.conf` and `nginx.conf` (all three portal blocks). Infra test extended to enforce `/orders` presence.
- `MIGRATED_PATHS.md`: `/orders` row added; migrated count now 3.
- Committed on branch: `feat/migrate-orders-list`.
- Awaiting: user review, then merge.

---

## Issues encountered and resolutions

_(empty — populated as work progresses)_

---

## Proposed rules for CONVENTIONS.md (if any)

_(empty — populated toward end of migration)_

---

## Open questions deferred

_(see "Awaiting user decision on" above; items that remain unanswered after Phase 2 will be moved here)_

---

## Final status

_(empty — populated at end)_
