# Client Layout Shell

**Type:** layout-component
**Portal:** client (mounted by Vue Router as the unnamed parent of every `/client-portal/*` route)
**Route:** N/A — parent route wrapping 10 client portal children
**Vue file:** [frontend/src/components/layout/ClientLayout.vue](../../../frontend/src/components/layout/ClientLayout.vue)
**Line count:** 193
**Migration wave:** Wave 2 (shell for all client pages)
**Risk level:** high (every client-portal page depends on it; hosts permission-gated menu + 10s notification polling; deep-links into 4 OrderDetail sub-tabs)

## Purpose (one sentence)
The sidebar + router-view wrapper for every `/client-portal/*` route — fetches the user's `portal_permissions`, builds a dynamically-filtered menu, exposes a notification drawer with client-scoped deep-links, and renders the active child route.

## Layout (top→bottom, left→right, exhaustive)

### Outer shell
`<div class="flex h-screen bg-gray-50">` — flexbox row split between the collapsible sidebar and the `<main>` scroll area. Unlike the internal portal, there is no Topbar in the client portal shell. Each page renders its own header.

### Zone 1 — Sidebar `<aside>`
`bg-gradient-to-b from-emerald-800 to-emerald-900 text-white flex flex-col transition-all duration-300`. Width depends on `collapsed: ref(false)`:
- Expanded: `w-56` (14rem — narrower than the internal sidebar's `w-64`)
- Collapsed: `w-16`

Note: **the collapse toggle is not bound to any visible button** in this layout (unlike the internal Sidebar which has an arrow toggle). `collapsed` is effectively dead-read state. [UNCLEAR — needs Sachin review: intentional (always-expanded)?]

#### 1a — Logo header (top, `px-4 py-4 border-b border-emerald-700/50`)
- 32×32 rounded tile with `bg-emerald-400/20 text-emerald-300`, holds `pi pi-box` icon.
- Label `Client Portal` in `text-sm font-bold tracking-wide` (hidden when collapsed).

#### 1b — Menu `<nav>` (middle, `flex-1 py-3 space-y-0.5 px-2`)
Uses `<router-link>` elements (unlike internal Sidebar which uses `<button>` + programmatic push). Active state:
- Active: `bg-emerald-700/60 text-white font-medium`
- Idle: `text-emerald-200 hover:bg-emerald-700/30 hover:text-white`

**Static items** (always visible):
- Dashboard (`pi pi-home`) → `/client-portal`
- Products (`pi pi-box`) → `/client-portal/products`
- My Orders (`pi pi-shopping-cart`) → `/client-portal/orders`

**Permission-gated items** (added to the array if the corresponding `portalPerms.*` is `true`):
- Ledger (`pi pi-wallet`) → `/client-portal/ledger` — gated by `portalPerms.show_payments`
- Shipments (`pi pi-truck`) → `/client-portal/shipments` — gated by `portalPerms.show_shipping`
- After-Sales (`pi pi-exclamation-triangle`) → `/client-portal/after-sales` — gated by `portalPerms.show_after_sales`

**Static items after permission-gated section:**
- Returns & Pending (`pi pi-replay`) → `/client-portal/returns-pending`
- Profile (`pi pi-user`) → `/client-portal/profile`

Note the insertion order: the permission-gated items are injected **between** the static "My Orders" and the static "Returns & Pending" / "Profile" block. This matters for migration — the visible menu order is not alphabetical.

#### 1c — User footer (bottom, `border-t border-emerald-700/50 p-3`)
Expanded (collapsed variant is minimal):
- Row 1: `user.full_name || user.email` (truncated, `text-xs text-emerald-300`) + notification bell button.
  - Bell icon `pi pi-bell`; red circular badge with `unreadCount` (shown if `>0`, capped at `9+`).
  - Click → `openDialog()` from `useNotifications` → fetches list + opens modal.
- Row 2: Sign out button (`pi pi-sign-out` + `Sign out` label when expanded).

Collapsed variant: only the sign-out button is visible. **The bell is hidden when collapsed** — same quirk as the internal Sidebar.

### Zone 2 — Notification Dialog (inline overlay within `<aside>`)
`v-if="showNotifDialog"` — identical structure to the internal Sidebar dialog but with minor differences:
- Unread stripe color: `border-l-4 border-l-teal-500` (vs internal's `indigo-500`).
- Count badge over icon: teal-600 (vs indigo-600).
- **Smaller notification type map** — 11 entries (internal has 16) — see table below.
- No "affordance lines" ("Click to review", "Click to verify payment") — those are internal-only.

**Notification type mapping in this file** (`NOTIF_STYLES`, lines 24-36) — a subset of the internal map, with labels rewritten for client-facing copy:

| type | icon | label |
|---|---|---|
| ITEM_QUERY_CREATED | pi-comments | New Query |
| ITEM_QUERY_REPLY | pi-reply | Query Reply |
| PAYMENT_SUBMITTED | pi-wallet | Payment |
| PAYMENT_APPROVED | pi-check-circle | Verified |
| PAYMENT_REJECTED | pi-times-circle | Rejected |
| ORDER_STAGE_CHANGE | pi-arrow-right | Stage Update |
| PRODUCT_APPROVED | pi-check | Approved |
| ITEMS_PENDING_CONFIRMATION | pi-clock | Needs Action |
| ITEMS_APPROVED | pi-check-circle | Items Added |
| PRICES_SENT_FOR_REVIEW | pi-tag | Prices Ready |
| PACKING_DECISION | pi-box | Packing |

Types missing from this map (present in internal): `PRODUCT_REVIEW_REQUEST`, `ITEMS_PENDING_APPROVAL`, `ITEMS_CLIENT_CONFIRMED`, `ITEM_CONFIRMED`, `AFTER_SALES_SUBMIT`. These are internal-only workflows. **If any ever leaks into a client notification list, it will fall through to the generic `{icon: pi-bell, label: 'Update'}` default.**

### Zone 3 — Main content (`<main class="flex-1 overflow-y-auto">`)
Contains `<router-view />` — the active client-portal child renders here. No max-width, no padding at this level — each child page applies its own `p-4 md:p-6 max-w-{N}xl mx-auto` shell.

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| `user.full_name` / `user.email` | `useAuth().user` | string | footer display |
| `portalPerms` | `authApi.getMe()` → `data.portal_permissions` | `{show_payments, show_production, show_shipping, show_after_sales, show_files, show_packing}` | drives menu item visibility |
| `unreadCount` | `useNotifications().unreadCount` | int | bell badge |
| `notifications` | `useNotifications().notifications` | array | dialog list |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click any menu item | `<router-link>` | none | navigate |
| Click bell | `openDialog()` | `GET /api/notifications/` | opens dialog |
| Click a notification row | `handleNotifClick(n)` → `markAsRead` + route | `PUT /api/notifications/{id}/read/` | closes dialog, deep-links |
| Click `Mark all read` | `markAllRead()` | `PUT /api/notifications/read-all/` | clears list + badge |
| Click dialog close × / backdrop | toggles `showNotifDialog` | none | |
| Click **Sign out** | `handleLogout()` → `logout()` then `router.push('/login')` | `POST /api/auth/logout` | clears session |

### Notification deep-link map (`handleNotifClick`, lines 42-60)
All deep-links stay **inside** the client portal (unlike the internal Sidebar which links to `/orders/{id}?tab=...`). Client links use `/client-portal/orders/{id}?tab=...`:

| type | Destination |
|---|---|
| `ITEM_QUERY_CREATED` / `ITEM_QUERY_REPLY` (with `resource_id`) | `/client-portal/orders/{id}?tab=queries` + optional `&query={metadata.query_id}` |
| `PAYMENT_SUBMITTED` / `PAYMENT_APPROVED` / `PAYMENT_REJECTED` (with `resource_id`) | `/client-portal/orders/{id}?tab=payments` |
| `ITEMS_PENDING_CONFIRMATION` / `ITEMS_APPROVED` / `PRICES_SENT_FOR_REVIEW` (with `resource_id`) | `/client-portal/orders/{id}?tab=items` |
| `PACKING_DECISION` (with `resource_id`) | `/client-portal/orders/{id}?tab=packing` |
| `ORDER_STAGE_CHANGE` (with `resource_id`) | `/client-portal/orders/{id}` (no tab hint) |
| any other with `resource_id` | `/client-portal/orders/{id}` |

**Critical contract:** the `tab=queries|payments|items|packing` slugs are load-bearing — `ClientOrderDetail.vue` reads `route.query.tab` to set `activeTab`. Renaming them breaks every pre-existing notification link.

## Modals/dialogs triggered (inline)
| Modal | Triggered by | Purpose | API on submit |
|---|---|---|---|
| Notification Dialog | Bell button | list + mark read + deep-link | `PUT /notifications/{id}/read`, `PUT /notifications/read-all/` |

## API endpoints consumed (from src/api/index.js)
- `authApi.getMe()` — on `onMounted`, to populate `portalPerms` and (via `ClientOrderDetail`) `clientType`. Result's `portal_permissions` is shared state across every client page.

Notifications are called through raw axios inside `useNotifications` (same as internal):
- `GET /api/notifications/count/` (10s polling)
- `GET /api/notifications/`
- `PUT /api/notifications/{id}/read/`
- `PUT /api/notifications/read-all/`

## Composables consumed
- **`useAuth`** — `user`, `logout`.
- **`useNotifications`** — `unreadCount`, `notifications`, `showNotifDialog`, `fetchUnreadCount`, `fetchNotifications`, `markAsRead`, `markAllRead`, `openDialog`. `fetchUnreadCount()` starts the 10s polling on mount.

## PrimeVue components consumed
None. Tailwind + PrimeIcons only.

## Local state (refs, reactive, computed, watch)
- `collapsed: ref(false)` — but **no UI toggle** exposes this state (dead).
- `portalPerms: ref({})` — loaded in `onMounted` from `authApi.getMe()`.
- `menuItems: computed` — filters the menu based on `portalPerms` flags.
- `notifStyle(n)` — function lookup for icon/color/label.
- `handleNotifClick(n)` — function for notification row click.
- `isActive(path)` — function; `/client-portal` is an exact match, others use `startsWith`.

## Permissions/role gating
- Route-level: every child has `meta.requiresAuth: true` and `meta.userType: 'CLIENT'`. Router `beforeEach` redirects non-CLIENT users away ([router/index.js:374-376](../../../frontend/src/router/index.js#L374)).
- Menu-level: three permission flags (`show_payments`, `show_shipping`, `show_after_sales`) decide whether Ledger, Shipments, and After-Sales menu items render.

**Three portal permission flags do NOT gate the menu** but are consumed by OrderDetail tab visibility:
- `show_production` → the Production tab on OrderDetail
- `show_files` → the Files tab on OrderDetail
- `show_packing` → the Packing tab on OrderDetail

These flags are therefore layout-less (no top-level menu item maps to them).

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
- **Portal perms load failure:** silently caught (`catch (_) {}` line 21). `portalPerms` stays `{}` → permission-gated menu items stay hidden. This is a **fail-closed** behavior — good security but invisible to the user.
- **No spinner/blocker** while perms are loading. The menu renders with only the three always-visible items, then expands a tick later when `portalPerms` arrives. Briefly, a user may not see their Ledger / Shipments / After-Sales links.

## Business rules (the non-obvious ones)
1. **`portalPerms` is loaded once on mount** and never refreshed. If an admin toggles permissions mid-session, the client has to log out and back in to see the change. No real-time sync.
2. **Permission-based menu contrasts with role-based internal menu.** Internal Sidebar uses role arrays in each item; client layout uses per-feature booleans sourced from the server-side `client_portal_permissions` table.
3. **Deep-link slugs use underscore/kebab differently**:
   - `queries`, `payments`, `items`, `packing` — these are the slugs OrderDetail recognizes.
   - The admin portal also has `shipping-docs`, `after-sales`, `final-draft`, `landed-cost`, `booking`, `sailing`, `customs`, `dashboard`, `production`, `files` — 14 total tabs.
   - Client portal has a smaller set — any notification that gets through a slug not in ClientOrderDetail will fall back to opening the default `items` tab (because `activeTab: ref(route.query.tab || 'items')` defaults to `items` when the query string is something unrecognized).
4. **Client's `Returns & Pending` and `Profile` items are always visible** — they don't require any permission. Logic: every client has a profile and pending items by default.

## Known quirks
- **`collapsed` has no UI trigger** — effectively hidden feature. Inherited code path from internal Sidebar.
- **Menu transitions between "always show 5" → "show up to 8"** as perms load — small flicker.
- **Dialog lives inside the aside** but uses `fixed inset-0 z-50` to escape. Fine, but it means stacking context inherits from the aside.
- **Notification type map is a subset** of internal's. Any new notification type must be added in both maps or the client portal shows the generic "Update" label.

## Migration notes
- **Claude Design template mapping:** **Navigation Shell** (companion to the internal Sidebar pattern).
- **Layer 2 components needed:** `ClientShellSidebar`, `SidebarMenuItem`, `NotificationBell`, `NotificationDrawer` (reuse the internal's drawer primitive). Share `isActive` logic across shells.
- **New Layer 1 strings to add:** `client.nav.dashboard`, `client.nav.products`, `client.nav.orders`, `client.nav.ledger`, `client.nav.shipments`, `client.nav.aftersales`, `client.nav.returns_pending`, `client.nav.profile`, `client.portal_title` (`Client Portal`), `common.sign_out`, all 11 `NOTIF_STYLES[...].label` strings, `notifications.title`, `notifications.empty`, `notifications.mark_all_read`.
- **Open questions for Sachin:**
  1. Is the missing collapse toggle intentional or should we add one to match the internal Sidebar?
  2. Should `portalPerms` refresh periodically (or via polling/WS) so mid-session permission changes propagate?
  3. Should the three "tab-only" permissions (`show_production`, `show_files`, `show_packing`) also add top-level menu items (or pages), or stay tab-scoped?
  4. Should we unify the two notification type maps (internal vs client)?
  5. Is the user-display strategy (`full_name || email`, no avatar) sufficient, or do we want avatars in the client portal too?
