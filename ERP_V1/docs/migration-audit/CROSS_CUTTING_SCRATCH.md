# Cross-Cutting Patterns — Scratch Log

Running log of patterns surfaced during Wave 2 profile generation.
Will be consolidated into CROSS_CUTTING.md after all waves complete.

---

## Findings from Wave 2 Batch 2

### Pattern P-001: Duplicate utility functions
- client_ledger.md: formatINR duplicated inline (exists in utils/formatters.js)
- Action: Every profile generated from Batch 3 onward must check for duplicated utilities and list them in a new profile section called "## Duplicate or inline utilities". Write "None observed." if none.

### Pattern P-002: Inconsistent error-detail rendering
- client_ledger.md: raw e.response.data.detail rendered to user
- Action: Every profile from Batch 3 onward must check the error state and note whether raw backend errors are leaked. Add to "## Empty / error / loading states" section.

### Pattern P-003: Client-side data merging of separate API responses
- client_ledger.md: orders[] + payments[] merged into transactions computed
- Action: Note in migration notes for Next.js rebuild — candidate for server-side consolidation or TanStack Query merge.

### Pattern P-004: Portal permission enforcement asymmetry
- client_ledger.md: show_payments permission bypassed on /ledger route while respected on Payments tab
- RESOLVED: PORTAL_PERMISSIONS_AUDIT.md produced 2026-04-21. Full G-cluster findings logged in SECURITY_BACKLOG.md. G-002, G-003, G-004 patched. G-001, G-005, G-006 deferred to Wave 0.

---

## Findings from Wave 2 Batch 3

### Pattern P-005: Carry-forward stepper duplicated across pages
- `ClientAfterSales.vue` and `ClientReturnsPending.vue` both define identical `STEPPER_STEPS` constant and `stepperState` function.
- The 3-step stepper (Pending → In Order → Fulfilled) is a shared UI concept that should be a single `<CarryForwardStepper>` component.
- Action: Extract to shared component in Wave 0. Accept `item` (or `stepIndex: 0 | 1 | 2 | -1`) as prop. Used in at minimum 2 client portal pages; verify whether `ClientOrderDetail.vue` after-sales tab also duplicates this.

### Pattern P-006: Dual field name schema across merged data sources
- `ClientReturnsPending.vue` merges `UnloadedItem` (fields: `original_order_number`, `quantity`) and `AfterSalesCarryForward` (fields: `order_number`, `affected_quantity`) into a single list.
- Template handles mismatch via `||` fallbacks: `item.original_order_number || item.order_number`, `item.affected_quantity || item.quantity`.
- Action: Define a discriminated union SDK type in the Next.js rebuild. Normalise field names at the adapter layer. Do not carry the `||` fallback pattern forward.

### Pattern P-007: `factory_price` transmitted but not rendered
- `backend/routers/unloaded.py` `list_unloaded_items` serialises `factory_price` into every response row.
- `ClientReturnsPending.vue` receives the field in `unloadedItems` but never renders it.
- `factory_price` is received by the client browser as dead data — a pricing data exposure even though no visual leak exists.
- **Status:** First instance patched by G-007 (2026-04-21). Second instance (`total_value_cny` in CLIENT serializer) patched by G-010 (2026-04-22). Pattern now recognized as recurring — added to Wave-audit security checklist.
- Action: Strip `factory_price` from CLIENT/FACTORY responses in `list_unloaded_items` after auth is added (G-007 patch). In the Next.js SDK type for `UnloadedItem` exposed to CLIENT callers, omit `factory_price`.
- Action: During every Wave audit, Claude Code must grep the backend serializer for fields named `*_cny`, `factory_*`, or `markup_*` and verify each appears in `CLIENT_HIDDEN_FIELDS` if it carries factory/supplier-side cost data. Missing entries are candidates for a new Cluster G ticket.

_(These two Wave 2 items were formalized into numbered patterns during Wave 3 — see P-009 and P-013 below.)_

### [→ P-009] `ordersApi.list` limit:50 client-side filtering risk (original Wave 2 finding)
- `ClientShipments.vue` fetches `ordersApi.list({ limit: 50 })` then filters client-side to `SHIPPING_STATUSES`.
- If a client has >50 total orders, in-transit orders beyond position 50 are silently absent from the shipment view.
- Same underlying issue as `ClientProducts.vue` (per_page: 50 with no UI control).
- Formalized as **P-009** (cross-portal limit ceiling) in Wave 3. See Wave 3 findings below.

### [→ P-013] `s.phase || s.sailing_phase` field ambiguity in shipping (original Wave 2 finding)
- `ClientShipments.vue` reads `s.phase || s.sailing_phase` throughout the detail panel.
- Indicates either a renamed field not fully propagated to the frontend, or two co-existing field names in the serialiser.
- Extended to include `o.factory_total_cny` vs `total_value_cny` mismatch found in Wave 3.
- Formalized as **P-013** (frontend field name mismatch) in Wave 3. See Wave 3 findings below.

---

## Findings from Wave 3

### Pattern P-008: Route reuse without context differentiation
- `FactoryOrders.vue` is mounted at three routes: `/factory-portal/orders` (meta.title: 'Orders'), `/factory-portal/production` (meta.title: 'Production'), `/factory-portal/packing` (meta.title: 'Packing').
- Component ignores `meta.title` entirely — page heading is always hardcoded "Assigned Orders".
- No status filter is applied by route context. Production route does not filter to `PRODUCTION_*` statuses; Packing route does not filter to `BOOKED`. All three views are identical.
- Action: Un-merge into 3 distinct Next.js pages sharing a Layer 2 `<OrderListPage statusFilter={...} />` component. Each page should pass `status__in` to the backend query and render its own contextual heading. Backend already supports `status` as a comma-separated filter (orders.py:341-344).

### Pattern P-009: `limit:N` hard ceiling without pagination UI (cross-portal)
- `FactoryOrders.vue`: `ordersApi.list({ limit: 50 })` — no pagination, no "load more".
- Also seen in Wave 2: `ClientShipments.vue` (limit:50), `ClientProducts.vue` (per_page:50), `ClientDashboard.vue` (limit:10 used for stats).
- Pattern spans both portals. Factories or clients with >50 orders silently see truncated data.
- Action: Adopt a single pagination strategy for all list pages in the Next.js rebuild. Options: cursor-based (preferred for large datasets), offset+limit with a page control, or infinite scroll. Decide in Wave 0 and enforce consistently. Backend `ordersApi.list` already accepts `page` and `per_page` params.

### Pattern P-010: Search input without debounce
- `FactoryOrders.vue`: `@input="loadOrders"` fires a new API call on every keystroke — no debounce.
- Each character typed sends a partial-string search query to the backend.
- Action: Apply 300ms debounce universally to all search inputs in the Next.js rebuild. Recommend a shared `useSearch(fn, 300)` hook or TanStack Query's built-in `placeholderData` + debounced state pattern.

### Pattern P-011: Non-reactive route param capture
- `FactoryOrderDetail.vue`: `const orderId = route.params.id` captures the param once at setup time.
- If Vue Router reuses the component instance for navigation between two order detail pages (same route, different `:id`), `loadOrder()` does not re-fire and stale data persists.
- Action: In all detail pages in the Next.js rebuild, use the framework's param-reactive patterns (`useParams()` in Next.js app router, or `watch(() => route.params.id, ...)` in Vue). Never capture params as a non-reactive const.

### Pattern P-012: Dead stat counters in dashboard pages
- `FactoryDashboard.vue`: `stats.pending_milestones` is declared and rendered but never written — always 0.
- Also seen in Wave 2: `ClientDashboard.vue` `stats.total_value` — declared, never written, no corresponding UI card.
- Pattern: Dashboard stat refs are stubbed in anticipation of future backend endpoints that were never wired up.
- Action: In the Next.js rebuild, do not render a stat card unless the value has a confirmed data source. Remove or implement all dead stat refs before merge.

---

## Findings from Wave 4 Batch 1

### Pattern P-014: Missing inline role enforcement on internal mutation endpoints
- `backend/routers/products.py`: All mutation endpoints (`POST /`, `PUT /{id}/`, `DELETE /{id}/`, `POST /bulk-delete/`, `POST /bulk-update/`, `POST /bin/permanent-delete/`, `POST /bin/restore/`, `POST /{id}/set-default/`, `POST /remove-duplicate-images/`, `POST /{id}/images/upload/`, `DELETE /{id}/images/{imageId}/`) have only `db: Session = Depends(get_db)` — no `current_user` parameter at handler level.
- `backend/routers/factories.py`: Same pattern — `create_factory`, `update_factory`, `delete_factory` all have no `current_user` parameter.
- Both routers are mounted with `dependencies=[Depends(get_current_user)]` in `main.py` (auth required) but that provides authentication only — not role authorization.
- **Impact:** Any valid JWT (CLIENT, FACTORY, or INTERNAL) can call these mutations directly. A CLIENT user from the client portal could bulk-delete the entire product catalog, create bogus products, or delete factories.
- **AUTHZ_SURFACE.md claim ("CUSTOM inline ADMIN|OPERATIONS check (writes). All OK.") is inaccurate** — no such checks exist in the current code for either file.
- Also: Review endpoints (`pending-review-list`, `approve`, `reject`, `map`) have `current_user` but no ADMIN role check — any INTERNAL user can approve product requests.
- **Status:** G-011 (products.py — CLOSED 2026-04-22), G-012 (factories.py — CLOSED 2026-04-22), G-013 (clients.py — CLOSED 2026-04-22), G-014 (shipping.py transport handlers — CLOSED 2026-04-22). All discovered P-014 instances across the Wave 1–4 audited routers are now patched.
- **First CRITICAL-severity instance of P-014:** `clients.py update_portal_permissions` (Patch 12, G-013). This is the most severe instance because the unguarded endpoint allowed any authenticated user — including a CLIENT portal user — to rewrite their own portal permission flags, defeating the entire D-006 enforcement model. All prior patches (1–11) could be circumvented via a single `PUT /api/clients/{id}/portal-permissions/` call.
- **Remaining risk:** Routers not yet covered by wave profiles may still exhibit P-014. Specifically: any router in `backend/routers/` mounted with `dependencies=[Depends(get_current_user)]` but not yet audited. The pattern check during each Wave audit (grep for `def ` + `db: Session = Depends(get_db)` with no `current_user` param on mutation handlers) must continue as waves proceed.
- Action (Wave 0): Before any new router is added in the Next.js backend, require inline `current_user` on all mutation handlers at code-review time. Do not rely solely on router-level `dependencies=[]` for authorization.

### P-014 variant — Read endpoints without `current_user` driving `filter_for_role`

Primary P-014 concerned mutation endpoints missing role checks entirely. A related but distinct variant: read endpoints that rely solely on router-level auth AND return data whose response shape should vary by role. These endpoints need `current_user` not for authorization (router-level `Depends(get_current_user)` handles that) but to drive `filter_for_role` for response field stripping.

**Known instances:**
- `GET /api/products/search/` (`orders.py:358`) — returns `ProductOut` with no `current_user` param; `filter_for_role` never called; `notes` (in `CLIENT_HIDDEN_FIELDS`) returned to all callers. See G-016.

**Risk profile:** Lower than primary P-014 (no destructive action possible), but creates a class of latent leaks: adding any sensitive field to a shared response model (`ProductOut`, etc.) auto-exposes it to all roles with no filtering gate. Affects response-model evolution safety more than current-state security.

**Wave 0 action:** Grep for handlers that (a) return a model where `CLIENT_HIDDEN_FIELDS` or `FACTORY_HIDDEN_FIELDS` would apply, and (b) have no `current_user` parameter and no `filter_for_role` / `filter_list_for_role` call. Add `current_user` + appropriate filter call to each. Candidate grep: `def .*db: Session = Depends(get_db)\):` with no `current_user` on the same line, in routers that return shared response models.

### Pattern P-013: Frontend field name mismatch — template reads undefined API field
- `FactoryOrders.vue` reads `o.factory_total_cny`; `serialize_order` (`orders.py:231`) emits `total_value_cny`. Field is `undefined` in every response row — "Total (CNY)" column always renders `'-'` with no runtime error or warning.
- `ClientShipments.vue` reads `s.phase || s.sailing_phase` — one of the two names is undefined; the `||` fallback masks which field the backend actually emits.
- Pattern: template accesses a stale or guessed field name; the live API serializer uses a different name; Vue silently treats the access as `undefined` and the template falls back to `'-'` or `null`. This is invisible without reading the serializer.
- Security note: in the `factory_total_cny` case, the actual serialized field `total_value_cny` is NOT in `CLIENT_HIDDEN_FIELDS` — see G-010.
- Action: For each affected field, read the serializer and use only the canonical field name. In the Next.js SDK, generate field names from the Pydantic schema — do not hand-code them in templates. Canonical names: `total_value_cny` (orders list), determined by reading `_serialize_shipment()` (shipments).

---

## Findings from Wave 5

### Pattern P-017: Near-identical sibling page components
- `ClientLedger.vue` (internal, 172 lines) and `FactoryLedger.vue` (175 lines) are structurally identical: filter bar → no-selection prompt → loading → summary cards (3) → ledger table → empty state. The only differences are entity type (client vs factory), two extra columns (currency, exchange_rate) in the factory version, and auth level.
- Action: In Wave 0, extract a shared `<LedgerPage entity="client|factory" />` Layer 2 component. Accept entity type, column definitions, API hook, and download hook as props. Do not duplicate the filter bar, summary card grid, table footer, or download button logic.

### Pattern P-018: Unimplemented stub routes registered in production navigation
- `WarehouseStock.vue` (11 lines) has an empty `<script setup>`, a static card, and no API calls. Its route `/warehouse` (meta.title: 'Warehouse Stock') is registered in the router and appears in the sidebar navigation. Users can navigate to it and see only a placeholder description.
- Action: Before the Next.js migration, decide: implement or remove. A stub route that appears navigable in production is misleading. In the Next.js rebuild, do not carry forward unimplemented routes — either implement the feature or mark it as a future navigation item that is hidden/disabled until ready.

### P-005 instances #3 and #4 confirmed
- `AfterSales.vue` (internal): `STEPPER_STEPS` + `stepperState` defined (instance #3).
- `ReturnsPending.vue` (internal): `STEPPER_STEPS` + `stepperState` defined (instance #4).
- Combined with ClientAfterSales.vue (instance #1) and ClientReturnsPending.vue (instance #2), the pattern now spans 4 files across 2 portals.
- Action: P-005 extraction to `<CarryForwardStepper>` component is now confirmed critical. Must handle both `carry_forward_status` (after-sales) and `status` (unloaded) fields. Include hover tooltip for `added_to_order_number`.

### Cluster A validation from Wave 5
- `FactoryLedger.vue` (internal) renders `e.currency`, `e.exchange_rate`, and `e.debit` (INR value derived from `factory_price × qty × exchange_rate`). This confirms factory cost data is exposed at the frontend. Cluster A (AUTH_TOO_PERMISSIVE) is validated — effective access is FINANCE-only due to dual-dependency conflict; SUPER_ADMIN is incorrectly locked out. Deferred to Wave 0.

---

## Findings from Wave 6

### P-019 — Fixed-interval polling without backoff

- **Source:** `ExcelUpload.vue` `setInterval` at 2 seconds, no exponential backoff, no timeout ceiling.
- **Impact:** Long-running jobs hit backend every 2 seconds indefinitely. Scales poorly; wastes resources; no circuit-breaker if job is stuck.
- **Likely recurrence:** Any Vue page polling backend job status (bulk operations, report generation, file processing).
- **Wave 7/8 check:** grep for `setInterval` in order profiles; flag any polling instance; document interval + backoff strategy (usually absent).
- **Migration action:** Replace all polling with TanStack Query `refetchInterval` + backoff, or SSE for genuine real-time updates. Establish standard polling interval policy in Wave 0.

---

## Findings from Wave 8 Session A

### Pattern P-021: Client-side Excel file processing via ExcelJS

- **Source:** `OrderItemsTab.vue` `handlePriceExcelUpload()` — parses factory price list `.xlsx` files entirely in the browser using ExcelJS. Auto-detects column layout from header keywords (`'Part No'`, `'UNIT PRICE'`, `'单价'`).
- **Also observed:** PI download in the same component uses `quotationsApi.downloadPI` → receives a blob → creates a temporary `<a>` element and clicks it. Client-side blob URL approach for file downloads is fine; client-side file *parsing* is the concern.
- **Impact:** ExcelJS is a large npm dependency (~100KB+ gzipped) added to the client bundle for a single file upload use case. File parsing in the browser is slower than server-side and provides no validation or access control on parsed data.
- **Likely recurrence:** Any page with bulk data import via Excel (other portals may have similar upload patterns). Wave 7 `ExcelUpload.vue` uses a server-side parser (the backend handles the file). `OrderItemsTab.vue` is the only confirmed client-side ExcelJS usage.
- **Migration action:** Move client-side Excel parsing to a Next.js Server Action. Client POSTs the `.xlsx` file; server returns `[{ code, price }]`. Removes ExcelJS from client bundle. PI generation (`quotationsApi.generatePI`, `downloadPIWithImages`) remains server-side (backend generates the file); client just receives a blob — no change needed for downloads.

### D-004 dashboard / payments factory cost concern (Wave 8-A finding)

Two locations in the Order Detail view expose factory cost aggregates to all INTERNAL roles without a SUPER_ADMIN/FINANCE role gate:

1. `OrderDashboardTab.vue` — `estProfit` computed: `pi_total_inr - factory_total_inr - totalDuty`. Dashboard tab visible to OPERATIONS.
2. `PaymentsTab.vue` — Factory Payments section: `factoryPaymentSummary.factory_total_inr`, `factory_total_cny`. Payments tab visible to OPERATIONS post-PI.

Both are **[UNCLEAR]** — may be intentional for OPERATIONS order management or D-004 violations. Product decision required before migration. Pending decision in DECISIONS.md.

**Wave 0 action:** For each location, add role guard `v-if="isSuperAdmin || isAdmin || isFinance"` OR explicitly document the OPERATIONS exception in DECISIONS.md. Do not carry the ambiguity forward.

### P-020 instance #3 confirmed: OrderItemsTab.vue getInitials()

```javascript
// OrderItemsTab.vue — query panel chat bubbles
function getInitials(name) {
  const parts = name.split(/[@\s.]/).filter(Boolean)
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : ...
}
```

Combined instances: OrderList.vue (#1), OrderDraft.vue (#2), OrderItemsTab.vue (#3). All three are identical implementations. Extract to `utils/avatars.js` or `utils/formatters.js` immediately — this is now three confirmed duplicates.

### N+1 BOE fetch in OrderDashboardTab (Wave 8-A observation)

`customsApi.getBoe(shipment.id)` called per-shipment in a sequential loop after `shipmentsApi.list()` resolves. No batch endpoint exists. For the typical case (1–3 shipments) this is acceptable, but the pattern is fragile if shipment counts grow.

**Migration action:** Add `GET /api/customs/boe/?shipment_ids=id1,id2` batch endpoint. Next.js rebuild uses Promise.all or a single batch call, not a loop.

### Migration scope revision — OrderItemsTab as standalone wave

OrderItemsTab.vue at 3,331 lines is now the single largest component in the Vue frontend (exceeding OrderDraft.vue 1,563 lines by 2.1×). Original migration planning treated it as one of 14 OrderDetail tab components in Wave 8.

Revised recommendation: In migration execution phase, OrderItemsTab should be scoped as its own sub-wave (e.g., "Migration Wave 8c — OrderItemsTab alone") rather than grouped with other tab components. Budget matching the original OrderDraft.vue migration effort (sibling complexity: shared bulk-paste workflow, shared item management patterns).

---

## Findings from Wave 8 Session B

### Pattern P-022 (FORMALIZED): `highlightSection` prop + scrollIntoView scroll

A parent component (OrderDetail shell or router) passes a `highlightSection: String` prop to a sub-tab. The sub-tab watches the prop using `watch(() => props.highlightSection, ...)` and calls `nextTick(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))` followed by adding a CSS flash animation class (removed after ~2.5s).

**Instances:**
- #1: `OrderItemsTab.vue` — multiple named sections
- #2: `PaymentsTab.vue` — payment upload section
- #3: `PackingListTab.vue` — `upload` section (watches for `section === 'upload'`)

**Migration action:** Replace with URL hash routing. Each section that can be deep-linked gets an `id` attribute. On mount (or hash change), the component reads `window.location.hash` and scrolls to the matching element. No prop threading through parent shell. Example: `/orders/123?tab=packing#upload`.

---

### Pattern P-023 (NEW): N+1 per-entity API fetch in sequential loop

A component loads a collection (e.g., shipments[]) then iterates over each entity and makes a separate API call per entity, either in a sequential `for` loop or in a `Promise.all` without a corresponding bulk backend endpoint.

**Instances:**
- #1: `OrderDashboardTab.vue` — `customsApi.getBoe(shipment.id)` per shipment (Wave 8-A; now formalized here)
- #2: `SailingTab.vue` — `shipmentsApi.getProgress(s.id)` per shipment in `loadAllProgress()` using a sequential `for` loop. For 3 containers: 3 sequential round-trips before progress data appears.

**Migration action (both instances):**
1. Short-term: Convert sequential loops to `Promise.all(shipments.map(s => api.call(s.id)))` to at least parallelize.
2. Long-term: Add bulk backend endpoints returning a map keyed by entity ID:
   - `GET /api/customs/boe/?shipment_ids=id1,id2,id3`
   - `GET /api/shipments/progress/?order_id={id}` returning `{ [shipmentId]: { percent, days_remaining } }`

**Detection pattern for future profiles:** Any `for (const x of collection) { await api.call(x.id) }` or `.map` over a collection making API calls.

---

### Wave 8 Session B: P-001 (status list duplication) additional instances

- `PackingListTab.vue`: `showPackingSection` — 13 statuses hardcoded
- `BookingTab.vue`: `isBookingStage` — 10 statuses hardcoded
- `SailingTab.vue`: `isSailingStage` — 9 statuses hardcoded
- `ShippingDocsTab.vue`: `isSailingStage` — 9 statuses hardcoded (IDENTICAL to SailingTab; two files, same array)

Total P-001 instances for status arrays across Wave 8 components: 8+ independent definitions. All derive from `backend/enums.py → OrderStatus`. Next.js action: export named constants from `@/types/order-status.ts`:
- `PRODUCTION_STATUSES`
- `PACKING_VISIBLE_STATUSES`
- `BOOKING_VISIBLE_STATUSES`
- `SAILING_VISIBLE_STATUSES`

### Wave 8 Session B: P-002 (silent failure) additional instances

- `PackingListTab.vue`: 6 silent `console.error` calls (loadPackingList, updateFactoryReady, updatePackType, updatePallet, downloadExcel, downloadPDF)
- `BookingTab.vue`: 2 silent `console.error` calls (loadProviders, loadAddressData)
- `SailingTab.vue`: 1 fully silent `catch {}` (loadShippingDocs — no logging at all; causes `allDocsReceived()` to silently return false)

Running total of known P-002 instances: 15+. Wave 0 must establish a `toast.error()` call as the mandatory catch-block default.

### P-022 Wave 0 action

Layer 2 component: `<HighlightScrollTarget id={string} />` wrapping sections that receive deep-link highlights. URL hash drives which target is highlighted + scrolled. Replaces the highlightSection prop pattern in ItemsTab, PaymentsTab, PackingTab. Part of Wave 0 component gallery.

### P-023 Wave 0 action

Backend cleanup: identify N+1 patterns in frontend and add bulk endpoints. Known instances:
- DashboardTab BOE fetch — needs `/api/customs/boe/bulk?ids=X,Y,Z`
- SailingTab progress fetch — needs `/api/shipping/progress/bulk?shipment_ids=X,Y,Z`

Wave 0 backend task.

---

## Meta-observations from schema compliance checks

### Schema compliance checks catch factual contradictions, not just formatting

Wave 4 compliance check caught a claim in internal_factories_list.md that DELETE /api/factories/{id}/ was "hard (permanent)" when backend implementation is soft-delete (deleted_at + is_active=False). The error was cross-referenced against SECURITY_BACKLOG.md Patch 11 notes.

Action: All future compliance checks must include a content cross-reference step — verify profile claims about delete semantics, role requirements, and API behavior against SECURITY_BACKLOG.md, AUTHZ_SURFACE.md, and DECISIONS.md. Pure formatting checks miss factual drift; cross-reference checks find it.
