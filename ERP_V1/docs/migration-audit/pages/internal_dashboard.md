# Dashboard (Internal)

**Type:** page
**Portal:** internal
**Route:** `/dashboard` (also target of `/` redirect)
**Vue file:** [frontend/src/views/Dashboard.vue](../../../frontend/src/views/Dashboard.vue)
**Line count:** 221
**Migration wave:** Wave 1 (foundational landing page)
**Risk level:** low (read-only page, no write APIs)

## Purpose (one sentence)
Internal home page: shows 5 KPI cards, a pending Client Inquiries table, and a two-column split of Active Shipments + Recent Activity.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`<div class="space-y-6">` — stacks four vertical zones with 1.5rem gaps.

### Zone 1 — Stat Cards row (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6`)
Five cards, each: `bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start justify-between`. Fed by `statCards` array (lines 32-38):

| Order | Key | Label | Icon | Icon BG | Subtext | Subtext color |
|:-:|---|---|---|---|---|---|
| 1 | `total_orders` | `TOTAL ORDERS` | `pi pi-shopping-cart` | `bg-blue-500` | `All active orders` | slate-500 |
| 2 | `in_production` | `IN PRODUCTION` | `pi pi-cog` | `bg-amber-500` | `Factory stages` | slate-500 |
| 3 | `in_transit` | `IN TRANSIT` | `pi pi-truck` | `bg-cyan-500` | `Loaded / Sailing / Arrived` | cyan-600 |
| 4 | `aftersales_open` | `OPEN ISSUES` | `pi pi-exclamation-triangle` | `bg-red-500` | `Needs attention` | red-500 |
| 5 | `client_inquiries` | `CLIENT INQUIRIES` | `pi pi-inbox` | `bg-teal-500` | `Pending approval` | teal-600 |

Each card shows the uppercase label (`text-xs font-semibold uppercase tracking-wide text-slate-400`), a huge `text-3xl font-bold` number (or em-dash if null), the subtext in a muted color, and a 44×44 colored icon tile at the right. All values come from `summary.value[card.key]`.

### Zone 2 — Client Inquiries table (conditional: only when `clientInquiries.length > 0`)
Wrapped in `bg-white rounded-xl shadow-sm border border-teal-100`.
- Header bar (teal-100 border): `<h2>Client Inquiries` + teal pill showing `{count} Pending`.
- Table columns:
  1. **Client** (left, `text-sm font-medium text-slate-800`)
  2. **PO Reference** (left, slate-600; em-dash when null)
  3. **Items** (right, numeric count)
  4. **Submitted** (left, `timeAgo(created_at)` — e.g., `2 hours ago`)
  5. **Action** — teal-600 `Review` button; entire row is also clickable (routes to `/orders/{inq.id}`)

### Zone 3 — 2-column split (`grid grid-cols-1 lg:grid-cols-3 gap-6`)

#### Zone 3L — Active Shipments (`lg:col-span-2`, so 2/3 width on lg)
Card container `bg-white rounded-xl shadow-sm border border-slate-100`.
- Header bar: `<h2>Active Shipments` + emerald pill `{count} Live` + right-aligned `View All` link (`→ /orders`).
- **Loading state**: spinner (`pi pi-spin pi-spinner text-2xl`) in `p-8 text-center text-slate-400`.
- **Filled state**: table with:
  1. **Order / PO** — two-line cell: `order_number` (bold, font-mono) on top, `po_reference || '—'` on bottom (`text-xs text-slate-400`).
  2. **Factory** — `factory_name || '—'`.
  3. **Value** — `formatValue(total_value_cny)` → `¥ {N}` (comma-grouped, no decimals; `¥` is `\u00a5`).
  4. **Status** — pill in `S{stage_number} {stage_name}` format, background/text colored via `stageStyles` map (14 stages, lines 13-28).
  5. **Action** — eye icon button → `/orders/{id}`.
- **Empty state**: `p-8 text-center text-slate-400 text-sm` with `No active shipments`.

**Stage styles map** (for reference in migration):
- Stage 1 → slate
- Stages 2–3 → amber/orange
- Stage 4 → yellow
- Stages 5–9 → blue (all the same)
- Stage 10 → cyan
- Stage 11 → indigo
- Stage 12 → purple
- Stage 13 → emerald
- Stage 14 → green

#### Zone 3R — Recent Activity (1/3 width on lg)
Card container `bg-white rounded-xl shadow-sm border border-slate-100`.
- Header: `<h2>Recent Activity` + subtitle `Latest updates from the team`.
- Body: vertical list (`px-6 py-4 space-y-5 max-h-[480px] overflow-y-auto`). Each item:
  - 2×2 emerald dot (`w-2 h-2 rounded-full bg-emerald-500 mt-2`).
  - Tiny timestamp (`text-[11px] text-slate-400`, via `timeAgo(updated_at)`).
  - Bold action title (`text-sm font-semibold text-slate-800 truncate`).
  - Details line (`text-xs text-slate-500`).
- Empty: `No recent activity`.
- Footer bar with `View All Orders` link → `/orders`.

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| Stat card `total_orders` | `dashboardApi.getSummary` | int | `summary.total_orders` |
| Stat card `in_production` | `dashboardApi.getSummary` | int | factory-stage count |
| Stat card `in_transit` | `dashboardApi.getSummary` | int | Loaded + Sailing + Arrived |
| Stat card `aftersales_open` | `dashboardApi.getSummary` | int | after-sales open issues |
| Stat card `client_inquiries` | `dashboardApi.getSummary` | int | pending approvals |
| Client inquiry rows | `dashboardApi.getClientInquiries` | `{id, client_name, po_reference, item_count, created_at}[]` | swallowed on error (returns empty list) |
| Active shipment rows | `dashboardApi.getActiveShipments` | `{id, order_number, po_reference, factory_name, total_value_cny, stage_number, stage_name}[]` | — |
| Recent activity rows | `dashboardApi.getRecentActivity` | `{id, action, details, updated_at}[]` | — |
| `timeAgo()` | computed in-file (lines 40-51) | `Just now` / `{n} mins ago` / `{n} hours ago` / `Yesterday` / `{n} days ago` | |
| `formatValue()` | computed in-file (lines 53-56) | `¥ 1,234,567` | `\u00a5` + `toLocaleString('en-US')` |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click anywhere on a Client Inquiry row | `router.push('/orders/{inq.id}')` | none | navigate to OrderDetail |
| Click the inquiry-row **Review** button | same + `@click.stop` | none | (same navigation, stops propagation) |
| Click `View All` (Shipments header) | `<router-link to="/orders">` | none | |
| Click anywhere on an Active Shipment row | `router.push('/orders/{s.id}')` | none | |
| Click the shipment-row eye button | same + `@click.stop` | none | |
| Click `View All Orders` (Activity footer) | `<router-link to="/orders">` | none | |

## Modals/dialogs triggered (inline)
None.

## API endpoints consumed (from src/api/index.js)
- `dashboardApi.getSummary()` → `GET /dashboard/summary/` — fills the 5 stat cards.
- `dashboardApi.getActiveShipments()` → `GET /dashboard/active-shipments/` — left table.
- `dashboardApi.getRecentActivity()` → `GET /dashboard/recent-activity/` — right list.
- `dashboardApi.getClientInquiries()` → `GET /dashboard/client-inquiries/` — inquiries table. **Error is caught and substituted with `{ data: { inquiries: [] } }` (line 64)** — this endpoint is treated as optional.

All four run in parallel via `Promise.all` on mount (lines 58-75).

## Composables consumed
None — page uses `dashboardApi` and `useRouter` directly.

## PrimeVue components consumed
None. All chrome is hand-rolled Tailwind + PrimeIcons. No PrimeVue `<DataTable>`, `<Card>`, or `<Skeleton>` — this is a "native" table page.

## Local state (refs, reactive, computed, watch)
- `summary: ref({ total_orders: 0, in_production: 0, in_transit: 0, aftersales_open: 0, client_inquiries: 0 })`
- `activeShipments: ref([])`
- `recentActivity: ref([])`
- `clientInquiries: ref([])`
- `loading: ref(true)`
- `stageStyles` (constant map, lines 13-28)
- `statCards` (constant array, lines 32-38)

All populated in a single `onMounted` with `Promise.all`. No refetch on tab focus, no polling.

## Permissions/role gating
- Route has no `meta.roles` → accessible to any authenticated internal user (the sidebar further gates sidebar-visibility for VIEWER vs OPERATIONS etc.).
- Actual data exposure depends on backend: `/dashboard/*` endpoints must apply RBAC + field-stripping per role (see graphify community #16 "Excel Processing" — `filter_for_role`).

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
- **Loading (initial):** Active Shipments block shows centered spinner; stat cards read `0` / `—`; other sections not loading-aware (they show their empty states instead of spinner).
- **Empty shipments:** `No active shipments` text block.
- **Empty activity:** `No recent activity` text block.
- **Empty inquiries:** The entire inquiries section is `v-if="clientInquiries.length"` — it disappears cleanly when empty.
- **API errors:** Only `console.error('Dashboard load error:', err)` in the `catch` (line 71). No user-visible error banner. The `getClientInquiries` call has an individual `catch` fallback; the other three do not — if `getSummary` fails, the stat cards stay zero silently.

## Business rules (the non-obvious ones)
1. **Values are shown in CNY (¥)** — the factory-facing currency. INR counterparts do not appear on this page. This is a decision to center the internal dashboard on factory-side purchasing, not client-side selling.
2. **The `IN_TRANSIT` KPI aggregates three logical stages** (Loaded + Sailing + Arrived) — subtext makes this explicit.
3. **Client Inquiries surface only to the internal side**; this is the admin queue of orders that are in `CLIENT_DRAFT` status, submitted via the Client Portal.
4. **Stage-number → color map is closed-form (1 to 14).** There are in fact 22 internal statuses per `TechStack.vue` (see `orderStages` list), and 17 logical stages per CLAUDE.md — so the dashboard's stage coloring is a **simplified bucket**. Any stage > 14 falls back to Stage 1 color (`stageStyles[stage] || stageStyles[1]`). [UNCLEAR — needs Sachin review: is this a latent bug, or are only stages 1–14 ever expected in "active shipments"?]

## Known quirks
- **No refresh affordance.** The page loads once on mount. Users must navigate away and back (or use the sidebar's active-link re-click, which currently does nothing) to refresh numbers. `useNotifications` polls, but the dashboard stats don't.
- **`formatValue(0)` returns `—`** (em-dash), because the function's early-return `if (!val) return '—'` treats `0` as falsy. Actual zero-CNY orders display as `—` — minor but surprising.
- **No "Empty Stats" zero-state styling.** A freshly provisioned tenant sees five cards all showing `0` — looks identical to "loading failed."
- **Five stat cards at 5-column grid** — on medium screens collapses to 2 columns → odd last card. That's a visual paper-cut that's easily fixed in migration.

## Migration notes
- **Claude Design template mapping:** **Ledger** hybrid — the KPI strip + two-pane split (shipments + activity) is classic ops dashboard.
- **Layer 2 components needed:** `StatCard` (label + value + icon + subtext), `KPIStrip`, `SimpleTable` (or `DataTable` Layer 2 primitive), `ActivityFeed`, `EmptyState`, `SectionCard` (colored border for the Inquiries highlight).
- **New Layer 1 strings to add:** 5 stat card labels, 5 subtexts, `dashboard.inquiries_title`, `dashboard.inquiries_pending_n`, `dashboard.shipments_title`, `dashboard.shipments_live_n`, `dashboard.activity_title`, `dashboard.activity_subtitle`, `common.view_all`, table column headers × 2 tables, empty-state strings ×3, `time_ago.just_now`, `time_ago.yesterday`, `time_ago.mins_plural`, `time_ago.hours_plural`, `time_ago.days_plural`.
- **Open questions for Sachin:**
  1. Should the dashboard refresh on a timer (e.g., 30–60s) similar to notifications?
  2. Is CNY the permanent display currency for the internal dashboard, or should it switch to INR / multi-currency after the accounting framework rollout?
  3. Do you want the Active Shipments list paginated, or is it always a short "live" slice?
  4. Should OPEN ISSUES / CLIENT INQUIRIES be prioritized so the cards reorder when one is non-zero? Currently fixed order.
  5. Stage color map covers 1–14; confirm whether stages ≥15 should get their own palette.
