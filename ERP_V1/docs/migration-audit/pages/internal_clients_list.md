# Internal Clients List

**Type:** page (list)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/clients` → `ClientList` (meta.title: `'Clients'`, meta.icon: `'pi-users'`)
**Vue file:** [frontend/src/views/clients/ClientList.vue](../../../frontend/src/views/clients/ClientList.vue)
**Line count:** 297
**Migration wave:** Wave 4 (internal master data)
**Risk level:** medium — G-013 CLOSED 2026-04-22 (Patch 12); `ClientResponse` exposes margin fields to any caller (Cluster D, open)

---

## Purpose

Paginated, searchable list of client/buyer records for INTERNAL users, supporting inline single-delete with a confirmation modal and a separate create/edit form.

---

## Layout

### Outer container
No `max-w-*` constraint — full-width within the shell layout.

**Page header** (`flex justify-between items-center mb-6`)
- Left: h2 "Clients" + subtitle `{{ totalItems }} clients`
- Right: `<router-link to="/clients/new">` — "Add Client" (pi-plus, emerald-600 button)

**Search bar** (`bg-white rounded-xl shadow-sm p-4 mb-4`)
- `<input>` with pi-search icon, `max-w-md`
- Placeholder: "Search by company name, GSTIN, city, contact..."
- Debounced 400ms via `onSearchInput` → resets `page` to 1

**Table container** (`bg-white rounded-xl shadow-sm overflow-hidden`)

Loading state: `v-if="loading"` — centered spinner "Loading clients..."

Empty state: `v-else-if="clients.length === 0"` — pi-users icon, "No clients found", "Add your first client" link

**Data table** (`overflow-x-auto`)

| Column | Data | Notes |
|---|---|---|
| Company Name | `client.company_name` | `text-sm font-medium text-slate-800` |
| GSTIN | `client.gstin` | `font-mono`; "Not provided" italic if absent |
| Location | `client.city + client.state` joined; `client.pincode` on second line | Both optional; em-dash if both absent |
| Contact | `client.contact_name`; `client.contact_phone` on second line | em-dash if absent |
| IEC / PAN | Badge pair: `IEC: {iec}` (indigo-50) + `PAN: {pan}` (slate-100) | em-dash if both absent |
| Actions | Edit (pi-pencil) → `/clients/{id}/edit`; Delete (pi-trash) → `confirmDelete(client)` | |

**Pagination** (`flex items-center justify-between border-t border-slate-200 bg-slate-50`)
- Only renders when `totalPages > 1`
- Range label: "Showing X–Y of Z"
- Page buttons: prev chevron, numbered pages with ±1 window + ellipsis at ±2, next chevron
- Active page: `bg-emerald-600 text-white`

**Delete confirmation modal** (`fixed inset-0 bg-black/50 z-50`)
- Backdrop click → `cancelDelete()`
- Shows `deleteTarget.company_name`
- Two buttons: Cancel + Delete (red-600)
- No typed confirmation required

---

## Data displayed

| Field | Source | Rendered | Notes |
|---|---|---|---|
| `company_name` | `ClientResponse` | Yes | Primary identifier in table |
| `gstin` | `ClientResponse` | Yes | Mono font badge |
| `city`, `state` | `ClientResponse` | Yes | Joined; pincode on second line |
| `contact_name`, `contact_phone` | `ClientResponse` | Yes | Two-line cell |
| `iec`, `pan` | `ClientResponse` | Yes | Badge pair |
| `factory_markup_percent` | `ClientResponse` | **No** | Present in API response (Cluster D); fetched but never accessed in template |
| `sourcing_commission_percent` | `ClientResponse` | **No** | Same as above |

> **Cluster D:** `ClientResponse` includes `factory_markup_percent` and `sourcing_commission_percent`. These are sensitive internal margin fields. They are not rendered in the list UI, but they are transmitted to the browser for every client record fetched. Migration should audit whether the list endpoint can omit them, or use a `ClientListResponse` projection that excludes margin fields.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadClients()` | `GET /api/clients/?page=1&per_page=50` | Fills table |
| Search input | `onSearchInput()` (400ms debounce) | `GET /api/clients/?search=…&page=1&per_page=50` | Re-fills table; page reset to 1 |
| Page change | `goToPage(p)` | `GET /api/clients/?page=p&per_page=50` | Re-fills table |
| Edit button | `router.push('/clients/{id}/edit')` | — | Navigate |
| Delete icon | `confirmDelete(client)` | — | Opens modal |
| Modal "Delete" | `executeDelete()` | `DELETE /api/clients/{id}/` | Soft-deletes; reloads list |
| Modal "Cancel" / backdrop | `cancelDelete()` | — | Closes modal |
| "Add Client" button | `router.push('/clients/new')` | — | Navigate (router-link) |

---

## Modals/dialogs triggered

| Modal | Trigger | Content | Notes |
|---|---|---|---|
| Delete Confirmation | Trash icon click | Shows `deleteTarget.company_name`; Cancel + Delete buttons | Custom inline; backdrop-click dismisses; no typed confirmation (D-003 note) |

---

## API endpoints consumed

| Method | Path | Via | Notes |
|---|---|---|---|
| GET | `/api/clients/` | `clientsApi.list(params)` | `page`, `per_page`, optional `search` query params |
| DELETE | `/api/clients/{id}/` | `clientsApi.delete(id)` | **G-013 CLOSED (Patch 12)** — ADMIN|OPERATIONS|SUPER_ADMIN only |

> Per D-001 (Option B): in Next.js these become `client.clients.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-plus`, `pi-search`, `pi-spin pi-spinner`, `pi-users`, `pi-pencil`, `pi-trash`, `pi-chevron-left`, `pi-chevron-right`, `pi-exclamation-triangle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `clients` | `ref([])` | `[]` | Table rows |
| `loading` | `ref(false)` | false | Table loading spinner |
| `search` | `ref('')` | `''` | Search input (bound + debounced) |
| `page` | `ref(1)` | 1 | Current page number |
| `perPage` | `ref(50)` | 50 | Items per page (hardcoded) |
| `totalItems` | `ref(0)` | 0 | Total count from API |
| `showDeleteConfirm` | `ref(false)` | false | Modal visibility |
| `deleteTarget` | `ref(null)` | null | Client object for pending delete |
| `totalPages` | `computed` | — | `Math.ceil(totalItems / perPage)` |

---

## Permissions / role gating

- Route `/clients` has **no `meta.roles`** — all INTERNAL users can navigate.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal entirely.
- "Add Client" button (`/clients/new`) visible to **all INTERNAL users** — no role check on the button or the list page.
- **Backend (G-013 CLOSED, Patch 12):** `DELETE /api/clients/{id}/` now requires ADMIN|OPERATIONS|SUPER_ADMIN role.
- **Migration note:** In Next.js, render the "Add Client" button conditionally per `hasPermission(user, 'manage_clients')`. The delete action in the table row should also be gated.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.client_list.title` | "Clients" | "" | `InternalString` |
| `internal.client_list.search_placeholder` | "Search by company name, GSTIN, city, contact..." | "" | `InternalString` |
| `internal.client_list.btn_add` | "Add Client" | "" | `InternalString` |
| `internal.client_list.col_company` | "Company Name" | "" | `InternalString` |
| `internal.client_list.col_gstin` | "GSTIN" | "" | `InternalString` |
| `internal.client_list.col_location` | "Location" | "" | `InternalString` |
| `internal.client_list.col_contact` | "Contact" | "" | `InternalString` |
| `internal.client_list.col_iec_pan` | "IEC / PAN" | "" | `InternalString` |
| `internal.client_list.col_actions` | "Actions" | "" | `InternalString` |
| `internal.client_list.empty` | "No clients found" | "" | `InternalString` |
| `internal.client_list.delete_title` | "Delete Client" | "" | `InternalString` |
| `internal.client_list.delete_confirm` | "Are you sure you want to delete:" | "" | `InternalString` |

[D-005: Tamil may remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — full-table centered spinner | |
| Empty — no records | `clients.length === 0` after load | Yes — pi-users icon, "No clients found", add link | |
| Load failure | `catch` in `loadClients` | **No** — `console.error` only | No user-facing error banner. **P-002 gap.** |
| Delete failure | `catch` in `executeDelete` | **No** — `console.error` only | Modal closes, list is NOT reloaded, row remains. |
| Delete success | — | Implicit — row disappears after `loadClients()` | No toast or banner |

---

## Business rules

1. **Per-page fixed at 50.** `perPage` is initialised as `ref(50)` and never changed. No page-size selector.
2. **Search resets page to 1.** `onSearchInput` sets `page.value = 1` before calling `loadClients`.
3. **Pagination window.** Shows pages within ±1 of current page; ellipsis at ±2; always shows first and last page buttons. Same pattern as ProductList and FactoryList.
4. **Soft delete.** `DELETE /api/clients/{id}/` is a soft-delete (`deleted_at = datetime.utcnow()`, `is_active = False`). Deleted clients disappear from the list immediately after reload.
5. **`factory_markup_percent` / `sourcing_commission_percent` fetched but not displayed.** The list response includes these fields (Cluster D). They are wasted bandwidth and a confidential data exposure risk if the JWT is ever issued to non-INTERNAL callers.

---

## Known quirks

- **No load-failure UI.** If `clientsApi.list()` throws, the table stays in its previous state (or empty on first load) with no user-visible error. **P-002 gap.**
- **No delete-failure UI.** If `clientsApi.delete()` throws, the modal closes silently. The row still appears until the user manually reloads.
- **"Add Client" unrestricted.** All INTERNAL users can reach `/clients/new` regardless of role.
- **D-003:** Delete modal shows the company name but has no typed-confirmation guard. A single mis-click on the trash icon followed by "Delete" permanently (soft-)removes the record.

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

- Pagination rendering logic (windowed page buttons + ellipsis) is the same pattern as `ProductList.vue` and `FactoryList.vue` — copy-pasted inline in each component. **P-016 candidate:** extract to a shared `<Pagination>` component in Next.js.

---

## Migration notes

1. **Server Component.** `app/clients/page.tsx` — fetch initial page server-side, pass to a `<ClientTable>` Client Component for search/pagination interactivity.
2. **List projection.** Define a `ClientListItem` type that omits `factory_markup_percent` and `sourcing_commission_percent`. Either add a backend projection endpoint or filter on the frontend before passing to the table. Do not expose margin fields in the list response.
3. **Error states.** Add a user-visible error banner for load failure (P-002 fix). Add a toast or inline error for delete failure.
4. **Delete confirmation.** Consider adding typed confirmation (D-003) — at minimum, make the confirm button require an explicit second click.
5. **Role-conditional "Add Client" button.** Render only when `hasPermission(user, 'manage_clients')`.
6. **Shared Pagination component.** Extract the window pagination logic (shared across ProductList, FactoryList, ClientList, TransportList) into `src/components/Pagination.tsx`.
7. **D-001:** `clientsApi.*` → `client.clients.*` via generated SDK.
8. **D-005:** All `InternalString` entries; Tamil can remain `""`.
