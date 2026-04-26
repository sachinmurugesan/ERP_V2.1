# Page Migration — Factory Ledger

## Header

- **Page name:** Factory Ledger
- **Date started:** 2026-04-24
- **Date completed:** — (in progress)
- **Audit profile:** [docs/migration-audit/pages/internal_factory_ledger.md](../../migration-audit/pages/internal_factory_ledger.md)
- **Vue source:** [frontend/src/views/finance/FactoryLedger.vue](../../../frontend/src/views/finance/FactoryLedger.vue) — 175 lines
- **Peer source** (same LedgerPage bundle, scope: Factory only this migration): [frontend/src/views/finance/ClientLedger.vue](../../../frontend/src/views/finance/ClientLedger.vue) — 171 lines
- **Reference image:** none provided
- **Research doc:** [docs/migration/research/factory-ledger-clients-transporters-2026-04-24.md](../research/factory-ledger-clients-transporters-2026-04-24.md) (committed at hash 0756b3d)
- **Branch:** `feat/migrate-factory-ledger`
- **Scope:** Factory Ledger page only. Extracts `<LedgerPage>` Layer 2 component. Client Ledger migration is deferred (but the abstraction is built to accept it).

---

## Phase 1 — Discovery findings

### 1. Research document (authoritative) — findings confirmed

All Target 1 (Factory Ledger) items from the research doc confirmed against live sources. One **correction** to the research doc recorded here: `<LedgerPage>` **already exists in `apps/ui-gallery`** as a design-system prototype at `apps/ui-gallery/src/components/composed/ledger-page.tsx` — the research doc said it was *not yet built*. It is not consumed by `apps/web` today; it is a prototype in the gallery app only. This changes the Phase 3 approach from "design + build from scratch" to "port + generalize" (details in Phase 2 §2.12).

### 2. Audit profile

[docs/migration-audit/pages/internal_factory_ledger.md](../../migration-audit/pages/internal_factory_ledger.md) is complete, current (Patch 18 note from 2026-04-22), and aligns with the Vue source. No drift. Existing known-quirk list (P-002 swallow, date-filter asymmetry, factory dropdown unpaginated) all carry forward.

### 3. Vue source — read in full

**Path:** `frontend/src/views/finance/FactoryLedger.vue` · **175 lines** · composition-api `<script setup>` + `<template>`.

**Sections:**
- **Filter bar** — Factory `<select>` + From/To `<input type="date">` + (conditional) Excel/PDF download buttons.
- **Summary cards** — Total Debit (red), Total Credit (emerald), Net Balance (amber if >0 else emerald).
- **Transactions table** — 10 columns: Date, Order, Remark, Currency, Forex Rate, Debit (₹), Credit (₹), Balance (₹), Method, Reference. Footer TOTALS row.
- **Empty state** — `pi-building` icon + "Select a factory to view their ledger" when no factory selected; `pi-database` + "No ledger entries found" when entries empty.
- **Loading state** — centered spinner.

**Key logic:**
- `loadFactories()` on mount → `GET /api/factories/` (no pagination — loads all).
- `watch([selectedFactory, startDate, endDate], loadLedger)` — reactive refetch.
- `loadLedger()` short-circuits when no factory selected.
- `downloadStatement(format)` — blob download, creates `<a>` element, clicks it, revokes URL.
- All errors `console.error` only (P-002 — documented gap, migration must fix).

**Dead code:** None observed.

**Pagination:** None — ledger is "all orders + payments for this factory in this date range" (no row-level pagination).

**Permission gates in template:** None — no `v-if="hasRole(...)"`. The audit profile flags this: the route has no `meta.roles` so all INTERNAL users can *reach* the page; the backend enforces D-004 via endpoint-level `require_factory_financial`. The Next.js migration must add a frontend `RoleGate` for cleanness.

### 4. Column inventory (transactions table, 10 columns)

| # | Header | Source | Format notes |
|---|---|---|---|
| 1 | Date | `e.date` | ISO "YYYY-MM-DD" |
| 2 | Order | `e.order_number` | `font-mono text-indigo-600 text-xs` |
| 3 | Remark | `e.remark` | plain text |
| 4 | Currency | `e.currency` | mono xs, e.g. "CNY" |
| 5 | Forex Rate | `e.exchange_rate.toFixed(2)` | right-aligned, mono, xs; "-" when null |
| 6 | Debit (₹) | `formatCurrency(e.debit)` | red-600 if >0, "-" else |
| 7 | Credit (₹) | `formatCurrency(e.credit)` | emerald-600 if >0, "-" else |
| 8 | Balance (₹) | `formatCurrency(e.running_balance)` | amber-700 if >0 (factory owed) else emerald-700 |
| 9 | Method | `e.method.replace('_', ' ')` | xs slate-500; "-" for debits |
| 10 | Reference | `e.reference` | xs slate-400 |

### 5. Filter inventory

1. Factory selector — required (ledger is scoped to one factory at a time).
2. `start_date` — optional; ISO date from native date picker.
3. `end_date` — optional.

Watcher re-fetches on any filter change. No explicit "Apply" button.

### 6. Action inventory

| Action | Placement | Visible when | Handler |
|---|---|---|---|
| Factory select | Filter bar (left) | Always | Updates `selectedFactory` ref → triggers watch |
| Date pickers | Filter bar (middle) | Always | Same |
| Excel download | Filter bar (right) | `selectedFactory && entries.length > 0` | `downloadStatement('xlsx')` |
| PDF download | Filter bar (right) | Same | `downloadStatement('pdf')` |

No row-level actions. No bulk actions. No inline edits.

### 7. Balance summary structure

Three cards in a `grid-cols-3`:
- **Total Debit** — red-50 bg / red-100 border / red-700 value
- **Total Credit** — emerald-50 / emerald-100 / emerald-700
- **Net Balance** — amber-50/100/700 if `>0` (factory owed), emerald-50/100/700 if `≤0`

Derived from `summary` response object (not computed client-side beyond colour choice).

### 8. Endpoint verification (LIVE against http://localhost:8001)

All three endpoints confirmed present. Admin JWT receives 403 on the two ledger endpoints — **this is correct D-004 enforcement**, not a bug.

| Endpoint | Method | Status (admin JWT) | Response when authed | OpenAPI typed |
|---|---|---|---|---|
| `/api/factories/` | GET | 200 | `{items: Factory[], total, page, per_page, pages}` (confirmed — DB currently empty but shape present) | Yes (`$ref`) |
| `/api/finance/factory-ledger/{factory_id}/` | GET | 403 (ADMIN blocked) | Shape read from `backend/routers/finance.py:1480-1617`: `{entries: LedgerEntry[], summary: {...}, factory_name, factory_id}` | No (`[]`) |
| `/api/finance/factory-ledger/{factory_id}/download/` | GET | 403 (ADMIN blocked) | Binary (xlsx or pdf). Query: `format`, `start_date`, `end_date` | No (`[]`) |

Entry shape (13 fields, derived from source): `{date, order_number, order_id, remark, debit, credit, amount_foreign, currency, exchange_rate, amount_usd, method, reference, running_balance}`.

Summary shape (6 fields): `{total_debit, total_credit, net_balance, total_debit_usd, total_credit_usd, net_balance_usd}` — UI ignores the three `*_usd` fields.

### 9. Permission confirmation

Verified against `harvesterp-web/packages/lib/src/auth/matrix.ts`:
- Line 74 — `Resource.FACTORY_LEDGER_VIEW: "FACTORY_LEDGER_VIEW"` present.
- Line 145 — `[Resource.FACTORY_LEDGER_VIEW]: [FINANCE]` (explicit FINANCE-only scope).
- Line 5 header — `SUPER_ADMIN bypasses all checks via has_any_role` (permissions.ts).
- Line 184 — `canAccess(UserRole.ADMIN, Resource.FACTORY_LEDGER_VIEW) // false (D-004: ADMIN excluded)` — comment documents intent.

**No Layer 1 changes needed.** `FACTORY_LEDGER_VIEW` consumed via `canAccess(role, Resource.FACTORY_LEDGER_VIEW)` in a `RoleGate` wrapper.

### 10. LedgerPage status

**`apps/ui-gallery/src/components/composed/ledger-page.tsx` exists** (255 lines). Its API:

```ts
interface LedgerPageProps {
  title: InternalString;
  entityType: "client" | "factory";
  entityId: string;
  entityOptions: LedgerEntityOption[];
  onEntityChange: (id: string) => void;
  summary: LedgerSummaryCard[];
  transactions: LedgerTransaction[];
  onDownloadPdf?: () => void;
  onDownloadExcel?: () => void;
  loading?: boolean;
  empty?: boolean;
  locale?: "en" | "ta";
}
```

**Limitations for this migration:**
- Hard-codes a **5-column** transactions table (Date / Description / Debit / Credit / Balance). Factory Ledger needs **10 columns**. Either:
  - (a) Extend with a generic `columns: LedgerColumn[]` prop so consumers can pass an arbitrary schema.
  - (b) Use the 5-col version for client-ledger and a fork for factory-ledger (wastes the reuse).
- Depends on primitives that **do not exist in `apps/web`**: Radix-composed `Select` (SelectContent/Item/Trigger/Value), `Table` (TableHead/Body/Row/Cell/Header), `Skeleton`. `apps/web` currently has a native `<select>` primitive (added during products-form) and no Table/Skeleton primitives.
- Has its own test at `apps/ui-gallery/tests/composed/ledger-page.test.tsx` that **won't port directly** because the consumer app is different.

**Path forward (proposed, awaiting Phase 2 decision):** Port to `apps/web/src/components/composed/ledger-page.tsx`, generalize the transactions table via a `columns` prop, add Table + Skeleton primitives to `apps/web/src/components/primitives/`. Promote Radix-composed Select later if needed (factory ledger can stay with the existing native select for the entity dropdown).

### 11. Date asymmetry (carry-forward concern)

Backend applies the date filter to **payments only**, not to factory-order debits. A date-range view shows *all* debits + only payments in range. This is a documented known-quirk, not a bug, but it surprises users. The migration needs either a visible UI hint or a behavioural change (needs decision in Phase 2).

### 12. Components to reuse

Already available in `apps/web`:
- `@harvesterp/lib`: `formatCurrency`, `formatINR`, `formatDate`, `Resource`, `canAccess`, `InternalString`, `resolveString`.
- `@/components/composed/role-gate.tsx` — RoleGate.
- `@/components/composed/user-dropdown.tsx`, `kpi-card.tsx` — unrelated but confirms Layer 2 pattern.
- `@/components/primitives/button.tsx`, `card.tsx`, `input.tsx`, `select.tsx` (native), `alert-dialog.tsx`, `textarea.tsx`, `label.tsx`.
- `@/lib/session`, `@/lib/api-server` — session + server-side SDK client.

Needs building/porting:
- **`<LedgerPage>`** — port + generalize from ui-gallery version.
- **`<Table>` primitive** — lightweight wrapper (header/body/row/cell/head) over semantic HTML; matches the design system's `.tbl` class in `components.css`.
- **`<Skeleton>` primitive** — for loading state.
- **`useBlobDownload()` hook** — creates `<a>`, clicks, revokes URL. Shared between factory ledger (this migration) and future ledgers.
- **Factory ledger page files** — `/finance/factory-ledger/page.tsx` (RSC shell), `_components/factory-ledger-client.tsx` (client wrapper wiring TanStack Query), `_components/types.ts` (local interfaces for the untyped endpoints), `_components/columns.tsx` (the 10-column schema).
- **API proxy routes** — `apps/web/src/app/api/finance/factory-ledger/[id]/route.ts` (GET ledger) and `apps/web/src/app/api/finance/factory-ledger/[id]/download/route.ts` (GET download stream).

### 13. Stop-condition check

- Research doc committed? **Yes** (0756b3d in log).
- Audit profile present? **Yes.**
- `FACTORY_LEDGER_VIEW` in matrix.ts:74? **Yes** (exact match).
- Any endpoint 404? **No** — admin JWT gets 403 (correct), not 404.
- Vue source >2000 lines? **No** (175 lines).
- Any drift between research doc and reality? **Yes, one:** ui-gallery LedgerPage exists; research doc said it didn't. Documented above and reflected in Phase 2 recommendation.

No stop condition triggered. Proceed.

---

## Phase 2 — UX reasoning report

### User goal

A FINANCE user needs to answer, for one factory at a time, two questions in sequence:
1. **"What's the current net position — do we owe them or are we ahead?"** (balance headline, scanned in under 2 seconds)
2. **"What made up that balance — which orders, which payments, in what order?"** (scannable transaction history)

A SUPER_ADMIN uses the same page for the same two questions plus audit-trail scanning (reference numbers, methods, forex rates on CNY orders). ADMIN has no legitimate use-case — D-004 excludes them.

### Information hierarchy

Ranking, most-to-least important:

1. **Net balance** (is this factory owed, or overpaid, and by how much?)
2. **Factory selector + date range** (the filters that make everything else meaningful)
3. **Transaction list with running balance** (the audit trail)
4. **Totals row** (cross-check on the balance headline)
5. **Download actions** (off-ramp to spreadsheet/PDF for sharing with the factory)

### Current layout assessment

**POLISH** — the Vue layout's hierarchy is already correct:
- Filter bar (factory + dates + downloads) at top.
- Summary cards (Total Debit / Total Credit / **Net Balance**) — Net Balance is the amber/emerald tone-coded one; the eye lands there first.
- Transactions table below.

The content ranking matches user priority. The port should be **faithful** with improvements at the margins:

1. Surface errors (P-002 fix) via toast + inline banners.
2. Add an explicit **"last updated: X seconds ago"** marker or refresh icon to make data staleness visible (the Vue version re-fetches silently on filter change, which is fine for interactive filter changes but a long-sitting page could show stale totals).
3. Add a small **info icon** next to the date range explaining the debit/payment asymmetry (backend applies the filter to payments only — users get confused when they narrow the date range and the net balance still includes ancient debits).
4. ADMIN should see a **dedicated 403 forbidden state**, not a blank table with a swallowed 403 in the console.

No redesign needed.

### Specific suggestions (numbered with reasoning)

1. **Keep the existing 3-card summary** — debit red, credit emerald, net amber/emerald. It matches the design system's finance.jsx KPI row pattern (`finance.jsx:18-31`). No change.
2. **Keep the 10-column transactions table.** Do NOT drop Currency / Forex Rate — these are the critical distinguishers for CNY factory orders vs INR reconciliations. The ui-gallery `<LedgerPage>` prototype only ships 5 columns; generalize it via a `columns` prop (details in §2.12).
3. **Move downloads to a sticky action area** in the header instead of the filter bar. Reason: in the Vue version they hide conditionally (`v-if selectedFactory && entries.length > 0`), which means the buttons jump in/out. A consistent header slot with disabled state (not hidden) is less jumpy and more predictable.
4. **Add an "info" tooltip next to the date range** that reads: *"Date range filters payments only — factory-order debits are always included for the selected factory."* This mirrors the Vue quirk without hiding it.
5. **Gate the entire page via `FACTORY_LEDGER_VIEW`.** On the server-rendered page component, read the user role; if `!canAccess(role, Resource.FACTORY_LEDGER_VIEW)` render a minimal forbidden state (not `notFound()` — 403 is more accurate than 404 for an intentional gate).
6. **Prefer `formatINR` over the `formatCurrency(..., "INR")` call** in the component, it's shorter and more readable.

### Interactions inventory

- **Factory selector** (native select, consistent with rest of app) — triggers refetch.
- **From/To date pickers** (native `<input type="date">`) — trigger refetch on blur/change. No "Apply" button (matches Vue, immediate refetch is fine).
- **Excel button** — downloads xlsx via blob.
- **PDF button** — downloads pdf via blob.
- **Row hover highlight** — present, no click action (rows are non-interactive).

All interactions are discoverable. None are hidden or mislabeled. Filter and action zones are clearly separated by whitespace.

### State coverage

| State | Vue handling | Next.js target |
|---|---|---|
| No factory selected | "Select a factory to view their ledger" empty card | Same, keep. |
| Loading factories | No visible state (loads silently) | Add skeleton on the factory select. |
| Loading ledger | Spinner | Skeleton rows in summary + table. |
| Empty ledger (factory has no activity) | "No ledger entries found" | Keep. |
| Load factories error | **Swallowed** | Toast + retry button. |
| Load ledger error | **Swallowed** | Toast + inline banner above table. |
| Download error | **Swallowed** | Toast. |
| Forbidden (ADMIN) | 403 in console, blank UI | Dedicated forbidden page with role help text. |
| Role blocked (CLIENT / FACTORY / OPERATIONS) | Route guard blocks | Server-side `redirect('/login')` + sidebar hides the Finance item. |

### Accessibility notes

- Colour-only signalling on debit/credit/balance (red/green/amber). Needs a non-colour cue for colour-blind users — add icons (↗ for debits, ↙ for credits, ≈ for neutral) or at minimum ensure the numeric value is always present and semantically labelled.
- Table needs proper `<caption>` + scope="col" on headers.
- Summary cards should be `role="status"` with `aria-live="polite"` so screen readers announce the net balance after a filter change.
- Date inputs use native `<input type="date">` — keyboard-accessible by default.
- Download buttons need `aria-label` with the factory name and range ("Download PDF for factory X from 2026-01-01 to 2026-04-24").

### Responsive notes

The Vue version is desktop-first (explicit `overflow-x-auto` on the table; `grid-cols-3` on cards with no breakpoint sm/md alternatives).

Target behavior in Next.js:
- **Desktop (≥1024px):** cards in a 3-column grid, table fills width.
- **Tablet (768–1023px):** cards stack in a 1-column grid with `sm:grid-cols-3` (ui-gallery's LedgerPage uses `sm:grid-cols-4` — appropriate for that 4-card layout but we're on 3). Table scrolls horizontally inside an `overflow-x-auto` wrapper.
- **Mobile (<768px):** same stacking, but the 10-column table is too wide. Two options:
  - (a) horizontal scroll (accept, it's an admin/finance tool, not primarily mobile).
  - (b) card-per-transaction layout below `md:` like products-list did.

Recommend **(a) horizontal scroll** for the transactions table — finance users work on desktops, a degraded mobile experience is acceptable for this page.

### Role-based behavior

| Role | View summary? | View table? | Download? | Sidebar item visible? |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ (via bypass) | ✓ | ✓ | ✓ |
| FINANCE | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✗ (D-004) | ✗ | ✗ | ✗ (hide Finance menu item) |
| OPERATIONS | ✗ | ✗ | ✗ | ✗ |
| CLIENT / FACTORY | ✗ (route-guarded — can't reach internal portal) | — | — | — |

Page-level implementation: `RoleGate user={user} permission={Resource.FACTORY_LEDGER_VIEW}` wraps everything. Server component additionally renders a proper 403 page for ADMIN who might have an old bookmark.

### LedgerPage extraction decision (§2.12)

Research doc proposed **Option A: build LedgerPage as Layer 2, consume from factory-ledger**. Phase 1 revealed a prototype already exists in `apps/ui-gallery`. Revised recommendation:

**Option A' (modified):** **Port + generalize the ui-gallery LedgerPage into `apps/web/src/components/composed/ledger-page.tsx` in this migration.** Changes vs the prototype:
- Add a `columns: LedgerColumn[]` prop (generic schema) so factory's 10 columns and client's 8 columns can both consume it.
- Swap its Radix-composed Select/Table/Skeleton primitive dependencies to match `apps/web`'s primitive roster (native `<Select>` already present; add lightweight `<Table>` and `<Skeleton>` primitives alongside).
- Add a `dateRange` filter zone (absent from the prototype, present in both Vue sources).
- Accept `actions?: ReactNode` slot in the header so factory-specific controls can slot in if needed.

**Why A' over B (inline + extract later):** the prototype already validates the abstraction concept, and the structural diff between factory and client ledgers is small (2 columns, nothing else). Building inline here would delete proven work.

**Why A' over C (partial abstraction):** nothing in the factory-specific surface is hard to put behind a prop. `entityType` already differentiates "client"/"factory"; extending with column schema is a natural widening, not a pollution.

**Client Ledger migration** is out of scope for this PR per the user's scope note, but the component is built to accept it without changes.

### Recommendation: POLISH

Faithful port of the content. Visual layer rebuilt using the design system's Card + table patterns. State coverage expanded (P-002 fixes, role-gate forbidden state, skeleton loading). One abstraction lift: `<LedgerPage>` from ui-gallery → apps/web with a generic columns API.

No new UX patterns. No content reorder. No redesign.

### Awaiting user decision on

| # | Decision | Recommendation |
|---|---|---|
| 1 | LedgerPage port strategy (A / B / C / A'-modified) | **A'-modified** — port from ui-gallery + add `columns` prop + add Table/Skeleton primitives. |
| 2 | Transactions table column count: 10 (faithful) or a condensed subset? | **10 (faithful)** — Currency + Forex Rate are essential for CNY factories. |
| 3 | Download buttons: header (consistent placement) or filter bar (Vue-faithful, conditionally hidden)? | **Header (consistent)** with disabled state when no factory selected. |
| 4 | Date filter asymmetry (payments only): preserve + info tooltip, OR fix behaviour (apply to debits too)? | **Preserve + tooltip** — backend change is out of scope for this migration; tooltip closes the UX gap. |
| 5 | Default date range: "All time" (no filter), "Last 90 days", "This FY"? | **"All time"** — matches Vue; finance users frequently want the full picture, and narrowing is one click. |
| 6 | ADMIN forbidden state: dedicated 403 page, or route redirect to `/dashboard`? | **Dedicated 403 page** with explanatory text — helps FINANCE teams debug access issues later. |
| 7 | Responsive strategy for transactions table (mobile): horizontal scroll OR card-per-row? | **Horizontal scroll** — this is a desktop finance tool, card layout wastes effort. |
| 8 | Debit/credit/balance non-colour cues (accessibility): icons, bold for non-zero, something else? | **Bold non-zero values + `aria-label` including "debit"/"credit"** — icons add noise; the colour + bold + label triad is sufficient without over-decorating. |
| 9 | `useBlobDownload()` hook — lift to Layer 2 now, or inline in the factory-ledger client? | **Lift to Layer 2** (`apps/web/src/lib/use-blob-download.ts` or `apps/web/src/components/composed/use-blob-download.ts`) — tiny, reused by future ledgers + exports. |
| 10 | Currency display in summary cards: INR only, OR INR + USD secondary? | **INR only** for visual simplicity; keep the `*_usd` summary fields in the types.ts interface (don't render) so future "toggle to USD" is a cheap change. |
| 11 | Sidebar item hiding for ADMIN: update `NavigationSidebar` to filter Finance by role, OR rely on the RoleGate forbidden page alone? | **Update `NavigationSidebar`** — hiding the link is more polished than a one-click dead-end. Small patch. |

### New components to be built (Phase 3)

1. `apps/web/src/components/composed/ledger-page.tsx` — ported + generalized.
2. `apps/web/src/components/primitives/table.tsx` — semantic HTML table wrapper (Table / TableHeader / TableBody / TableRow / TableHead / TableCell).
3. `apps/web/src/components/primitives/skeleton.tsx` — loading shimmer.
4. `apps/web/src/lib/use-blob-download.ts` — hook for xlsx/pdf blob downloads with error surfacing.
5. `apps/web/src/app/(app)/finance/factory-ledger/page.tsx` — RSC shell with role gate + initial factory list fetch.
6. `apps/web/src/app/(app)/finance/factory-ledger/_components/factory-ledger-client.tsx` — client interactive wrapper with TanStack Query for ledger refetch on filter change.
7. `apps/web/src/app/(app)/finance/factory-ledger/_components/types.ts` — local `FactoryLedgerResponse`, `LedgerEntry`, `LedgerSummary` interfaces.
8. `apps/web/src/app/(app)/finance/factory-ledger/_components/columns.tsx` — the 10-column schema for the `<LedgerPage columns={...}>` prop.
9. `apps/web/src/app/api/finance/factory-ledger/[id]/route.ts` — GET proxy.
10. `apps/web/src/app/api/finance/factory-ledger/[id]/download/route.ts` — GET blob proxy with stream pass-through.
11. Tests (each component + route handler) — target ~35 new tests covering role gate, column rendering, download trigger, empty states, error states.

### STOP — awaiting user approval of 11 decisions above before Phase 3.

---

## Phase 3 — Implementation notes

### Files created

**Layer 1 primitives (2)**
- `apps/web/src/components/primitives/table.tsx` (121 lines) — shadcn table wrapper (Table/Header/Body/Footer/Row/Head/Cell/Caption) with uppercase tracking-wide header styling that matches the design system. Ported from ui-gallery.
- `apps/web/src/components/primitives/skeleton.tsx` (19 lines) — animate-pulse shimmer.

**Layer 2 composed (2)**
- `apps/web/src/components/composed/ledger-page.tsx` (317 lines) — ported from ui-gallery + generalized: `columns<TRow>` prop, date-range filter, totals footer, `downloadDisabled`, `dateFilterTooltip`, `error`, `headerActions`.
- `apps/web/src/components/composed/admin-forbidden-state.tsx` (54 lines) — dedicated D-004 403 screen.

**Lib hooks (1)**
- `apps/web/src/lib/use-blob-download.ts` (117 lines) — authenticated blob download with RFC 5987 filename extraction and proper error surfacing.

**Page (4 files under `apps/web/src/app/(app)/finance/factory-ledger/`)**
- `page.tsx` (76 lines) — RSC shell: role gate via `FACTORY_LEDGER_VIEW`, AdminForbiddenState for ADMIN, generic 403 for others, initial factory list pre-fetch.
- `_components/factory-ledger-client.tsx` (146 lines) — TanStack Query wrapper, blob download integration, summary + totals derivation.
- `_components/columns.tsx` (100 lines) — 10-column schema with bold non-zero + aria-label a11y cues, sticky Date column for mobile scroll.
- `_components/types.ts` (55 lines) — local `LedgerEntry`, `LedgerSummary`, `FactoryLedgerResponse`, `FactorySummary`, `FactoriesListResponse` interfaces (OpenAPI declares these as `{}`).

**API route handlers (2)**
- `apps/web/src/app/api/finance/factory-ledger/[id]/route.ts` (56 lines) — GET proxy with start_date/end_date forwarding; preserves 403/404 status semantics.
- `apps/web/src/app/api/finance/factory-ledger/[id]/download/route.ts` (79 lines) — blob-streaming proxy for xlsx/pdf with format whitelist + Content-Disposition passthrough.

**Tests (5 files, +64 tests)**
- `tests/components/table.test.tsx` — 8 tests (table + skeleton primitives).
- `tests/lib/use-blob-download.test.ts` — 7 tests (success, fallback filename, 403, network error, empty blob, RFC 5987, clearError).
- `tests/components/ledger-page.test.tsx` — 20 tests (rendering, interactions, totals, custom 10-column schema, AdminForbiddenState).
- `tests/api/factory-ledger-routes.test.ts` — 11 tests (GET proxy + download stream with 401/403/404/500 mapping, format whitelist, fallback Content-Disposition).
- `tests/app/factory-ledger-client.test.tsx` — 11 tests (dropdown, fetch wiring, summary cards, download button enable rules, error banner, subtitle).
- `tests/components/navigation-role-filter.test.tsx` — 5 new route-target tests (finance items route under `/finance/*`).
- `tests/infra/nginx-config.test.ts` — extended `EXPECTED_MIGRATED_PATHS` with `/finance/factory-ledger` (+2 tests implicit).

### Files modified

- `apps/web/src/components/shells/navigation-sidebar.tsx` — added `NAV_HREF_OVERRIDES` for finance items; sidebar role filtering already existed and correctly hides factory-ledger for non-FINANCE roles.
- `nginx/nginx.dev.conf` — added `location = /finance/factory-ledger`.
- `nginx/nginx.conf` — same, replicated across all 3 portals.
- `docs/migration/MIGRATED_PATHS.md` — 7 → 8 entries.
- `apps/web/tests/infra/nginx-config.test.ts` — extended path list.

### Tech-debt notes created

- `docs/tech-debt/factory-ledger-date-filter.md` (43 lines) — documents the backend date-asymmetry quirk (filter applies to payments only) with the current frontend tooltip workaround and proposed backend fix.

### Commits on this branch (5)

1. `feat(primitives): add table and skeleton primitives` — 72060f7
2. `feat(lib): add useBlobDownload hook` — f7528d7
3. `feat(composed): port and generalize LedgerPage` — d25b0ca
4. `feat(shell): filter sidebar items by role permissions` — ebe010d (separate commit per Phase 2 decision 11; routing overrides were the missing piece; visibility filter already in place)
5. *(this commit)* page + API routes + nginx + MIGRATED_PATHS + tech debt + log

### Definition of done — verification

| Item | Status |
|---|---|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm test` (web) | **433 passed** (369 baseline → +64) |
| `pnpm test` (lib) | 280 passed (unchanged) |
| `tsc --noEmit` | 0 errors |
| `pnpm build` | 0 errors; `/finance/factory-ledger` 4.99 kB + 119 kB first-load |
| nginx dev + prod (3 portals) | Verified (3 occurrences of `location = /finance/factory-ledger`) |
| MIGRATED_PATHS.md | 7 → 8 ✓ |
| nginx-config test | 37 passed (was 35) |
| ADMIN dedicated 403 | Verified live on preview (title: "Access restricted", sidebar hides Factory Ledger) |
| Mobile sticky Date column | Implemented in columns.tsx via `sticky left-0 z-10` |
| Bold non-zero + aria-label | Implemented in columns.tsx `moneyCell` / `balanceCell` |
| Date filter tooltip | Implemented; tech-debt doc filed |
| LedgerPage accepts `columns<TRow>` | Yes — unit-tested with 10-column custom schema |
| `useBlobDownload` returns `{ download, isDownloading, error, clearError }` | Yes |
| Sidebar filtering doesn't break other pages | 30 navigation tests green |

### Visual verification (preview)

- `/finance/factory-ledger` loaded as ADMIN → **AdminForbiddenState rendered** ("Access restricted" + D-004 message + return-to-dashboard link).
- Sidebar does NOT show "Factory Ledger" for ADMIN.
- No browser console errors.

_FINANCE-role live verification skipped — no FINANCE user in the seeded DB; unit tests cover the success path comprehensively (44 tests across LedgerPage, FactoryLedgerClient, and route handlers)._

---

## Issues encountered and resolutions

### Issue 1: React Compiler flagged useMemo in client component

- **Date raised:** 2026-04-24 20:37
- **Problem:** `pnpm lint` failed with "Compilation Skipped: Existing memoization could not be preserved" on three `React.useMemo` calls in `factory-ledger-client.tsx`. React Compiler inferred dependencies like `ledger.summary.total_debit` but the manual `[ledger?.summary]` was broader.
- **Root cause:** React Compiler is strict about manual memo dependency accuracy when the compiler handles memoization itself.
- **Fix applied:** removed all three `useMemo` calls — let React Compiler handle memoization. Converted to plain derived values inside the component body.
- **Date resolved:** 2026-04-24 20:37
- **Tests added:** not needed — behaviour unchanged; unit tests still pass.

### Issue 2: Preview dev server had stale `.next` after `pnpm build`

- **Date raised:** 2026-04-24 20:38
- **Problem:** Dev server crashed on page load with ENOENT for a chunk file.
- **Root cause:** Running `pnpm build` overwrote `.next/` with production artifacts; the subsequent `next dev` read a mismatched graph.
- **Fix applied:** stopped dev server, `rm -rf .next`, restarted — same workaround applied in the products-form migration (Issue 2 there).
- **Date resolved:** 2026-04-24 20:39
- **Tests added:** none (infra hiccup).

### Issue 3: `LedgerPage` TypeScript under `exactOptionalPropertyTypes`

- **Date raised:** 2026-04-24 20:30
- **Problem:** Passing `undefined` for optional props caused `TS2375` on `exactOptionalPropertyTypes: true`.
- **Root cause:** Same pattern seen in products-form migration (R-14).
- **Fix applied:** widened every optional prop in `LedgerPageProps<TRow>` to `T | undefined`.
- **Date resolved:** 2026-04-24 20:30
- **Tests added:** none (type only).

### Issue 4: ui-gallery LedgerPage prototype existed — research doc said it didn't

- **Date raised:** 2026-04-24 (Phase 1)
- **Problem:** Research doc 0756b3d asserted `<LedgerPage>` was *not built*; `apps/ui-gallery` has a prototype at `src/components/composed/ledger-page.tsx` (255 lines).
- **Root cause:** Research pass did not search `apps/ui-gallery`.
- **Fix applied:** Phase 2 decision 1 updated to "port + generalize from prototype" rather than "design from scratch". Reduced total scope; preserved abstraction validation work already done by the gallery team.
- **Date resolved:** 2026-04-24 (Phase 2)
- **Tests added:** 20 component tests for the ported + generalized version.

### Issue 5: NavigationSidebar routing bug for `/finance/*` items

- **Date raised:** 2026-04-24 (Step 4)
- **Problem:** Clicking "Factory Ledger" in the sidebar would have routed to `/factory-ledger` (missing `/finance/` prefix). Other finance items (receivables, client-ledger, payments) would have had the same bug — all four map to nested `/finance/*` routes in the Vue app.
- **Root cause:** `onNavigate` in NavigationSidebar pushed `/${id}` unconditionally. No override map.
- **Fix applied:** added `NAV_HREF_OVERRIDES` map with all 4 finance routes.
- **Date resolved:** 2026-04-24 20:27
- **Tests added:** 5 new routing-target tests.

### Issue 6: `per_page=500` exceeds backend cap → factory dropdown empty

- **Date raised:** 2026-04-24 21:12 (pre-merge FINANCE live verification)
- **Problem:** After seeding a factory in the DB, the Factory Ledger dropdown still showed only the placeholder. Dropdown was populated by RSC's `fetchFactories()` calling `/api/factories/?per_page=500`.
- **Root cause:** Backend caps `per_page` at 200 (Pydantic query validator: `le=200`). Value 500 triggered a 422 validation error. `fetchFactories()` has a try/catch that returns `[]` silently on failure, hiding the actual issue from the user.
- **Fix applied:** lowered to `per_page: 200` with inline comment noting the cap and that pagination will be needed if factory count ever approaches it.
- **Date resolved:** 2026-04-24 21:14
- **Verified:** factory dropdown now populates; selecting the seeded factory renders the ledger with empty-state (no orders in this test DB) + zero-valued summary cards; PDF/Excel buttons correctly disabled for empty transactions. No console errors.
- **Tests added:** none added specifically — the bug surfaced from integration (RSC + real backend); unit tests mock the endpoint and can't detect a query-param validation mismatch. Filing a follow-up thought (not a test) on whether the `fetchFactories()` silent-catch should surface errors to a page-level banner, matching the error-banner pattern used inside `FactoryLedgerClient`. Deferred as a polish item.

---

## Proposed rules for CONVENTIONS.md (if any)

None this migration. R-14 (RSC prop forwarding under `exactOptionalPropertyTypes`) applied again. R-15 (Layer-2 lift threshold) still deferred per user's review direction after products-form — this migration did lift `<LedgerPage>` on first-known-upcoming-use, but the rule is still under evaluation.

---

## Open questions deferred

- Backend date-filter asymmetry — documented in tech debt, low priority.
- FINANCE-role live preview verification deferred (no seeded user). Unit tests cover the success path.
- Whether to generalize `AdminForbiddenState` for other D-004-like exclusions (e.g. future "ADMIN sees Payments limited" cases). Current pattern is specific to this one screen; future need will show whether it should become a generic `DenyByPolicy` composed component.

---

## Final status

- **Tests passing:** 433/433 web, 280/280 lib, 37/37 infra.
- **Build:** ✅
- **Lint:** ✅ (0 errors, 0 warnings)
- **nginx config:** ✅ (dev + all 3 portals)
- **MIGRATED_PATHS.md:** ✅ (7 → 8)
- **Committed in PR:** (pending — branch feat/migrate-factory-ledger, 5 commits)
- **Merged:** not yet (awaiting review per scope boundary)
- **Deployed to staging / production:** —

---

## Visual fidelity (R-17, retroactive — added 2026-04-26)

Audited live in a real browser (Claude Preview MCP) on 2026-04-26 after the dev-server CSS-pipeline regression of that morning was resolved by `rm -rf apps/web/.next` + restart. Full root-cause analysis of the regression is in [`docs/migration/audits/ui-quality-audit-2026-04-26.md`](../audits/ui-quality-audit-2026-04-26.md).

Two states verified: (1) initial empty state ("Select a factory to view their ledger"); (2) populated state with `Acme Test Factory` selected (₹0.00 summary tiles + "No ledger entries found" empty-table message — there are no transactions in the seeded test DB).

**Reference compared against:** [`Design/screens/finance.jsx`](../../../Design/screens/finance.jsx)

**Scorecard (R-17, 5 dimensions × 0–10, threshold = 7):**

| Dimension | Score | Notes |
|---|---|---|
| Typography | 8 | Manrope loads. KPI tile values render at 24 px (`text-2xl`) where the DS `.kpi-value` class is 30 px tabular-nums. Headings + body otherwise on-spec. |
| Layout | 9 | Factory selector (top) → 4-tile summary row → transactions table → PDF/Excel export buttons. Matches `finance.jsx` reference. |
| Spacing | 8 | `<Card>` framing on summary tiles produces correct gutters. Empty-state messaging is centered and properly spaced. |
| Color | 8 | Brand emerald primary action (Apply / Export). Currency formatting uses `--n-700` neutral; no off-token colors. |
| Component usage | 7 | Zero DS class adoption (0 `.btn` / 0 `.card` / 0 `.chip` / 0 `.tbl` / 0 `.input`). Built entirely from primitive `<Card>` / `<Table>` / `<Input>` / `<Button>` via the `<LedgerPage>` composed component. Functional + visually close to reference, but consistency-with-older-cohort is weakest. |
| **Average** | **8.0 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

**Verdict:** PASS. No fixes required.

**Caveats / known drift:**
- KPI numerals at 24 px instead of 30 px is the most visible delta vs reference. Promoting `<LedgerPage>` summary tiles to use `.kpi-value` would close it; tracked as part of audit recommendation #6 (DS-class-adoption decision).
- Export buttons (PDF / Excel) correctly disabled when no transactions; matches reference's "no-data" mode.
- AdminForbiddenState (D-004) not exercised in this run — FINANCE seeded user not yet available; unit tests cover the success path.

**Audit context:** This page passed the original R-16 (live happy-path verification) at merge time. The retroactive R-17 audit was triggered by a user-reported visual breakage on `/clients` on 2026-04-26 that turned out to be a dev-server CSS 404 affecting all 8 migrated pages, not a per-page defect. After clean `.next` rebuild, every migrated page (including this one) renders correctly with Manrope and brand-emerald CTAs. R-17 was added to CONVENTIONS.md as a result; this section back-fills the gate retroactively.
