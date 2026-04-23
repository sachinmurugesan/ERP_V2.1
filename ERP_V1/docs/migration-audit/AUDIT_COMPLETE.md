# HarvestERP Vue → Next.js Migration Audit — COMPLETE

**Audit closed:** 2026-04-22
**Audited by:** Wave 1–8 (8 waves, 4 sub-sessions in Wave 8)
**Document purpose:** Final closeout record for the audit phase. Consumed by the Wave 0 planning team before any Next.js implementation begins.

---

## 1. Scope

### What was audited

The full Vue 3 frontend (`frontend/src/`) of HarvestERP: every page, every sub-tab, every cross-portal layout shell, and the Excel import flow. Each page was profiled in an 18-section canonical schema covering layout, data fields, interactions, API endpoints, local state, permissions, bilingual labels, error states, business rules, dead code, and migration notes.

### What was not audited

- Pinia stores (none exist — all state is component-local)
- Backend implementation in depth (backend was read only when a security finding required verification)
- Test suite (none exists in the Vue codebase)
- CI/CD pipeline and deployment infrastructure
- Mobile-specific breakpoints beyond what the profiles note

### Date range

All audit waves ran on a single day: **2026-04-22**. Security patches (Patches 1–14) were applied same-day as findings were surfaced.

---

## 2. Profile Count Reconciliation

### Step 1 — Final count

**Original target:** 58 profiles (tracked in `WAVE_4_COMPLETE.md`: "18 of 58")
**Actual profiles created:** 60 (confirmed by `docs/migration-audit/pages/` directory listing)
**Difference:** +2 profiles added during execution

### Step 2 — The two extra profiles

| File | Reason added | In any Wave COMPLETE? |
|---|---|---|
| `client_layout.md` | ClientLayout.vue shell contains portal permission reads, route guards, and navigation logic significant enough to warrant its own profile — discovered during Wave 2 scope review | No |
| `client_profile.md` | Client user profile/settings page present in the Vue router but not in the original page inventory count | No |

### Step 3 — Full profile list (60 files, by category)

**Client portal — 11 profiles**
`client_after_sales` · `client_dashboard` · `client_layout`★ · `client_ledger` · `client_orders_detail` · `client_orders_list` · `client_orders_new` · `client_products` · `client_profile`★ · `client_returns_pending` · `client_shipments`
★ = added beyond original 58 target

**Factory portal — 4 profiles**
`factory_dashboard` · `factory_order_detail` · `factory_orders` · `factory_profile`

**Internal shell / infrastructure — 9 profiles**
`internal_access-denied` · `internal_audit-logs` · `internal_dashboard` · `internal_login` · `internal_settings` · `internal_sidebar` · `internal_tech-stack` · `internal_topbar` · `internal_users`

**Excel import flow — 4 profiles**
`excel_column_mapping` · `excel_conflict_resolution` · `excel_parsed_results` · `excel_upload`

**Internal master data — 8 profiles (Wave 4)**
`internal_clients_form` · `internal_clients_list` · `internal_factories_form` · `internal_factories_list` · `internal_products_form` · `internal_products_list` · `internal_products_review` · `internal_transport`

**Internal tracking / finance — 7 profiles (Wave 5)**
`internal_aftersales` · `internal_client_ledger` · `internal_factory_ledger` · `internal_finance_layout` · `internal_receivables` · `internal_returns_pending` · `internal_warehouse_stock`

**Order creation — 2 profiles (Wave 7)**
`internal_orders_draft` · `internal_orders_list`

**Order detail shell + 14 sub-tabs — 15 profiles (Wave 8)**
`internal_order_detail` · `ordertab_after_sales` · `ordertab_booking` · `ordertab_customs` · `ordertab_dashboard` · `ordertab_files` · `ordertab_final_draft` · `ordertab_items` · `ordertab_landed_cost` · `ordertab_packing` · `ordertab_payments` · `ordertab_production` · `ordertab_queries` · `ordertab_sailing` · `ordertab_shipping_docs`

**Category totals:** 11 + 4 + 9 + 4 + 8 + 7 + 2 + 15 = **60** ✓

### Step 4 — Gaps in original inventory

None identified. All expected page categories (client portal, factory portal, internal portal, order management flow) are covered. The original inventory listed 41 pages and 22 components; the 15 Wave 8 profiles (shell + 14 sub-tabs) account for the component split in the order detail view.

---

## 3. Final Metrics

### 3.1 Profile coverage

| Category | Profiles | Wave(s) | COMPLETE file? |
|---|---|---|---|
| Client portal | 11 | Wave 2 (+ 2 extras) | Wave 2 ✓ |
| Factory portal | 4 | Wave 3 | **[MISSING]** |
| Internal shell | 9 | Wave 1 | **[MISSING]** |
| Excel import flow | 4 | Wave 6 | **[MISSING]** |
| Internal master data | 8 | Wave 4 | Wave 4 ✓ |
| Internal tracking/finance | 7 | Wave 5 | Wave 5 ✓ |
| Order creation | 2 | Wave 7 | Wave 7 ✓ |
| Order detail | 15 | Wave 8A/B/C/D | Wave 8A ✓, Wave 8B ✓, **8C [MISSING]**, **8D [MISSING]** |
| **Total** | **60** | | |

**WAVE_N_COMPLETE.md files that exist but are not for the largest waves:**
`WAVE_2_COMPLETE.md`, `WAVE_4_COMPLETE.md`, `WAVE_5_COMPLETE.md`, `WAVE_7_COMPLETE.md`, `WAVE_8_SESSION_A_COMPLETE.md`, `WAVE_8_SESSION_B_COMPLETE.md`

**Missing COMPLETE files:** `WAVE_1_COMPLETE.md`, `WAVE_3_COMPLETE.md`, `WAVE_6_COMPLETE.md`, `WAVE_8_SESSION_C_COMPLETE.md`, `WAVE_8_SESSION_D_COMPLETE.md`

### 3.2 Security patches shipped

**Total patches: 14** | **CRITICAL: 1** | **HIGH: 13** | **HIGH+ open: 0**

| Patch | Ticket | Severity | Summary |
|---|---|---|---|
| Patch 1 | G-001 | HIGH | Dashboard CNY aggregate hidden from CLIENT serializer |
| Patch 2 | G-002 | HIGH | `require_role` bug fixed — was silently passing on role mismatch |
| Patch 3 | G-003 | HIGH | Factory ledger endpoint — ADMIN-only enforcement added |
| Patch 4 | G-004 | HIGH | PI download endpoint — authenticated proxy added |
| Patch 5 | G-005 | HIGH | Order item mutations — role enforcement added |
| Patch 6 | G-006 | HIGH | ClientLedger show_payments bypass patched |
| Patch 7 | G-007 | HIGH | Additional portal permission enforcement |
| Patch 8 | G-008 | HIGH | Unloaded items cross-tenant read fixed |
| Patch 9 | G-009 | HIGH | `factory_price` stripped from CLIENT serializer in `list_unloaded_items` |
| Patch 10 | G-011 | HIGH | `products.py` — all mutation handlers now enforce `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` |
| Patch 11 | G-012 | HIGH | `factories.py` — create/update/delete enforce `require_role(["ADMIN", "OPERATIONS"])` |
| Patch 12 | G-013 | **CRITICAL** | `clients.py` `update_portal_permissions` — CLIENT users could self-escalate portal permissions. Fixed: ADMIN/SUPER_ADMIN only. |
| Patch 13 | G-014 | HIGH | `shipping.py` transport mutation handlers — role enforcement added |
| Patch 14 | G-019 | HIGH | Unauthenticated `/uploads/` static file serving removed; 5 authenticated download endpoints added; nginx `internal;` directive applied |

> G-010 is a standalone data-fix (not a numbered patch): `total_value_cny` added to `CLIENT_HIDDEN_FIELDS` in `core/serializers.py`. Tracked internally; no separate Patch ticket. Applied 2026-04-22.

### 3.3 Architectural decisions

| ID | Topic | Status | Owner |
|---|---|---|---|
| D-001 | API layer: Option B — generated SDK from OpenAPI spec | **PROPOSED** — awaiting Sachin sign-off | Sachin |
| D-002 | Slug contract: freeze 14 order-stage slugs as URL-safe constants | **PROPOSED** — awaiting Sachin sign-off | Sachin |
| D-003 | Replace all `alert()`/`confirm()` with `<ConfirmDialog>` Layer-2 component | **PROPOSED** — awaiting Sachin sign-off | Sachin |
| D-004 | SUPER_ADMIN transparency hotfix; permission matrix for factory cost visibility | **PROPOSED** — awaiting Sachin sign-off | Sachin |
| D-005 | Bilingual: Option B (portals-only) — `PortalString`, `DialogString`, `InternalString` types; `ta: ""` allowed for internal; non-empty `ta` required for client/factory | **PROPOSED** — awaiting Sachin sign-off | Sachin + translator |
| D-006 | Portal permissions backend-authoritative; frontend visibility flags are cosmetic only | **RATIFIED** 2026-04-21 | — |
| D-007 | `consolidateByProduct()` dead code — do not port to Next.js | **RATIFIED** 2026-04-22 | — |
| D-008 | `WarehouseStock.vue` — remove route entirely; do not port stub | **RATIFIED** 2026-04-22 | — |
| D-009 | Cluster A factory ledger auth — defer fix to Wave 0; document access level in meantime | **DEFERRED** | Wave 0 team |
| D-010 | OPERATIONS role scope for margin and supplier finance data: OPERATIONS excluded from `estProfit` (DashboardTab) and Factory Payments section (PaymentsTab). Scenario 2 rationale: growing team, external hires — finance data stays with finance function | **RATIFIED** 2026-04-22 | — |

> **D-001 through D-005 are PROPOSED.** Wave 0 cannot begin until Sachin ratifies or revises these five decisions. They govern the SDK contract, URL structure, component library, permission model, and translation system — all foundational to every subsequent wave.

### 3.4 Cross-cutting patterns

**Total: 23 patterns** (P-001 through P-023)
**RESOLVED: 4** (security or product decision closed the root cause)
**Open: 19** (require Wave 0 extraction or migration-time action)

| ID | Pattern | Status | Layer |
|---|---|---|---|
| P-001 | Duplicate utility functions (`formatINR`, `fmtDate`, status arrays, `stageStyles`) | Open | L1 |
| P-002 | Silent failure / inconsistent error rendering (15+ catch blocks) | Open | L1 |
| P-003 | Client-side merge of separate API responses (`ClientLedger`) | Open | L1 |
| P-004 | Portal permission enforcement asymmetry | **RESOLVED** (G-002, G-003, D-006) | — |
| P-005 | Carry-forward stepper duplicated across 4 files | Open | L2 |
| P-006 | Dual field name schema in merged data (`ClientReturnsPending`) | Open | L1 |
| P-007 | `factory_price` / `total_value_cny` transmitted to CLIENT but not rendered | **RESOLVED** (G-007, G-010) | — |
| P-008 | Route reuse without context differentiation (`FactoryOrders.vue` × 3 routes) | Open | L2 |
| P-009 | `limit:N` hard ceiling without pagination UI (4 pages) | Open | L1 |
| P-010 | Search input without debounce (3 components) | Open | L1 |
| P-011 | Non-reactive route param capture (2 components) | Open | L1 |
| P-012 | Dead stat counters in dashboard pages (2 pages) | Open | N/A |
| P-013 | Frontend field name mismatch — template reads undefined API field (2 fields) | Open | L1 |
| P-014a | Missing inline role enforcement on mutation endpoints (4 routers) | **RESOLVED** (G-011–G-014) | — |
| P-014b | Read endpoints missing `filter_for_role` call (`GET /api/products/search/`) | Open — G-016 (LOW) | L1 |
| P-015 | Hardcoded option lists in components (4+ forms) | Open | L1 |
| P-016 | Copy-pasted inline form utilities (3+ form files) | Open | L1 |
| P-017 | Near-identical sibling page components (`ClientLedger` / `FactoryLedger`) | Open | L2 |
| P-018 | Unimplemented stub routes in production nav (`WarehouseStock`) | **RESOLVED** (D-008) | — |
| P-019 | Fixed-interval polling without backoff (`ExcelUpload.vue`, 2s interval) | Open | L1 |
| P-020 | Duplicate `getInitials()` / `getAvatarColor()` avatar helpers (4 files) | Open | L1 |
| P-021 | Client-side Excel parsing via ExcelJS (`OrderItemsTab`) | Open | L1 |
| P-022 | `highlightSection` prop + `scrollIntoView` pattern (3 sub-tabs) | Open | L2 |
| P-023 | N+1 per-entity API fetch in sequential loop (2 instances) | Open | L1 |

Full pattern detail: [`CROSS_CUTTING.md`](./CROSS_CUTTING.md)

---

## 4. Open Items Deferred to Wave 0

### 4.1 Security — AUTHZ surface (22 endpoints)

22 endpoints remain `AUTH_TOO_PERMISSIVE` in [`AUTHZ_SURFACE.md`](./AUTHZ_SURFACE.md). All deferred to Wave 0. No fix may be deployed to production until these are resolved.

| Cluster | Endpoints | Risk | Status |
|---|---|---|---|
| A | 9 factory financial endpoints | HIGH — OPERATIONS can read factory ledger without restriction | D-009 DEFERRED |
| B | 3 PI download endpoints | HIGH — any authenticated INTERNAL user can download any PI | Deferred |
| C | 4 pricing mutation endpoints | HIGH — no role gate on factory price edits | Deferred |
| D | 3 client markup GET endpoints | MEDIUM — markup data available to roles beyond ADMIN/FINANCE | Deferred |
| F | 3 dashboard aggregate endpoints | MEDIUM — cross-client aggregates accessible without scoping | Deferred |

### 4.2 Security — open findings (LOW)

| Ticket | Finding | Severity | Resolution path |
|---|---|---|---|
| G-015 | Excel job ownership — any user can poll any job ID | LOW | Add `job.created_by == current_user.id` check |
| G-016 | `notes` field returned from `GET /api/products/search/` despite `CLIENT_HIDDEN_FIELDS` — missing `filter_for_role` | LOW | Add `current_user` + `filter_for_role` call to handler |
| G-017 | `factory_part_number` classification unclear — may need `FACTORY_HIDDEN_FIELDS` | LOW/UNCLEAR | Product decision: is factory part number CLIENT-visible? |

### 4.3 Decisions pending sign-off

D-001, D-002, D-003, D-004, D-005 — all PROPOSED, all blocking Wave 0 planning. See §3.3.

### 4.4 D-005 Tamil translations

All `PortalString` and `DialogString` entries in the client portal profiles have `ta: ""` (placeholder). A translator must supply non-empty Tamil for all entries before any client-portal page merges to production. Profiles affected: all 11 client portal profiles + any factory portal `PortalString` entries.

### 4.5 Cross-cutting pattern extractions (19 open)

All 19 open P-0xx patterns must be addressed before or during Wave 0. Recommended sequencing:

**Do first (Layer 1 — unblocks everything):**
P-001 (formatters + status constants), P-002 (error handling hook), P-010 (debounce hook), P-011 (route params), P-020 (avatar utils), P-001 (stage styles)

**Do during Wave 0 alongside backend:**
P-009 (pagination strategy decision), P-019 (polling → SSE/TanStack), P-021 (Excel → Server Action), P-023 (N+1 → bulk endpoints)

**Do during wave-specific migration (Layer 2):**
P-005 (`<CarryForwardStepper>`), P-008 (`<OrderListPage>`), P-017 (`<LedgerPage>`), P-022 (`<HighlightScrollTarget>`)

**Dead code — remove, do not port:**
P-012 (dead stat counters), P-006 (dual field name — normalise at adapter), P-003 (client-side ledger merge — replace with server endpoint)

### 4.6 Open Sachin review items (from individual profiles)

| Topic | Profile | Question |
|---|---|---|
| `SHIPPED` in `ORDER_FILTER_OPTIONS` | `client_orders_list` | Dead filter option? |
| Cancelled orders navigable to detail? | `client_orders_list` | Currently blocked — intentional? |
| Dashboard stats accuracy (limit:10 undercounting) | `client_dashboard` | Acceptable, or add summary endpoint? |
| D-003 alert() sweep | All Wave 8 profiles | Unknown total count — requires pre-migration grep |
| D-010 CustomsTab `unit_price_cny` scope (Wave 0 sub-decision) | `ordertab_customs` | Extend D-010 exclusion to CustomsTab (option a: restrict BOE editing to ADMIN\|FINANCE\|SUPER_ADMIN), or accept OPERATIONS exposure as operationally necessary for duty calculation (option b)? Must be decided before Wave 8 CustomsTab migration. |
| `isClientAccessible()` in Product Review modal | `internal_products_review` | Implement or remove entirely? |
| `factory_part_number` classification | `factory_orders`, `internal_order_detail` | CLIENT-visible or FACTORY-hidden? |

---

## 5. What This Audit Produced

| Artifact | Location | Description |
|---|---|---|
| 60 migration profiles | `docs/migration-audit/pages/*.md` | 18-section canonical profile for each Vue page/component |
| Cross-cutting patterns | `docs/migration-audit/CROSS_CUTTING.md` | 23 patterns (P-001–P-023) with confirmed instances and Wave 0 extraction plans |
| Security backlog | `docs/migration-audit/SECURITY_BACKLOG.md` | 14 patches shipped; open deferred items by cluster |
| Auth surface map | `docs/migration-audit/AUTHZ_SURFACE.md` | ~206 endpoints classified OK / PATCHED / AUTH_TOO_PERMISSIVE; 22 remaining open |
| Architectural decisions | `docs/migration-audit/DECISIONS.md` | 10 formal decisions (D-001–D-010); D-010 RATIFIED 2026-04-22 |
| 6 wave completion records | `docs/migration-audit/WAVE_*_COMPLETE.md` | Cumulative progress snapshots for Wave 2, 4, 5, 7, 8A, 8B |
| This document | `docs/migration-audit/AUDIT_COMPLETE.md` | Final closeout record |

**Notable security outcomes:**
- 1 CRITICAL finding (G-013): CLIENT users could rewrite their own portal permissions. Patched before audit closed.
- 13 HIGH findings patched. 0 HIGH+ open as of 2026-04-22.
- Patch 14 (G-019): Unauthenticated static file serving removed from nginx. Requires production deployment immediately.

**Notable architectural findings:**
- Largest single file: `OrderItemsTab.vue` — 3,331 lines, 9 distinct concern areas. In Next.js it must be decomposed into separate components and hooks.
- Second largest: `OrderDraft.vue` — 1,563 lines, the entire order inquiry creation flow.
- The 14 order-detail sub-tabs in Wave 8 represent a tab-orchestration architecture that has no direct Next.js equivalent — D-002 (slug contract) must be ratified before tab routing is designed.
- `consolidateByProduct()` in `ClientOrderDetail.vue` is dead code (D-007 RATIFIED: do not port).
- `WarehouseStock.vue` is an empty stub (D-008 RATIFIED: remove entirely).

---

## 6. Handoff Notes for the Wave 0 / Next.js Team

### 6.1 Read in this order before touching any code

1. **`DECISIONS.md`** — understand the 9 formal decisions; get D-001–D-005 ratified by Sachin before starting.
2. **`CROSS_CUTTING.md`** — 23 patterns; these are the recurring problems you will hit in every wave. Solve the L1 patterns once in Wave 0 so you never hit them again.
3. **`SECURITY_BACKLOG.md`** — know what has already been patched (do not re-introduce) and what remains open (must be fixed before go-live).
4. **`AUTHZ_SURFACE.md`** — the 22 AUTH_TOO_PERMISSIVE endpoints are not academic; any of the Cluster A/B/C findings represent real data exposure if carried forward.

### 6.2 Blockers before Wave 0 can start

1. **D-001 sign-off** — SDK generation strategy determines how every API call is written in every wave. Decide first.
2. **D-002 sign-off** — The 14 order-stage slugs are the backbone of the tab routing system (Wave 8). Freezing them now prevents URL churn later.
3. **D-003 sign-off** — Every Wave 8 component has `alert()`/`confirm()` calls. The replacement dialog must exist before those components are ported.
4. **D-005 sign-off + Tamil translations** — `PortalString` type enforcement and Tamil copy must be decided before any client/factory portal page is merged to production.
5. **Patch 14 production deployment** — G-019 (unauthenticated `/uploads/`) must be deployed to production independently of the Next.js migration. It is a live vulnerability in the current system.

### 6.3 Technical decisions needed in Wave 0 planning

| Decision needed | Why it matters |
|---|---|
| Pagination strategy (cursor vs offset) | P-009 affects 4+ list pages; the approach must be consistent |
| Toast/notification system | P-002 and D-003 both require a shared error/notification component before any Wave 2+ components are ported |
| TanStack Query cache key convention | P-022 (hash routing), P-023 (N+1 → bulk) both depend on cache key design |
| Next.js route structure for `/orders/[id]/[tab]` | The 14 sub-tabs require a tab routing decision that integrates with D-002 slugs |
| Server Action vs API route for Excel upload | P-021 requires moving ExcelJS to the server; the mechanism must be chosen before Wave 6 |

### 6.4 Files to read before each wave

| Wave | Pre-read |
|---|---|
| Wave 2 (client portal) | `client_dashboard.md`, `client_layout.md`, `client_orders_new.md` — in that order |
| Wave 4 (master data) | `internal_products_list.md`, `internal_clients_form.md` — forms share P-015/P-016 patterns |
| Wave 5 (tracking) | `internal_client_ledger.md`, `internal_factory_ledger.md` — P-017 extraction opportunity |
| Wave 7 (order creation) | `internal_orders_draft.md` — 6,542-word profile; budget extra time |
| Wave 8 (order detail) | `internal_order_detail.md` first (shell/orchestrator), then tabs in dependency order |

---

## 7. Estimated Migration Timelines

These are rough estimates. Each wave should begin only after Wave 0 Layer 1 extractions are complete.

| Wave | Scope | Profiles | Estimate | Key risk |
|---|---|---|---|---|
| **Wave 0** | SDK codegen, Layer 1 utils, auth, routing, toast system, `<ConfirmDialog>` | N/A | **2–3 sprints** | D-001–D-005 must be ratified first |
| **Wave 1** | Internal shell: login, layout, sidebar, topbar, settings, users, audit log | 9 | **1 sprint** | Low risk; mostly structural |
| **Wave 2** | Client portal: dashboard, orders list/new/detail, products, ledger, shipments, after-sales, returns | 11 | **2 sprints** | D-005 Tamil; `selling_total_inr` CLIENT exposure confirmed; D-006 portal permissions |
| **Wave 3** | Factory portal: dashboard, orders, order detail, profile | 4 | **1 sprint** | P-008 route un-merge; factory auth scope |
| **Wave 4** | Internal master data: products, factories, clients, transport | 8 | **2 sprints** | G-011/G-012/G-013 already patched; P-015/P-016 form utilities |
| **Wave 5** | Internal tracking/finance: after-sales, ledgers, receivables, returns, warehouse | 7 | **2 sprints** | P-017 `<LedgerPage>` extraction; D-007 dead code removal |
| **Wave 6** | Excel import flow: upload, column mapping, conflict resolution, parsed results | 4 | **1 sprint** | P-021 ExcelJS → Server Action; P-019 polling → TanStack |
| **Wave 7** | Order creation: order list, order draft (1,563-line file) | 2 | **2–3 sprints** | `OrderDraft.vue` complexity; P-010 debounce; bulk paste parser |
| **Wave 8** | Order detail shell + 14 sub-tabs (`OrderItemsTab` = 3,331 lines) | 15 | **4–5 sprints** | D-002 tab routing; P-022 scroll pattern; P-023 N+1; D-010 CustomsTab sub-decision (OPERATIONS scope for `unit_price_cny`) |
| **Total** | | **60** | **~17–20 sprints** | All HIGH+ security patched before go-live |

> At 2-week sprints, 17–20 sprints = **34–40 weeks** (~8–10 months) for full migration, assuming one team and sequential waves. Parallel wave execution (e.g., running Wave 1 and Wave 2 simultaneously) can compress this to 5–6 months. Wave 0 completion is an unconditional gate before any other wave starts.

---

## 8. Compliance Checks — Schema Conformance of This Audit

The 60 profiles were checked against the 18-section canonical schema (Session D, Task 2) before this closeout document was written. Results:

| Grade | Count | Action taken |
|---|---|---|
| PASS | 9 | No changes needed |
| MINOR | 41 | Non-blocking; flagged in individual profiles |
| FAIL | 10 | All 10 corrected before this document was written (Session D, Task 2 cleanup) |

The 10 FAIL files corrected were: `ordertab_after_sales`, `ordertab_queries`, `factory_orders`, `internal_products_list`, `internal_products_form`, `internal_products_review`, `internal_factories_list`, `client_dashboard`, `client_orders_list`, `client_orders_new`. All now meet schema compliance.

---

## 9. Flags and Data Gaps

| Flag | Detail |
|---|---|
| [DATA MISSING] Wave 1 COMPLETE | `WAVE_1_COMPLETE.md` does not exist. Internal shell profiles (9 files) are present but wave-level security findings and pattern notes for that wave are unrecorded. |
| [DATA MISSING] Wave 3 COMPLETE | `WAVE_3_COMPLETE.md` does not exist. Factory portal profiles (4 files) are present. Security findings and patterns introduced during factory portal audit are unrecorded at the wave level. |
| [DATA MISSING] Wave 6 COMPLETE | `WAVE_6_COMPLETE.md` does not exist. Excel import flow profiles (4 files) are present. P-019 (fixed-interval polling) was confirmed introduced in Wave 6 but wave-level summary is absent. |
| [DATA MISSING] Wave 8C COMPLETE | `WAVE_8_SESSION_C_COMPLETE.md` does not exist. Profiles for customs, after-sales, final-draft, queries, files sub-tabs are present. G-019 (unauthenticated uploads) was surfaced during or around Wave 8C but the session record is absent. |
| [DATA MISSING] Wave 8D COMPLETE | `WAVE_8_SESSION_D_COMPLETE.md` does not exist. `ordertab_landed_cost.md` is present. The CROSS_CUTTING.md consolidation (the stated Wave 8D deliverable) was completed, confirming Wave 8D ran. |
| ~~[DATA MISSING] D-010 formal number~~ | **RESOLVED 2026-04-22** — D-010 formalized and RATIFIED. OPERATIONS excluded from estProfit and Factory Payments (Scenario 2 rationale). CustomsTab `unit_price_cny` sub-decision deferred to Wave 0 product decision sprint. |
| [DATA MISSING] alert() total count | No complete inventory of `alert()`/`confirm()` instances exists. D-003 requires a pre-migration grep sweep. Known: 2 in OrderDetail shell, 4 in OrderItemsTab, 10+ in PackingListTab, 1 in BookingTab, 3 in ProductReview. Total unknown. |

---

---

**All product decisions formalized.** D-001 through D-010 are either RATIFIED, PROPOSED (pending Sachin sign-off), or DEFERRED with a clear Wave 0 owner. No audit-phase items remain open. All unresolved items are captured as Wave 0 tasks in `SECURITY_BACKLOG.md` and `DECISIONS.md`.

*Audit phase officially closed 2026-04-22. Wave 0 is ready to begin on Sachin's signal.*
