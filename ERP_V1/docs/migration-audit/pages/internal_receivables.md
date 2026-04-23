# Internal Receivables

**Type:** page (finance dashboard — list)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/finance/receivables` → `Receivables` (meta.title: `'Receivables'`); child of `FinanceLayout`
**Vue file:** [frontend/src/views/finance/Receivables.vue](../../../frontend/src/views/finance/Receivables.vue)
**Line count:** 161
**Migration wave:** Wave 5 (internal tracking — finance)
**Risk level:** low — read-only list; all data is client-side INR pricing; no factory cost data exposed

---

## Purpose

Paginated receivables dashboard showing outstanding or settled client payment balances across all orders, with client and status filters, a payment progress bar per row, and click-through to the order detail page.

---

## Layout

### Outer container
`div.p-6.space-y-5` (inside FinanceLayout content area)

**Zone 1 — Summary card** (`bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 rounded-xl p-5`)
- "Total Outstanding" — `formatCurrency(summary.total_outstanding_inr)` — red-700 bold
- "Orders" — `summary.count` — slate-700 bold

**Zone 2 — Filter bar** (`flex items-center gap-4`)
- Client dropdown: "All Clients" + list from `clientsApi.list()`
- Status toggle group: Outstanding / Settled / All (pill-style)

**Zone 3 — Loading state**
Centred `pi-spin pi-spinner`

**Zone 4 — Empty state**
`pi-check-circle` icon + "No receivables found"

**Zone 5 — Receivables table** (shown when `receivables.length > 0`)

| Col | Header | Content |
|---|---|---|
| 1 | Order | `r.order_number` — font-mono indigo-600; click → `/orders/{r.order_id}` |
| 2 | Client | `r.client_name` |
| 3 | Factory | `r.factory_name` |
| 4 | PI Total | `formatCurrency(r.pi_total_inr)` |
| 5 | Paid | `formatCurrency(r.total_paid_inr)` — emerald-600 |
| 6 | Outstanding | `formatCurrency(r.outstanding_inr)` — badge via `outstandingClass()` |
| 7 | Progress | `r.paid_percent`% progress bar (emerald ≥100%, amber ≥50%, red <50%) + percentage label |
| 8 | Days | `r.days_outstanding` badge (red >60d, amber >30d, blue ≤30d); hidden if 0 |
| 9 | Last Payment | `r.last_payment_date` or `'-'` |

Row click → `router.push('/orders/{r.order_id}')`

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `order_number` | `financeApi.receivables()` | font-mono indigo-600 | Falls back to `r.order_id.slice(0,8)` |
| `client_name` | `financeApi.receivables()` | text | |
| `factory_name` | `financeApi.receivables()` | text | `"-"` if no factory |
| `pi_total_inr` | `financeApi.receivables()` | `formatCurrency` | Effective (revised) total per backend |
| `total_paid_inr` | `financeApi.receivables()` | `formatCurrency` | Verified payments only |
| `outstanding_inr` | `financeApi.receivables()` | `formatCurrency` badge | `pi_total_inr - total_paid_inr` |
| `paid_percent` | `financeApi.receivables()` | progress bar | 0–100 |
| `days_outstanding` | `financeApi.receivables()` | badge | Days since PI generated |
| `last_payment_date` | `financeApi.receivables()` | ISO date string | |
| `status` | `financeApi.receivables()` | (not shown in table, used for filter) | |
| Summary `total_outstanding_inr` | `res.data.summary` | `formatCurrency` | |
| Summary `count` | `res.data.summary` | integer | |

**P-007 checklist:** No `*_cny`, `factory_price`, or `markup_*` fields observed. All monetary values are INR. `factory_name` is company name only (not pricing data). Clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadClients()` + `loadReceivables()` | `GET /api/clients/` + `GET /api/finance/receivables/` | Populates client dropdown and table |
| `selectedClient` or `statusFilter` change | `watch` → `loadReceivables()` | `GET /api/finance/receivables/` | Reloads table with new params |
| Row click | navigate | None | `/orders/{r.order_id}` |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/finance/receivables/` | `financeApi.receivables(params)` | `status` (outstanding/settled/all), `client_id` (optional) | Returns `{receivables, summary}`; sorted by days outstanding desc |
| GET | `/api/clients/` | `clientsApi.list()` | None | Populates client filter dropdown |

> Per D-001 (Option B): in Next.js these become `client.finance.receivables(...)` and `client.clients.list()` via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline for row click navigation.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-spin`, `pi-spinner`, `pi-check-circle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(true)` | `true` | Spinner visibility |
| `receivables` | `ref([])` | `[]` | Receivable rows from API |
| `summary` | `ref({total_outstanding_inr, count})` | all 0 | Summary card values |
| `clients` | `ref([])` | `[]` | Client dropdown options |
| `selectedClient` | `ref('')` | `''` | Client filter selection |
| `statusFilter` | `ref('outstanding')` | `'outstanding'` | Status toggle (outstanding/settled/all) |

**Watch:**
`watch([selectedClient, statusFilter], loadReceivables)` — reactive re-fetch on either filter change.

No computed properties. No `onUnmounted`.

---

## Permissions / role gating

- Route `/finance/receivables` has **no `meta.roles`** — all INTERNAL users can navigate here.
- **Backend `GET /api/finance/receivables/`:** Protected by router-level `require_finance` = ADMIN|FINANCE. Any INTERNAL user without ADMIN or FINANCE role receives 403 on data load (no frontend gate).
- Data returned is all INR (client-side billing amounts). No factory cost data. ADMIN visibility is acceptable per D-004 for client receivables.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.receivables.total_outstanding` | "Total Outstanding" | "" | `InternalString` |
| `internal.receivables.orders` | "Orders" | "" | `InternalString` |
| `internal.receivables.filter_all_clients` | "All Clients" | "" | `InternalString` |
| `internal.receivables.status_outstanding` | "Outstanding" | "" | `InternalString` |
| `internal.receivables.status_settled` | "Settled" | "" | `InternalString` |
| `internal.receivables.status_all` | "All" | "" | `InternalString` |
| `internal.receivables.col_order` | "Order" | "" | `InternalString` |
| `internal.receivables.col_client` | "Client" | "" | `InternalString` |
| `internal.receivables.col_factory` | "Factory" | "" | `InternalString` |
| `internal.receivables.col_pi_total` | "PI Total" | "" | `InternalString` |
| `internal.receivables.col_paid` | "Paid" | "" | `InternalString` |
| `internal.receivables.col_outstanding` | "Outstanding" | "" | `InternalString` |
| `internal.receivables.col_progress` | "Progress" | "" | `InternalString` |
| `internal.receivables.col_days` | "Days" | "" | `InternalString` |
| `internal.receivables.col_last_payment` | "Last Payment" | "" | `InternalString` |
| `internal.receivables.empty` | "No receivables found" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — centred spinner | |
| Empty | `receivables.length === 0 && !loading` | Yes — icon + "No receivables found" | |
| Load error (receivables) | `catch (e)` in `loadReceivables()` | **No — P-002 (swallow variant):** `console.error` only; `loading = false`; empty state shown | |
| Load error (clients) | `catch (e)` in `loadClients()` | **No — P-002 (swallow variant):** `console.error` only; dropdown stays empty | User cannot filter by client if clients fail to load |

---

## Business rules

1. **Default view is "Outstanding"** (`statusFilter` initialised to `'outstanding'`). Settled orders are hidden unless the user toggles to "Settled" or "All".
2. **Payment data uses verified payments only.** Backend `list_receivables` counts only `verification_status == 'VERIFIED'` payments toward `total_paid_inr`.
3. **Days outstanding computed from PI generation date**, not order creation date. Orders without a PI show `days_outstanding = 0`.
4. **Sort is server-side by days outstanding (descending).** No client-side re-sorting.
5. **No pagination.** All matching receivables are returned in a single response.

---

## Known quirks

- **Client dropdown loads `clientsApi.list()` without pagination.** If there are many clients, the dropdown may be slow or incomplete (P-009 pattern).
- **P-002 — errors swallowed silently.** A finance API 403 (user lacks FINANCE/ADMIN role) results in an empty state with no access-denied message.
- **No loading state shown during filter-triggered reload.** `watch([selectedClient, statusFilter], loadReceivables)` sets `loading.value = true` inside `loadReceivables`, but there is a brief frame before the spinner appears as the old table disappears.

---

## Dead code / unused state

None observed — all refs and methods used in template.

---

## Duplicate or inline utilities

- `formatCurrency` imported from `utils/formatters` — correct, no duplication.
- `outstandingClass(val)` — inline colour function (3 branches). Simple enough to keep inline but could be a shared badge utility for financial pages.

---

## Migration notes

1. **Add frontend role gate.** Show "Finance access required" message to INTERNAL users without ADMIN or FINANCE role, rather than letting the backend return 403 silently.
2. **Add error state** for both `loadReceivables()` and `loadClients()` failures (P-002).
3. **Add pagination** (P-009 pattern). Backend currently returns all receivables in one response.
4. **Client dropdown pagination.** `clientsApi.list()` should include `per_page` param or use a searchable select for large client lists.
5. **TanStack Query.** In Next.js rebuild, use `useQuery` with `[selectedClient, statusFilter]` as query key — no manual `watch` needed.
6. **D-001:** `financeApi.receivables(...)` → `client.finance.receivables(...)` via generated SDK; `clientsApi.list()` → `client.clients.list()`.
7. **D-005:** All `InternalString`; Tamil can remain `""`.
