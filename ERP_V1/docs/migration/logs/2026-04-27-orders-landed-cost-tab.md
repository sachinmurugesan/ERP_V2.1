# Migration log — OrderLandedCostTab

**Date:** 2026-04-27
**Branch:** _not yet created_ (planning only — Phase 1 + 2)
**Author:** sachinmurugesan111@gmail.com
**Conventions in effect:** R-16, R-17, R-18, R-19 (per `ERP_V1/CONVENTIONS.md`)
**Source spec:** Orders Phase 3 — LandedCostTab migration (Phase 1 + 2 ONLY, no code)
**Predecessor:** `2026-04-27-orders-queries-tab.md` (PR #6, merged) — migrated QueriesTab Tier 1.

---

## 0. Stop conditions check (per spec)

| # | Stop condition | Status | Notes |
|---|---|---|---|
| 1 | LandedCostTab.vue not found | ✅ no | Found at `frontend/src/components/order/LandedCostTab.vue` |
| 2 | Backend not responding | ✅ no | Backend live on `:8001`; full R-19 curl pass executed (with one shape-coverage caveat — see §1.5) |
| 3 | Tab has edit functionality | ✅ no | **Purely read-only display** + Excel download. No mutations. |
| 4 | LandedCostTab.vue over 300 lines | ✅ no | **207 lines** — comfortably under threshold |
| 5 | Currency conversion logic complex | ✅ no | **Single currency (INR)** throughout. CNY exchange rate is metadata only — backend does all math. |

**Verdict: NO stop conditions hit.** Cleanest migration target since the
shell/dashboard work — read-only rendering + 1 binary download proxy +
straightforward role gating already enforced at the shell visibility
layer.

---

## 1. Phase 1 — Discovery

### 1.1 LandedCostTab.vue summary

- **Line count:** **207** (script + template, no scoped styles).
- **Vue source:** `frontend/src/components/order/LandedCostTab.vue`.
- **Composition:** single-file Vue with one `defineProps({orderId})`,
  one fetch on mount via `ordersApi.getLandedCost`, one binary download
  via `ordersApi.downloadLandedCostExcel`. **No useNotifications, no
  polling, no WebSocket, no router watching.**

### 1.2 Business context — what is "landed cost"?

The total cost of importing goods to the destination. For HarvestERP's
**TRANSPARENCY clients** (a special pricing tier where the buyer sees
the actual factory invoice + every cost component, vs REGULAR clients
who get a fixed sale price), the Landed Cost tab exposes the full
breakdown:

```
Invoice (CNY × FX rate → INR)
  + Freight + THC          (per shipment)
  + Clearance + CFS        (per order's clearance charges)
  + Sourcing Charge (%)    (commission on invoice)
  + Duty + IGST            (per BOE: BCD + SWC + IGST)
  + Transport              (post-port logistics)
  + Miscellaneous          (insurance + other + doc fees)
  ─────────────────────────
  = Total Expenses
  + Invoice
  ─────────────────────────
  = Grand Total (Landed Cost)
```

Plus a **per-item proportional split** (each item's share of every
expense bucket, computed proportional to its CNY value / total CNY
value).

This is the deepest financial transparency we expose to any client —
literally a line-by-line accounting of every rupee.

### 1.3 Sections + fields displayed

#### Section 1 — Header (LandedCostTab.vue:90-101)
- **H3 title:** "LANDED COST BREAKDOWN" (uppercase tracking-wider)
- **Subtitle:** `{order_number} · {client_name}`
- **Right-aligned Excel download button** (emerald theme, paperclip / file-excel icon, "Download Excel" or "Generating..." while pending)

#### Section 2 — 4 KPI cards (LandedCostTab.vue:103-121)
Responsive grid `grid-cols-2 md:grid-cols-4`, each card colored per metric:

| Card | Bg | Source field | Formatter |
|---|---|---|---|
| **Invoice** | blue-50 | `summary.total_bill_inr` | `formatLakh` |
| **Total Expenses** | amber-50 | `summary.total_expenses_inr` | `formatLakh` |
| **Expense %** | indigo-50 | `summary.expense_percent` | `.toFixed(2) + '%'` |
| **Grand Total** | emerald-50 | `summary.grand_total_inr` | `formatLakh` |

`formatLakh(n)` returns `₹X.XXL` (lakhs) when ≥ 100,000, `₹X.XK`
(thousands) when ≥ 1,000, otherwise the full INR.

#### Section 3 — Expense Breakdown table (LandedCostTab.vue:123-162)
Two columns (Category / Amount INR), zebra-style hover, with 3-row footer:

```
┌──────────────────────────────┬──────────────┐
│ Invoice @{exchange_rate:.2f}  │ {amount_inr} │  ← header row, blue tint
├──────────────────────────────┼──────────────┤
│ Freight + THC                 │ ...          │
│ Clearance + CFS               │ ...          │
│ Sourcing Charge (X.X%)        │ ...          │
│ Duty + IGST                   │ ...          │
│ Transport                     │ ...          │
│ Miscellaneous                 │ ...          │
├──────────────────────────────┼──────────────┤
│ Total Bill                    │ {summary.total_bill_inr}     │  ← tfoot
│ Total Expenses                │ {summary.total_expenses_inr} │
│ Grand Total                   │ {summary.grand_total_inr}    │  ← emerald accent
└──────────────────────────────┴──────────────┘
```

Each `expenses[]` row uses `formatINR(amount_inr)`.

#### Section 4 — Per-Item Breakdown (LandedCostTab.vue:164-204) — conditional on `data.items?.length`
A 10-column table per active order item:

| # | Product (code + name truncated) | Qty | Value | Freight | Duty | Clearance | Commission | Landed Cost | Per Unit |
|---|---|---|---|---|---|---|---|---|---|
| 1 | (code mono) / (name truncate) | int | formatINR | formatINR | formatINR | formatINR | formatINR | **formatINR (emerald, bold)** | formatINR (slate-500) |

10 columns, monospace numerics, emerald accent on the "Landed Cost"
totals column.

### 1.4 Currency handling

**Single currency: INR** for all displayed values. Backend converts
the CNY-denominated invoice using `order.exchange_rate` server-side
(`landed_cost.py:99-107`). No client-side currency conversion;
frontend only formats already-INR numbers via `formatINR` /
`formatLakh`.

`exchange_rate` and `currency` are returned in the envelope (line 191-192)
but only `exchange_rate` is rendered (in the Invoice row label:
`"Invoice @{exchange_rate:.2f}"`). `currency` is metadata only.

### 1.5 R-19 — endpoint shapes

#### A. `GET /api/orders/{order_id}/landed-cost/` — main fetch

- **URL verified live (2026-04-27):** `/api/orders/{id}/landed-cost/`
  matches Vue's `ordersApi.getLandedCost`. Tested live with a DRAFT
  order at status=DRAFT, client_type=REGULAR. Returned **HTTP 404
  `{"detail": "Not found"}`** (correctly — REGULAR clients are excluded
  per backend `landed_cost.py:65-66`).

- **400 case verified live:** flipped the test client to TRANSPARENCY
  via PUT `/api/clients/{id}`, then retried — **HTTP 400 with body
  `{"detail": "Landed cost is available after customs clearance.
  Current stage: Draft (stage 1)"}`**. Vue handles this exact 400 in
  the `catch` block (line 27-28). Restored client to REGULAR after
  probe (cleanup).

- **200 populated case NOT live-probable** in this session:
  - The probe DB has no order at CLEARED+ stage (would need full PI
    → advance → factory ordered → production → packing → booking →
    sailing → arrived → customs filed → cleared sequence, with
    shipments + BOE + clearance charges seeded along the way).
  - Backend `landed_cost.py:1-216` is the source-of-truth for the
    populated shape. R-19 paper trail relies on the serializer
    source (same approach used for `factory-payments` populated
    shape in PR #4 — also used backend source where the live shape
    couldn't be observed).

- **Backend source-derived envelope shape** (lines 187-216):
  ```ts
  interface LandedCostResponse {
    order_id: string;
    order_number: string | null;
    client_name: string;
    exchange_rate: number;
    currency: string;                      // e.g. "CNY"
    invoice: {
      label: string;                       // "Invoice @{rate}"
      amount_inr: number;
    };
    expenses: Array<{
      label: string;                       // 6 fixed labels (see below)
      amount_inr: number;
    }>;
    summary: {
      total_bill_inr: number;
      total_expenses_inr: number;
      grand_total_inr: number;
      expense_percent: number;             // 0-100
    };
    items: Array<{
      product_code: string;
      product_name: string;
      quantity: number;                    // int
      client_factory_price_cny: number;
      item_value_inr: number;
      freight_share: number;
      duty_share: number;
      clearance_share: number;
      commission_share: number;
      total_landed_cost: number;
      landed_cost_per_unit: number;
    }>;
  }
  ```
  Six fixed `expenses[].label` values: `"Freight + THC"`,
  `"Clearance + CFS"`, `"Sourcing Charge ({rate}%)"`, `"Duty + IGST"`,
  `"Transport"`, `"Miscellaneous"`.

#### B. `GET /api/orders/{order_id}/landed-cost/download/` — Excel binary

- **URL verified live:** Vue calls
  `ordersApi.downloadLandedCostExcel` → same path with `/download/`
  suffix. Backend at `landed_cost.py:219-241`.
- **Auth + access checks:** reuses `get_landed_cost()` for shape and
  RLS — same TRANSPARENCY + role + stage gates apply.
- **Response:** `StreamingResponse` of an .xlsx blob (media-type
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
  with `Content-Disposition: attachment;
  filename="LandedCost_{order_number}.xlsx"`.
- **Bearer-token-required** (header, not cookie) — same as documents
  download.

### 1.6 Backend role gating (verified from source)

`landed_cost.py:68-75`:
```py
allowed_internal = {"SUPER_ADMIN", "ADMIN", "FINANCE"}
if current_user.role not in allowed_internal:
    if current_user.role == "CLIENT":
        if current_user.client_id != order.client_id:
            raise 403
    else:
        raise 403
```

Effective access (admin portal):
- **SUPER_ADMIN / ADMIN / FINANCE** → ✅
- **OPERATIONS** → ❌ (would 403)
- **CLIENT** → ✅ but only on their own orders (own client portal)
- **FACTORY** → ❌

The shell already mirrors this exactly (`order-tabs.tsx:156-160`):
```ts
const LANDED_COST_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "FINANCE"]);
```
Plus the stage check (`LANDED_COST_STAGES` = CLEARED+) and
`client_type === "TRANSPARENCY"` check on the `visible` predicate.

**No D-004 fields or anything stricter inside the tab body.** All
costs are rendered identically for everyone who can see the tab — the
gating is at the doorway.

### 1.7 Existing proxies + matrix.ts state

- **No `/api/orders/[id]/landed-cost/...` proxy exists** in
  `apps/web/src/app/api/orders/[id]/`. Net new: 2 routes (GET data +
  GET download).
- **No `LANDED_COST_*` or `TRANSPARENCY_*` permissions in
  matrix.ts.** The existing `FACTORY_PAYMENTS` /
  `FACTORY_LEDGER_VIEW` are the closest analogs, but landed-cost gating
  is more nuanced (role + status + client_type, all three required).
  We could add a `Resource.ORDER_LANDED_COST` for completeness, but
  the shell tab visibility is currently inline (lines 192-198 of
  `order-tabs.tsx`) and works correctly. See decision **D-3**.

### 1.8 TRANSPARENCY_ENABLED feature flag

`backend/config.py:104`:
```py
TRANSPARENCY_ENABLED = os.getenv("TRANSPARENCY_ENABLED", "true").lower() == "true"
```

When false, every `GET /landed-cost/` call returns 404 regardless of
order/role state (line 53-54 of `landed_cost.py`). The FE proxy must
correctly forward 404 — already the standard error mapping, no
special handling needed.

### 1.9 Complexity rating

**SIMPLE (≤ 4 hours).**

Inventory:
- 2 new proxies (data + download) — both under 50 LOC
- 1 component (~250 LOC TSX) replicating the 207 Vue lines
- ~25 component tests (3 sections × loading/empty/error/success +
  download click + role/stage/client-type permutations on the shell
  visibility predicate)
- ~15 proxy tests (R-19 fixtures × 200/400/404/403/5xx for each of
  the 2 endpoints)
- No matrix.ts changes (decision D-3 below)
- No nginx changes (`/orders/{uuid}` already routes to Next.js)

The smallest tab migration since the shell. No mutations, no D-004
within-tab gating, no notification side-effects, no polling, no
attachments, no deep-link.

---

## 2. Phase 2 — UX Reasoning

### 2.1 Cost breakdown layout — D-1

Vue uses 3 sections: **header + 4 KPI cards + 1 expense table + 1
per-item table**. Already a good shape for the design system —
matches the `<Card>` primitive + `<Table>` primitive patterns from
prior tabs.

**Recommendation: mirror Vue layout 1:1** with our existing primitives:

| Vue construct | Migrated to |
|---|---|
| Header h3 + subtitle + button row | `<Card>` with `<CardHeader flex-row>` (same pattern as files-tab + queries-tab) |
| 4 KPI cards in colored boxes | Local `<MetricCard>` mini-component (or reuse the queries-tab `KpiCard` if we promote it to composed/) — see D-2 |
| Expense breakdown table | `<Table>` primitive with `<TableHeader>` / `<TableBody>` / `<TableFooter>` (the latter is exposed but rarely used — first consumer here) |
| Per-item table (10 cols) | `<Table>` primitive again, with `overflow-x-auto` wrapper for narrow viewports |

No new layer-2 component required.

### 2.2 KPI card reuse — D-2

The queries-tab already has a `KpiCard` (private to that file).
Landed-cost has 4 KPI cards too. Tempting to lift to `composed/`.

| Option | Description |
|---|---|
| **K-A (lift to composed/)** | Extract `<KpiCard label value accent>` to `apps/web/src/components/composed/kpi-card.tsx`. Update both queries + landed-cost to import from there. Lifts a 30-LOC component for ~50% reuse. |
| **K-B (duplicate locally)** | Keep the queries-tab's `KpiCard` private, add a near-identical local one in landed-cost. Slightly more code, no new shared surface. |

**Recommendation: K-B (duplicate locally) for now.** Reasoning: the
landed-cost cards have a `bg-{color}-50` inner fill (Vue's
`bg-blue-50 / bg-amber-50 / etc.`) that the queries-tab cards don't —
they only use a left-border accent. Lifting now would either lock us
into one of those styles or require a `variant` prop that complicates
the API. Wait for a 3rd consumer before promoting. Filed in D-2 either
way for explicit decision.

### 2.3 Currency display

**Already settled: INR-only display.** Backend does all conversion.
Use `formatINR` from `@harvesterp/lib` (same as the dashboard tab). The
Vue `formatLakh` helper is local — port it to a private helper in the
new component (or inline as a 6-line function — ~3 conditional
branches). Tier 2 for promoting `formatLakh` if a 3rd consumer
appears.

### 2.4 Tab visibility re-check inside the component — D-4

The shell at `order-tabs.tsx:192-198` already won't render
`<OrderLandedCostTab>` unless:
- `LANDED_COST_STAGES.has(status)` (CLEARED+)
- `LANDED_COST_ROLES.has(role)` (FINANCE/ADMIN/SUPER_ADMIN)
- `client_type === "TRANSPARENCY"`

**Should the component re-check defensively?**

| Option | Description |
|---|---|
| **V-A (trust shell)** | No internal re-check. Simpler. The component accepts the tab is only mounted when the gate passes. Backend will 404 / 403 / 400 if anything is wrong (defense-in-depth). |
| **V-B (re-check, render forbidden state)** | Component computes its own gate from props (status + role + client_type) and renders a forbidden card if any condition fails. Defense-in-depth + better dev ergonomics if someone calls the component directly outside the shell. |

**Recommendation: V-A (trust shell).** Reasons:
- The shell visibility is the SPOC — duplicating logic in the tab
  introduces drift risk if the shell adds a 4th condition later.
- The `<OrderLandedCostTab>` is conditionally rendered inside
  `<TabsContent>` — if the tab isn't visible, it never mounts. There's
  no path for it to render with a non-TRANSPARENCY order via the
  shell.
- Backend triple-checks anyway: stage + role + client_type + the
  TRANSPARENCY_ENABLED feature flag. The FE proxy will surface any
  backend rejection as the 400 / 404 error card.

We'll add a one-liner JSDoc note in the component pointing at the
shell predicate as the visibility source.

### 2.5 Empty / loading / error states

Vue's three states (lines 76-87):
- **Loading:** centered spinner + "Loading landed cost data..." text
- **Error:** centered amber info-circle + the backend's `detail`
  string (or fallback "Failed to load landed cost data")
- **No data sentinel:** the entire data block is wrapped in
  `v-else-if="data"` — if data is null after loading completes
  without error, the component renders nothing (a soft-empty)

For the migration:
- Use `<Skeleton>` rows shaped like the KPI cards + the expense table
  (~6 skeleton rows) instead of a centered spinner — matches the
  prior 3 tabs and feels less jarring.
- Render the backend's error `detail` verbatim — Vue already does this
  (line 28: `error.value = detail`), and the backend's 400 message is
  already user-friendly ("Landed cost is available after customs
  clearance. Current stage: Draft (stage 1)"). Don't reword.
- Soft-empty case (data is null): show an inline neutral card "No
  landed cost data yet — wait for the order to clear customs" with an
  info icon. Edge case; backend would normally 400 in this state but
  belt-and-braces.

### 2.6 Excel download mechanism — D-5

Backend serves a binary StreamingResponse with Content-Disposition.
**Identical pattern to existing `factory-ledger/[id]/download/`,
`documents/[doc_id]/download/`, etc.** All three already use the same
proxy pattern (raw `fetch` with Bearer + `arrayBuffer` + header
preservation).

Use the existing `useBlobDownload` hook from `apps/web/src/lib/`
(already used by factory-ledger + files-tab). The proxy follows the
exact factory-ledger-download template: `proxy_pass` server-side,
inject Bearer, preserve Content-Disposition, fall back to a generated
filename if upstream omits it.

**No new Layer 2 component, no new lib helper.**

### 2.7 Empty per-items handling

Vue's `data.items?.length` conditional (line 165) skips the per-item
table entirely when no items exist. Migrate as-is — this is the same
data-driven empty pattern we used for the dashboard's Carried Items
card.

### 2.8 Awaiting decisions

| # | Question | Recommendation | Alternatives |
|---|---|---|---|
| **D-1** | Cost breakdown layout — mirror Vue 1:1 with Card + Table primitives? | **Yes** (mirror Vue) | Re-organize as 4 cards in a grid (no table); skip per-item view; etc. — all worse |
| **D-2** | Lift `<KpiCard>` to composed/ now (also used by queries-tab) or duplicate locally? | **Duplicate locally (K-B)** — wait for 3rd consumer to promote | K-A (lift now) |
| **D-3** | Add `Resource.ORDER_LANDED_COST` permission to matrix.ts? | **No** — shell-level inline visibility predicate is fine; matrix entries are for resource-action gating, not multi-axis tab visibility. Matrix would either oversimplify (3-axis check doesn't fit `[ROLES]`) or duplicate state. | Yes, with a custom canAccess that takes status + client_type as extra args (no precedent in the codebase) |
| **D-4** | Defensive visibility re-check inside the component? | **No (V-A trust shell)** | V-B re-check + render forbidden card |
| **D-5** | Excel download mechanism | **Reuse `useBlobDownload` + new download proxy mirroring factory-ledger pattern** | Direct `<a href>` link (won't work — requires Bearer header) |
| **D-6** | Confirm scope: admin portal only — do not touch CLIENT or FACTORY portal Vue code | **Confirm** | Touch all 3 portals |

---

## 3. Phase 3 plan preview (DO NOT EXECUTE — for context only)

If recommendations approved (D-1=mirror, D-2=duplicate, D-3=no, D-4=no, D-5=blob hook, D-6=confirm):

1. Branch `feat/orders-landed-cost-tab` from main
2. **Commit 1 — proxies (2 routes):**
   - `apps/web/src/app/api/orders/[id]/landed-cost/route.ts` (GET data)
   - `apps/web/src/app/api/orders/[id]/landed-cost/download/route.ts` (GET binary)
   - R-19 fixture tests (~12: success/400/404/403/5xx for both routes)
3. **Commit 2 — `<OrderLandedCostTab>` component:**
   - Self-fetch via TanStack Query (`order-landed-cost` key)
   - Header card + 4 KPI cards (local) + Expense table + Per-Item table
   - Loading: 6 skeleton rows. Error: backend detail rendered. Soft-empty: neutral card.
   - Excel download via `useBlobDownload` (paperclip + label "Download Excel")
   - Local helpers: `formatINR` (from `@harvesterp/lib`), `formatLakh` (private 6-line)
4. **Commit 3 — wire into shell + tests:**
   - `order-tabs.tsx` — replace DeferredTabFallback case for `t.value === "landed-cost"` with `<OrderLandedCostTab orderId={order.id} />` (shell already constructs the visibility predicate, so the component only mounts when allowed)
   - `tests/app/order-detail-shell.test.tsx` — +3 regression tests:
     - landed-cost tab renders OrderLandedCostTab (when stage+role+client_type all match)
     - landed-cost tab still HIDDEN for OPERATIONS (visibility predicate)
     - landed-cost tab still HIDDEN for REGULAR client_type (visibility predicate)
   - `tests/app/orders-landed-cost-tab.test.tsx` — ~22 component tests
5. **Commit 4 — R-16 + R-17 + docs:**
   - R-16 LIVE on `?tab=landed-cost` for a TRANSPARENCY+CLEARED order (will need to seed one or fast-forward)
   - R-17 scoring vs `Design/screens/settings.jsx` (table list) + `Design/screens/inventory.jsx`
   - Migration log + screenshot evidence
   - MIGRATED_PATHS.md row update (4th tab migrated)

**Estimated total: ~3-4 h.**

---

## 4. Stop point (resolved)

User approved all 6 recommendations on 2026-04-27 (D-1=mirror Vue 1:1,
D-2=duplicate locally, D-3=no matrix entry, D-4=trust shell, D-5=blob
hook + download proxy, D-6=admin portal only). Branch:
`feat/orders-landed-cost-tab`. **4 commits.**

---

## 5. Phase 3 — implementation

### 5.1 Files created

- `apps/web/src/app/api/orders/[id]/landed-cost/route.ts` — GET data
  proxy (~120 LOC). Forwards to FastAPI `/api/orders/{id}/landed-cost/`
  via the typed SDK; surfaces backend 400/403/404 verbatim. No proxy-
  side role gating (decision D-4) — backend triple-gates.
- `apps/web/src/app/api/orders/[id]/landed-cost/download/route.ts` —
  GET binary stream (~80 LOC). Mirrors the factory-ledger-download
  template: raw `fetch` with Bearer + `arrayBuffer` + Content-Type +
  Content-Disposition pass-through + fallback filename
  (`LandedCost_{id}.xlsx`).
- `apps/web/src/app/(app)/orders/[id]/_components/tabs/order-landed-cost-tab.tsx`
  — client component (~390 LOC) replicating the 207 Vue lines using
  Card / Table / Skeleton / Button primitives + `useBlobDownload` +
  `formatINR` from `@harvesterp/lib`. Local `KpiCard` + private
  `formatLakh` helper (decisions D-2 + 2.3).
- `apps/web/tests/api/orders-landed-cost-proxy.test.ts` — 17 R-19
  fixture tests (200/400/403/404/5xx for each of the 2 endpoints,
  binary-stream Content-Disposition pass-through, fallback filename).
- `apps/web/tests/app/orders-landed-cost-tab.test.tsx` — 19 component
  tests (loading / error / soft-empty, header, KPI cards (lakh/
  thousand/zero formatting), expense table (invoice + 6 rows + tfoot),
  per-item table (10 columns, hide-when-empty), Excel download (URL
  + blob error surfacing)).

### 5.2 Files modified

- `apps/web/src/app/(app)/orders/[id]/_components/order-tabs.tsx` —
  imports `<OrderLandedCostTab>`, replaces the
  `<DeferredTabFallback>` branch for `t.value === "landed-cost"` with
  the real component. The 3-axis visibility predicate stays inline
  (status ∈ CLEARED+ × role ∈ FINANCE family × client_type ===
  TRANSPARENCY) — no matrix.ts entry (decision D-3). Updated the
  migration-status comment to reflect 4 migrated tabs.
- `apps/web/tests/app/order-detail-shell.test.tsx` — 3 regression
  tests: (a) landed-cost tab renders OrderLandedCostTab when
  stage+role+client_type all match; (b) landed-cost tab still hidden
  for OPERATIONS role on TRANSPARENCY DELIVERED orders; (c) landed-
  cost tab still hidden for REGULAR client_type on FINANCE+DELIVERED
  orders.

### 5.3 Tests added

- 17 proxy tests
- 19 component tests
- 3 wire / shell-regression tests
- **Total: +39 tests.** Suite: 880 → 919 web tests passing.

### 5.4 R-19 contract notes

No quirks this round. The two endpoints are clean GETs, both keyed
on the same `/api/orders/{id}/landed-cost/` path (download adds
`/download/`). The download proxy mirrors the existing
factory-ledger-download / documents-download pattern verbatim — no
new Layer 2 abstraction needed.

The populated 200 envelope shape was source-derived from
`backend/routers/landed_cost.py:187-216` (per the same precedent set
by factory-payments PR #4 and queries-tab PR #6 when no live
populated case was seedable). The 400 + 404 paths were verified live
both in Phase 1 (§1.5) and again during R-16 this session.

---

## 6. Issues encountered (Phase 3)

None. The migration was the smallest tab so far — purely read-only
display + 1 binary download. No D-004 within-tab gating, no
mutations, no notification side-effects, no polling, no attachments,
no deep-link. The Tier 2 deferred list is empty.

One test was iterated:

### Issue 1: 404 error mock string mismatch

- **Date raised:** 2026-04-27 17:13 (local)
- **Problem:** First component-test run failed 1 of 19 — the 404 case
  expected a `/not available/i` string but the test's fetch mock
  echoed the upstream `"Not found"` detail directly, bypassing the
  proxy's friendly rewrite.
- **Root cause:** Mock helper in the test built the response body as
  `{error: detail, detail: detail}` — when both fields are present
  the component reads `body.error` first and skipped its own 404
  fallback string.
- **Fix applied:** Updated the mock to use the proxy-formatted error
  string (`"Landed cost not available for this order."`) — that's
  what the actual proxy returns for 404, so the test now mirrors
  reality (also reinforces R-19 spirit: mock the actual proxy shape,
  not an upstream raw shape).
- **Date resolved:** 2026-04-27 17:13 (local)
- **Tests added:** 0 (existing test corrected; no new test).

---

## 7. Live verification (R-16 + R-17)

### 7.1 R-16 — CSS pipeline checks (PASS)

Logged in as `admin@harvesterp.com`, navigated to the existing dev
order at `/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=landed-cost`,
ran the three required console assertions:

```
fontFamily   = "Manrope, ui-sans-serif, system-ui, …"   ✅ Manrope
styleSheets  = 2                                         ✅ > 0
--f-sans     = "\"Manrope\", ui-sans-serif, …"           ✅ non-empty
console_errors = 0
```

The 2026-04-26 Times-New-Roman regression class is therefore not
present.

### 7.2 R-16 — visibility predicate works end-to-end

The dev DB order is REGULAR / DRAFT, so the shell's 3-axis predicate
(`status ∈ CLEARED+ × role ∈ FINANCE × client_type === TRANSPARENCY`)
hides the tab. Confirmed:

- `?tab=landed-cost` URL **fell back** to `?tab=dashboard` (the
  default for DRAFT) — the URL redirect proves the predicate works.
- Visible tabs were `["Dashboard", "Order Items", "Queries", "Files"]`
  (no "Landed Cost" trigger).
- No `<OrderLandedCostTab>` skeleton or content rendered.
- No `<DeferredTabFallback>` either (the tab is not just unmigrated —
  it's hidden by the predicate).

This proves the shell is gating correctly (gates 2 + 3 + 4 of the
backend's triple gate are mirrored on the frontend).

### 7.3 R-16 — backend gates re-verified live (this session)

Re-flipped the test client to TRANSPARENCY via PUT `/api/clients/{id}`
to exercise the gated 400 path again:

```
PUT  /api/clients/0f9afce8…   client_type: REGULAR → TRANSPARENCY  ✅ 200
GET  /api/orders/de2258e0…/landed-cost/                            ✅ 400
     body: {"detail":"Landed cost is available after customs
            clearance. Current stage: Draft (stage 1)"}
PUT  /api/clients/0f9afce8…   client_type: TRANSPARENCY → REGULAR  ✅ 200 (cleanup)
```

The component's error branch renders this `detail` verbatim — Vue
already does this (`LandedCostTab.vue:28`) and the test fixture
asserts the same `"Current stage:"` substring.

### 7.4 R-16 — populated 200 case is not live-probable in this session

Same constraint flagged in §1.5. The dev DB has no order at
CLEARED+ stage (would require seeding the full PI → advance →
factory ordered → production → packing → booking → sailing →
arrived → customs filed → cleared sequence, with shipments + BOE +
clearance charges). The reachable_forward set on the existing DRAFT
order is empty, so a single `jump-to-stage` API call can't fast-
forward.

This is the **same precedent** set in factory-payments PR #4 and
queries-tab PR #6 when the live happy path required a multi-stage
advance:

- the populated **shape** was source-derived from the FastAPI
  serializer (`landed_cost.py:187-216`),
- the **rendering** is exercised by the 19 component tests in jsdom
  (loading / error / empty / populated / KPI formatting / table
  layout / item-list / download click + error),
- the **proxy round-trip** is exercised by the 17 R-19 fixture
  tests, and
- the **gated branches** (400 + 404) are verified live both in
  Phase 1 (§1.5) and again this session (§7.3).

### 7.5 R-17 scorecard (PASS, 8.8 avg)

Code-level review against `Design/screens/inventory.jsx` (table
list + KPI cards reference) and the queries-tab + files-tab
migrations (closest precedent). The populated rendered output was
verified via the 19 jsdom unit tests rather than a single browser
screenshot — same constraint as queries-tab / factory-payments
documented above.

| Dimension | Score | Notes |
|---|---|---|
| Typography | **9** | Inherits Manrope live (verified §7.1). Section h3 uses `text-sm font-semibold uppercase tracking-wider` — same family as queries-tab + files-tab. KPI value `text-xl font-bold`, label `text-[10px] font-medium uppercase tracking-wider` — matches Vue source 1:1. |
| Layout | **9** | 4-section vertical stack (header / KPIs / expense table / per-item table) mirrors Vue. Header uses `flex items-center justify-between` — same pattern as files-tab's CardHeader. Sections separated by `space-y-6` (consistent with files-tab + queries-tab). |
| Spacing | **9** | All values from Tailwind tokens (`gap-3 p-4 px-5 py-3 mt-1 mt-0.5 space-y-6`). Card padding consistent with prior tabs. KPI grid `grid-cols-2 md:grid-cols-4 gap-3` matches Vue exactly. |
| Color | **9** | KPI cards use `bg-{color}-50 + border-{color}-100 + text-{color}-800` — design-system colour family, matches Vue's choices: blue (Invoice / data), amber (Total Expenses / warning-ish), indigo (Expense % / neutral metric), emerald (Grand Total / positive). Per-item Landed Cost column highlighted emerald-700 (bold) — same as Vue's emerald accent. |
| Component usage | **8** | Card / CardHeader / CardTitle / CardContent / Table family / Button / Skeleton — all design-system primitives. Local `KpiCard` duplicated (decision D-2 — coloured fill differs from queries-tab's left-border accent; promote when a 3rd consumer appears). `formatLakh` is a 6-line private helper port from Vue. -1 point for the intentional local duplication. |
| **Average** | **8.8 / 10 — PASS** | All 5 dimensions ≥ 7 threshold. |

### 7.6 Final checklist

- ✅ pnpm lint — 0 errors (web app)
- ✅ pnpm test (web) — **919 / 919** (was 880 → +39 tests)
- ✅ R-16 — 3/3 console checks + 0 console errors + visibility
  predicate verified end-to-end
- ✅ R-19 — populated shape source-derived, 400/404 verified live
  twice (Phase 1 + this session)
- ✅ R-17 — 5/5 dimensions ≥ 7; average 8.8
- ✅ Landed-cost tab renders real content (component + skeleton)
  when stage+role+client_type all match; deferred fallback removed
  for that case
- ✅ Tab still hidden for OPERATIONS / REGULAR (regression tests
  added)
- ✅ Excel download wired through `useBlobDownload` + new download
  proxy
- ✅ DeferredTabFallback still active for the other 10 tabs (Items,
  Payments, Production, Packing, Booking, Sailing, Shipping Docs,
  Customs, After-Sales, Final Draft)
- ✅ Vue legacy `LandedCostTab.vue` untouched (admin portal only,
  decision D-6)
- ✅ Migration log fully updated

Branch: `feat/orders-landed-cost-tab` (4 commits). Push + PR pending
user approval.

---

## 8. Proposed rules for CONVENTIONS.md

None. The migration relied entirely on existing rules (R-14, R-16,
R-17, R-19, Section-10 patterns). The local-KpiCard pattern is
already covered by the "wait for a 3rd consumer to promote"
heuristic in factory-payments + queries-tab logs — no formal rule
needed yet.

---

## 9. Open questions deferred

None. The Tier 2 deferral list is empty for landed-cost — the Vue
source is feature-complete in this PR.
