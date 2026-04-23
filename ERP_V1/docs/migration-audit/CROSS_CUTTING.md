# Cross-Cutting Patterns — HarvestERP Migration

Canonical reference. Consolidated from `CROSS_CUTTING_SCRATCH.md` at the close of the Wave 8 audit phase (2026-04-22). CROSS_CUTTING_SCRATCH.md is retained as provenance.

---

## Summary Table

| ID | Name | Status | Instances (confirmed) | Wave 0 action | Layer |
|---|---|---|---|---|---|
| P-001 | Duplicate utility functions | Open | 10+ (formatINR, fmtDate, status arrays, stageStyles, getInitials) | Extract to `@/lib/utils/` | Layer 1 |
| P-002 | Silent failure / inconsistent error rendering | Open | 15+ catch blocks | Mandatory `toast.error()` in all catch blocks | Layer 1 |
| P-003 | Client-side merge of separate API responses | Open | 1 (ClientLedger) | Server-side consolidation or TanStack Query merge | Layer 1 |
| P-004 | Portal permission enforcement asymmetry | **RESOLVED** (G-002, G-003) | 3 (all patched) | D-006 ratified — backend-authoritative | N/A |
| P-005 | Carry-forward stepper duplicated | Open | 4 (×2 client, ×2 internal) | Extract `<CarryForwardStepper>` Layer 2 component | Layer 2 |
| P-006 | Dual field name schema in merged data | Open | 1 (ClientReturnsPending) | Discriminated union SDK type; normalise at adapter | Layer 1 |
| P-007 | `factory_price` transmitted but not rendered | **RESOLVED** (G-007, G-010) | 2 (both patched) | Per-wave `*_cny` / `factory_*` grep in CLIENT serializers | N/A |
| P-008 | Route reuse without context differentiation | Open | 1 (FactoryOrders ×3 routes) | Un-merge into 3 Next.js pages + shared Layer 2 shell | Layer 2 |
| P-009 | `limit:N` hard ceiling without pagination UI | Open | 4 (FactoryOrders, ClientShipments, ClientProducts, ClientDashboard) | Single pagination strategy for all list pages | Layer 1 |
| P-010 | Search input without debounce | Open | 3 (FactoryOrders, OrderDraft ×2) | Shared `useSearch(fn, 300)` hook | Layer 1 |
| P-011 | Non-reactive route param capture | Open | 2 (FactoryOrderDetail, OrderDetail shell) | `useParams()` in Next.js app router | Layer 1 |
| P-012 | Dead stat counters in dashboard pages | Open | 2 (FactoryDashboard, ClientDashboard) | Do not render stat card without a confirmed data source | N/A |
| P-013 | Frontend field name mismatch (undefined API field) | Open | 2 (`factory_total_cny`, `s.phase`) | Generate field names from Pydantic schema in Next.js SDK | Layer 1 |
| P-014a | Missing inline role enforcement — mutation endpoints | **RESOLVED** (G-011–G-014) | 4 routers (all patched) | Require `current_user` on all mutation handlers at code-review time | N/A |
| P-014b | Read endpoints missing `filter_for_role` | Open — G-016 (LOW) | 1 (products search) | Grep handlers returning shared response models without `filter_for_role` | Layer 1 |
| P-015 | Hardcoded option lists in components | Open | 4+ (Wave 4 master-data forms) | Extract to `@/lib/constants/` or fetch from backend | Layer 1 |
| P-016 | Copy-pasted inline form utilities | Open | 3+ (Wave 4 forms) | Extract to `@/lib/form-utils.ts` | Layer 1 |
| P-017 | Near-identical sibling page components | Open | 1 pair (ClientLedger + FactoryLedger) | Extract shared `<LedgerPage>` Layer 2 component | Layer 2 |
| P-018 | Unimplemented stub routes in production nav | **RESOLVED** (D-008 ratified) | 1 (WarehouseStock) | Remove entirely; do not register | N/A |
| P-019 | Fixed-interval polling without backoff | Open | 1 (ExcelUpload.vue, 2s interval) | TanStack Query `refetchInterval` + backoff, or SSE | Layer 1 |
| P-020 | Duplicate `getInitials()` / `getAvatarColor()` avatar helpers | Open | 4 files (2 late-found by grep) | Extract to `@/lib/avatar-utils.ts` | Layer 1 |
| P-021 | Client-side Excel parsing via ExcelJS | Open | 1 (OrderItemsTab) | Move to Next.js Server Action | Layer 1 |
| P-022 | `highlightSection` prop + `scrollIntoView` | Open | 3 (ItemsTab, PaymentsTab, PackingTab) | Replace with URL hash routing (`#section-id`) | Layer 2 |
| P-023 | N+1 per-entity API fetch in sequential loop | Open | 2 (DashboardTab BOE, SailingTab progress) | `Promise.all` + bulk backend endpoints | Layer 1 |

**Status legend:** Open = must be addressed in Wave 0 or migration. RESOLVED = fix shipped; no migration action needed for the original concern. ⚠ conflict = contradicted evidence; requires source verification.

---

## Detailed Patterns

---

### P-001 — Duplicate utility functions

**Introduced:** Wave 2 (formatINR instance in ClientLedger)

**Description:**
Utility functions that exist in `frontend/src/utils/formatters.js` (or equivalent) are re-implemented inline in individual component files. This includes formatting functions, date helpers, status classification arrays, and UI helper maps.

**Confirmed instances:**

| Sub-type | File(s) | Notes |
|---|---|---|
| `formatINR` inline | `ClientLedger.vue` (Wave 2) + others | Formatter already in `utils/formatters.js` |
| `fmtDate` inline | `ClientShipments.vue` + others | Same formatter duplicated |
| Status array — PRODUCTION | `ProductionTab.vue`, `OrderDetail.vue` shell | Identical 7-status array; both define `PRODUCTION_STATUSES` independently |
| Status array — PACKING | `PackingListTab.vue` | 13-status `showPackingSection` array |
| Status array — BOOKING | `BookingTab.vue` | 10-status `isBookingStage` array |
| Status array — SAILING | `SailingTab.vue` + `ShippingDocsTab.vue` | 9-status `isSailingStage` — identical array in **two separate files** |
| `stageStyles` map | `OrderDetail.vue` shell + `OrderList.vue` | Same status-to-CSS-class map |
| `getInitials()` | See P-020 | Broken out as P-020 because of contradicted instance list |

**Source of truth for all statuses:** `backend/enums.py → OrderStatus`. All status arrays should derive from this enum exported as typed constants in the Next.js SDK.

**Wave 0 extraction plan:**
1. Create `src/lib/utils/formatters.ts` — `formatINR`, `formatDate`, `formatCNY`
2. Create `src/types/order-status.ts` — named exports: `PRODUCTION_STATUSES`, `PACKING_VISIBLE_STATUSES`, `BOOKING_VISIBLE_STATUSES`, `SAILING_VISIBLE_STATUSES`, `POST_PI_STATUSES`, `SHIPPING_STATUSES` — all derived from `OrderStatus` enum values in the OpenAPI spec
3. Create `src/lib/ui/stage-styles.ts` — `stageStyles` map
4. ESLint rule: ban `['STATUS_A', 'STATUS_B'].includes(...)` literals in component files; require named constant imports

**Layer:** Layer 1

---

### P-002 — Silent failure / inconsistent error rendering

**Introduced:** Wave 2 (ClientLedger raw `e.response.data.detail`)

**Description:**
API call error handling ranges from fully silent (`catch {}` with no logging) to raw backend error detail leaked to the user interface (`e.response.data.detail` rendered directly). No consistent catch-block convention exists across the codebase.

**Confirmed instances (by file):**

| File | Catch type | Severity |
|---|---|---|
| `PackingListTab.vue` | `console.error` × 6 (loadPackingList, updateFactoryReady, updatePackType, updatePallet, downloadExcel, downloadPDF) | Silent to user |
| `BookingTab.vue` | `console.error` × 2 (loadProviders, loadAddressData) | Silent to user |
| `SailingTab.vue` | `catch {}` with no logging in `loadShippingDocs` | Fully silent; causes `allDocsReceived()` to silently return false |
| `ClientLedger.vue` | Raw `e.response.data.detail` rendered | Backend error text exposed in UI |
| Various (Wave 4–7) | Mix of `console.error` and empty catch | 15+ total instances across audit |

**Wave 0 extraction plan:**
1. Create a shared `useApiError(err)` utility that: (a) logs to `console.error` in dev, (b) calls `toast.error(friendlyMessage)` for the user, (c) never leaks raw backend detail strings
2. Establish a mandatory catch-block template: `catch (err) { handleApiError(err, 'Context message') }`
3. Pre-migration sweep: grep for `catch (\w+) {` and `catch {}` across all component files; enumerate and fix before porting

**Layer:** Layer 1

---

### P-003 — Client-side merge of separate API responses

**Introduced:** Wave 2

**Description:**
A component fetches two separate API responses and merges them into a derived computed value on the client. This creates coupling between two asynchronous operations, adds client-side complexity, and prevents server-side pagination of the merged result.

**Confirmed instances:**

| File | Merge operation |
|---|---|
| `ClientLedger.vue` | `orders[]` + `payments[]` → `transactions` computed — sorted by date, mixed types |

**Wave 0 extraction plan:**
Option A (preferred): Add a server-side ledger endpoint `GET /api/clients/{id}/ledger/` that returns a unified, paginated transaction log.
Option B: Use TanStack Query's `useQueries` and merge the results in a shared data layer, not in the component.
Do not replicate the inline computed merge pattern in Next.js components.

**Layer:** Layer 1

---

### P-004 — Portal permission enforcement asymmetry

**Introduced:** Wave 2 | **Status: RESOLVED**

**Description:**
Portal permission flags (`show_payments`, `show_shipments`, etc.) were enforced by the frontend on some routes but not others, creating inconsistent access within the same permission model. Additionally, certain routes accepted portal users when they should have been blocked at the API layer.

**Resolution:**
- G-002 (Patch 6, 2026-04-21): ClientLedger route — `show_payments` bypass patched
- G-003 (Patch 7, 2026-04-21): Additional portal permission enforcement
- D-006 ratified: All portal permission enforcement must be backend-authoritative. Frontend visibility gates are cosmetic only.

**No migration action needed for the original concern.** D-006 governs all portal permission decisions in the Next.js rebuild.

---

### P-005 — Carry-forward stepper duplicated across pages

**Introduced:** Wave 2 (Batch 3)

**Description:**
A 3-step status stepper (Pending → In Order → Fulfilled) for carry-forward / after-sales items is independently implemented in four files. Each file defines an identical `STEPPER_STEPS` constant and `stepperState()` function.

**Confirmed instances:**

| # | File | Portal |
|---|---|---|
| 1 | `ClientAfterSales.vue` | Client |
| 2 | `ClientReturnsPending.vue` | Client |
| 3 | `AfterSales.vue` | Internal |
| 4 | `ReturnsPending.vue` | Internal |

**Wave 0 extraction plan:**
Extract to a `<CarryForwardStepper item={...} />` Layer 2 component. The component must:
- Accept `item` as prop
- Handle both `carry_forward_status` (after-sales items) and `status` (unloaded items) field names — or normalize to one at the adapter layer
- Include hover tooltip for `added_to_order_number`
- Work across both client and internal portals

**Layer:** Layer 2

---

### P-006 — Dual field name schema across merged data sources

**Introduced:** Wave 2 (Batch 3)

**Description:**
Two response types with different field names are merged into a single template-level list. The template handles mismatches via `||` fallbacks (`item.original_order_number || item.order_number`). This masks which field name is canonical and makes SDK type generation ambiguous.

**Confirmed instances:**

| File | Type A | Type B | Fallback pattern |
|---|---|---|---|
| `ClientReturnsPending.vue` | `UnloadedItem` (`original_order_number`, `quantity`) | `AfterSalesCarryForward` (`order_number`, `affected_quantity`) | `item.original_order_number \|\| item.order_number` |

**Wave 0 extraction plan:**
Define a discriminated union SDK type in TypeScript:
```typescript
type ReturnLineItem =
  | ({ _type: 'unloaded' } & UnloadedItem)
  | ({ _type: 'carry_forward' } & AfterSalesCarryForward)
```
Normalise field names at the API adapter layer before any component receives the data. Remove all `||` fallback field accesses.

**Layer:** Layer 1

---

### P-007 — `factory_price` transmitted to portal clients but not rendered

**Introduced:** Wave 2 (Batch 3) | **Status: RESOLVED**

**Description:**
The backend serializer included supplier cost fields (`factory_price`, `total_value_cny`) in responses delivered to CLIENT portal users. The Vue templates did not render these fields visually — but the raw data was present in the browser's memory and network tab.

**Resolution:**
- G-007 (Patch, 2026-04-21): `factory_price` stripped from CLIENT serializer in `list_unloaded_items`
- G-010 (Patch, 2026-04-22): `total_value_cny` stripped from CLIENT serializer (second instance)

**Ongoing Wave action (not yet complete):**
During every Wave audit, grep backend serializers for fields named `*_cny`, `factory_*`, or `markup_*` and verify each appears in `CLIENT_HIDDEN_FIELDS` if it carries factory/supplier-side cost data. Missing entries are candidates for a new Cluster G ticket.

---

### P-008 — Route reuse without context differentiation

**Introduced:** Wave 3

**Description:**
A single Vue component is mounted at multiple routes that conceptually represent distinct views. The component does not inspect the route's `meta` or `params` to filter or differentiate its content — all three routes render identically.

**Confirmed instances:**

| File | Routes | Expected differentiation | Actual |
|---|---|---|---|
| `FactoryOrders.vue` | `/factory-portal/orders`, `/factory-portal/production`, `/factory-portal/packing` | Each should filter by relevant order statuses | No filter applied; all show same unfiltered list |

**Wave 0 extraction plan:**
Un-merge into 3 distinct Next.js page components. Share a Layer 2 `<OrderListPage statusFilter={string[]} heading={string} />` component. Each page passes the appropriate `status__in` filter and heading. Backend `orders.py` already supports comma-separated `status` filter parameter.

**Layer:** Layer 2

---

### P-009 — `limit:N` hard ceiling without pagination UI

**Introduced:** Wave 3

**Description:**
API calls use a fixed `limit` or `per_page` parameter with no pagination UI. If the data set exceeds the limit, excess records are silently absent from the view. No "load more" or page control is shown.

**Confirmed instances:**

| File | Limit | Risk |
|---|---|---|
| `FactoryOrders.vue` | `limit: 50` | Factories with >50 orders silently see truncated list |
| `ClientShipments.vue` | `limit: 50` | Clients with >50 orders miss in-transit shipments beyond position 50 |
| `ClientProducts.vue` | `per_page: 50` | Clients with large product catalogs see truncated results |
| `ClientDashboard.vue` | `limit: 10` | Used for dashboard stats; low risk but undocumented ceiling |

**Wave 0 extraction plan:**
Decide on a single pagination strategy for all list pages in Wave 0 planning:
- Cursor-based pagination (preferred for large datasets)
- Offset + limit with a page control
- Infinite scroll for product browsing
Backend `ordersApi.list` already accepts `page` and `per_page` params. Apply consistently across all list endpoints.

**Layer:** Layer 1

---

### P-010 — Search input without debounce

**Introduced:** Wave 3

**Description:**
Search inputs fire API calls on every keystroke with no debounce. Each character typed dispatches a partial-string query to the backend.

**Confirmed instances:**

| File | Mechanism | Debounce |
|---|---|---|
| `FactoryOrders.vue` | `@input="loadOrders"` — raw Vue event handler | None |
| `OrderDraft.vue` | Inline `setTimeout` 300ms | Inline (no shared hook) |
| `OrderItemsTab.vue` | `addItemSearchTimer` inline `setTimeout` 400ms | Inline (no shared hook) |

**Wave 0 extraction plan:**
Create a shared `useDebounced(fn, delayMs)` hook (or use TanStack Query's `placeholderData` + debounced state). Apply 300ms universally to all search inputs. Remove all inline `setTimeout`/`clearTimeout` debounce patterns from components.

**Layer:** Layer 1

---

### P-011 — Non-reactive route param capture

**Introduced:** Wave 3

**Description:**
Route params (e.g., `:id`) are captured once at component setup time as a non-reactive constant. If Vue Router reuses the same component instance for navigation between two pages with the same route pattern (different param values), the captured value is stale and `loadData()` is not re-invoked.

**Confirmed instances:**

| File | Code | Risk |
|---|---|---|
| `FactoryOrderDetail.vue` | `const orderId = route.params.id` | Stale ID on in-app navigation to another order |
| `OrderDetail.vue` (shell) | Same pattern | Same risk; 14 sub-tabs all depend on `orderId` from the shell |

**Wave 0 extraction plan:**
In all Next.js detail pages, use `useParams()` from the app router. Params are automatically reactive and server-rendered. Never store params as a non-reactive const in a component or layout file.

**Layer:** Layer 1

---

### P-012 — Dead stat counters in dashboard pages

**Introduced:** Wave 3

**Description:**
Dashboard stat cards are wired to reactive refs that are declared but never populated by an API response. The counter always displays zero or a placeholder. The stat ref exists in anticipation of a backend endpoint that was never wired up.

**Confirmed instances:**

| File | Dead stat | Value always |
|---|---|---|
| `FactoryDashboard.vue` | `stats.pending_milestones` | 0 (never written by any API call) |
| `ClientDashboard.vue` | `stats.total_value` | `undefined` / not rendered (ref declared, no UI card) |

**Wave 0 extraction plan:**
Audit all dashboard stat cards before porting. For each stat: confirm a backend endpoint exists that populates it. If no endpoint exists and no implementation is planned, remove the stat card and its ref. Do not port dead counters.

**Layer:** N/A (dead code removal)

---

### P-013 — Frontend field name mismatch (template reads undefined API field)

**Introduced:** Wave 3

**Description:**
A template accesses a field using a stale or guessed name that does not match the actual key emitted by the backend serializer. Vue silently treats the undefined access as `null`/`undefined`; the template falls back to `'-'` or a falsy branch. The mismatch is invisible without reading the serializer directly.

**Confirmed instances:**

| File | Template reads | Backend emits | Effect |
|---|---|---|---|
| `FactoryOrders.vue` | `o.factory_total_cny` | `total_value_cny` (`serialize_order`) | "Total (CNY)" column always renders `'-'` |
| `ClientShipments.vue` | `s.phase \|\| s.sailing_phase` | One of the two (unclear which) | `\|\|` fallback masks which name is canonical |

**Wave 0 extraction plan:**
Generate TypeScript SDK types from the Pydantic schema using `openapi-typescript` or equivalent. Component templates must reference only the generated type's field names — never hand-code field names that could be guessed. For existing Vue code: read the actual serializer before referencing any field in a template.
Canonical names to verify: `total_value_cny` (orders list), `sailing_phase` vs `phase` (shipments — determine by reading `_serialize_shipment()`).

**Layer:** Layer 1

---

### P-014a — Missing inline role enforcement on mutation endpoints

**Introduced:** Wave 4 | **Status: RESOLVED**

**Description:**
Internal mutation API handlers (POST, PUT, DELETE, bulk operations) relied solely on router-level `dependencies=[Depends(get_current_user)]` for auth, which provides authentication only — not role authorization. Any valid JWT (CLIENT, FACTORY, or INTERNAL with any role) could call these mutations. The most severe instance allowed any authenticated user to rewrite portal permission flags for any client — defeating the entire D-006 enforcement model.

**Resolved instances (all patched):**

| Router | Patch | Severity |
|---|---|---|
| `backend/routers/products.py` — all mutation handlers | G-011, Patch 10 (2026-04-22) | HIGH |
| `backend/routers/factories.py` — create/update/delete | G-012, Patch 11 (2026-04-22) | HIGH |
| `backend/routers/clients.py` — `update_portal_permissions` | G-013, Patch 12 (2026-04-22) | **CRITICAL** |
| `backend/routers/shipping.py` — transport mutation handlers | G-014, Patch 13 (2026-04-22) | HIGH |

**Ongoing Wave 0 action:**
Before any new router is added in the Next.js backend, require inline `current_user` on all mutation handlers at code-review time. Do not rely solely on `dependencies=[]` for authorization. Detection pattern: `def ` handler with `db: Session = Depends(get_db)` and no `current_user` parameter on mutation endpoints.

---

### P-014b — Read endpoints missing `filter_for_role` call

**Introduced:** Wave 7 | **Status: Open (G-016, LOW)**

**Description:**
A sub-type of P-014 affecting read endpoints. The handler has no `current_user` parameter, so `filter_for_role()` / `filter_list_for_role()` is never called, and the full response model (including fields in `CLIENT_HIDDEN_FIELDS`) is returned to all callers regardless of their role. The risk is lower than mutation P-014 (no destructive action), but it creates a class of latent leaks: adding any sensitive field to a shared response model auto-exposes it to all roles with no filtering gate.

**Known instances:**

| Endpoint | File | Missing | Effect |
|---|---|---|---|
| `GET /api/products/search/` | `orders.py:358` | `current_user` + `filter_for_role` call | `notes` field (in `CLIENT_HIDDEN_FIELDS`) returned to all callers — G-016 |

**Wave 0 extraction plan:**
Grep for handlers that: (a) return a model where `CLIENT_HIDDEN_FIELDS` or `FACTORY_HIDDEN_FIELDS` would apply, AND (b) have no `current_user` parameter, AND (c) have no `filter_for_role` / `filter_list_for_role` call. Add `current_user` + appropriate filter call to each before migration launch.

**Layer:** Layer 1 (security rule, not a shared component)

---

### P-015 — Hardcoded option lists in components

**Introduced:** Wave 4

**Description:**
Dropdown options and enumerated choices (category lists, country selectors, unit-of-measure options, payment terms) are hardcoded as inline arrays inside component `<script setup>` blocks rather than fetched from the backend or imported from a shared constants module.

**Confirmed instances:**
Wave 4 master-data forms: `ProductForm.vue`, `FactoryForm.vue`, `ClientForm.vue`, `TransportForm.vue`. Exact option arrays not re-verified in this audit session — detail in individual profile files.

**Wave 0 extraction plan:**
For option lists that mirror backend enum values: generate from the OpenAPI enum schema and export from `@/lib/constants/`. For option lists that are frontend-only (UI labels, sort options): export from `@/lib/constants/ui.ts`. Remove all inline option array literals from component files.

**Layer:** Layer 1

---

### P-016 — Copy-pasted inline form utilities

**Introduced:** Wave 4

**Description:**
Small utility functions (pagination helpers, null-to-empty string conversions, GSTIN/PAN regex patterns) are copy-pasted across multiple form component files rather than shared through a single utility module.

**Confirmed instances:**
Wave 4 forms: `ClientForm.vue`, `FactoryForm.vue`, `ProductForm.vue` — all share copies of pagination logic, null-to-empty conversion for form binding, and Indian business identifier regex patterns. Exact line counts in individual profile files.

**Wave 0 extraction plan:**
Create `src/lib/form-utils.ts`:
- `toFormValue(v: unknown): string` — null/undefined → empty string
- `GSTIN_REGEX`, `PAN_REGEX`, `IEC_REGEX` — shared validation constants
- `usePagination(total, pageSize)` — shared pagination hook
Remove all duplicated copies from form components.

**Layer:** Layer 1

---

### P-017 — Near-identical sibling page components

**Introduced:** Wave 5

**Description:**
Two Vue page files are structurally identical (same layout pattern, same section sequence, same interaction model) with only entity-type differences (client vs factory), a small column count difference, and different auth requirements. The files will diverge over time without a shared abstraction.

**Confirmed instances:**

| File A | File B | Lines | Differences |
|---|---|---|---|
| `ClientLedger.vue` (172 lines) | `FactoryLedger.vue` (175 lines) | ~3 line difference | Entity type, 2 extra columns (currency, exchange_rate) in factory version, auth level |

**Wave 0 extraction plan:**
Extract a shared `<LedgerPage entity="client|factory" />` Layer 2 component. Accept as props:
- `entity`: `'client' | 'factory'`
- `columns`: column definition array
- `apiHook`: data fetching hook
- `downloadHook`: export hook
The filter bar, summary card grid, table footer, and download button are identical and must not be duplicated in Next.js.

**Layer:** Layer 2

---

### P-018 — Unimplemented stub routes in production navigation

**Introduced:** Wave 5 | **Status: RESOLVED (D-008)**

**Description:**
`WarehouseStock.vue` (11 lines, empty `<script setup>`, no API calls) was registered as a live navigation route (`/warehouse`, `meta.title: 'Warehouse Stock'`) visible in the sidebar. Users could navigate to it and see only a static placeholder description card.

**Resolution:**
D-008 ratified: Do not port `WarehouseStock.vue`. Remove the route and nav entry entirely in the Next.js rebuild. If warehouse management is implemented in the future, it should be added as a complete feature — never as a navigable stub.

---

### P-019 — Fixed-interval polling without backoff

**Introduced:** Wave 6

**Description:**
A component uses `setInterval` at a fixed interval (2 seconds) to poll a backend job-status endpoint. There is no exponential backoff, no maximum retry count, and no circuit-breaker if the job is stuck. Long-running jobs create a continuous stream of backend requests indefinitely.

**Confirmed instances:**

| File | Interval | Backoff | Timeout ceiling |
|---|---|---|---|
| `ExcelUpload.vue` | 2 seconds (`setInterval`) | None | None |

**Wave 0 extraction plan:**
Replace all polling patterns with:
- TanStack Query `refetchInterval` with exponential backoff (e.g., `Math.min(attempt * 2000, 30000)`)
- Or Server-Sent Events (SSE) for genuine real-time job progress

Establish a standard polling interval policy in Wave 0 architectural decisions. Detection: grep for `setInterval` in component files during Wave 6–8 audits.

**Layer:** Layer 1

---

### P-020 — Duplicate `getInitials()` / `getAvatarColor()` avatar helpers

**Introduced:** Wave 8 Session A (formalized) | **Instance count verified via source grep 2026-04-22**

**Description:**
Two avatar-helper functions — `getInitials(name)` and `getAvatarColor(name|role)` — are implemented inline in multiple component files for rendering avatar bubbles in order lists and query/message threads. Implementations share the same logical intent but differ slightly in signature and splitting strategy.

**Confirmed instances (source-verified):**

| # | File | Line | Functions | Notes |
|---|---|---|---|---|
| 1 | `src/views/orders/OrderList.vue` | 70 / 76 | `getInitials` + `getAvatarColor` | `getInitials`: space-split only. `getAvatarColor(name)`: hash → 8-color hex palette |
| 2 | `src/components/order/OrderItemsTab.vue` | 327 | `getInitials` only | Email-aware regex split `/[@\s.]/` — same body as ClientOrderItemsTab + QueriesTab |
| 3 | `src/components/order/ClientOrderItemsTab.vue` | 412 | `getInitials` only | **Late-found** — not in any Wave COMPLETE log. Email-aware regex split, identical to #2 |
| 4 | `src/components/order/QueriesTab.vue` | 449 / 457 | `getInitials` + `getAvatarColor` | **Late-found** — not in any Wave COMPLETE log. `getAvatarColor(role)`: role → CSS class (CLIENT→teal, else→indigo) — different signature/purpose from OrderList's `getAvatarColor(name)` |

**Implementation divergence to note:**
- `getInitials` in OrderList.vue uses `name.split(' ')` (space only); instances #2, #3, #4 all use `/[@\s.]/.filter(Boolean)` (email-aware). The email-aware version is correct for names that may be email addresses or dot-separated strings. Extraction should use the email-aware implementation.
- `getAvatarColor` has **two distinct contracts** across files:
  - OrderList.vue: `getAvatarColor(name: string) → string` — hash-based hex color from an 8-color palette
  - QueriesTab.vue: `getAvatarColor(role: string) → string` — role enum → Tailwind CSS class pair
  These serve different rendering models (inline `style` vs `:class`). Extraction must keep them as two named exports: `getAvatarHexColor(name)` and `getAvatarClass(role)`.

**Contradiction resolution (Wave 7 vs Wave 8A):**
- `WAVE_7_COMPLETE.md`: *"P-020 confirmed absent in OrderDraft"* — **CORRECT**. Grep confirms zero matches in `OrderDraft.vue`.
- `WAVE_8_SESSION_A_COMPLETE.md`: *"matches instances #1 (OrderList) and #2 (OrderDraft)"* — **INCORRECT**. The "instance #2" label was a misidentification. OrderDraft.vue has no `getInitials` or `getAvatarColor` definition.
- The grep also revealed two files not mentioned in any wave log: `ClientOrderItemsTab.vue` (#3) and `QueriesTab.vue` (#4). Both were outside the Wave 8 Session A profiled scope.

**Wave 0 extraction plan:**
Create `src/lib/avatar-utils.ts`:
```typescript
// Use email-aware split (correct for all display-name/email formats)
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.split(/[@\s.]/).filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0]?.slice(0, 2).toUpperCase() ?? '?'
}

// Name → deterministic hex color (for inline style= usage)
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444']
export function getAvatarHexColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// Role → Tailwind class pair (for :class= usage)
export function getAvatarClass(role: string): string {
  return role === 'CLIENT' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'
}
```
Import in: `OrderList.vue`, `OrderItemsTab.vue`, `ClientOrderItemsTab.vue`, `QueriesTab.vue`.

**Layer:** Layer 1

---

### P-021 — Client-side Excel file processing via ExcelJS

**Introduced:** Wave 8 Session A

**Description:**
Factory price list `.xlsx` files are parsed entirely in the browser using ExcelJS, including auto-detection of column layout from header keywords (`'Part No'`, `'UNIT PRICE'`, `'单价'`). ExcelJS adds ~100KB+ to the client bundle. Client-side file parsing is slower than server-side, provides no access control on parsed data, and exposes the parsing logic to reverse-engineering.

**Confirmed instances:**

| File | Function | Library |
|---|---|---|
| `OrderItemsTab.vue` | `handlePriceExcelUpload()` | ExcelJS (client bundle) |

**Note:** The PI *download* in the same component (`quotationsApi.downloadPI` → blob → temp `<a>` element) is the correct pattern for file downloads and should not be changed.

**Wave 0 extraction plan:**
Move `handlePriceExcelUpload()` to a Next.js Server Action:
1. Client POSTs the `.xlsx` `File` object to `POST /api/internal/orders/[orderId]/import-prices`
2. Server Action parses the file with ExcelJS (server-side), validates the result, and returns `{ items: [{ code, price }] }`
3. Client receives the validated array and applies it to the items state
4. Remove ExcelJS from `package.json` client dependencies entirely

**Layer:** Layer 1

---

### P-022 — `highlightSection` prop + `scrollIntoView` scroll pattern

**Introduced:** Wave 8 Session A (observed); Wave 8 Session B (formalized)

**Description:**
A parent shell or router passes a `highlightSection: String` prop to a sub-tab. The sub-tab watches the prop and uses `nextTick(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))` followed by a CSS flash animation (removed after ~2.5s) to scroll to and highlight a named section. This requires prop drilling from the parent shell through the tab interface.

**Confirmed instances:**

| # | File | Highlight targets |
|---|---|---|
| 1 | `OrderItemsTab.vue` | Multiple named sections |
| 2 | `PaymentsTab.vue` | Payment upload section |
| 3 | `PackingListTab.vue` | `upload` section |

**Wave 0 extraction plan:**
Replace with URL hash routing:
1. Each highlightable section gets an `id` attribute: `id="upload"`, `id="payment-upload"`, etc.
2. On component mount (or Next.js navigation with a hash), read `window.location.hash` and scroll to the matching element with `document.getElementById(hash)?.scrollIntoView()`
3. Optionally wrap in a shared `<HighlightScrollTarget id={string}>` Layer 2 component that handles the scroll + flash animation
4. Deep-link format: `/orders/123?tab=packing#upload` — no prop threading required

**Layer:** Layer 2

---

### P-023 — N+1 per-entity API fetch in sequential loop

**Introduced:** Wave 8 Session B (formalized; Wave 8 Session A BOE instance noted earlier)

**Description:**
A component loads a collection of entities (e.g., shipments), then iterates over each entity and makes a separate API call per entity in a sequential `for ... await` loop or via uncoordinated individual fetches. For N entities, this produces N serial round-trips before the UI can display the aggregated data.

**Confirmed instances:**

| # | File | Pattern | Impact |
|---|---|---|---|
| 1 | `OrderDashboardTab.vue` | `for (const shipment of shipments) { data = await customsApi.getBoe(shipment.id) }` | N serial BOE lookups after shipments load |
| 2 | `SailingTab.vue` | `for (const s of shipments) { await shipmentsApi.getProgress(s.id) }` in `loadAllProgress()` — sequential `for` loop | For 3 containers: 3 sequential round-trips before progress appears |

**Detection pattern for future profiles:**
```
for (const x of collection) { await api.call(x.id) }
```
Also flag: `.map(x => api.call(x.id))` without a corresponding `Promise.all`.

**Wave 0 extraction plan:**

**Short-term (migration stopgap):**
Convert sequential loops to `Promise.all`:
```typescript
const results = await Promise.all(shipments.map(s => api.getProgress(s.id)))
```

**Long-term (backend work):**
Add bulk endpoints returning a map keyed by entity ID:
- `GET /api/customs/boe/?shipment_ids=id1,id2,id3` → `{ [shipmentId]: BoeRecord }`
- `GET /api/shipments/progress/?order_id={id}` → `{ [shipmentId]: { percent, days_remaining } }`

**Layer:** Layer 1

---

## Meta-observations from Audit

### 1. Schema compliance checks catch factual contradictions, not just formatting

Wave 4 compliance check caught a claim in `internal_factories_list.md` that `DELETE /api/factories/{id}/` was "hard (permanent)" when the backend implementation is soft-delete (`deleted_at` + `is_active=False`). The error was cross-referenced against `SECURITY_BACKLOG.md` Patch 11 notes.

**Action for Task 2 (compliance sweep) and all future reviews:**
All compliance checks must include a content cross-reference step:
- Verify profile claims about delete semantics against the actual router implementation
- Verify role requirement claims against `AUTHZ_SURFACE.md` OK/RISK rows
- Verify security status claims against `SECURITY_BACKLOG.md` (patches shipped, status)
- Verify API endpoint details against the OpenAPI spec or router file
Pure formatting checks miss factual drift. Cross-reference checks find it.

### 2. Security patches surfaced by pattern recognition, not by targeted audit

G-011 through G-014 (4 HIGH patches, 1 CRITICAL) were found during the Wave 4 profile generation process — not by running a dedicated security scanner. P-014 was recognized as a pattern in the first router audited, and the pattern check was then applied to all subsequent routers. P-007 (factory cost data leak) similarly produced G-007 and G-010 across two waves.

**Implication for Next.js migration:** Security-critical patterns should be encoded as linting rules or code-review checklists, not discovered ad-hoc. The P-014 check (inline `current_user` on all mutation handlers) should be a required code-review item before any PR merge in the new codebase.

### 3. Status list proliferation is the highest-frequency P-001 sub-type

Across 8 waves, 8+ independent status array definitions were found for the order detail sub-tabs alone. Every sub-tab that conditionally renders based on order stage defines its own hardcoded status array. All derive from `backend/enums.py → OrderStatus`, which is the single source of truth. This is the most actionable P-001 item: generating typed constants from the OpenAPI spec eliminates the entire category.

### 4. The `isSailingStage` duplication (P-001 instance) illustrates cross-tab coupling risk

`SailingTab.vue` and `ShippingDocsTab.vue` both define identical 9-status `isSailingStage` arrays independently. If a new status is added to the backend enum and the SailingTab array is updated but `ShippingDocsTab` is not, the shipping documents section silently disappears for orders at the new status. This is a regression vector that shared constants eliminate entirely.

### 5. P-020 contradiction is a data quality issue in the audit record itself

Wave 7 explicitly verified the absence of `getInitials()` in `OrderDraft.vue`. Wave 8 Session A listed OrderDraft as instance #2. This contradiction exists in the audit documentation. The correct resolution is to verify the source file directly — not to accept either audit record at face value. This illustrates that multi-session audits can produce contradicted findings, and all claimed instance counts should be treated as minimum bounds, not exact counts, until verified against the source file.

### 6. D-003 (alert/confirm dialogs) count continues to grow; Wave 0 sweep is mandatory

Known instances accumulated across waves:
- Wave 8 Session A: 6 new `alert()` instances (OrderDetail shell ×2, OrderItemsTab ×4)
- Wave 8 Session B: 10+ new `alert()` instances in PackingListTab alone; 1 `confirm()` in BookingTab
- Total known: significant; exact count requires a pre-migration sweep

The browser `alert()` and `confirm()` APIs block the main thread and cannot be styled. Every instance must be replaced with a toast notification or modal dialog before the Next.js port.

### 7. Layer 1 vs Layer 2 split

- **Layer 1** (shared types, constants, utilities, hooks — not rendered): formatters, constants, form utils, avatar utils, error handling, route param hooks, debounce hooks, SDK types
- **Layer 2** (shared UI components — rendered): `<CarryForwardStepper>`, `<LedgerPage>`, `<OrderListPage>`, `<HighlightScrollTarget>`, and others

All P-0xx patterns map to one of these two layers or are resolved security/product-decision issues. Wave 0 work should be sequenced: Layer 1 extraction first (blocks nothing, unblocks everything), then Layer 2 components (depend on Layer 1 types and hooks).
