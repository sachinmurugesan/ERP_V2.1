# Topbar (Internal layout)

**Type:** layout-component
**Portal:** internal (rendered by [App.vue:45](../../../frontend/src/App.vue#L45) inside the admin layout)
**Route:** N/A
**Vue file:** [frontend/src/components/layout/Topbar.vue](../../../frontend/src/components/layout/Topbar.vue)
**Line count:** 53
**Migration wave:** Wave 1 (foundational)
**Risk level:** low

## Purpose (one sentence)
Thin header bar that renders the current page title, a breadcrumb trail derived from `route.meta`, and a persistent "New Order" quick-action CTA.

## Layout (top→bottom, left→right, exhaustive)

### `<header>` shell
`bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between`.

**Zone 1 — Left cluster**
- `<h1>` page title (`text-xl font-semibold text-slate-800`). Value is `route.meta.title || 'HarvestERP'`.
- Breadcrumb `<nav>` below the title: row of `<router-link>`s separated by `/` glyphs (`text-xs text-slate-400`). Last crumb is non-linked text. Algorithm (lines 9-19):
  1. Always start with `{ label: 'Home', path: '/' }`.
  2. If `route.meta.parent` is set, look up the parent route by `name` from `route.matched` and push `{ label: parentRoute.meta.title, path: parentRoute.path }`.
  3. Push the current route `{ label: route.meta.title, path: route.path }`.

**Zone 2 — Right cluster (Quick Actions)**
- Single button: `<router-link to="/orders/new">` — emerald-600 background, white text, rounded-lg, contains `pi pi-plus` icon + `New Order` label.

## Data displayed
| Field | Source | Format | Notes |
|---|---|---|---|
| Page title | `route.meta.title` | string | falls back to `'HarvestERP'` if meta missing |
| Breadcrumbs | Router's `route.matched` + `route.meta.parent` | array of `{label, path}` | Home → optional Parent → Current |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click a breadcrumb link | `<router-link :to>` | none | navigate |
| Click **New Order** | `<router-link to="/orders/new">` | none | navigate to OrderDraft page |

## Modals/dialogs triggered (inline)
None.

## API endpoints consumed (from src/api/index.js)
None.

## Composables consumed
None — only `useRoute()` from `vue-router`.

## PrimeVue components consumed
None. `pi pi-plus` is a CSS class only.

## Local state (refs, reactive, computed, watch)
- `pageTitle: computed` — `route.meta.title || 'HarvestERP'`.
- `breadcrumbs: computed` — assembled per algorithm above.

## Permissions/role gating
No in-component gating. **But:** the `New Order` CTA is visible to every internal role (including `VIEWER`, who cannot create orders). Clicking it routes to `/orders/new` which has no `meta.roles`, so VIEWER users can land on the form page and presumably fail at save-time on the backend RBAC. [UNCLEAR — needs Sachin review: should this CTA hide for VIEWER / non-OPERATIONS / non-ADMIN?]

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
Not applicable — the component is pure template and renders on every navigation.

## Business rules (the non-obvious ones)
1. **Breadcrumb chain depth is capped at 3** — Home + optional parent + current. Deeper navigations (`/orders/:id/upload-excel` has parent `OrderDetail`, which has parent `OrderList`) don't recurse to show the full chain. The ExcelUpload page's breadcrumb would read `Home / Order Detail / Upload Excel` — skipping the `Orders` root. [UNCLEAR — needs Sachin review: is this intentional or a bug?]
2. **Parent lookup uses `route.matched.find(r => r.name === route.meta.parent)`** — which only works for routes in the current matched chain. Since `meta.parent` references a sibling top-level route (e.g., `OrderList`), the `find` **will always return undefined** and the parent crumb never appears. Functionally the breadcrumb today is `Home / Current`. [UNCLEAR — confirm this is broken as I read it.]
3. **Page titles double as breadcrumb labels** — any change to `meta.title` changes both.

## Known quirks
- The `New Order` CTA is always on the right, even on pages where creating an order makes no sense (e.g., `/settings`, `/tech-stack`, `/users`). This is a product decision rather than a bug.
- The topbar has no notification indicator — the bell lives in the sidebar footer.
- No left-side back button. Users rely on breadcrumb links or browser-back.

## Migration notes
- **Claude Design template mapping:** **Navigation Shell** (companion to Sidebar).
- **Layer 2 components needed:** `PageTopbar`, `Breadcrumb`, `QuickActionButton`. Consider promoting a `PageHeader` primitive that takes `title`, `breadcrumbs`, and an `actions` slot so every page gets consistent chrome without repeating pattern.
- **New Layer 1 strings to add:** `nav.home`, `nav.new_order_cta`. The page titles themselves already live in router meta — those should be ported into a route-to-i18n-key map rather than rewritten inline.
- **Open questions for Sachin:**
  1. Is the current breadcrumb genuinely showing parent labels, or is the `route.matched.find` broken as I suspect? (Easy live test — verify on OrderDetail whether `Home / Orders / …` shows.)
  2. Should the quick-action button be role-gated (hidden for VIEWER)?
  3. Do you want the New-Order action to become a per-page slot (Products page → "New Product", Users page → "New User", etc.) or stay global?
