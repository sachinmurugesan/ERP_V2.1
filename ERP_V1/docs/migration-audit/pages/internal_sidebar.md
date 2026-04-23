# Sidebar (Internal layout)

**Type:** layout-component (profile included in Wave 1 per task brief)
**Portal:** internal (mounted by `App.vue` only when `showAdminLayout === true`; client/factory portals have their own layouts and do not render this)
**Route:** N/A — component rendered by [App.vue:43](../../../frontend/src/App.vue#L43) inside the admin layout wrapper
**Vue file:** [frontend/src/components/layout/Sidebar.vue](../../../frontend/src/components/layout/Sidebar.vue)
**Line count:** 288
**Migration wave:** Wave 1 (foundational — every internal page depends on it)
**Risk level:** high (touches auth, routing, notification polling, role-filtering, and deep-link behaviour — it is a shared surface across ~30 internal routes and must be migrated before any other internal page is ported)

## Purpose (one sentence)
Collapsible left navigation for internal/admin users — renders role-filtered menu groups, a notification center with live polling, and a user profile footer with sign-out.

## Layout (top→bottom, left→right, exhaustive)

### Shell
`<aside>` with classes `bg-slate-800 text-white flex flex-col transition-all duration-300`. Width binds to `collapsed` boolean:
- Expanded: `w-64` (16rem)
- Collapsed: `w-16` (4rem)

### Zone 1 — Logo header (top, `p-4 border-b border-slate-700`)
- Left cluster (hidden when collapsed): stalk emoji 🌾 (unicode `&#127806;`) + bold `HarvestERP` text in `text-emerald-400`.
- Right: circular toggle button. Icon flips between `pi pi-angle-left` (expanded) and `pi pi-angle-right` (collapsed) on click.

### Zone 2 — Menu groups (scrollable, `flex-1 py-2 overflow-y-auto`)
Groups are declared in `menuGroups` array at lines 63-99. Four groups, rendered in this exact order (top→bottom), **but individual groups and items are filtered by role** through the `filteredMenuGroups` computed property:

**Group A — `MAIN`**
- Dashboard (`pi pi-home`) → `/dashboard` — visible to ADMIN, FINANCE, OPERATIONS, VIEWER
- Orders (`pi pi-shopping-cart`) → `/orders` — visible to ADMIN, OPERATIONS, FINANCE, VIEWER

**Group B — `MASTER DATA`**
- Products (`pi pi-box`) → `/products` — ADMIN, OPERATIONS, VIEWER
- Factories (`pi pi-building`) → `/factories` — ADMIN, OPERATIONS
- Clients (`pi pi-users`) → `/clients` — ADMIN, OPERATIONS, FINANCE
- Transport (`pi pi-truck`) → `/transport` — ADMIN, OPERATIONS

**Group C — `TRACKING`**
- After-Sales (`pi pi-exclamation-triangle`) → `/after-sales` — ADMIN, OPERATIONS
- Finance (`pi pi-chart-line`) → `/finance` — ADMIN, FINANCE
- Returns & Pending (`pi pi-replay`) → `/returns-pending` — ADMIN, OPERATIONS
- Warehouse (`pi pi-warehouse`) → `/warehouse` — ADMIN, OPERATIONS

**Group D — `ADMIN`**
- Product Review (`pi pi-check-square`) → `/products/review` — ADMIN only
- Users (`pi pi-users`) → `/users` — ADMIN only
- Settings (`pi pi-cog`) → `/settings` — ADMIN only
- Audit Trail (`pi pi-list`) → `/audit-logs` — ADMIN only
- Tech Stack (`pi pi-code`) → `/tech-stack` — ADMIN only

Each group renders its label in `text-[10px] uppercase tracking-widest text-slate-500` only when expanded; items are buttons (not `<router-link>`) that call `navigate(item.route)` → `router.push(…)`. Active state computed via `isActive(path)` which returns true for exact match except `/dashboard` which also matches `/` (lines 134-137).

### Zone 3 — User profile footer (bottom, `p-3 border-t border-slate-700`)
- 32×32 circular avatar tile with `userInitials` (first 2 letters of email, uppercased) on emerald-600 background. Always visible.
- Expanded only: display name (`userDisplayName` computed — prefers `user.full_name`, else beautifies the email local-part: `sachin_m` → `Sachin M`) + role badge.
- Role badge colors (lines 122-132):
  - ADMIN → `bg-red-500/20 text-red-400`
  - FINANCE → `bg-amber-500/20 text-amber-400`
  - OPERATIONS → `bg-emerald-500/20 text-emerald-400`
  - VIEWER → `bg-slate-500/20 text-slate-400`
  - default (other roles) → VIEWER colors
- Expanded only: bell button (`pi pi-bell`) with red badge showing `unreadCount` (capped at `9+`). Click opens the Notification Dialog (see Modals).
- Expanded only: sign-out button (`pi pi-sign-out`) → `logout()` then `router.push('/login')`.
- Collapsed only: sign-out button on its own row (the bell is hidden when collapsed — a minor accessibility gap).

### Zone 4 — Notification Dialog (overlay, mounted inside `<aside>` but with `fixed inset-0 z-50`)
Conditionally rendered when `showNotifDialog === true`. Click on backdrop (`@click.self`) closes it.

- Modal card: `max-w-md` centered, rounded-2xl, `max-h-[70vh]` with internal scroll.
- Header (`border-b`): title `Notifications`, `Mark all read` link (only when list has items), close `×` button.
- Body scrollable list:
  - Empty state: centered bell icon + `No new notifications`.
  - Each notification row shows:
    - Circular icon tile with type-specific icon + color from `NOTIF_STYLES` (16 keyed types, lines 15-32).
    - Badge over-icon showing aggregation count when `n.count > 1` (shows `99+` if >99).
    - Title (bold, truncate), optional `(×N)` count suffix for grouped notifications.
    - Type pill in upper-right — color-paired with the icon tile.
    - Message body (`line-clamp-2`).
    - Timestamp via `new Date(n.created_at).toLocaleString()` + clock icon.
    - Affordance line: for `PRODUCT_REVIEW_REQUEST` shows `Click to review`; for `PAYMENT_SUBMITTED` shows `Click to verify payment`.
  - Unread rows get a `border-l-4 border-l-indigo-500` stripe.
- Click row → `handleNotifClick(n)` → marks read + deep-links (see Interactions).

## Data displayed
| Field | Source | Format | Notes |
|---|---|---|---|
| `userInitials` | `useAuth().user.email.substring(0,2).toUpperCase()` | 2 upper-case letters | fallback `'U'` if no email |
| `userDisplayName` | `useAuth().user.full_name` OR email local-part beautified | Title Case | fallback `'User'` |
| `roleBadge.label` | `useAuth().roles[0]` | string | takes the first role only |
| `unreadCount` | `useNotifications().unreadCount` | int | shown in bell badge, capped at `9+` |
| `notifications[]` | `useNotifications().notifications` | array of `{ id, title, message, notification_type/type, resource_type, resource_id, count, is_read, created_at, metadata }` | rendered in dialog list |

## Interactions (every clickable element)
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click collapse/expand toggle | flips `collapsed` | none | width transitions 64↔16, labels hide/show |
| Click menu item | `navigate(item.route)` → `router.push(...)` | none | navigate to route; active state computed via `isActive` |
| Click bell (in profile footer) | `openDialog()` from `useNotifications` | `GET /api/notifications/` via composable | opens dialog, fetches list |
| Click notification row | `handleNotifClick(n)` | `PUT /api/notifications/{id}/read/` (via `markAsRead`) | closes dialog, routes to mapped destination (see below) |
| Click `Mark all read` | `markAllRead()` | `PUT /api/notifications/read-all/` | empties list, zeroes count |
| Click dialog close `×` | sets `showNotifDialog = false` | none | dismiss |
| Click dialog backdrop | `@click.self` → `showNotifDialog = false` | none | dismiss |
| Click sign-out | `logout(); router.push('/login')` | `POST /api/auth/logout` | clears session, redirects to Login |

### Notification deep-link map (`handleNotifClick`, lines 38-61)
| type | Destination |
|---|---|
| `PRODUCT_REVIEW_REQUEST` | `/products/review` |
| `PAYMENT_SUBMITTED` / `PAYMENT_APPROVED` / `PAYMENT_REJECTED` (with `resource_id`) | `/orders/{resource_id}?tab=payments` |
| `ITEM_QUERY_CREATED` / `ITEM_QUERY_REPLY` (with `resource_id`) | `/orders/{resource_id}?tab=queries` + optional `&query={metadata.query_id}` |
| `ITEMS_PENDING_APPROVAL` / `ITEMS_PENDING_CONFIRMATION` / `ITEMS_CLIENT_CONFIRMED` / `ITEMS_APPROVED` / `ITEM_CONFIRMED` / `PRICES_SENT_FOR_REVIEW` (with `resource_id`) | `/orders/{resource_id}?tab=items` |
| `ORDER_STAGE_CHANGE` (with `resource_id`) | `/orders/{resource_id}?tab=dashboard` |
| `PACKING_DECISION` (with `resource_id`) | `/orders/{resource_id}?tab=packing` |
| `AFTER_SALES_SUBMIT` (with `resource_id`) | `/orders/{resource_id}?tab=after-sales` |
| Fallback (`resource_type === 'order'`) | `/orders/{resource_id}` (no tab hint) |

This map and the corresponding `OrderDetail.vue` tab slugs are tightly coupled — **any migration of OrderDetail must preserve the 14 tab slug strings** (`dashboard`, `items`, `payments`, `production`, `packing`, `booking`, `sailing`, `shipping-docs`, `customs`, `after-sales`, `final-draft`, `queries`, `files`, `landed-cost`) or every existing notification link in email/push breaks.

## Modals/dialogs triggered (inline in this Vue file)
| Modal | Triggered by | Purpose | API on submit |
|---|---|---|---|
| Notification Dialog | Bell button (`openDialog`) | List + mark read + deep-link | `PUT /notifications/{id}/read` per row, `PUT /notifications/read-all/` on mark-all |

## API endpoints consumed (from src/api/index.js)
**None directly.** All calls are routed through `useNotifications` which uses raw `axios` (not `api/index.js`). Endpoints hit:
- `GET /api/notifications/count/` (polled every 10s and on focus/visibility-change via `pollFetchCount`)
- `GET /api/notifications/` (on `openDialog` and when dialog is visible during poll)
- `PUT /api/notifications/{id}/read/` (row click)
- `PUT /api/notifications/read-all/` (mark-all)
- `POST /api/auth/logout` (from `useAuth().logout()`)

Add to `api/index.js` as part of migration — currently ad-hoc axios in composable. See CROSS_CUTTING notes.

## Composables consumed
- **`useAuth`** — destructures `user, roles, isAdmin, isFinance, isOperations, hasAnyRole, logout`. Used for role filtering, profile display, and sign-out.
- **`useNotifications`** — destructures `unreadCount, notifications, showNotifDialog, fetchUnreadCount, fetchNotifications, markAsRead, markAllRead, openDialog`. Polling starts inside `fetchUnreadCount()` (10s interval, focus + visibility refetch).

## PrimeVue components consumed
**None.** Entirely Tailwind-styled. Uses PrimeIcons classes only (`pi-angle-left`, `pi-angle-right`, `pi-home`, `pi-shopping-cart`, `pi-box`, `pi-building`, `pi-users`, `pi-truck`, `pi-exclamation-triangle`, `pi-chart-line`, `pi-replay`, `pi-warehouse`, `pi-check-square`, `pi-cog`, `pi-list`, `pi-code`, `pi-bell`, `pi-sign-out`, `pi-times`, `pi-clock`, `pi-arrow-right`, `pi-comments`, `pi-reply`, `pi-wallet`, `pi-check-circle`, `pi-times-circle`, `pi-plus-circle`, `pi-thumbs-up`, `pi-check`, `pi-tag`).

## Local state (refs, reactive, computed, watch)
- `collapsed: ref(false)` — sidebar width.
- `filteredMenuGroups: computed` — filters `menuGroups` by `hasAnyRole(item.roles)`, then drops groups with zero items.
- `userInitials: computed` — 2 upper-case letters from email, fallback `'U'`.
- `userDisplayName: computed` — `full_name` else email beautified (`replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`).
- `roleBadge: computed` — `null` when no roles; else `{ label, class }`.
- `isActive(path)` — function, not a computed.
- `onMounted(() => fetchUnreadCount())` — kicks off polling.

## Permissions/role gating
- Menu item visibility is driven by `item.roles` arrays × `useAuth().hasAnyRole(roles)`.
- `hasAnyRole` in [useAuth.js:142](../../../frontend/src/composables/useAuth.js#L142) grants ADMIN / SUPER_ADMIN unconditional access regardless of the role list passed in.
- Four user roles are surfaced in the badge color map (ADMIN, FINANCE, OPERATIONS, VIEWER); SUPER_ADMIN falls through to VIEWER colors — **probably a bug**. [UNCLEAR — needs Sachin review.]
- CLIENT / FACTORY users never see this component (they get `ClientLayout` / `FactoryLayout` in `App.vue`).

## Bilingual labels (Tamil + English pairs)
None. All 15+ menu labels and badge/copy strings are English-only.

## Empty/error/loading states
- Notification list empty → "No new notifications" centered block.
- Failed notification fetch silently swallows errors (composable `catch (_e) {}`).
- No loading skeleton for the menu (it's static).
- If `user` hasn't loaded, `filteredMenuGroups` is empty (no items render) and the profile footer shows initials `'U'`. `App.vue` already blocks rendering of internal routes until `initialized && user`, so this is largely unreachable.

## Business rules (the non-obvious ones)
1. **The `collapsed` state is not persisted.** Refreshing the page expands it again — a paper-cut for returning users.
2. **ADMIN / SUPER_ADMIN bypass role gates** everywhere (hard-coded in `hasAnyRole`). Menu rules such as `['ADMIN', 'FINANCE']` therefore include SUPER_ADMIN implicitly.
3. **Notifications poll every 10s** and also on tab-focus / `visibilitychange` events — there's no backoff or auth-loss handling. When the token expires the `401` response from `/api/notifications/count/` triggers the `useAuth` interceptor → hard redirect to `/login?session_expired=true`. The poll keeps firing until then.
4. **`markReadByResource` is exported by `useNotifications` but Sidebar does not call it** — only `markAsRead(id)`. Some grouped-count notifications may be left orphaned. [UNCLEAR — needs Sachin review.]
5. **`ITEM_QUERY_REPLY` uses `n.type`, all others use `n.notification_type || n.type`.** Look at [Sidebar.vue:278](../../../frontend/src/components/layout/Sidebar.vue#L278) — `PAYMENT_SUBMITTED` affordance banner reads `n.type` directly instead of the normalized `notification_type || type`. Likely harmless today but worth pinning in tests.

## Known quirks
- **Bell button is hidden when sidebar is collapsed.** The collapsed footer only shows sign-out. Users wanting to see notifications must expand first.
- **Active-state match logic**: `isActive` uses `startsWith(path)` except for `/dashboard` (special case). So `/orders` is active for both `/orders`, `/orders/new`, and `/orders/abc123`. This is desirable but means `/products` is also active for `/products/review` (which is its own top-level ADMIN menu item) — there's a latent "both Products and Product Review highlight together" issue. [UNCLEAR — needs Sachin review.]
- **Two-character initials from email even when `full_name` is known** — the avatar uses `email.substring(0, 2)` regardless of whether `full_name` exists. If John Doe logs in as `jdoe@…`, his avatar reads `JD` by coincidence, but `sachin_m@harvesterp.com` becomes `SA` — no first-name initial.
- **Notification `(count > 99)` shows `99+`, but the bell badge caps at `9+`** — inconsistent thresholds.

## Migration notes
- **Claude Design template mapping:** new **Navigation Shell** pattern — distinct from Ledger / Catalog / Guided Operator. Expect this to be dedicated plumbing in Layer 2.
- **Layer 2 components needed:** `SidebarShell`, `SidebarGroup`, `SidebarItem`, `NotificationBell`, `NotificationDrawer` (replace dialog with a right-side drawer? — discuss), `UserProfileChip`, `RoleBadge`, `CollapseToggle`. Probably `RoleFilter` HOC that wraps items and computes visibility.
- **New Layer 1 strings to add:** all 15 menu labels + group headers + dialog header + "No new notifications" + "Mark all read" + "Click to review" + "Click to verify payment" + every `NOTIF_STYLES[...].label` (16 strings).
- **Open questions for Sachin:**
  1. Should the collapsed state persist (localStorage)?
  2. SUPER_ADMIN badge color? Currently falls through to VIEWER's grey.
  3. Is the Product Review overlap with Products intentional (both highlight)?
  4. Move the notification bell to Topbar instead? Currently hidden when sidebar is collapsed.
  5. Is 10s polling acceptable long-term, or do you want to move to Server-Sent Events / WebSocket post-migration?
  6. Confirm we keep the `?tab=` deep-link contract for OrderDetail — 14 slugs are immutable across migration.
