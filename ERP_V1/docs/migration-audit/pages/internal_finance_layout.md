# Internal Finance Layout

**Type:** layout (nested parent)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/finance` → `FinanceLayout` (meta.title: `'Finance'`, meta.icon: `'pi-chart-line'`); redirects `/finance` → `/finance/receivables`
**Vue file:** [frontend/src/views/finance/FinanceLayout.vue](../../../frontend/src/views/finance/FinanceLayout.vue)
**Line count:** 52
**Migration wave:** Wave 5 (internal tracking — finance)
**Risk level:** low — pure layout; no API calls, no data, no mutations

---

## Purpose

Nested-layout wrapper for the Finance section that renders a gradient header with tab navigation (Receivables, Client Ledger, Factory Ledger) and delegates all content to child routes via `<router-view />`.

---

## Layout

### Outer container
`div.space-y-0`

**Zone 1 — Gradient header** (`bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-t-xl px-6 py-4`)
- `h1` with `pi-chart-line` icon + "Finance"
- Sub-text: "Receivables, ledgers & statements" (text-blue-100)

**Tab navigation** (inside header, `-mb-4` overlap into content area):
Three tab buttons rendered from the `tabs` constant:

| Tab | Route | Icon |
|---|---|---|
| Receivables | `/finance/receivables` | `pi pi-indian-rupee` |
| Client Ledger | `/finance/client-ledger` | `pi pi-users` |
| Factory Ledger | `/finance/factory-ledger` | `pi pi-building` |

Active tab: `bg-white text-indigo-700 shadow-sm`; inactive: `text-blue-100 hover:text-white hover:bg-white/10`

**Zone 2 — Content area** (`bg-white rounded-b-xl shadow-sm min-h-[500px]`)
- `<router-view />` — renders the active child route

---

## Data displayed

None. This is a pure layout component with no reactive data.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Tab click | `router.push(tab.route)` | None | Navigates to child route |
| Direct `/finance` navigation | Redirect | None | Redirects to `/finance/receivables` |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

None.

---

## Composables consumed

None. Uses `useRoute()` for `isActive()` check and `useRouter()` for tab navigation.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-chart-line`, `pi-indian-rupee`, `pi-users`, `pi-building`).

---

## Local state

None — no `ref`, no `computed`, no `watch`.

**Constants (not reactive):**
- `tabs` — 3-entry array `[{label, route, icon}]` — **P-015:** hardcoded tab list; tab membership and labels must be kept in sync with router config manually.

**Methods:**
- `isActive(path)` → `route.path === path`

---

## Permissions / role gating

- Route `/finance` has **no `meta.roles`** — all INTERNAL users can reach the Finance layout.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- **Individual child tabs** (Receivables, Client Ledger, Factory Ledger) are protected at the backend by `require_finance` (ADMIN|FINANCE) at the router level. There is no frontend role check preventing an INTERNAL user without FINANCE/ADMIN role from clicking the Finance menu item — the backend will return 403 on data load.
- **Factory Ledger** additionally requires `require_factory_financial` (SUPER_ADMIN|FINANCE) at the endpoint level — see Cluster A (AUTH_TOO_PERMISSIVE, deferred to Wave 0).

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.finance.title` | "Finance" | "" | `InternalString` |
| `internal.finance.subtitle` | "Receivables, ledgers & statements" | "" | `InternalString` |
| `internal.finance.tab_receivables` | "Receivables" | "" | `InternalString` |
| `internal.finance.tab_client_ledger` | "Client Ledger" | "" | `InternalString` |
| `internal.finance.tab_factory_ledger` | "Factory Ledger" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

None applicable — layout component has no data-dependent states.

---

## Business rules

1. **Default tab is Receivables.** `/finance` redirects to `/finance/receivables` via the router config `{ path: '', redirect: '/finance/receivables' }`.
2. **Tab routing is push-based.** Each tab click calls `router.push(tab.route)` — browser back/forward works correctly.
3. **Active tab determined by exact path match.** `isActive(path)` uses `route.path === path`. Sub-paths (e.g., `/finance/client-ledger?start_date=...`) would still match because query params are not in `route.path`. This is correct behaviour.

---

## Known quirks

- **No frontend role gate on Finance menu.** Any INTERNAL user can navigate to `/finance/*` routes; they receive a 403 from the backend when the finance API responds. No friendly "access denied" page is shown — the data area stays in loading state indefinitely or shows empty (P-002 swallow pattern in child components).
- **Tab list and router children must stay in sync manually.** The `tabs` constant in `FinanceLayout.vue` duplicates route path strings that are also defined in `router/index.js`. If a new Finance sub-page is added, both files must be updated.

---

## Dead code / unused state

None — `tabs`, `isActive`, `useRoute`, `useRouter` are all used in the template.

---

## Duplicate or inline utilities

None observed. `isActive()` is simple enough not to warrant extraction.

---

## Migration notes

1. **Use Next.js nested layout.** In the App Router, this becomes a `layout.tsx` in `app/(internal)/finance/`. The tab navigation becomes a `<FinanceTabs>` client component that reads `usePathname()`.
2. **Add role-based tab visibility.** Only show the Factory Ledger tab to SUPER_ADMIN and FINANCE users (D-004). Hide or disable it for ADMIN (Cluster A concern).
3. **Add access-denied state for children.** When a finance API returns 403, the child page should show a "You don't have access to this section" message rather than an empty/loading state.
4. **Derive tabs from route config** rather than a parallel hardcoded array (P-015). In Next.js the tab list can be derived from the route segment metadata.
5. **D-001:** Tab navigation uses `router.push` → becomes Next.js `<Link>` components.
6. **D-005:** All `InternalString`; Tamil can remain `""`.
