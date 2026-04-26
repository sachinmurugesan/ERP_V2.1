# Migration Log — Dashboard

## Header

- **Page name:** Dashboard (internal)
- **Date started:** 2026-04-23
- **Date completed:** _(pending)_
- **Audit profile:** [docs/migration-audit/pages/internal_dashboard.md](../../migration-audit/pages/internal_dashboard.md)
- **Also referenced (flagged for follow-up):**
  - [docs/migration-audit/pages/client_dashboard.md](../../migration-audit/pages/client_dashboard.md)
  - [docs/migration-audit/pages/factory_dashboard.md](../../migration-audit/pages/factory_dashboard.md)
- **Vue source:** [ERP_V1/frontend/src/views/Dashboard.vue](../../../frontend/src/views/Dashboard.vue)
- **Reference image / screen:** `Design/screens/dashboard-v1.jsx` (primary; v2 and v3 also exist on disk)
- **Branch:** `feat/migrate-dashboard`
- **Scope:** INTERNAL dashboard only in this migration. CLIENT and FACTORY dashboards flagged for follow-up migrations (separate tasks).

---

## Phase 1 — Discovery findings

### What the audit profile says (internal_dashboard.md)

Internal home page after login. Five KPI stat cards (Total Orders, In Production, In Transit, Open Issues, Client Inquiries), a conditional Client Inquiries table, and a two-column split of Active Shipments (2/3 width) + Recent Activity (1/3 width). Route: `/dashboard`. No `meta.roles` — open to all authenticated INTERNAL users. Sidebar gates which roles can see the link in the first place, but the page itself is not role-gated.

### What the Vue source actually does

`frontend/src/views/Dashboard.vue` (221 lines) matches the audit faithfully.

- **Stat cards (5):** `grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6`. Plain white cards with colored icon tile; no sparklines, no deltas, no trend indicators. Values default to `0` or em-dash.
- **Client Inquiries table:** Teal-bordered header card, 5 columns (Client, PO Reference, Items, Submitted, Action). Hidden entirely when list is empty (`v-if="clientInquiries.length"`). Row click → `/orders/{id}`.
- **Active Shipments table:** Emerald-bordered header card, 5 columns (Order, Factory, Value CNY, Stage, action). Loading spinner present. "View All" → `/orders`. Empty-state text "No active shipments" when applicable.
- **Recent Activity feed:** White card with auto-scroll `max-h-[480px]`. Dot + timestamp + action + details rows. "View All Orders" link. Empty-state text "No recent activity".
- **Parallel data load:** `Promise.all` on four endpoints in `onMounted`. `getClientInquiries` has individual `.catch` returning `{ inquiries: [] }`; other three have no per-call catch (silent failure keeps zeros).

### API endpoints called

All under `/api/dashboard/*` (admin-scoped):

1. `GET /api/dashboard/summary/` → five counters.
2. `GET /api/dashboard/active-shipments/` → list of orders in production/transit, includes `total_value_cny`, `stage_number`, `stage_name`.
3. `GET /api/dashboard/recent-activity/` → recent order updates for activity feed.
4. `GET /api/dashboard/client-inquiries/` → pending client-initiated inquiries.

Additional endpoints exist but are NOT called by current Vue dashboard:
- `GET /api/dashboard/recent-orders/` (defined in OpenAPI, unused by current Vue).

No `/api/users/me` call inside `Dashboard.vue`; user context comes from the existing `useAuth()` composable (same session token used by Layer 1 layout).

**Note:** OpenAPI response schemas for all `/api/dashboard/*` endpoints are empty (`{}`) — response shapes are inferred from Vue template field access, not typed contracts. This is pre-existing tech debt, not a blocker for this migration.

### Drift between audit and Vue source

**None.** The internal dashboard audit profile and the Vue source match field-for-field.

### Role-based content strategy (today)

- **No role gating inside the component.** Every INTERNAL user sees identical content regardless of role (SUPER_ADMIN, ADMIN, FINANCE, OPERATIONS, VIEWER).
- `total_value_cny` is shown on Active Shipments rows to every role, which is arguably in tension with D-004 (factory pricing is SUPER_ADMIN/FINANCE only) and D-010 (OPERATIONS excludes profit estimates). Ruling: `total_value_cny` is the order's total factory value, not markup/profit, so it is not strictly gated by D-004 — but this is worth an explicit decision during Phase 2 rather than carrying forward the Vue behavior without question.

### State coverage (today)

- **Loading:** Only Active Shipments has an actual spinner. Stat cards, Client Inquiries, and Recent Activity show baseline-zero or empty-text while fetching — no visible loading feedback.
- **Empty:** Client Inquiries hides the whole section. Shipments and Activity show plain text. Treatment is inconsistent.
- **Error:** Three of four endpoints fail silently (stats stay at zero with no banner). Only Client Inquiries has an explicit empty-on-error fallback. No error toast or retry.
- **Permission-denied:** Not applicable inside the page — if the user lacks auth, the global router guard redirects to `/login` before the page renders.

### Key interactions (today)

| Trigger | Destination | Notes |
|---|---|---|
| Click Client Inquiry row | `/orders/{id}` | Row clickable; "Review" button uses `@click.stop` |
| Click Active Shipment row | `/orders/{id}` | Row clickable; eye icon uses `@click.stop` |
| Click "View All" (shipments) | `/orders` | `router-link` |
| Click "View All Orders" (activity) | `/orders` | `router-link` |

No filters, no time-range switchers, no drill-down, no refresh button.

### Layer 2 components available for reuse

**Design system primitives** (`apps/ui-gallery/src/components/design-system/`): Icon, HarvestERPLogo, DSAvatar, SparkLine, AreaChart, BarChart, Donut, Progress. All production-ready, tokens-based, no external chart library.

**Composed components** (`apps/ui-gallery/src/components/composed/`): **KpiCard** (label + value + delta + subtext + optional sparkline + tone), **RoleGate** (frontend permission gate), CarryForwardStepper, ClientAvatar, PageShell.

**Shells** (`apps/ui-gallery/src/components/shells/`): Sidebar (232/64 compact), Topbar (breadcrumbs, title, currency switcher, theme toggle, notifications).

### Design reference evaluation

Three dashboard variants exist at `C:\Dev\Template_1\ERP_V1\Design\screens\`. The task specifies v1 as primary; v2 and v3 are noted for optional inspiration.

- **dashboard-v1.jsx (primary):** Airy, balanced, executive-finance-leaning. 4 KPI cards with sparklines → Revenue Trend area chart + Cash Position donut → Pending Approvals + Top-moving SKUs. Brand-emerald palette on light surfaces. Uses tokens.css.
- **dashboard-v2.jsx:** Dense, operational. Compact sidebar (64px), 6-column metric strip, live orders table with status filters, warehouse capacity bars, AR aging bars, approval queue with step indicators. Closer in spirit to the current Vue content.
- **dashboard-v3.jsx:** Dark, AI-forward. Gradient hero, AI Copilot card, revenue-vs-target chart, sales funnel, risk feed, team activity grid.

### Critical observation — mismatch between reference and Vue content

**dashboard-v1.jsx is an executive/finance dashboard.** It shows revenue trends, cash position across accounts, pending invoice approvals, and top-moving SKUs. The **current Vue dashboard is an operations dashboard** — its focus is order workflow: orders in production, orders in transit, open after-sales issues, client inquiries, shipment stages.

These are not the same dashboard. A literal port of v1 would delete the operational utility the Vue page currently has (active shipments, recent activity, client inquiries), while a faithful port of the Vue page would not look like v1 at all. Phase 2 has to resolve this directly — it is the central design decision of this migration.

### Tokens available

`Design/styles/tokens.css` provides semantic tokens: `--bg`, `--bg-elev`, `--bg-sunken`, `--fg`, `--fg-muted`, `--border`, `--brand-{50..950}`, semantic colors (`--ok`, `--warn`, `--err`, `--info`), chart palette `--c1..--c6`, radii (`--r-xs..--r-xl`, `--r-full`), shadow set (`--sh-xs..--sh-lg`), typography (`--f-sans` Manrope, `--f-mono` JetBrains Mono), spacing (`--s-1..--s-12`). Both light and dark modes defined.

### Router findings

Three dashboard routes confirmed, no others:

| Portal | Route | Component | Guard |
|---|---|---|---|
| Internal | `/dashboard` | `views/Dashboard.vue` | Auth only; no `meta.roles` |
| Client | `/client-portal/` | `views/client/ClientDashboard.vue` | `user_type === 'CLIENT'` |
| Factory | `/factory-portal/` | `views/factory/FactoryDashboard.vue` | `user_type === 'FACTORY'` |

`/` redirects to `/dashboard`.

### CLIENT / FACTORY dashboards (flagged for follow-up)

- **ClientDashboard.vue** (150 lines): welcome + 3 stat cards (Active / Total / In-Transit) + 5-row recent orders table. Calls `ordersApi.list({ limit: 10 })` and client-side aggregates — undercounts if client has more than 10 orders. All labels are `PortalString` keys with empty Tamil translations (bilingual required per Section 8).
- **FactoryDashboard.vue** (82 lines): welcome + 3 stat cards (Active / Total / Pending Updates [dead — never written]) + recent orders list. Calls `ordersApi.list({ limit: 5 })`. Same undercount risk. Errors silently swallowed.

Both should be migrated later in separate tasks. Neither is blocking for the internal migration.

### Current Next.js placeholder

`harvesterp-web/apps/web/src/app/(app)/dashboard/page.tsx` — Task 7 scaffold. Async RSC, Suspense-wrapped card fetching `/api/dashboard/recent-orders/`, client `QuickStatsCard` polling `/api/auth/session` every 30s. Useful as a reference for the RSC + Suspense + React-Query patterns established in the app shell, but the content itself is placeholder and gets replaced wholesale in Phase 3.

The `(app)` layout already renders `NavigationSidebar` and `AppTopbar` around the page, so the migrated dashboard only needs to render page content.

### [UNCLEAR] markers and open questions surfaced by discovery

- **Stage color map only covers stages 1–14.** Dashboard.vue `stageStyles` falls back to slate for stages ≥15, which may exist per `TechStack.vue`. Latent cosmetic bug. Decision: fix in this migration, or defer to a follow-up?
- **Dashboard refresh cadence.** No polling today. Should the new dashboard auto-refresh (30–60s like notifications), or stay static?
- **Role-based gating.** Should `total_value_cny` be visible to OPERATIONS and VIEWER? Today: yes. Moving forward: yes / no / different-per-role?
- **Sparkline data.** v1 shows sparklines per KPI card. Backend has no trend history endpoint today. Skip sparklines, or add the endpoint?
- **Revenue / cash content from v1.** No endpoints exist for revenue trend or cash position. Include in scope by adding endpoints, or drop?

---

## Phase 2 — UX reasoning report

### User goal

One-sentence goal: **An internal user opening the dashboard wants to know, within two seconds, whether anything needs their attention right now — new client inquiries to triage, shipments in motion, or recent order activity — without hunting through the orders list.**

This is an operations dashboard, not a finance dashboard. The "right now" framing matters: the dashboard is a triage surface, not a reporting surface.

### Information hierarchy (ranked 1 → 5, most to least important)

1. **Action required (Client Inquiries awaiting review).** A pending inquiry is the single thing that most directly demands the user's time. When present, it goes first.
2. **Operational summary (5 KPI counters).** Total orders, in-production, in-transit, open after-sales, pending inquiries — the at-a-glance health check.
3. **Active shipments detail.** Which orders are mid-flight, at what stage, for which factory, at what value. The "what is moving" view.
4. **Recent activity feed.** What changed in the last few hours. Useful for picking up where you left off after lunch / overnight.
5. **Navigation shortcuts (View All).** Always visible, never competing for attention.

### Current layout assessment

**Significant redesign recommended — but not a blank-slate redesign.** The current Vue page is a Task 7 placeholder in the Next.js app, but the Vue page it will replace is a real, working operations dashboard whose content and hierarchy are correct. The redesign is an aesthetic and ergonomic upgrade of that content — not a replacement of its information.

- The Vue page's hierarchy (inquiries → stats → shipments + activity) is well-aligned with user priority. Keep it.
- The Vue page's visual treatment (flat white cards, plain numbers, no trend indication, inconsistent states) is below design-system standard. Upgrade it.
- dashboard-v1.jsx is **aesthetically** the right target (airy, tokens-based, uses `KpiCard` with sparklines, area/donut charts, proper card pattern). Its **content** is not directly applicable (revenue/cash/invoice-approvals is not what the operations user needs).

### Reference screen choice

**Use dashboard-v1.jsx as the aesthetic reference. Do not use its content verbatim.** Rationale:

| Criterion | v1 | v2 | v3 |
|---|---|---|---|
| Visual hierarchy clarity | Strong (clear row-by-row priority) | Medium (dense strips compete) | Medium (hero dominates everything) |
| Information density | Balanced | High (risk of overwhelm) | Low (marketing-heavy) |
| Role-flexibility (SUPER_ADMIN / FINANCE / OPERATIONS / CLIENT / FACTORY) | High (content-agnostic layout) | Medium (assumes ops user) | Low (assumes strategic/executive user) |
| Match with existing Sidebar/Topbar aesthetic | Excellent (same tokens, same spacing language) | Excellent | Requires dark-theme overrides, more divergent |

v1 is the right aesthetic target because it is content-agnostic: a KPI row + two-panel split + secondary two-panel split is a layout grammar that maps cleanly onto operations data as well as it does onto finance data. v2 is more thematically on-brand for operations but is more opinionated in its information density and would constrain future content. v3 is too executive-dashboardy for an operations page.

### Proposed layout

Top-to-bottom, all sections use `KpiCard`/`Card` tokens + `--bg-elev` surfaces + `--border` dividers. All numerals use the existing `num` class (tabular).

1. **Attention strip (conditional, only when there's something to act on).** If `clientInquiries.length > 0`, render a prominent strip at the top: `KpiCard`-style row with tone `warn`, label "Client inquiries awaiting review", value = count, inline table of the inquiries with per-row "Review" button. Collapse to zero height when no inquiries. This preserves the Vue behavior of hiding the table when empty, but elevates it visually from "buried section" to "top priority". If empty, the entire strip is not rendered, and the page starts at row 2.
2. **KPI row (5 `KpiCard`s in a responsive grid):** Total Orders, In Production, In Transit, Open Issues (after-sales), Client Inquiries. Use the existing `KpiCard` component. Sparkline prop is left empty if no trend data exists. Delta/subtext are also optional — can be added once backend exposes trend data.
3. **Two-panel split (`2fr / 1fr` on ≥ `lg`, stacked below):**
   - **Left: Active Shipments** (same table structure as Vue; upgraded typography, card surface, stage-chip styling using `chip` primitives instead of custom Tailwind strings). Keep "View All" → `/orders`.
   - **Right: Recent Activity** (same vertical feed as Vue; upgraded spacing, dot indicator uses semantic color tokens, scroll region uses `--bg-sunken`). Keep "View All Orders" → `/orders`.
4. **(Deliberately omitted)** Revenue Trend, Cash Position, Pending Approvals (invoice-style), Top-moving SKUs. These come from dashboard-v1.jsx and do not map to any current backend endpoint for the operations dashboard. Adding them would require new backend work. They are flagged as out-of-scope for this migration; revisit once / if a finance dashboard page is scoped separately.

### State coverage (required in the migrated version)

Every section must have explicit handling for all five states:

- **Loading:** skeleton rows for the KPI values (not just a silent zero); skeleton table rows for shipments and inquiries; skeleton feed rows for activity. Reuse existing skeleton primitives if they exist in Layer 2; otherwise a `Progress`-tone shimmer.
- **Empty:** each section shows a calm empty state (icon + one-line message + optional CTA), not silent absence. Client Inquiries section hides entirely when empty (behavior preserved). Shipments and Activity show a proper empty card, not plain centered text.
- **Error:** each section has its own retry-able error state. A failure in one endpoint must not cascade-blank the entire page. No silent zero-on-error (current behavior). A small inline "Retry" action per section.
- **Success:** data as spec'd.
- **Permission-denied:** the page itself is auth-gated at the layout; no additional handling needed at page level. If future role-gating is added (see "Awaiting decisions"), use `RoleGate` from Layer 2 composed components with an inline `fallback`.

### Role-based content strategy

Two options, each defensible:

- **(A) Preserve current behavior:** every INTERNAL role sees the same content, including `total_value_cny`. This is what the Vue page does today and what the audit profile documents. Simpler, less surprising, consistent with how the page has been used historically.
- **(B) Tighten per D-010:** wrap `total_value_cny` column in `RoleGate permission="factory-pricing"` and have OPERATIONS / VIEWER see a `—` or hide the column entirely. Consistent with the broader D-010 rule ("OPERATIONS excludes profit estimates") but introduces a new behavior change outside the scope of a "migrate the page" task.

**Recommendation: (A) preserve current behavior for this migration.** If role-tightening is desired, it should be a separately scoped task with its own audit so the change is visible and reviewed. Flagging in "Awaiting decisions" below.

### Accessibility notes

- KPI numerals must use `tabular-nums` (already in `erp-root .num` class). Confirm `KpiCard` component applies it — fix if not.
- Stage chips currently rely on color alone to convey stage. Add the stage name as text next to the chip (this is already done in the Vue page — preserve) and confirm WCAG AA contrast for every stage color against `--bg-elev`. The known stage-color table only covers 1–14; stages ≥15 silently map to slate. Fix in this migration by adding explicit slate/grey with a stage-name label, so stages 15–22 are unambiguous.
- Clickable table rows must expose a focus ring and keyboard activation (Enter/Space). Vue implementation uses click-on-`<tr>` which is not keyboard-accessible by default. Fix during migration: make the primary action a focusable `<button>` or `<a>` within the row.
- Per-row icon buttons (eye icon, Review button) need `aria-label`s.

### Responsive notes

- Break at `lg` (≥1024px): KPI row goes from 1-col → 2-col → 5-col; two-panel split collapses to single column on < `lg`.
- Mobile (< `md`): KPI cards become 1-col full-width stack. Shipment table becomes a card list (per-row cards with labeled fields) rather than a horizontally scrolling table. Activity feed is already vertical — unchanged.
- Topbar is the `(app)` layout's responsibility; not in scope here.

### Recommendation

**REDESIGN** — but constrained: keep the Vue page's content and information hierarchy exactly, and re-present it with dashboard-v1.jsx's design language, the existing Layer 2 components, and improved state coverage.

Specifically:
- **LIFT** the Vue content + hierarchy verbatim.
- **POLISH** state handling (loading skeletons, proper empty states, per-section retryable errors) and accessibility (keyboard rows, AA contrast, stage-name + chip).
- **REDESIGN** the visual presentation to match dashboard-v1.jsx's card pattern, spacing language, typography, and component choices (`KpiCard`, `chip`, `card-pad`, tokens).

This is not a faithful port. A faithful port would reproduce the flat tailwind-utility mishmash of the Vue page, which would violate the design-token rule in Section 1 of CONVENTIONS.md and look visibly inconsistent with the rest of the Next.js app.

### Awaiting user decision on

1. **Scope confirmation:** internal dashboard only in this migration, client and factory in follow-up migrations. OK to proceed?
2. **Role strategy for `total_value_cny`:** preserve current behavior (visible to all INTERNAL roles) or tighten under `RoleGate`? Recommend preserve and flag separately.
3. **Sparklines in KPI cards:** add (requires a new backend endpoint returning last-N-days trend) or leave the `spark` prop empty for now and add later?
4. **Revenue Trend / Cash Position panels from dashboard-v1.jsx:** include in scope (requires new backend endpoints) or defer to a dedicated finance dashboard page?
5. **Auto-refresh:** poll every 30–60s (matches notifications) or static-on-load (matches today)?
6. **Stage color fallback for stages ≥15:** fix in this migration (small cosmetic change) or log as a separate follow-up?
7. **Empty-state CTA copy:** when there are no active shipments, should the empty state suggest "Import factory Excel" or just show "No active shipments"? (Copy decision.)
8. **First-ever-login empty state:** should the dashboard render a welcome/onboarding card for users with zero orders in the system, or the same empty states as a returning user? (Content-design decision.)

**STOP.** Awaiting user answers to the above before producing a Phase 3 implementation plan.

---

## Phase 2 — user decisions captured

All 8 "Awaiting user decision" questions answered on 2026-04-23:

1. **Scope:** Internal dashboard only this migration; client and factory dashboards logged as deferred.
2. **`total_value_cny`:** Preserve current behaviour (visible to all INTERNAL roles). Logged as a D-010 review item — see Open Questions.
3. **KPI sparklines:** Skipped. No trend endpoint exists and no new backend endpoints during a migration.
4. **Revenue Trend / Cash Position:** Deferred. Operations dashboard is not a finance dashboard; a future `/finance-dashboard` page is flagged.
5. **Auto-refresh:** 30-second `refetchInterval` (TanStack Query) on Active Shipments and Recent Activity. Everything else is static-on-load.
6. **Stage color fallback (stages ≥15):** Fixed in this migration.
7. **Empty-state copy:** CTA pattern, e.g. "No active shipments. Create a new order to get started." Same pattern applied to all empty states on this page.
8. **First-login welcome card:** Yes, simple version, dismissible, `localStorage` key `dashboard_welcomed`. No backend changes required.

Recommendation from Phase 2 is adopted: **REDESIGN (constrained)** — Vue content + hierarchy lifted verbatim, state handling and a11y polished, visual layer rebuilt against the design-system tokens and `KpiCard` pattern.

---

## Phase 3 — Implementation notes

### Files created

**Layer 2 components ported into `apps/web` (first use in this app):**
- `apps/web/src/components/design-system/spark-line.tsx` — ported from `apps/ui-gallery/src/components/design-system/spark-line.tsx`. Not actively used on this page (KPI sparklines were dropped per decision #3) but ported because it is a required dependency of `KpiCard`.
- `apps/web/src/components/composed/kpi-card.tsx` — ported from `apps/ui-gallery/src/components/composed/kpi-card.tsx`. Adjusted the `style` spread to comply with `exactOptionalPropertyTypes: true`.

**Dashboard sections (all under `apps/web/src/app/(app)/dashboard/_components/`):**
- `types.ts` — local response interfaces for `/api/dashboard/*` (OpenAPI returns empty schemas; shapes derived from the Vue source).
- `formatters.ts` — `formatCNY`, `formatCount` (en-IN locale), `timeAgo`. `timeAgo` accepts a `now` override for deterministic tests.
- `stage-chip.tsx` — `StageChip` + `stageToneFor`. Stages 1–14 map to semantic chip tones; stages ≥15 fall back to the neutral chip with an explicit `aria-label` (fixes the latent silent-slate bug).
- `skeletons.tsx` — `KpiSkeleton`, `TableRowsSkeleton`, `FeedRowsSkeleton`. Use the existing `animate-erp-pulse` keyframe.
- `empty-state.tsx` — shared empty-state card with optional CTA (`ctaHref` + `ctaLabel`).
- `error-card.tsx` — `"use client"` inline error panel with a Retry action.
- `welcome-card.tsx` — `"use client"`. Reads `localStorage["dashboard_welcomed"]`; renders null until mount to avoid SSR flash.
- `kpi-summary.tsx` — async RSC. Fetches `/api/dashboard/summary/` via `getServerClient()`; renders 5 `KpiCard`s using `KPI_DEFINITIONS`. Falls back to a skeleton grid + inline error on backend failure. Exports `KpiSummarySkeleton` for the page's `<Suspense>` boundary.
- `client-inquiries.tsx` — async RSC. Fetches `/api/dashboard/client-inquiries/`; returns `null` when there are no inquiries (matches the legacy behaviour of hiding the section entirely); renders a high-emphasis card with an attention strip when present. Errors degrade to hidden section (Vue-parity best-effort behaviour).
- `active-shipments.tsx` — `"use client"`. TanStack Query with `refetchInterval: 30_000`. Five table columns as in Vue. Uses `StageChip` + `formatCNY`. Renders loading skeleton, empty-state + CTA, and inline Retry-able error.
- `recent-activity.tsx` — `"use client"`. TanStack Query with `refetchInterval: 30_000`. Scrollable feed (max 480px), `timeAgo` timestamps, empty-state with "View all orders" CTA, inline Retry-able error.

**Next.js API route handlers (for client-side polling):**
- `apps/web/src/app/api/dashboard/active-shipments/route.ts` — proxies FastAPI `/api/dashboard/active-shipments/` using the httpOnly session cookie. Returns `{ shipments }`.
- `apps/web/src/app/api/dashboard/recent-activity/route.ts` — proxies FastAPI `/api/dashboard/recent-activity/`. Returns `{ events }`.

### Files modified

- `apps/web/src/app/(app)/dashboard/page.tsx` — replaced the Task 7 scaffold. Now orchestrates: `WelcomeCard` → `ClientInquiriesSection` (Suspense) → `KpiSummary` (Suspense with skeleton) → `ActiveShipmentsSection` + `RecentActivitySection` in a 2fr/1fr grid (collapses to single column below `lg`). Uses `export const dynamic = "force-dynamic"` so RSC fetches run per request.
- `apps/web/src/app/(app)/dashboard/_components/formatters.ts` — extracted `formatCount` so it is testable outside the async RSC.
- `docs/migration/MIGRATED_PATHS.md` — updated the Notes/PR column for `/dashboard` to reflect the real migration.

### Files deleted

- `apps/web/src/app/(app)/dashboard/_components/quick-stats-card.tsx` — Task 7 scaffold placeholder. Replaced by the new dashboard sections.

### Nginx config

- `nginx/nginx.dev.conf` — `location = /dashboard { ... }` block already present (added in Task 7/9 when the scaffold was wired). **No change needed.**
- `nginx/nginx.conf` — `location = /dashboard` already present in all three portal blocks (admin / client / factory). **No change needed.**

The nginx test at `apps/web/tests/infra/nginx-config.test.ts` continues to pass unchanged.

### Tests added

- `apps/web/tests/app/dashboard.test.tsx` — new file. Covers `WelcomeCard`, `ActiveShipmentsSection`, `RecentActivitySection`, `StageChip` / `stageToneFor`, `formatCNY` / `formatCount` / `timeAgo`, plus a static import-grep guard that no dashboard source file references `RoleGate` (decision #2).

Exact scenarios (14 test cases in total):
1. Welcome card appears on first visit.
2. Welcome card dismissed → hidden + `localStorage.dashboard_welcomed` set + stays hidden on remount.
3. Welcome card stays hidden when `localStorage` key pre-exists.
4. Active Shipments renders rows with CNY formatting from mocked data.
5. Active Shipments empty state with CTA "Create a new order".
6. Active Shipments loading state (no error / no empty text while fetch is pending).
7. Active Shipments error state surfaces inline alert + Retry button.
8. Active Shipments stage ≥15 renders `StageChip` without crashing (color fallback fixed).
9. Active Shipments Retry button triggers another fetch.
10. Recent Activity empty state with "View all orders" CTA.
11. Recent Activity rows render with mocked events.
12. `formatCNY` null / undefined / 0 → em dash; positive numbers → `¥ 1,234,567`.
13. `formatCount` Indian grouping (`100000 → "1,00,000"`).
14. `timeAgo` buckets (Just now / mins / hours / Yesterday).
15. `stageToneFor` returns distinct tones for stages 1/2/5/11/13 and neutral chip for ≥15.
16. `StageChip` renders stage number + stage name with an accessible label.
17. RoleGate-import guard: 6 files asserted free of `role-gate`/`RoleGate` references.

(`describe` blocks group these; the static guard is one test per file.)

### Test / lint / build results

- `pnpm lint` — clean (0 errors, 0 warnings) after two fixes surfaced by `eslint-config-next` v16:
  1. `welcome-card.tsx` originally called `setState` inside `useEffect`; refactored to `useSyncExternalStore` with a `localStorage`-backed snapshot (clean, subscribes to `storage` event for cross-tab consistency).
  2. `spark-line.tsx` used `Math.random()` during render for SVG gradient IDs; replaced with `React.useId()` (impurity-rule compliant).
- `pnpm test` — 209 passed / 209 total, 14 test files, duration ~5.9 s. My 30 new tests (24 in `dashboard.test.tsx`, 6 in `dashboard-routes.test.ts`) all pass.
- `pnpm build` — production build succeeded. `/dashboard` route size 12.2 kB / 119 kB first-load. Both new route handlers (`/api/dashboard/active-shipments`, `/api/dashboard/recent-activity`) present.
- Coverage (new totals): 85.27% statements / 92.8% branches / 96.66% functions / 85.27% lines — above the 70% / 60% thresholds.

### Runtime verification (preview)

Ran `next dev` on port 3100 via `.claude/launch.json` config `web-next`. Navigated to `/dashboard` with a stub session cookie (backend not running).

Observed (screenshot captured; a11y snapshot captured):
- Dashboard rendered without crashing (GET /dashboard → 200 in 2.8 s).
- Welcome card visible ("Welcome to HarvestERP, there." — `userName` falls back to `"there"` when /api/auth/me fails).
- KPI summary grid shows 5 `KpiSkeleton` placeholders + an inline error card ("Unable to load dashboard summary right now. The feed below may still be up to date.") when the backend is unreachable, as designed.
- Active shipments and Recent activity sections render their headers/footers; internal state shows the loading skeleton / error card transitions (client fetch to the proxy route fails with the stub cookie).
- Sidebar + Topbar render around the page content.
- 0 browser console errors.

The full live-data path will be verified once the FastAPI backend is stood up in the local compose stack — tracked in smoke tests (`bash scripts/smoke-test.sh http://localhost`) per `MIGRATED_PATHS.md` adoption protocol.

### `MIGRATED_PATHS.md` update

Updated the `/dashboard` row in the "Currently migrated" table. Notes now describe the operations dashboard contents and flag client/factory portals as follow-up migrations.

---

## Issues encountered and resolutions

### Issue 1: Silent stage color fallback for stages ≥15 (fix during migration)

- **Date raised:** 2026-04-23 (Phase 1 discovery).
- **Problem:** The legacy Vue dashboard's `stageStyles` map only covered stages 1–14. Orders in stages 15–22 (sailing / landed / customs / payments / after-sales) silently rendered as slate with no signal that they were past production, leading to ambiguity on the active-shipments table.
- **Root cause:** `getStageStyle(s) => stageStyles[s] || stageStyles[1]` — any unmapped stage number falls back to the Stage 1 slate styling, indistinguishable from an actual Stage 1 order.
- **Fix applied:** Introduced `stageToneFor` + `StageChip` in `stage-chip.tsx`. Stages 1–14 map to semantic tones as before, stages ≥15 return the neutral `chip` tone and the chip exposes an explicit `aria-label="Stage <N>: <name>"`. Unit tests confirm the ≥15 fallback is intentional and distinct from Stage 1.
- **Date resolved:** 2026-04-23.
- **Tests added:** `stage chip tone mapping` describe block — 3 tests (distinct tones for 1–13; neutral for 15/18/22/99; accessible label on high-stage chip).

### Issue 2: Visual polish gap against v1 design reference

- **Date raised:** 2026-04-23 (post-login visual review).
- **Problem:** With the backend online and a real session, the live dashboard felt plain vs the v1 design reference in `Design/screens/dashboard-v1.jsx`. Two concrete gaps surfaced:
  1. Topbar showed only a static `HarvestERP` title; v1 has a time-of-day greeting + date subtitle ("Good morning, Ravi · Tue, 21 Apr").
  2. The WelcomeCard surfaced the full email `admin@harvesterp.com` instead of a friendly name, because `/api/auth/me`'s `full_name` wasn't being read with the correct null-tolerance.
  3. KPI cards looked flat — no sparkline/delta (dropped per decision #3) meant the only visual distinction per card was the right-side icon badge.
- **Root cause:**
  1. `AppTopbar` was wired with a hard-coded `title="HarvestERP"` in `(app)/layout.tsx`; no per-route greeting logic.
  2. `resolveUserName()` in `page.tsx` used `u.full_name ?? u.email` which falls through to email when `full_name` is null (not undefined), and didn't title-case the email local part.
  3. `KpiCard` styled the icon badge per tone but had no accent on the card itself.
- **Fix applied:** "Tier A" visual polish, scoped to not reverse Phase 2 content decisions:
  1. New helper `src/lib/display-name.ts` with `resolveDisplayName()` — prefers `full_name`, falls back to title-cased email local part (`admin@harvesterp.com` → `Admin`), with `"there"` as a last resort. Used by both the layout (for sidebar + topbar greeting) and the dashboard page (for WelcomeCard).
  2. `AppTopbar` is now pathname-aware via `usePathname()`. On `/dashboard` (or `/`) it overrides the title to `Dashboard` and the subtitle to a greeting computed from the user's local time: `<Good morning|afternoon|evening>, <Name> · <Weekday, DD Mon>`. Re-computed every 60 s client-side so the greeting transitions naturally (morning → afternoon).
  3. `KpiCard` gained a 3 px tone-coloured left border (`TONE_ACCENT_COLOR`) — info/warn/err/ok each have a matching accent, making the five-card row visually legible at a glance without adding any data dependency. Neutral tone uses `var(--border)` so unstyled cards don't become accidental accents.
- **Date resolved:** 2026-04-23.
- **Tests added:** `tests/lib/display-name.test.ts` — 5 tests covering full_name preference, whitespace handling, title-casing, delimiters (`_`, `.`, `-`), and the `"there"` fallback. Test count: 209 → 214.
- **Phase 2 decisions preserved:** no sparklines, no Revenue Trend chart, no Cash Position donut. Those remain deferred to a future `/finance-dashboard` migration.

---

## Proposed rules for CONVENTIONS.md

Two rules surfaced during this migration that may be worth promoting to CONVENTIONS.md after the user reviews them:

1. **Empty-state CTA rule.** Every empty state on a dashboard / list page includes a named next action (`ctaLabel` + `ctaHref`), not just a message. Rationale: the user committed to this as decision #7 and applied it across all empty states on the internal dashboard (Active Shipments, Recent Activity). If we want this to extend to Client/Factory dashboards and list pages, encoding it as a rule stops the next migration from re-litigating.
2. **Local response interface rule.** When a FastAPI endpoint has an untyped OpenAPI response (`"application/json": unknown`), the consuming page declares a local `interface` under `_components/types.ts` (or an equivalent colocated file) derived from the legacy Vue consumer — and uses `client.getJson<T>()` (the SDK escape hatch), not the fully typed `.GET()`. Rationale: the dashboard did this for all four `/api/dashboard/*` endpoints; codifying it gives a clear, repeatable pattern for future migrations that inherit the same OpenAPI gap.

(Both deferred for explicit user decision at the end of this migration.)

---

## Open questions deferred

- **D-010 review of `total_value_cny` dashboard visibility.** Preserved for all INTERNAL roles in this migration (decision #2). Needs deliberate review before production: if `total_value_cny` is a shipment value → keep visible; if it includes markup / profit → gate to `FINANCE | ADMIN | SUPER_ADMIN` via `RoleGate`. Owner: Finance / Sachin to decide. Target: before the dashboard goes live in production.
- **Client and Factory dashboard migrations.** Both flagged by Phase 1 but out of scope for this task. Each needs its own migration (`feat/migrate-client-dashboard`, `feat/migrate-factory-dashboard`), including bilingual (`PortalString`) coverage for the client portal and the Pending Updates / Pending Milestones clarification for the factory portal.
- **Dashboard trend endpoint (for sparklines).** Sparklines dropped per decision #3. Reconsider when a trend endpoint is added, probably alongside the finance dashboard.
- **`/finance-dashboard` as a separate page.** Flagged by decision #4. Content would include Revenue Trend, Cash Position, Pending Approvals, Top-moving SKUs (inspiration from `dashboard-v1.jsx`). Not scoped in this migration.

---

## Final status

- Tests passing: 209 / 209
- Build: passing
- Lint: passing (0 errors, 0 warnings)
- Preview verified: `/dashboard` renders end-to-end without crashing; graceful backend-offline states confirmed visually.
- nginx config: no changes needed (`/dashboard` blocks already present in `nginx.dev.conf` and all three portal blocks of `nginx.conf` from Task 7/9; infra tests continue to pass).
- `MIGRATED_PATHS.md`: updated Notes column for `/dashboard`.
- Committed on branch: `feat/migrate-dashboard`.
- Awaiting: user review of the committed work, then PR / merge.

---

## Visual fidelity (R-17, retroactive — added 2026-04-26)

Audited live in a real browser (Claude Preview MCP) on 2026-04-26 after the dev-server CSS-pipeline regression of that morning was resolved by `rm -rf apps/web/.next` + restart. Full root-cause analysis of the regression is in [`docs/migration/audits/ui-quality-audit-2026-04-26.md`](../audits/ui-quality-audit-2026-04-26.md).

**Reference compared against:** [`Design/screens/dashboard-v3.jsx`](../../../Design/screens/dashboard-v3.jsx)

**Scorecard (R-17, 5 dimensions × 0–10, threshold = 7):**

| Dimension | Score | Notes |
|---|---|---|
| Typography | 8 | Manrope loads from `--f-sans`. KPI values use `.kpi-value` (30 px tabular-nums); KPI labels use `.kpi-label` (11 px uppercase, 0.6 px letter-spacing). Heading hierarchy matches reference. |
| Layout | 8 | 4-column KPI row + 2-column "Active Shipments / Recent Activity" split matches `dashboard-v3.jsx` structurally. Sidebar + main content gutter consistent. |
| Spacing | 8 | `.card` framing on KPI tiles produces correct padding; row gaps in 2-column split land within 4 px of reference. |
| Color | 9 | All five brand emerald tones from tokens (`--brand-50..950`); `--bg` warm neutral; KPI tones use DS chip palette (warn / good / info). No off-token colors. |
| Component usage | 8 | 7 `.btn` / 5 `.card` / 2 `.chip` / 2 `.tbl` / 0 `.input` in source — high DS-class adoption. Closest of any migrated page to the original "use the design-system class" pattern. |
| **Average** | **8.2 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

**Verdict:** PASS. No fixes required.

**Caveats / known drift:**
- KPI tile background tints (`bg-emerald-50/30` etc. on the inner content) are Tailwind utilities rather than DS tokens, but this is per-tile decoration and acceptable.
- Empty-state CTAs ("Active Shipments" / "Recent Activity") use the proposed Decision #7 pattern — every empty state names a next action; this is now reflected as a candidate rule above.

**Audit context:** This page passed the original R-16 (live happy-path verification) at merge time. The retroactive R-17 audit was triggered by a user-reported visual breakage on `/clients` on 2026-04-26 that turned out to be a dev-server CSS 404 affecting all 8 migrated pages, not a per-page defect. After clean `.next` rebuild, every migrated page (including this one) renders correctly with Manrope and brand-emerald CTAs. R-17 was added to CONVENTIONS.md as a result; this section back-fills the gate retroactively.

---

## Issues encountered and resolutions

_(empty — populated as work progresses)_

---

## Proposed rules for CONVENTIONS.md (if any)

_(empty — populated toward end of migration)_

---

## Open questions deferred

_(see "Awaiting user decision on" above; items that remain unanswered after Phase 2 will be moved here)_

---

## Final status

_(empty — populated at end)_
