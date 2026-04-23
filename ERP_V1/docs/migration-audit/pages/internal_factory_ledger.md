# Internal Factory Ledger

**Type:** page (finance ledger — factory costs)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/finance/factory-ledger` → `FactoryLedger` (meta.title: `'Factory Ledger'`); child of `FinanceLayout`
**Vue file:** [frontend/src/views/finance/FactoryLedger.vue](../../../frontend/src/views/finance/FactoryLedger.vue)
**Line count:** 175
**Migration wave:** Wave 5 (internal tracking — finance)
**Risk level:** low (resolved) — factory CNY cost data restricted to SUPER_ADMIN|FINANCE; Cluster A (AUTH_TOO_PERMISSIVE) RESOLVED by Patch 18 (2026-04-22)

---

## Purpose

Double-entry factory payment ledger for INTERNAL finance users showing factory order values as debits and factory payments as credits chronologically for a selected factory, with currency and exchange-rate columns, date-range filtering, and Excel/PDF download.

---

## Layout

### Outer container
`div.p-6.space-y-5` (inside FinanceLayout content area)

**Zone 1 — Filter bar** (`flex items-end gap-4 flex-wrap`)
- Factory dropdown: "Select a factory..." + list from `factoriesApi.list()`
- "From" date picker
- "To" date picker
- Download buttons (shown only when `selectedFactory && entries.length > 0`):
  - "Excel" → `downloadStatement('xlsx')` — emerald-600
  - "PDF" → `downloadStatement('pdf')` — red-600

**Zone 2 — No-factory prompt** (when `!selectedFactory`)
`pi-building` icon + "Select a factory to view their ledger"

**Zone 3 — Loading state**
Centred `pi-spin pi-spinner`

**Zone 4 — Ledger content** (when `entries.length > 0`)

Summary cards (identical layout to ClientLedger):
| Card | Metric |
|---|---|
| Total Debit | `formatCurrency(summary.total_debit)` |
| Total Credit | `formatCurrency(summary.total_credit)` |
| Net Balance | `formatCurrency(summary.net_balance)` |

Ledger table (10 columns — 2 more than ClientLedger):

| Col | Header | Content |
|---|---|---|
| 1 | Date | `e.date` |
| 2 | Order | `e.order_number` — font-mono indigo-600 |
| 3 | Remark | `e.remark` |
| 4 | Currency | `e.currency` — mono xs |
| 5 | Forex Rate | `e.exchange_rate.toFixed(2)` or `'-'` |
| 6 | Debit (₹) | `formatCurrency(e.debit)` — red-600 if >0 |
| 7 | Credit (₹) | `formatCurrency(e.credit)` — emerald-600 if >0 |
| 8 | Balance (₹) | `formatCurrency(e.running_balance)` — amber/emerald |
| 9 | Method | `e.method` (spaces from `_`) |
| 10 | Reference | `e.reference` |

Table footer: TOTALS row for cols 6–8 (debit/credit/balance).

**Zone 5 — No entries**
`pi-database` icon + "No ledger entries found"

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `date` | `financeApi.factoryLedger()` | ISO date | |
| `order_number` | `financeApi.factoryLedger()` | font-mono indigo | |
| `remark` | `financeApi.factoryLedger()` | text | "Factory order for {order_number}" or payment notes |
| `currency` | `financeApi.factoryLedger()` | mono xs | e.g., "CNY" |
| `exchange_rate` | `financeApi.factoryLedger()` | 2 d.p. | CNY→INR rate used for the order |
| `debit` | `financeApi.factoryLedger()` | `formatCurrency` | Factory order value in INR (`factory_price × qty × rate`) |
| `credit` | `financeApi.factoryLedger()` | `formatCurrency` | Payment made to factory in INR |
| `running_balance` | `financeApi.factoryLedger()` | `formatCurrency` | Positive = factory owed; negative = overpaid |
| `method` | `financeApi.factoryLedger()` | text | Payment method or `'-'` for order entries |
| `reference` | `financeApi.factoryLedger()` | text | |

**P-007 checklist:** `factory_price` is not surfaced directly in the response. However, backend `get_factory_ledger` (finance.py:1530) computes `total_cny = sum(factory_price × qty)` per order and includes it as `amount_foreign` in the raw entry. The INR `debit` field (`total_inr = total_cny × exchange_rate`) is factory cost data. `currency` and `exchange_rate` columns are also factory-cost-adjacent. This page **intentionally exposes factory cost totals** — access is restricted to FINANCE (and theoretically SUPER_ADMIN per D-004 intent). **Cluster A issue:** ADMIN role can reach the FinanceLayout but is blocked by the endpoint-level `require_factory_financial`; SUPER_ADMIN is blocked by the router-level `require_finance`. Effective access: FINANCE only. Deferred to Wave 0 per AUTHZ_SURFACE.md.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadFactories()` | `GET /api/factories/` | Populates factory dropdown |
| `selectedFactory` / `startDate` / `endDate` change | `watch` → `loadLedger()` | `GET /api/finance/factory-ledger/{factory_id}/` | Loads ledger entries |
| `selectedFactory` cleared | `loadLedger()` short-circuits | None | `entries = []` |
| "Excel" button click | `downloadStatement('xlsx')` | `GET /api/finance/factory-ledger/{factory_id}/download/` | Blob download as `.xlsx` |
| "PDF" button click | `downloadStatement('pdf')` | `GET /api/finance/factory-ledger/{factory_id}/download/` | Blob download as `.pdf` |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/factories/` | `factoriesApi.list()` | None | Populates dropdown |
| GET | `/api/finance/factory-ledger/{factory_id}/` | `financeApi.factoryLedger(id, params)` | `start_date`, `end_date` (optional) | Returns factory cost data — FINANCE-only. Cluster A (AUTH_TOO_PERMISSIVE). |
| GET | `/api/finance/factory-ledger/{factory_id}/download/` | `financeApi.downloadFactoryLedger(id, format, params)` | `format` (xlsx/pdf), `start_date`, `end_date` | Returns file blob; same auth surface |

> **Security cross-reference (Cluster A):** Per AUTHZ_SURFACE.md lines 48–49:
> - `GET /api/finance/factory-ledger/{factory_id}/` has endpoint-level `Depends(require_factory_financial)` = SUPER_ADMIN|FINANCE AND router-level `require_finance` = ADMIN|FINANCE. Effective access = FINANCE only (intersection). D-004 intends SUPER_ADMIN|FINANCE to access factory cost data, but SUPER_ADMIN is currently locked out by the router-level `require_finance` check. Status: AUTH_TOO_PERMISSIVE per AUTHZ_SURFACE.md — deferred to Wave 0.
> - Same issue applies to the `/download/` endpoint (finance.py:1835).

> Per D-001 (Option B): in Next.js these become `client.finance.factoryLedger(...)` etc. via the generated SDK.

---

## Composables consumed

None. No `useRouter()` — no navigation from this page.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-building`, `pi-spin`, `pi-spinner`, `pi-file-excel`, `pi-file-pdf`, `pi-database`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(false)` | `false` | Spinner |
| `factories` | `ref([])` | `[]` | Factory dropdown options |
| `selectedFactory` | `ref('')` | `''` | Active factory selection |
| `startDate` | `ref('')` | `''` | Date range start |
| `endDate` | `ref('')` | `''` | Date range end |
| `entries` | `ref([])` | `[]` | Ledger rows |
| `summary` | `ref({total_debit, total_credit, net_balance})` | all 0 | Summary cards |
| `factoryName` | `ref('')` | `''` | Used in download filename |

**Watch:**
`watch([selectedFactory, startDate, endDate], loadLedger)` — reactive re-fetch.

`onMounted` calls `loadFactories()` only.

---

## Permissions / role gating

- Route `/finance/factory-ledger` has **no `meta.roles`** — all INTERNAL users can navigate here via FinanceLayout tabs; they receive a backend 403 if they lack the required role.
- **Backend effective access: SUPER_ADMIN | FINANCE** — correct per D-004.
- **Dual-dependency pattern (verified 2026-04-22):**
  - Router-level: `require_finance = require_role([SUPER_ADMIN, ADMIN, FINANCE])` — all INTERNAL roles except OPERATIONS pass (OPERATIONS blocked here)
  - Endpoint-level: `require_factory_financial = require_role([SUPER_ADMIN, FINANCE])` — ADMIN additionally blocked here
  - Net: only SUPER_ADMIN and FINANCE reach the handler
- **D-004 compliance:** ADMIN excluded from factory financial data ✅. SUPER_ADMIN has access ✅. OPERATIONS excluded ✅.
- **Cluster A — RESOLVED (Patch 18, 2026-04-22).** `require_finance` widened from `[ADMIN, FINANCE]` to `[SUPER_ADMIN, ADMIN, FINANCE]`. SUPER_ADMIN access is now explicit (was implicit via `has_any_role()` bypass). Verified 27/27 matrix checks pass.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.factory_ledger.select_factory` | "Select a factory..." | "" | `InternalString` |
| `internal.factory_ledger.from_label` | "From" | "" | `InternalString` |
| `internal.factory_ledger.to_label` | "To" | "" | `InternalString` |
| `internal.factory_ledger.download_excel` | "Excel" | "" | `InternalString` |
| `internal.factory_ledger.download_pdf` | "PDF" | "" | `InternalString` |
| `internal.factory_ledger.prompt` | "Select a factory to view their ledger" | "" | `InternalString` |
| `internal.factory_ledger.total_debit` | "Total Debit" | "" | `InternalString` |
| `internal.factory_ledger.total_credit` | "Total Credit" | "" | `InternalString` |
| `internal.factory_ledger.net_balance` | "Net Balance" | "" | `InternalString` |
| `internal.factory_ledger.col_date` | "Date" | "" | `InternalString` |
| `internal.factory_ledger.col_order` | "Order" | "" | `InternalString` |
| `internal.factory_ledger.col_remark` | "Remark" | "" | `InternalString` |
| `internal.factory_ledger.col_currency` | "Currency" | "" | `InternalString` |
| `internal.factory_ledger.col_forex` | "Forex Rate" | "" | `InternalString` |
| `internal.factory_ledger.col_debit` | "Debit (₹)" | "" | `InternalString` |
| `internal.factory_ledger.col_credit` | "Credit (₹)" | "" | `InternalString` |
| `internal.factory_ledger.col_balance` | "Balance (₹)" | "" | `InternalString` |
| `internal.factory_ledger.col_method` | "Method" | "" | `InternalString` |
| `internal.factory_ledger.col_reference` | "Reference" | "" | `InternalString` |
| `internal.factory_ledger.totals` | "TOTALS" | "" | `InternalString` |
| `internal.factory_ledger.no_entries` | "No ledger entries found" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| No factory selected | `!selectedFactory` | Yes — icon + "Select a factory to view their ledger" | |
| Loading | `loading === true` | Yes — centred spinner | |
| Empty ledger | `entries.length === 0 && !loading && selectedFactory` | Yes — icon + "No ledger entries found" | |
| Load error (factories) | `catch (e)` in `loadFactories()` | **No — P-002 (swallow):** `console.error`; dropdown stays empty | |
| Load error (ledger) | `catch (e)` in `loadLedger()` | **No — P-002 (swallow):** `console.error`; empty entries shown | |
| Download error | `catch (e)` in `downloadStatement()` | **No — P-002 (swallow):** `console.error`; no user feedback | |

---

## Business rules

1. **Debit = factory order value; credit = factory payment.** Positive running balance means factory is still owed money.
2. **Only orders at FACTORY_ORDERED or later are included** as debit entries — backend filters `Order.status.in_(factory_committed_statuses)`.
3. **CREDIT-method payments are excluded** from the ledger — internal credit reallocations are filtered out; only real money transfers appear.
4. **Date filter applies to payments only**, not to factory order debit entries. Order debits are always included if they match the factory; payments are filtered by `payment_date`.
5. **Download buttons only appear when a factory is selected and entries exist.**
6. **Factory cost data.** `debit` values represent total factory cost in INR derived from `factory_price × qty × exchange_rate`. This is D-004-restricted data.

---

## Known quirks

- **Cluster A — RESOLVED (Patch 18, 2026-04-22).** SUPER_ADMIN now has explicit access at the router level. Pre-patch, SUPER_ADMIN was already passing via the `has_any_role()` bypass — the patch made this explicit. ADMIN correctly receives 403 from the endpoint-level dep.
- **Date filter applies to payments but not debits.** A user filtering by date range sees all factory order debits regardless of date, but only payments within the range. This can make the running balance appear incorrect for date-filtered views.
- **P-002 — all errors swallowed.** Load, download, and factory-list errors all fail silently.
- **Factory dropdown loads without pagination** (P-009 pattern).

---

## Dead code / unused state

None observed — all refs and methods used.

---

## Duplicate or inline utilities

- `formatCurrency` imported from `utils/formatters` — correct, no duplication.
- The overall structure (filter bar → prompt/loading/content/empty states, summary cards, ledger table, download buttons) is near-identical to `ClientLedger.vue`. In Wave 0, extract a shared `<LedgerPage>` Layer 2 component parameterised by entity type.

---

## Migration notes

1. **Cluster A RESOLVED (Patch 18, 2026-04-22).** `require_finance` widened to `[SUPER_ADMIN, ADMIN, FINANCE]`; all 9 factory-cost endpoints already carry `require_factory_financial` at the endpoint level. SUPER_ADMIN access explicit; ADMIN blocked at endpoint level. Verified 27/27.
2. **Add frontend role gate.** Show the Factory Ledger tab only to FINANCE and SUPER_ADMIN users. Hide it from ADMIN (D-004 compliance).
3. **Add error states** for all `catch` blocks (P-002).
4. **Date filter semantics.** Apply date filter consistently to both debit (order) entries and credit (payment) entries, or document the asymmetry explicitly in the UI.
5. **Extract shared `<LedgerPage>` component** with `ClientLedger.vue` — they are near-identical in structure.
6. **TanStack Query.** Use `useQuery` keyed on `[selectedFactory, startDate, endDate]`.
7. **D-001:** `financeApi.factoryLedger(...)` → `client.finance.factoryLedger(...)` via generated SDK.
8. **D-005:** All `InternalString`; Tamil can remain `""`.
