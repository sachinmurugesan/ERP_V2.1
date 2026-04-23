# Internal Client Ledger

**Type:** page (finance ledger)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/finance/client-ledger` → `ClientLedger` (meta.title: `'Client Ledger'`); child of `FinanceLayout`
**Vue file:** [frontend/src/views/finance/ClientLedger.vue](../../../frontend/src/views/finance/ClientLedger.vue)
**Line count:** 172
**Migration wave:** Wave 5 (internal tracking — finance)
**Risk level:** low — all monetary values are INR (client-side billing); no factory cost data; backend protected by router-level `require_finance`

> **Distinct from client portal:** This is the internal finance version at `views/finance/ClientLedger.vue`. The client portal version at `views/client/ClientLedger.vue` (Wave 2) is a different component with different data and different API endpoints.

---

## Purpose

Double-entry client payment ledger for INTERNAL finance users showing PI debits and payment credits chronologically for a selected client, with date-range filtering and Excel/PDF download.

---

## Layout

### Outer container
`div.p-6.space-y-5` (inside FinanceLayout content area)

**Zone 1 — Filter bar** (`flex items-end gap-4 flex-wrap`)
- Client dropdown: "Select a client..." + list from `clientsApi.list()`
- "From" date picker (`input[type=date]`)
- "To" date picker (`input[type=date]`)
- Download buttons (shown only when `selectedClient && entries.length > 0`):
  - "Excel" → `downloadStatement('xlsx')` — emerald-600
  - "PDF" → `downloadStatement('pdf')` — red-600

**Zone 2 — No-client prompt** (when `!selectedClient`)
`pi-users` icon + "Select a client to view their ledger"

**Zone 3 — Loading state** (when `loading`)
Centred `pi-spin pi-spinner`

**Zone 4 — Ledger content** (when `entries.length > 0`)

Summary cards (3-column grid):
| Card | Metric | Colour |
|---|---|---|
| Total Debit | `formatCurrency(summary.total_debit)` | red-50/red-700 |
| Total Credit | `formatCurrency(summary.total_credit)` | emerald-50/emerald-700 |
| Net Balance | `formatCurrency(summary.net_balance)` | amber (>0) / emerald (≤0) |

Ledger table:

| Col | Header | Content |
|---|---|---|
| 1 | Date | `e.date` |
| 2 | Order | `e.order_number` — font-mono indigo-600 |
| 3 | Remark | `e.remark` |
| 4 | Debit (₹) | `formatCurrency(e.debit)` — red-600 if >0 else `'-'` |
| 5 | Credit (₹) | `formatCurrency(e.credit)` — emerald-600 if >0 else `'-'` |
| 6 | Balance (₹) | `formatCurrency(e.running_balance)` — amber (>0) / emerald (≤0) |
| 7 | Method | `e.method` (spaces from `_`) or `'-'` |
| 8 | Reference | `e.reference` |

Table footer repeats `total_debit`, `total_credit`, `net_balance` from summary.

**Zone 5 — No entries** (when `selectedClient && entries.length === 0 && !loading`)
`pi-database` icon + "No ledger entries found"

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `date` | `financeApi.clientLedger()` | ISO date string | |
| `order_number` | `financeApi.clientLedger()` | font-mono indigo | |
| `remark` | `financeApi.clientLedger()` | text | Backend-generated: "PI raised for {order_number}" or payment notes |
| `debit` | `financeApi.clientLedger()` | `formatCurrency` | PI total (what client owes) |
| `credit` | `financeApi.clientLedger()` | `formatCurrency` | Payment received from client |
| `running_balance` | `financeApi.clientLedger()` | `formatCurrency` | Positive = client owes; negative = overpaid |
| `method` | `financeApi.clientLedger()` | text | Payment method; `'-'` for PI entries |
| `reference` | `financeApi.clientLedger()` | text | PI number or payment reference |
| Summary `total_debit` | `res.data.summary` | `formatCurrency` | |
| Summary `total_credit` | `res.data.summary` | `formatCurrency` | |
| Summary `net_balance` | `res.data.summary` | `formatCurrency` | |

**P-007 checklist:** No `*_cny`, `factory_price`, or `markup_*` fields in the backend `get_client_ledger` response (finance.py:1253). All values are INR. `factory_name` is not included. Clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadClients()` | `GET /api/clients/` | Populates client dropdown |
| `selectedClient` / `startDate` / `endDate` change | `watch` → `loadLedger()` | `GET /api/finance/client-ledger/{client_id}/` | Loads ledger entries |
| `selectedClient` cleared | `loadLedger()` short-circuits | None | `entries = []` |
| "Excel" button click | `downloadStatement('xlsx')` | `GET /api/finance/client-ledger/{client_id}/download/` | Blob download as `.xlsx` |
| "PDF" button click | `downloadStatement('pdf')` | `GET /api/finance/client-ledger/{client_id}/download/` | Blob download as `.pdf` |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/clients/` | `clientsApi.list()` | None | Populates dropdown |
| GET | `/api/finance/client-ledger/{client_id}/` | `financeApi.clientLedger(id, params)` | `start_date`, `end_date` (ISO strings, optional) | Returns `{entries, summary, client_name, client_id}` |
| GET | `/api/finance/client-ledger/{client_id}/download/` | `financeApi.downloadClientLedger(id, format, params)` | `format` (xlsx/pdf), `start_date`, `end_date` | Returns file blob |

> **Security cross-reference:** `GET /api/finance/client-ledger/{client_id}/` (finance.py:1253) has **no `current_user` parameter** in the handler signature — only `db: Session = Depends(get_db)`. Authentication is enforced solely by the router-level `require_finance` (ADMIN|FINANCE) dependency in `main.py`. This is structurally different from P-014 (which flagged mutation handlers with no auth at all) — the router-level dep does enforce ADMIN|FINANCE access. No inline role check possible without `current_user` param, so there is no per-client ownership validation at the endpoint level. Acceptable for INTERNAL finance roles.

> Per D-001 (Option B): in Next.js these become `client.finance.clientLedger(...)` etc. via the generated SDK.

---

## Composables consumed

None. No `useRouter()` — no navigation from this page.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-users`, `pi-spin`, `pi-spinner`, `pi-file-excel`, `pi-file-pdf`, `pi-database`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(false)` | `false` | Spinner visibility |
| `clients` | `ref([])` | `[]` | Client dropdown options |
| `selectedClient` | `ref('')` | `''` | Active client selection |
| `startDate` | `ref('')` | `''` | Date range start |
| `endDate` | `ref('')` | `''` | Date range end |
| `entries` | `ref([])` | `[]` | Ledger entry rows |
| `summary` | `ref({total_debit, total_credit, net_balance})` | all 0 | Summary card and footer values |
| `clientName` | `ref('')` | `''` | Used in download filename |

**Watch:**
`watch([selectedClient, startDate, endDate], loadLedger)` — reactive re-fetch on any of the three inputs.

`onMounted` calls `loadClients()` only — no initial ledger load until a client is selected.

---

## Permissions / role gating

- Route `/finance/client-ledger` has **no `meta.roles`** — all INTERNAL users can navigate here.
- **Backend:** Router-level `require_finance` (ADMIN|FINANCE). No additional per-endpoint role check. No `current_user` in handler signature (no inline role enforcement possible without it).
- **Download endpoint** (`/download/`) is on the same `main` finance router — same `require_finance` protection applies.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.client_ledger.select_client` | "Select a client..." | "" | `InternalString` |
| `internal.client_ledger.from_label` | "From" | "" | `InternalString` |
| `internal.client_ledger.to_label` | "To" | "" | `InternalString` |
| `internal.client_ledger.download_excel` | "Excel" | "" | `InternalString` |
| `internal.client_ledger.download_pdf` | "PDF" | "" | `InternalString` |
| `internal.client_ledger.prompt` | "Select a client to view their ledger" | "" | `InternalString` |
| `internal.client_ledger.total_debit` | "Total Debit" | "" | `InternalString` |
| `internal.client_ledger.total_credit` | "Total Credit" | "" | `InternalString` |
| `internal.client_ledger.net_balance` | "Net Balance" | "" | `InternalString` |
| `internal.client_ledger.col_date` | "Date" | "" | `InternalString` |
| `internal.client_ledger.col_order` | "Order" | "" | `InternalString` |
| `internal.client_ledger.col_remark` | "Remark" | "" | `InternalString` |
| `internal.client_ledger.col_debit` | "Debit (₹)" | "" | `InternalString` |
| `internal.client_ledger.col_credit` | "Credit (₹)" | "" | `InternalString` |
| `internal.client_ledger.col_balance` | "Balance (₹)" | "" | `InternalString` |
| `internal.client_ledger.col_method` | "Method" | "" | `InternalString` |
| `internal.client_ledger.col_reference` | "Reference" | "" | `InternalString` |
| `internal.client_ledger.totals` | "TOTALS" | "" | `InternalString` |
| `internal.client_ledger.no_entries` | "No ledger entries found" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| No client selected | `!selectedClient` | Yes — icon + "Select a client to view their ledger" | |
| Loading | `loading === true` | Yes — centred spinner | |
| Empty ledger | `entries.length === 0 && !loading && selectedClient` | Yes — icon + "No ledger entries found" | |
| Load error (clients) | `catch (e)` in `loadClients()` | **No — P-002 (swallow):** `console.error` only; dropdown stays empty | |
| Load error (ledger) | `catch (e)` in `loadLedger()` | **No — P-002 (swallow):** `console.error` only; `loading = false`; empty entries state shown | |
| Download error | `catch (e)` in `downloadStatement()` | **No — P-002 (swallow):** `console.error` only; no user feedback | |

---

## Business rules

1. **Debit = what the client owes (PI totals); credit = what the client paid (payments).** Running balance positive means client has an outstanding amount owed.
2. **CREDIT-method payments are excluded.** Backend filters `method != 'CREDIT'` — internal credit reallocations (applied from overpayments) do not appear as double entries. The original overpayment is already in the ledger as a credit.
3. **Only VERIFIED payments are included.** Backend filters `verification_status == 'VERIFIED'`.
4. **PI total used is the effective (revised) total**, not the stale `pi.total_inr` — `calc_effective_pi_total()` accounts for unloaded items and after-sales price corrections.
5. **Download buttons only appear when a client is selected and entries exist.** Avoids empty-file downloads.

---

## Known quirks

- **P-002 — download error swallowed.** If the download API fails, `console.error` is logged but the user sees no feedback.
- **Client dropdown loads `clientsApi.list()` without pagination** — same risk as Receivables page for large client lists.
- **No ownership validation at endpoint level.** Any ADMIN or FINANCE user can view any client's ledger by passing any `client_id`. This is intentional for the INTERNAL finance role but worth noting for audit purposes.
- **Date filter is inclusive on both ends** (backend uses `>=` and `<=`). PI entries are filtered by `generated_at` date; payments by `payment_date`. Mismatched date semantics could cause unexpected empty results if PI was generated outside the date range but payments fall inside it.

---

## Dead code / unused state

None observed — all refs and methods used.

---

## Duplicate or inline utilities

- `formatCurrency` imported from `utils/formatters` — correct, no duplication.
- The overall structure (filter bar → prompt/loading/content/empty states, summary cards, ledger table, download buttons) is near-identical to `FactoryLedger.vue`. In Wave 0, extract a shared `<LedgerPage>` Layer 2 component parameterised by entity type (client vs factory). This is P-017 in CROSS_CUTTING_SCRATCH.md.

---

## Migration notes

1. **Add error states** for ledger load failure and download failure (P-002).
2. **Client dropdown:** Use a searchable select for large client lists; apply `per_page` param or server-side search.
3. **TanStack Query.** Use `useQuery` keyed on `[selectedClient, startDate, endDate]` — removes manual `watch` + `loadLedger`.
4. **Add `current_user` to `get_client_ledger` handler** in Next.js backend. Currently no inline auth object is available (only router-level). This blocks future per-ownership or role-specific field redaction at the handler level.
5. **D-001:** `financeApi.clientLedger(...)` → `client.finance.clientLedger(...)` via generated SDK.
6. **D-005:** All `InternalString`; Tamil can remain `""`.
