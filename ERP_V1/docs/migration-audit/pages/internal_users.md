# Users

**Type:** page
**Portal:** internal
**Route:** `/users` (`meta.roles: ['ADMIN']`)
**Vue file:** [frontend/src/views/Users.vue](../../../frontend/src/views/Users.vue)
**Line count:** 523
**Migration wave:** Wave 1 (ADMIN; critical identity-management surface)
**Risk level:** high (issues bugs here cascade to RBAC / portal isolation across the whole system; cross-store writes during save; explicit raw axios call bypassing api module)

## Purpose (one sentence)
ADMIN console to list, filter, create, edit, and activate/disable users — including binding CLIENT users to a client record with brand access, portal-tab permissions, and order-item permissions, and binding FACTORY users to a factory record.

## Layout (top→bottom, left→right, exhaustive)

### Shell
`<div class="p-6 max-w-6xl mx-auto">`

### Zone 1 — Header (`flex items-center justify-between mb-6`)
- Left: `<h1>User Management` (`text-2xl font-bold`) + subtitle `{total} users registered`.
- Right: **Add User** emerald CTA (`pi pi-plus`).

### Zone 2 — Filters (`flex gap-3 mb-4`)
- Search input (`placeholder="Search by name or email..."`, `flex-1`). `@input` triggers `loadUsers()` (per-keystroke fetch).
- Role filter `<select>` with `All Roles` + one option per role in `roles` array (SUPER_ADMIN, ADMIN, FINANCE, OPERATIONS, CLIENT, FACTORY). `@change` triggers `loadUsers()`.

### Zone 3 — Users table (`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm`)
Columns:
1. **User** — two-line cell: `full_name` (bold slate-800) / `email` (xs slate-400).
2. **Role** — colored pill. Color map (lines 29-36):
   - SUPER_ADMIN → purple
   - ADMIN → red
   - FINANCE → amber
   - OPERATIONS → blue
   - CLIENT → green
   - FACTORY → violet
3. **Type** — `user_type` (INTERNAL / CLIENT / FACTORY) in slate-500 plaintext.
4. **Status** — `Active` (emerald-600) or `Disabled` (red-500).
5. **Last Login** — `new Date(u.last_login).toLocaleDateString()` OR `Never`.
6. **Actions (right-aligned)** — `Edit` (blue) + `Disable`/`Enable` toggle (red when active, emerald when disabled).

Loading row: colspan=6 with centered spinner + `Loading...`.

### Zone 4 — Modal (`v-if="showForm"`, `fixed inset-0 z-50 flex items-center justify-center bg-black/40`)
Modal card: `bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto`.

**Modal title:** `{editingUser ? 'Edit User' : 'New User'}`.

**Inline error banner** (`v-if="formError"`): red-50, red-200 border, red-700 text + `pi pi-exclamation-circle`.

**Form fields** (all `space-y-3`):
1. **Email** — only visible when creating (`v-if="!editingUser"`). Envelope icon prefix. On edit, email is locked (`delete body.email` in `saveUser`).
2. **Full Name** — user icon prefix.
3. **Password** — lock icon + eye-toggle suffix. Label flips: on create = `Password` (`Min 6 characters`); on edit = `New Password (leave blank to keep)`.
4. **Role** — `<select>`. On-change calls `onRoleChange()` which synchronizes `user_type`. Helper caption below select has role-specific copy:
   - SUPER_ADMIN → `Full system access + real factory pricing visibility`
   - ADMIN → `Full system access`
   - FINANCE → `Payments, ledgers, invoices`
   - OPERATIONS → `Orders, products, shipping`
   - CLIENT → `External buyer — own orders only`
   - FACTORY → `External supplier — assigned orders only`
5. **Client Link** (conditional: `v-if="form.role === 'CLIENT'"`) — select populated from `clients` (fetched via `clientsApi.search({q:''})`), plus a link `+ Add New Client` (opens `/clients/new` in new tab). When a client is picked:
   - **Client Type Badge** — `Transparency Client` (indigo) or `Regular Client` (slate) based on `c.client_type`.
   - **Product Brand Access** — scrollable `max-h-48` list of checkboxes for all brands + a separated "Products without brand" toggle (`includeNoBrand`). Caption: `{N} brand(s) selected{' + unbranded products'} — client can only order products from these brands`.
   - **Portal Tab Permissions** — 6 checkboxes (below `<i class="pi pi-eye" />` header):
     - `show_payments` — Payments (payment history, balance due)
     - `show_production` — Production Progress (factory production status)
     - `show_shipping` — Shipping & Tracking (vessel, ETA, transit status)
     - `show_after_sales` — After-Sales (quality claims, resolution)
     - `show_files` — Files (shared documents, PI downloads)
     - `show_packing` — Packing (packing status, items produced, carry-forward)
   - **Order Item Permissions** block (slate-50 card, blue icon header `pi pi-list`) — 6 checkboxes:
     - `items_add` — Add Items
     - `items_bulk_add` — Bulk Add
     - `items_fetch_pending` — Fetch Pending Items (carry-forward from previous orders)
     - `items_upload_excel` — Upload Excel
     - `items_edit_qty` — Edit Quantity
     - `items_remove` — Remove Items
6. **Factory Link** (conditional: `v-if="form.role === 'FACTORY'"`) — select from `factories`, with `+ Add New Factory` link (`/factories/new` new tab).
7. **Active** — checkbox with label `Active`.

**Modal footer (`flex justify-end gap-3 mt-6`):** `Cancel` (ghost) + `Update`/`Create` (emerald) button.

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| Users list | `usersApi.list(params)` | `{users: [{id, full_name, email, role, user_type, is_active, last_login, client_id, factory_id}], total}` | 100 per page |
| Role pill color | `roleColors` map in-file | string | |
| Clients list | `clientsApi.search({q: ''})` | `[{id, company_name, client_type}]` | for the client select |
| Factories list | `factoriesApi.search({q: ''})` | `[{id, company_name, factory_code}]` | for the factory select |
| All categories | `productsApi.categories` | `string[]` OR `{categories: string[]}` | accessor handles both response shapes (line 88) |
| All brands | `productsApi.brands` | `string[]` OR `{brands: string[]}` | same defensive shape handling |
| Selected categories for CLIENT user | `clientsApi.getClientCategories(client_id)` | `{categories: string[]}` | loaded on edit |
| Selected brands | `clientsApi.getBrands(client_id)` | `{brands: string[], include_no_brand: bool}` | |
| Portal permissions | `clientsApi.getPortalPermissions(client_id)` | `{show_*: bool, items_*: bool}` | 12 booleans |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Type in search input | `@input="loadUsers"` | `usersApi.list({search, role, per_page})` | refetches (per keystroke) |
| Change role filter | `@change="loadUsers"` | same | |
| Click **Add User** | `openNew()` | none | resets form, opens modal |
| Click **Edit** on a row | `openEdit(u)` async | `clientsApi.getClientCategories` + `getBrands` + `getPortalPermissions` if user has a `client_id` | opens modal with prefilled form |
| Click **Disable** / **Enable** | `toggleActive(u)` | `usersApi.toggleActive(id, !is_active)` | refetch users; error → native `alert()` |
| Change role `<select>` in form | `onRoleChange()` | none | auto-syncs `user_type`, clears `client_id`/`factory_id` for non-CLIENT/non-FACTORY |
| Toggle brand checkboxes | `v-model="selectedBrands"` | none | captured on save |
| Toggle any portal/item permission | `v-model` on `portalPermissions.*` | none | captured on save |
| Click **Create** / **Update** | `saveUser()` | `usersApi.create(form)` OR `usersApi.update(id, bodyWithoutEmail)` then (for CLIENT) `clientsApi.setClientCategories` + **raw `api.put('/clients/.../brands/')`** + `clientsApi.updatePortalPermissions` | closes modal, refreshes list |
| Click **Cancel** | sets `showForm = false` | none | |
| Click `+ Add New Client` link | native anchor (`target="_blank"`) | none | opens `/clients/new` in a new tab |
| Click `+ Add New Factory` link | native anchor | none | opens `/factories/new` in a new tab |

## Modals/dialogs triggered (inline)
| Modal | Triggered by | Purpose | API on submit |
|---|---|---|---|
| User form modal | `openNew` / `openEdit` | create/edit user + (for CLIENT) permissions | `usersApi.create`/`update` + `clientsApi.setClientCategories` + raw `api.put` brands + `clientsApi.updatePortalPermissions` |
| Native `alert()` | `toggleActive` catch block | show error | — |

## API endpoints consumed (from src/api/index.js)
- `usersApi.list` — table fetch
- `usersApi.create` — submit new user
- `usersApi.update(id, body)` — submit edits (body has `email` stripped because email is immutable post-creation)
- `usersApi.toggleActive(id, bool)`
- `clientsApi.search` / `factoriesApi.search` — for dropdowns
- `productsApi.categories` / `productsApi.brands` — for checkbox lists
- `clientsApi.getClientCategories` / `setClientCategories`
- `clientsApi.getBrands` (read only — write uses raw axios)
- `clientsApi.getPortalPermissions` / `updatePortalPermissions`

**⚠ Raw axios bypass at line 172:**
```js
await api.put(`/clients/${clientId}/brands/`, {
  brands: selectedBrands.value,
  include_no_brand: includeNoBrand.value,
})
```
This is the **only place in the entire codebase** that writes brands. `clientsApi.setBrands` exists at [api/index.js:239](../../../frontend/src/api/index.js#L239) but takes only `brands` (not the `include_no_brand` flag). The inline axios bypasses the module because the module method has the wrong signature. **Migration must either extend `setBrands` to accept `include_no_brand` or preserve the inline call.** [UNCLEAR — needs Sachin review.]

## Composables consumed
None (uses `api/index.js` and raw axios directly).

## PrimeVue components consumed
None. Native `<table>`, native `<select>`, native `<input>`, hand-rolled modal.

## Local state (refs, reactive, computed, watch)
- List state: `users`, `total`, `loading`, `search`, `roleFilter`.
- Form state: `showForm`, `editingUser`, `form` (fields: email, full_name, password, role, user_type, client_id, factory_id, is_active), `showPassword`, `formError`.
- Dropdown caches: `clients`, `factories`, `allCategories`, `selectedCategories`, `allBrands`, `selectedBrands`, `includeNoBrand`.
- Portal permissions: `portalPermissions` (12 booleans).
- Static: `roles` array, `roleColors` map.

No computed or watch.

## Permissions/role gating
- Route: `meta.roles: ['ADMIN']`.
- Sidebar: menu item gated to ADMIN.
- Note: SUPER_ADMIN is not in `meta.roles`, but the guard grants SUPER_ADMIN unconditional access ([router/index.js:392](../../../frontend/src/router/index.js#L392)).

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
- **Loading users:** colspan row with `pi pi-spinner pi-spin` + `Loading...`.
- **Empty users:** no dedicated empty state — the table just renders no body rows. Could lead to blank screens for freshly provisioned tenants.
- **Form error:** red inline banner at top of modal shows `formError.value`.
  - Specifically detects email collision: `if (status === 409 || detail.includes('email'))` → `This email is already in use by another account.` Otherwise shows raw `detail`.
- **Toggle-active error:** native `alert()` — jarring.

## Business rules (the non-obvious ones)
1. **Email is immutable post-creation.** `saveUser` hard-deletes `body.email` before PUT (line 160). The modal hides the Email field when `editingUser !== null`.
2. **`onRoleChange` auto-syncs `user_type`.** Picking CLIENT forces `user_type = 'CLIENT'`, picking FACTORY forces `user_type = 'FACTORY'`, any other role forces `user_type = 'INTERNAL'` AND clears `client_id` / `factory_id`. This coupling is silent — UI doesn't announce it.
3. **Cross-resource writes on save.** For CLIENT users, after the main `usersApi.update`/`create` succeeds, three further requests are fired (categories, brands, portal permissions) — each wrapped in `try { } catch (_e) {}` that silently swallows errors. A category/brand/permission write failure is invisible to the admin. [UNCLEAR — needs Sachin review: is silent failure acceptable here?]
4. **Permissions block replicates server state.** The 6 "portal tab permissions" and 6 "order item permissions" are fetched from `clientsApi.getPortalPermissions` and mutated on save. The user's own permissions are inherited via their client binding.
5. **Brand access also acts as a product filter.** The caption explicitly states `client can only order products from these brands` — this drives the product catalog shown in ClientProducts / ClientNewOrder.
6. **Transparency vs. Regular Client distinction.** A badge surfaces `client_type === 'TRANSPARENCY'`. Transparency clients see real factory prices and the LandedCost tab; regular clients do not. This is a property on the *client*, not the user.
7. **The "Add New Client" link opens in a new tab** to preserve the in-progress form — no draft persistence, so the user must return and re-select the new client.
8. **Password hint `Min 6 characters`** is presentational. Backend enforces actual length.
9. **`SUPER_ADMIN` vs `ADMIN`** — SUPER_ADMIN is a distinct role but is treated as ADMIN-equivalent throughout the auth guard and UI. The only visible hint is the role-select caption mentioning "real factory pricing visibility."

## Known quirks
- **Per-keystroke search refetch** — no debounce. Every letter hits `/api/users/?search=…`. For a small admin surface this is harmless, but it would be trivially debounced.
- **The form can be submitted even if required fields are blank.** The enabled/disabled state of the CTA doesn't reflect required-field validation — the backend will reject and set `formError` post-hoc.
- **`<input type="email">` on the Email field only** — `Full Name` is just `<input>` (no type, defaults to text).
- **`selectedCategories` is captured but there's no visible categories checkbox UI in the template**. Code paths write it to `clientsApi.setClientCategories` on save, but the modal only shows the Brand checkboxes. [UNCLEAR — needs Sachin review: is the category picker missing from the modal on purpose, or was it removed in a refactor and the server side wasn't cleaned up?]
- **`client_id`/`factory_id` types cleared to `null` on role change**, not `undefined` — consistent with `<option :value="null">`.
- **Role-select helper caption shows all 6 descriptions sequentially**, with one always visible. Works because only one `v-if` matches per render.
- **No row-level "Delete"** — users can only be disabled, not deleted. This is a deliberate audit-trail choice.
- **Loading state doesn't extend to the form modal.** Opening the modal to edit a CLIENT user fires up to 3 parallel requests before the checkboxes populate — if those are slow, the admin sees empty checkbox lists and may click Save prematurely.

## Migration notes
- **Claude Design template mapping:** **Ledger** for the list + **Guided Operator** for the edit modal (long vertical form). Possibly move the CLIENT-specific blocks to a dedicated secondary pane or wizard step.
- **Layer 2 components needed:** `FilteredTable` (search + role filter + paginated), `UserRow`, `RolePill`, `UserFormDrawer` (replace modal with right-side drawer for the long form), `CheckboxGroup`, `PermissionMatrix` (reusable for portal + item permission blocks), `BrandSelector` (with "include unbranded" sub-toggle), `ToastHost` (consistent w/ Settings), `ConfirmDialog` (replace native `alert`).
- **New Layer 1 strings to add:** 6 role names, 6 role captions, 12 permission labels + 12 permission descriptions, 2 client-type badges, search placeholder, all column headers, all button labels, error strings (`This email is already in use by another account.`), empty brand state (`No brands available`), row-count pluralization, `Active` / `Disabled` / `Never`, form field labels, caption `client can only order products from these brands`.
- **Open questions for Sachin:**
  1. Why does `clientsApi.setBrands` exist but get bypassed? Should we extend it to accept `include_no_brand`?
  2. The `selectedCategories` persistence path exists (writes back on save) — is the missing category-checkbox UI in the modal a bug, or intended?
  3. Should cross-resource save failures (brand/permission/category writes after user save succeeds) surface as partial-success warnings, instead of silently swallowing?
  4. Password policy — should we surface strength rules in the UI?
  5. Should email changes be permitted via a separate flow (with verification)? The current "email is forever" policy is strong but inflexible.
  6. Deletion vs disable: any future need for hard delete (GDPR / right to erasure)?
  7. Would a drawer beat a modal for this long form?
