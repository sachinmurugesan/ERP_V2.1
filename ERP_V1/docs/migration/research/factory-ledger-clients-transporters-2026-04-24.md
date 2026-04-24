# Deep Research — Factory Ledger + Clients List + Transporters List

**Date:** 2026-04-24  
**Author:** Migration planner  
**Status:** Read-only research (Phase 0 — no code, no branches)  
**Successor migrations:** dashboard, orders-list, products-list, products-form

---

## Executive summary

Three targets, all **list/ledger pages, no heavy forms in scope**. The peer forms (`ClientForm.vue` 443 lines, `TransportForm.vue` 494 lines) are related but can be deferred to a follow-up wave. Factory ledger and client ledger are near-identical in structure (diff is 2 columns) and are the natural justification for a new `LedgerPage` Layer 2 component — the first one that would be built *before* its third use (per the R-15 discussion deferred after products-form).

**Total estimated work:** **22–32 hours** across the three targets (1.5× safety multiplier applied to base estimates, matching the products-family overrun pattern).

**Recommended sequence** (details in §Cross-cutting):
1. **Clients list first** (6–8 h) — pure list pattern, no D-004 concerns, smallest blast radius, validates the shared `<Pagination>` + delete-confirm patterns that Transport will reuse.
2. **Transporters list second** (5–7 h, bundled with Clients shared extractions) — same list shape as Clients + role badge column; reuses every extraction from step 1.
3. **Factory Ledger third** (8–12 h, with `<LedgerPage>` extraction covering Client Ledger too) — the only target with D-004 role gating, blob download, and summary cards.

**Blocking backend work:** None for Clients List or Transport List. For Factory Ledger one cleanup item is worth pairing with the migration (§D.3 factory-ledger): the current endpoint response ships `total_debit_usd` / `amount_usd` fields the UI doesn't render — harmless but a design gap noted for later.

---

## 1. Factory Ledger (`/finance/factory-ledger`)

### A. Location in codebase

- **Vue file:** [frontend/src/views/finance/FactoryLedger.vue](../../../frontend/src/views/finance/FactoryLedger.vue) — **175 lines**
- **Peer:** [frontend/src/views/finance/ClientLedger.vue](../../../frontend/src/views/finance/ClientLedger.vue) — **171 lines** (near-identical structure; 2 fewer table columns)
- **Route:** `/finance/factory-ledger` → `FactoryLedger` (meta.title: `'Factory Ledger'`); nested under `FinanceLayout` at `/finance` with sibling `Receivables` and `ClientLedger` routes
- **Parent layout:** [frontend/src/views/finance/FinanceLayout.vue](../../../frontend/src/views/finance/FinanceLayout.vue) — tab-bar shell
- **Services used:**
  - `financeApi.factoryLedger(factoryId, params)` → `GET /api/finance/factory-ledger/{factory_id}/`
  - `financeApi.downloadFactoryLedger(factoryId, format, params)` → `GET /api/finance/factory-ledger/{factory_id}/download/`
  - `factoriesApi.list()` → `GET /api/factories/` (factory dropdown)
- **Composables used:** None. No `useRouter` — ledger does not navigate away.
- **Formatters:** `formatCurrency` from [frontend/src/utils/formatters.js](../../../frontend/src/utils/formatters.js)
- **Audit profile:** [docs/migration-audit/pages/internal_factory_ledger.md](../../migration-audit/pages/internal_factory_ledger.md)

### B. User flow walkthrough

- **Primary persona:** Finance team (role `FINANCE`) and owner (role `SUPER_ADMIN`). ADMIN is explicitly blocked per D-004.
- **Entry point:** Sidebar `Finance` menu → `FinanceLayout` → `Factory Ledger` tab. No external deep links.
- **Step-by-step success path:**
  1. User lands on the page with empty filter state → sees "Select a factory to view their ledger" prompt.
  2. Opens factory dropdown (populated from `/api/factories/` on mount) → picks one.
  3. Optionally narrows `start_date` / `end_date` (native `<input type="date">`).
  4. Watcher fires on any of the three filter refs → refetches ledger.
  5. Sees summary cards (Total Debit / Total Credit / Net Balance) + 10-column table with running balance.
  6. Clicks **Excel** or **PDF** → blob download triggered via hidden `<a>` click.
- **Error paths:**
  - ADMIN tries to load → backend 403 → currently `console.error` only (P-002 swallow bug); next.js migration must show a proper forbidden state.
  - No orders at FACTORY_ORDERED stage → empty `entries[]` response → "No ledger entries found" shown.
  - Download fails → silent `console.error`. Migration must surface a toast.
- **Where they go next:** Typically back to `Receivables` or `Client Ledger` tab via the sibling `FinanceLayout` tabs — never out of Finance.

### C. Fields and interactions inventory

**Filter bar (3 inputs + 2 conditional buttons):**

| Control | Type | Behaviour |
|---|---|---|
| Factory | `<select>` | Populated from `/api/factories/`; "Select a factory..." placeholder |
| From | `<input type="date">` | Optional; clears to no filter |
| To | `<input type="date">` | Same |
| Excel | `<button>` emerald-600 | Only when `selectedFactory && entries.length > 0`; calls `downloadStatement('xlsx')` |
| PDF | `<button>` red-600 | Same gating; calls `downloadStatement('pdf')` |

**Summary cards (3):** Total Debit (red), Total Credit (emerald), Net Balance (amber if >0 else emerald).

**Table — 10 columns** (Client Ledger peer has 8; diff is **Currency** + **Forex Rate**):

| # | Header | Source | Notes |
|---|---|---|---|
| 1 | Date | `e.date` | ISO |
| 2 | Order | `e.order_number` | `font-mono text-indigo-600 text-xs` |
| 3 | Remark | `e.remark` | |
| 4 | Currency | `e.currency` | e.g. `"CNY"` |
| 5 | Forex Rate | `e.exchange_rate.toFixed(2)` | |
| 6 | Debit (₹) | `e.debit` | red-600 if >0, `-` else |
| 7 | Credit (₹) | `e.credit` | emerald-600 if >0 |
| 8 | Balance (₹) | `e.running_balance` | amber if >0 (factory owed) / emerald if ≤0 |
| 9 | Method | `e.method.replace('_', ' ')` | Payment method or `-` |
| 10 | Reference | `e.reference` | |

**Footer row:** TOTALS across cols 6–8.

**Actions:** Page-level download buttons only. No row-level or bulk actions. No inline editing.

**States:** `no-factory-selected` · `loading` · `data` · `empty-ledger` · `error` (currently swallowed — gap).

**Special patterns:** Sticky-less table, horizontal scroll on overflow (`overflow-x-auto`). No mobile-card layout (Vue source is desktop-focused).

### D. API endpoints used

**Verified live on 2026-04-24 (backend port 8001):**

| # | Method | URL | Request shape | Response shape | OpenAPI typed? | Role |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/factories/` | `?per_page=N` | `{items, total, page, per_page, pages}` | Yes (`$ref`) | INTERNAL — any |
| 2 | GET | `/api/finance/factory-ledger/{factory_id}/` | `?start_date&end_date` | See below — **backend code at `finance.py:1480-1617`** | **No** (`[]`) | SUPER_ADMIN \| FINANCE (verified 403 for ADMIN with admin JWT) |
| 3 | GET | `/api/finance/factory-ledger/{factory_id}/download/` | `?format=xlsx|pdf&start_date&end_date` | Binary blob | **No** (`[]`) | Same as #2 |

**Factory-ledger response shape (confirmed from source, not curl due to 403 on admin JWT):**
```ts
{
  entries: Array<{
    date: string;            // "YYYY-MM-DD"
    order_number: string;
    order_id: string;
    remark: string;
    debit: number;           // INR
    credit: number;          // INR
    amount_foreign: number;  // CNY value
    currency: string;        // "CNY"
    exchange_rate: number;
    amount_usd: number;      // derived from USD→INR rate
    method: string;          // "-" for debits; payment method for credits
    reference: string;
    running_balance: number; // INR
  }>;
  summary: {
    total_debit: number;
    total_credit: number;
    net_balance: number;
    total_debit_usd: number;
    total_credit_usd: number;
    net_balance_usd: number;
  };
  factory_name: string;
  factory_id: string;
}
```

**Deviations from the Vue template usage:**
- Backend ships `amount_foreign`, `amount_usd`, and `*_usd` summary fields — Vue ignores all three. **These should stay in the TypeScript interface** (strictness) even if not rendered — future surfaces may want them.

**Migration note (D-001):** Next.js migration routes all three via `app/api/finance/factory-ledger/[id]/...` proxies. Because the OpenAPI schema is `[]`, define a local `FactoryLedgerResponse` type in `app/(app)/finance/factory-ledger/_components/types.ts` (Section 10 local-interface rule).

### E. Data model

**Primary object displayed:** `LedgerEntry` (union of order-debit and payment-credit entries, flattened by the backend into a chronologically sorted stream with running balance).

**Input references:**
- `Factory` — looked up by id; returns `company_name` shown in filename.
- `Order` — filtered by `factory_id` AND `status IN factory_committed_statuses` (13 stages from `FACTORY_ORDERED` through `COMPLETED_EDITING`).
- `FactoryPayment` — filtered by `order_id IN orders AND method != 'CREDIT'`.

**Derived fields:**
- `debit` = `Σ(factory_price × qty) × exchange_rate` per order (factory cost in INR).
- `credit` = `FactoryPayment.amount_inr` per payment.
- `running_balance` = cumulative `debit - credit` after each entry.
- Summary triplets are sums across the filtered set.

**D-004 note:** `debit` column carries factory cost in INR — this is the D-004-restricted signal. The endpoint enforces role; the frontend must not leak it client-side either.

### F. Business logic embedded

1. **Debit = order value; credit = payment.** Positive net_balance = factory is owed money.
2. **Order filter applies always; date filter applies to payments only.** Documented asymmetry — a date-filtered view shows *all* factory debits + only payments within range. **Anti-pattern to carry forward only if surfaced clearly** — migration should add a UI hint.
3. **CREDIT-method payments excluded.** Internal reallocations never appear as ledger entries.
4. **`factory_committed_statuses`** defined in backend, not frontend — good, no drift risk.
5. **Download filename** constructed client-side: `factory_ledger_${factoryName || 'statement'}.{xlsx|pdf}`.
6. **P-002 silent swallow** on all three try/catch blocks (load factories, load ledger, download). Migration must replace with toast/banner.

### G. Design system coverage

**Layer 1 primitives in use (or that would be used after migration):**
- `Input` (search, date)
- `Select` (factory dropdown)
- `Button` (Excel / PDF variants — can map to `default` + `destructive` tones, or a new `warn` tone)
- `Card` wrappers for summary tiles

**Layer 2 composed components needed:**
- **`<LedgerPage>`** — proposed new extraction. The filter bar + summary cards + table + states structure is duplicated 1:1 between `FactoryLedger.vue` and `ClientLedger.vue`. The only diffs: entity dropdown source, column set (10 vs 8), and download endpoint. **Strong case for R-15-style "lift on first use" since the second use is already shipping in the same wave** (Client Ledger exists in the codebase today and will migrate next). Props sketch:
  ```ts
  interface LedgerPageProps<TEntity> {
    entityLabel: string;           // "Factory" / "Client"
    entities: TEntity[];           // dropdown options
    getEntityId: (e: TEntity) => string;
    getEntityLabel: (e: TEntity) => string;
    columns: LedgerColumn[];       // Factory has 10, Client has 8
    onLoad: (id: string, filters: DateRange) => Promise<LedgerResponse>;
    onDownload: (id: string, format: 'xlsx'|'pdf', filters: DateRange) => Promise<Blob>;
    permission: Resource;          // role gating
  }
  ```
- `StageChip` **does not** apply (no stage statuses here).
- `AlertDialog` **does not** apply (no destructive confirmations).
- Blob-download helper — candidate for Layer 2 `useBlobDownload()` hook or a small client util.

**`Design/screens/*.jsx`:** No finance/ledger screen reference exists in the design system snapshot. Visual pattern is ad-hoc Tailwind in Vue.

**Gaps:**
- No existing `LedgerPage` Layer 2.
- No existing blob-download util.
- Table primitive — currently hand-rolled. Not a blocker but an opportunity for a small `<DataTable>` wrapper used here + Clients + Transport.

### H. Complexity rating

**MODERATE (8–12 hours)** — 1.5× overrun applied.

**Base estimate:** 6 hours.
- 2h: Layer 2 `<LedgerPage>` design + extraction + tests.
- 2h: Route page + API proxy + role gate + preview verification.
- 1h: Blob download handler (client-side).
- 1h: Error/loading/empty polish.
- 6 × 1.5 ≈ 9h bumped to **8–12h range**.

**Factors:**
- No form complexity.
- D-004 gating demands careful server-side role check + RoleGate hiding.
- Blob download is minor but unfamiliar pattern vs prior migrations.
- Two pages land in one migration if bundled with Client Ledger (recommend bundling — see §Cross-cutting).

### I. Dependencies on other migrations

- **Depends on:** nothing already migrated. The sibling `FinanceLayout.vue` is *not* migrated, so `/finance/*` routes are still Vue-served; migrating `/finance/factory-ledger` means splitting out a single exact-match nginx route while the layout stays Vue. **This is a pattern break** — every prior migration landed a top-level page, not a nested child.
- **Could migrate standalone:** yes, by exact-matching `/finance/factory-ledger` in nginx. The sibling `Receivables` and `ClientLedger` tabs remain Vue — user navigation between tabs causes full-page reloads, acceptable per strangler-fig precedent.
- **Shared code opportunity:** ClientLedger migration should land in the same PR or immediately after, since `<LedgerPage>` is extracted for both.

### J. Role and permission requirements

- **View page:** SUPER_ADMIN | FINANCE (verified 403 for ADMIN on curl test with admin JWT).
- **Download:** same (both endpoints carry `Depends(require_factory_financial)`).
- **D-004 compliance:** enforced at endpoint-level. The Next.js page must additionally hide the Finance nav item for ADMIN and render a forbidden state if somehow reached.
- **Portal access:** internal only.
- **Patch 18 note (2026-04-22):** backend `require_finance` widened to `[SUPER_ADMIN, ADMIN, FINANCE]` at the router level; `require_factory_financial` at the endpoint level is the real D-004 enforcement ([SUPER_ADMIN, FINANCE]). ADMIN passes the router check but fails the endpoint check.

**Permission matrix current state (verified 2026-04-24 against [matrix.ts:74, 145, 184](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts)):**
- `FACTORY_LEDGER_VIEW` → `[FINANCE]` (explicit at line 145)
- SUPER_ADMIN reaches it via the global bypass in `permissions.ts` (matrix.ts line 5 header)
- ADMIN excluded per D-004 (matrix.ts line 184 comment confirms this is intentional)
- **No Layer 1 changes needed for this migration.** (Earlier draft speculated the key was `FACTORY_LEDGER_READ` — actual name is `FACTORY_LEDGER_VIEW`.)

### K. Current state / bugs / issues

1. **P-002 — all errors swallowed.** Load, download, and factory-list errors all `console.error` only. Must be fixed.
2. **Date filter asymmetry.** Applies to payments only — factory-order debits always included. Either make consistent or add UI hint.
3. **Factory dropdown has no pagination** (loads all). Fine for current volumes, re-evaluate if factory count >500.
4. **No role-gated nav hiding.** ADMIN can click the tab, gets 403. Migration should hide the tab via `RoleGate` in the finance layout.
5. **`amount_foreign` / `amount_usd` / `*_usd` summary fields fetched but never rendered.** Not a bug, but a cleanup target — either surface them (e.g. tooltip) or drop from the response.

### L. Labels inventory

All English; no i18n. Every string from audit profile's `InternalString` table applies:
- "Select a factory..."
- "From", "To"
- "Excel", "PDF"
- "Select a factory to view their ledger"
- "Total Debit", "Total Credit", "Net Balance"
- Column headers: "Date", "Order", "Remark", "Currency", "Forex Rate", "Debit (₹)", "Credit (₹)", "Balance (₹)", "Method", "Reference"
- "TOTALS"
- "No ledger entries found"

New strings the migration should add:
- Forbidden state for unauthorised access ("Finance team access only")
- Toast errors for load/download failures
- Tooltip explaining date filter asymmetry (if not making it consistent)

---

## 2. Clients List (`/clients`)

### A. Location in codebase

- **Vue file:** [frontend/src/views/clients/ClientList.vue](../../../frontend/src/views/clients/ClientList.vue) — **297 lines**
- **Peer form:** [frontend/src/views/clients/ClientForm.vue](../../../frontend/src/views/clients/ClientForm.vue) — **443 lines** (create + edit)
- **Route:** `/clients` → `ClientList` (meta.title: `'Clients'`, meta.icon: `'pi-users'`)
- **Also sibling routes** (`/clients/new`, `/clients/:id/edit`) — **out of scope** for this wave per research brief; flagged as follow-up.
- **Services used:**
  - `clientsApi.list(params)` → `GET /api/clients/`
  - `clientsApi.delete(id)` → `DELETE /api/clients/{id}/`
- **Composables:** `useRouter` inline.
- **Audit profile:** [docs/migration-audit/pages/internal_clients_list.md](../../migration-audit/pages/internal_clients_list.md)

### B. User flow walkthrough

- **Primary persona:** ADMIN and OPERATIONS (client-facing order ops). FINANCE reads-only.
- **Entry point:** Sidebar `Clients` menu item (pi-users icon).
- **Step-by-step:**
  1. Page mounts → `loadClients()` with `page=1&per_page=50`.
  2. Table renders 6 columns; counter shows total.
  3. User types in search (debounced 400ms) → `page` resets to 1 → refetch.
  4. Pagination: click page number or prev/next chevron.
  5. **Row-level Edit** → navigate to `/clients/{id}/edit` (still Vue until ClientForm migrates).
  6. **Row-level Delete** → confirm modal → `DELETE /api/clients/{id}/` → list reloads.
  7. **Page-level "Add Client"** → `/clients/new` (still Vue).
- **Error paths:** Load fail → silent (P-002). Delete fail → modal closes silently, row stays.
- **Where they go next:** Edit form (Vue fall-through) or Client Ledger (Vue, still under Finance layout).

### C. Fields and interactions inventory

**Filter bar (1 input):**
| Control | Type | Behaviour |
|---|---|---|
| Search | `<input>` with pi-search | Placeholder: "Search by company name, GSTIN, city, contact..." · 400ms debounce · resets page to 1 |

No category/status filter tabs — simpler than products list.

**Table — 6 columns:**

| # | Header | Source | Notes |
|---|---|---|---|
| 1 | Company Name | `client.company_name` | `font-medium` |
| 2 | GSTIN | `client.gstin` | `font-mono`; "Not provided" italic if absent |
| 3 | Location | `[city, state].filter(Boolean).join(', ')` + `pincode` on 2nd line | em-dash if both absent |
| 4 | Contact | `contact_name` + `contact_phone` on 2nd line | em-dash if absent |
| 5 | IEC / PAN | Badge pair (indigo-50 IEC · slate-100 PAN) | em-dash if both absent |
| 6 | Actions | Edit (pencil icon) + Delete (trash icon) | right-aligned |

**Actions:**
- Page-level: "Add Client" router-link (emerald-600).
- Row-level: Edit (navigates), Delete (opens custom confirm modal).
- No bulk selection.

**States:** `loading` · `data` · `empty` · `load-error` (silent) · `delete-error` (silent).

**Special patterns:** Custom inline delete modal (pi-exclamation-triangle icon, plain Cancel/Delete buttons — **no typed confirmation** unlike products list's 3-scenario dialog). Pagination with ±1 window + ellipsis at ±2.

### D. API endpoints used

**Verified live on 2026-04-24 (shape = `{items, total, page, per_page, pages}` — empty DB but endpoint responds):**

| # | Method | URL | Request | Response | OpenAPI typed? | Role |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/clients/` | `?page&per_page&search` | `{items: Client[], total, page, per_page, pages}` | **Yes** (`$ref`) | INTERNAL — any |
| 2 | DELETE | `/api/clients/{id}/` | — | 204 / error detail | Untyped | ADMIN \| OPERATIONS \| SUPER_ADMIN (G-013 CLOSED via Patch 12) |

**ClientResponse shape (from OpenAPI `$ref`):** Includes `id`, `company_name`, `gstin`, `iec`, `pan`, `address`, `city`, `state`, `pincode`, `contact_name`, `contact_phone`, `contact_email`, `notes`, `client_type`, `is_active`, timestamps, **AND** `factory_markup_percent`, `sourcing_commission_percent`.

**Cluster D concern (open):** Margin fields are fetched for every client but never rendered in the list. Migration should define a `ClientListItem` projection that omits them (frontend-only filter until backend adds a `/clients/list-projection/` endpoint). Pattern precedent: products-list's Product type includes `replace_variant_id` also not rendered — acceptable trade-off, same approach here.

### E. Data model

**`Client`** — primary master data record for buyers/importers. Fields: identity (`company_name`, `gstin`, `iec`, `pan`, `client_type`), address (`address`, `city`, `state`, `pincode`), contact (`contact_name`, `contact_phone`, `contact_email`), notes, margin config (`factory_markup_percent`, `sourcing_commission_percent`), flags (`is_active`, `deleted_at`).

**Relationships:**
- `Order.client_id` FK — delete is soft (preserve order history).
- Also referenced by `/finance/client-ledger/{client_id}/` (peer ledger page).

**Computed/derived:** None client-side. `totalPages` derived from `totalItems / perPage`.

### F. Business logic embedded

1. **Soft delete only.** Confirmed via backend `DELETE /api/clients/{id}/` setting `deleted_at = utcnow()`, `is_active = False`. Clients disappear from subsequent list loads.
2. **Per-page hardcoded at 50.** No page-size selector.
3. **Search resets to page 1.** Prevents empty-results-on-page-3 confusion.
4. **Pagination window pattern** — same as products-list (±1 window, ellipsis at ±2, first/last always shown). Candidate for shared `<Pagination>` Layer 2.
5. **Delete confirms by company name only** — no typed-confirmation guard. Migration should decide: match products-list's scenario dialog, or keep simple. Recommendation: **simple inline** — clients don't have the "bulk with DELETE" scenario products had.

### G. Design system coverage

**Layer 1:** `Input`, `Button`, Card wrappers for table container.  
**Layer 2:**
- **`<Pagination>`** — proposed extraction (3rd use case: products-list already inlined; transporters will also need it).
- **`<DeleteConfirmDialog>`** — proposed thin wrapper over `AlertDialog` primitive (already built for products-form) that takes a subject label. Used by clients + transporters + (future) factories.
- `RoleGate` + `canAccess(PRODUCT_LIST)` analogue with `CLIENT_CREATE`/`CLIENT_DELETE` keys — check matrix.ts; if not present, add.

**Gaps:** `<Pagination>` absent from Layer 2 today — good candidate to extract as part of this migration (used in 3 known places + likely in factories list later).

### H. Complexity rating

**SIMPLE-MODERATE (6–8 hours)** — 1.5× overrun applied.

**Base estimate:** 4–5h.
- 1h: Route page + server-side initial load.
- 1h: Client component with search + pagination.
- 1h: Delete modal + API proxy.
- 1h: Tests (target ~20 tests like orders-list).
- 1h: nginx + MIGRATED_PATHS + preview.
- 5 × 1.5 ≈ 7.5h → **6–8h**.

**Factors reducing risk:**
- OpenAPI schema is typed (`$ref` present).
- G-013 closed — backend role-gating complete.
- Same structural pattern as orders-list (already migrated) — reference implementation available.

**Factors adding risk:**
- `ClientListItem` projection decision (include margin fields? strip them?).
- First migration to extract `<Pagination>` — design that component well.

### I. Dependencies on other migrations

- **Depends on:** none that are migrated. Links out to `/clients/new` and `/clients/{id}/edit` remain Vue.
- **Shared code with Transport:** pagination component, delete-confirm modal, list table patterns, empty states.
- **Migrate standalone:** yes. Cleanest first target.

### J. Role and permission requirements

- **View page:** any INTERNAL role.
- **"Add Client" button:** ADMIN, OPERATIONS, SUPER_ADMIN per backend gate on `POST /api/clients/` (G-013). Migration must RoleGate the button.
- **Edit link:** gated by `PUT /api/clients/{id}/` — same roles as create.
- **Delete action:** same. Backend enforces; frontend must gate visibility.
- **Portal:** internal only.

**Permission matrix current state (verified 2026-04-24 against [matrix.ts](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts)):**
- `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE` are **all MISSING** from matrix.ts.
- No `CLIENT_LIST` or `CLIENT_VIEW` key exists either — list access is currently governed only by route-level `requiresAuth` + `INTERNAL` user-type checks. Migration can rely on that for the list page itself.
- `CLIENT_PORTAL_ACCESS` exists at line 84 but is a **separate concept** (role-based access to the client portal for `CLIENT` users, not internal CRUD permissions). Not a substitute.

**BLOCKING:** Clients migration requires a Layer 1 permission commit *first*, following the pattern from the products-list wave (commit [3909ec1](../../../../): `feat(lib): add PRODUCT_CREATE and PRODUCT_UPDATE permissions`). Add:
- `CLIENT_CREATE` → `[ADMIN, OPERATIONS, SUPER_ADMIN]`
- `CLIENT_UPDATE` → `[ADMIN, OPERATIONS, SUPER_ADMIN]`
- `CLIENT_DELETE` → `[ADMIN, SUPER_ADMIN]`

(Confirm `DELETE` role scope during Phase 2. Backend `DELETE /api/clients/{id}/` currently accepts `ADMIN | OPERATIONS | SUPER_ADMIN` per G-013 notes — tighten frontend to `[ADMIN, SUPER_ADMIN]` if aligning with transport's stricter delete pattern, or match backend exactly.)

This is the **first commit** of `feat/migrate-clients-list`, separate from page work.

### K. Current state / bugs / issues

1. **P-002 — all errors swallowed** on list-load and delete.
2. **Cluster D open** — margin fields in list response. Either frontend-project or backend-filter in list endpoint.
3. **"Add Client" button visible to all internal roles** — must gate per G-013 in migration.
4. **No D-003 typed confirmation on delete.** Current pattern acceptable; flag for decision.
5. **Pagination logic copy-pasted** from products-list/factories-list/transport-list — extract once.

### L. Labels inventory

All English. Key strings:
- "Clients", "{n} clients"
- "Add Client"
- Search: "Search by company name, GSTIN, city, contact..."
- Column headers: "Company Name", "GSTIN", "Location", "Contact", "IEC / PAN", "Actions"
- Empty: "No clients found", "+ Add your first client"
- Loading: "Loading clients..."
- Delete modal: "Delete Client", "Are you sure you want to delete:", "Cancel", "Delete"
- "Not provided" (GSTIN fallback)

New strings migration should add: toast for load/delete errors (P-002 fix).

---

## 3. Transporters List (`/transport`)

### A. Location in codebase

- **Vue file:** [frontend/src/views/transport/TransportList.vue](../../../frontend/src/views/transport/TransportList.vue) — **313 lines**
- **Peer form:** [frontend/src/views/transport/TransportForm.vue](../../../frontend/src/views/transport/TransportForm.vue) — **494 lines** (create + edit) — **out of scope** this wave.
- **Route:** `/transport` → `TransportList` (meta.title: `'Service Providers'`, meta.icon: `'pi-truck'`)
- **Services used:**
  - `transportApi.list(params)` → `GET /api/shipping/transport/`
  - `transportApi.delete(id)` → `DELETE /api/shipping/transport/{id}/`
- **Composables:** `useRouter` inline.
- **Backend router path:** `backend/routers/shipping.py` (NOT `transport.py`); `_serialize_provider` defines the response shape.
- **Audit profile:** [docs/migration-audit/pages/internal_transport.md](../../migration-audit/pages/internal_transport.md)

### B. User flow walkthrough

- **Primary persona:** OPERATIONS and ADMIN (maintain logistics contacts).
- **Entry point:** Sidebar `Transport` menu (pi-truck icon).
- **Step-by-step:**
  1. Mount → `loadProviders()` → table of 5 columns.
  2. User searches / paginates / clicks Edit / clicks Delete — identical pattern to Clients.
  3. Delete confirm modal → `DELETE /api/shipping/transport/{id}/` → reload.
- **Error paths:** Same swallow pattern as Clients.
- **Where next:** Edit form (Vue fall-through) or shipment detail pages that reference providers (not migrated).

### C. Fields and interactions inventory

Search placeholder: "Search by name, contact, city..."

**Table — 6 columns:**

| # | Header | Source | Notes |
|---|---|---|---|
| 1 | Name | `p.name` | |
| 2 | Roles | `p.roles[]` via `roleLabelMap`/`roleColorMap` | Badge-pill per role (4 colours: blue/green/orange/purple) |
| 3 | Contact | `contact_person` + `phone` | |
| 4 | Location | `city + state` joined | |
| 5 | GST / PAN | Badge pair | |
| 6 | Actions | Edit + Delete | |

**Role badges (NEW pattern, not in Clients):**
- `FREIGHT_FORWARDER` → "Freight Forwarder" / blue
- `CHA` → "CHA" / green
- `CFS` → "CFS" / orange
- `TRANSPORT` → "Transport" / purple

Multiple roles per provider shown as a wrap of pills.

**Actions / states / modals:** Same patterns as Clients.

### D. API endpoints used

**Verified live on 2026-04-24:**

| # | Method | URL | Request | Response | OpenAPI typed? | Role |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/shipping/transport/` | `?page&per_page&search` | `{items, total, page, per_page, pages}` | **No** (`[]`) | INTERNAL — any |
| 2 | DELETE | `/api/shipping/transport/{id}/` | — | 204 | Untyped | ADMIN \| SUPER_ADMIN (G-014 CLOSED via Patch 13) |

**Response entity shape (from `_serialize_provider` in `backend/routers/shipping.py`):**
```ts
interface ServiceProvider {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;           // default "India"
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  roles: Array<'FREIGHT_FORWARDER' | 'CHA' | 'CFS' | 'TRANSPORT'>;
  operating_ports: string[];         // free-text tags
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Clean data** — no factory_price / markup / margin fields. No Cluster D risk here.

**Migration note:** OpenAPI untyped → define local `ServiceProvider` interface in types.ts (same pattern as products-list).

### E. Data model

**`ServiceProvider`** — one record per logistics partner; `roles[]` is a many-valued enum.

**Relationships:**
- Referenced by shipment/booking entities (not migrated).
- No cascading delete — soft-delete only via `is_active = False`.

**Computed:** None client-side.

### F. Business logic embedded

1. **Defensive total handling:** `totalItems.value = data.total || providers.value.length` — migration should resolve whether API always returns `total` (verified live: **yes, always returned** as `{items, total, page, per_page, pages}`). Remove the defensive fallback.
2. **Role badge colour hardcoded** in two places — `roleLabelMap` + `roleColorMap` in TransportList and `availableRoles` in TransportForm. **Consolidate** into `SERVICE_PROVIDER_ROLES` constant during migration (even if only List migrates first — put it in a `_components/constants.ts` that the future Form can import).
3. **Per-page hardcoded at 50.**
4. **Soft delete.** Same as Clients.

### G. Design system coverage

**Layer 1:** `Input`, `Button`, Card wrappers.  
**Layer 2:**
- **`<Pagination>`** — same proposed extraction as Clients.
- **`<DeleteConfirmDialog>`** — same.
- **New: role-badge component.** Simple — can stay inline as a `<ProviderRoleBadge role={r} />` local component; not worth Layer 2 unless future screens also show these roles.

**Gaps:** Same as Clients.

### H. Complexity rating

**SIMPLE-MODERATE (5–7 hours — when bundled with Clients shared extractions)** / **6–8 hours standalone**.

**Base estimate (bundled):** 3–4h.
- 1h: Route page + client component (mostly copy-paste from Clients with 6-col table swap).
- 0.5h: Role-badge component.
- 1h: Delete proxy + reuse `<DeleteConfirmDialog>`.
- 0.5h: Tests (~12 new).
- 0.5h: nginx + MIGRATED_PATHS + preview.
- 3.5 × 1.5 ≈ 5.25h → **5–7h bundled**.

**Factors reducing risk:**
- Second list migration in the wave — patterns solidify.
- G-014 closed.
- Clean response shape.

**Factors adding risk:**
- First page to handle multi-valued enum display (roles) — minor.
- Defensive `|| providers.length` — audit the backend behaviour during migration.

### I. Dependencies on other migrations

- **Depends on:** none.
- **Shared code opportunity:** all extractions from Clients (Pagination, DeleteConfirmDialog).
- **Migrate standalone:** yes; best bundled with Clients for shared-code amortisation.

### J. Role and permission requirements

- **View:** any INTERNAL.
- **"Add Provider" button:** ADMIN | OPERATIONS | SUPER_ADMIN (backend G-014).
- **Edit:** same.
- **Delete:** ADMIN | SUPER_ADMIN (stricter than create/edit).
- **Portal:** internal only.

**Permission matrix current state (verified 2026-04-24 against [matrix.ts](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts)):**
- `TRANSPORT_CREATE`, `TRANSPORT_UPDATE`, `TRANSPORT_DELETE` are **all MISSING** from matrix.ts.
- No `TRANSPORT_LIST` or `TRANSPORT_VIEW` key exists — list-page access falls back to the route-level INTERNAL-only guard.

**BLOCKING:** Transporters migration requires a Layer 1 permission commit *first*, same pattern as Clients.
- `TRANSPORT_CREATE` → `[ADMIN, OPERATIONS, SUPER_ADMIN]`
- `TRANSPORT_UPDATE` → `[ADMIN, OPERATIONS, SUPER_ADMIN]`
- `TRANSPORT_DELETE` → `[ADMIN, SUPER_ADMIN]`

(Confirm `DELETE` role scope during Phase 2 — backend G-014 already enforces `[ADMIN, SUPER_ADMIN]` for delete, so this matches.)

First commit of `feat/migrate-transporters-list`.

### K. Current state / bugs / issues

1. **P-002 swallow** on load and delete.
2. **`Array.splice` direct mutation in `toggleRole`** (form file, out of scope) — note for future.
3. **Role badge styling duplicated** across List and Form — unify.
4. **No D-003 on delete** — same decision needed as Clients.

### L. Labels inventory

All English. Key strings:
- "Service Providers", "{n} providers"
- "Add Provider"
- Search: "Search by name, contact, city..."
- Column headers: "Name", "Roles", "Contact", "Location", "GST / PAN", "Actions"
- Empty: "No service providers found", "+ Add your first provider"
- Loading: "Loading providers..."
- Role labels: "Freight Forwarder", "CHA", "CFS", "Transport"
- Delete modal: "Delete Provider", "Are you sure you want to delete:", "Cancel", "Delete"

---

## Cross-cutting analysis

### Shared code opportunities

| Concept | Factory Ledger | Clients List | Transporters List |
|---|---|---|---|
| Filter bar pattern | Dropdown + 2 date pickers | Search | Search |
| Pagination window pattern | — (no pagination; ledger is all-or-date-filtered) | ±1 with ellipsis at ±2 | Same |
| Delete confirm modal | — | Company-name subject | Provider-name subject |
| Table wrapper (Card + overflow-x-auto + header row + empty state) | ✓ | ✓ | ✓ |
| "Add X" CTA with role-gate | — | ✓ | ✓ |
| Role-gated nav item | ✓ (D-004) | — | — |
| Blob download | ✓ | — | — (could appear later with a "download contacts CSV" affordance) |
| Summary cards (Total X / Net) | ✓ | — | — |
| Multi-valued enum badge | — | — | Roles (4-value) |
| Local projection to strip margin | — | ✓ (Cluster D) | — (clean backend shape) |

**Biggest shared-code win:** `<LedgerPage>` covers Factory + Client ledgers in one extraction (halves the Factory Ledger PR cost).  
**Second biggest:** `<Pagination>` + `<DeleteConfirmDialog>` applied across Clients + Transporters (and later Factories list, Orders detail, etc.).

### Layer 1 permission prep required

Before Clients and Transporters migrations can build pages, **six new permission keys** must be added to [matrix.ts](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts) following the pattern from commit [3909ec1](../../../../) (`feat(lib): add PRODUCT_CREATE and PRODUCT_UPDATE permissions`):

| Key                | Scope (explicit)              | Required by          |
|--------------------|-------------------------------|----------------------|
| `CLIENT_CREATE`    | `ADMIN, OPERATIONS`           | Clients migration    |
| `CLIENT_UPDATE`    | `ADMIN, OPERATIONS`           | Clients migration    |
| `CLIENT_DELETE`    | `ADMIN`                       | Clients migration    |
| `TRANSPORT_CREATE` | `ADMIN, OPERATIONS`           | Transporters         |
| `TRANSPORT_UPDATE` | `ADMIN, OPERATIONS`           | Transporters         |
| `TRANSPORT_DELETE` | `ADMIN`                       | Transporters         |

SUPER_ADMIN gets all via the global bypass (matrix.ts line 5 header — `SUPER_ADMIN` bypasses all checks via `has_any_role` in `permissions.ts`).

**Factory Ledger does NOT need Layer 1 changes.** `FACTORY_LEDGER_VIEW` already exists at [matrix.ts:74](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts) with scope `[FINANCE]` (and SUPER_ADMIN via bypass).

### Migration sequencing recommendation

**Updated sequence (factoring Layer 1 prep):**

1. **`feat/migrate-factory-ledger` (no Layer 1 prep needed, 10–14 h for the Factory + Client Ledger bundle)**
   - Uses existing `FACTORY_LEDGER_VIEW` permission — zero matrix.ts churn.
   - **Builds** the `<LedgerPage>` Layer 2 component (does **not** exist yet — earlier draft of this doc flagged it as "proposed"; reiterating here for clarity).
   - Wires Factory Ledger with D-004 role gate + blob download.
   - Wires Client Ledger as the second consumer in the same PR (validates the abstraction).
   - **Rationale for moving to #1:** zero Layer 1 prep, highest shared-code payoff (two pages ship), D-004 is well-understood from products-form experience, blob download is small new pattern best learned early.

2. **`feat/migrate-clients-list` (6–8 h + 0.5 h for the permission commit)**
   - **Commit 1:** `feat(lib): add CLIENT_CREATE/UPDATE/DELETE permissions` (must land first — mirrors 3909ec1 cadence).
   - **Commits 2+:** page implementation. Extracts `<Pagination>` and `<DeleteConfirmDialog>` to Layer 2 (both new).
   - Decides `ClientListItem` projection (strip margin fields frontend-side for Cluster D).

3. **`feat/migrate-transporters-list` (5–7 h + 0.5 h for the permission commit)**
   - **Commit 1:** `feat(lib): add TRANSPORT_CREATE/UPDATE/DELETE permissions`.
   - **Commits 2+:** page implementation. Reuses Layer 2 components from step 2.
   - Adds inline `<ProviderRoleBadge>` (local, single-use).
   - Verifies `data.total` always present → removes defensive fallback.

**Rationale for the new order:**
- Factory Ledger first because it has **zero Layer 1 prep** and delivers two migrated pages via the `<LedgerPage>` extraction.
- Clients and Transporters each carry a small Layer 1 commit before page work, matching the 3909ec1 precedent.
- Ledger *implementation* complexity is actually lowest once `<LedgerPage>` is built — the abstraction does most of the work; the list pages are moderate (more custom UI but pattern established from products-list).

**Total:** **22–32 hours** across the wave. Three sessions, roughly 1 per migration.

**Bundling judgement:**
- Clients + Transporters together: **not recommended as one PR** — 13–15h is too big a diff and would fail the products-list lesson (we regretted that PR size). Two sequential PRs, same branch cadence.
- Factory Ledger + Client Ledger: **recommended as one PR** — they share the `<LedgerPage>` extraction directly; splitting means the extraction ships unused between PRs.

**Hard cases:** None. These are all "standard" list/ledger migrations.

### New Layer 2 components needed

| Component | Ownership wave | Consumers (proven) | Consumers (likely) | Justify lift now |
|---|---|---|---|---|
| `<Pagination>` | Clients migration | Clients, Transporters | Factories list, Users list, Audit logs list | **YES** — 4+ known uses, exact same logic copied in every Vue file today. |
| `<DeleteConfirmDialog>` | Clients migration | Clients, Transporters | Factories list, future admin pages | **YES** — thin wrapper over existing AlertDialog primitive; no cost to lift. |
| `<LedgerPage>` | Factory Ledger bundle | Factory Ledger, Client Ledger | — | **YES (R-15 "lift on first known upcoming use")** — the second use ships in the same bundle. |
| `useBlobDownload()` (hook) | Factory Ledger bundle | Factory Ledger, Client Ledger | Future: orders export, products export | **YES** — small hook, obvious shape, reused twice immediately. |
| `<ProviderRoleBadge>` | Transporters migration | Transporters | — (single use) | **NO** — keep as local component; consider lift only if Shipments page also uses it. |

### Backend endpoint gaps

No **blocking** gaps found. Minor notes:
- **OpenAPI schemas untyped** for transport and finance routes. Not a blocker — local-interface pattern handles it (same as products-form did for check-variants).
- **`/api/clients/` returns margin fields in list response** — not a bug, but Cluster D open item. Frontend-project workaround is acceptable for this wave.
- **Factory-ledger response ships `*_usd` fields** the UI doesn't render. Optional follow-up: either surface them or drop from response.
- **No N+1 concerns.** `get_factory_ledger` uses `joinedload(Order.items)` and batches payments by order IDs. Clients and transport lists are flat paged queries.
- **`data.total` defensive fallback in transport** — confirmed always returned on curl. Migration can drop the fallback safely.

### Risk summary

| Migration | Risk | Rationale |
|---|---|---|
| Clients list | **low** | Typed OpenAPI schema, closed backend gate, simplest pattern, orders-list gives a reference implementation. Only wrinkle: Cluster D margin projection decision. |
| Transporters list | **low** | Identical pattern to Clients; untyped response but local-interface pattern proven; clean data shape. |
| Factory Ledger | **medium** | D-004 enforcement requires careful RoleGate + backend end-to-end verification with a non-admin JWT. First blob-download pattern in Next.js. Bundling Client Ledger doubles surface area but keeps the abstraction honest. |

**Biggest cross-migration risk:** getting the `<LedgerPage>` abstraction right on first try. Mitigation:
1. Draft the props interface up-front (similar to ProductForm's `mode` union).
2. Build with Factory Ledger as the "hard" consumer (10 columns, D-004 gate, download).
3. Validate with Client Ledger in the same PR — if Client Ledger can't cleanly consume the API, redesign before merging.

**Second-biggest risk:** the Cluster D margin-field exposure on Clients list. Mitigation: frontend-project `ClientListItem` type that omits `factory_markup_percent` and `sourcing_commission_percent` before the data reaches the client component. Open a separate backend ticket to add a proper projection endpoint.

---

## Appendix — Out-of-scope follow-ups flagged by this research

1. **ClientForm.vue migration** (443 lines) — needed to fully close the clients module; use products-form as template (but simpler — no variant mode, no image gallery).
2. **TransportForm.vue migration** (494 lines) — 4 section cards + role card grid + tag input; moderate complexity.
3. **Client Ledger standalone audit pass** if not bundled with Factory Ledger.
4. **FinanceLayout.vue migration** — parent layout still Vue; migrating children individually is a pattern break worth discussing.
5. **Backend ticket — Cluster D projection** for `/api/clients/` list response.
6. **Backend ticket — factory-ledger** summary `*_usd` fields either surface or drop.
7. ~~matrix.ts permission keys — confirm `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE`, `TRANSPORT_CREATE`, `TRANSPORT_UPDATE`, `TRANSPORT_DELETE`, `FACTORY_LEDGER_READ` exist; add if missing.~~ **Resolved 2026-04-24** — see §Cross-cutting analysis → *Layer 1 permission prep required*. Six client/transport keys confirmed missing; Factory Ledger's key exists as `FACTORY_LEDGER_VIEW` (not `_READ` as originally speculated).
