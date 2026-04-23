# Internal Transport / Service Providers (List + Form)

**Type:** combined profile — list page + shared form page (two modes)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Routes:**
- `/transport` → `TransportList` (meta.title: `'Service Providers'`, meta.icon: `'pi-truck'`)
- `/transport/new` → `TransportNew` (meta.title: `'New Service Provider'`, meta.parent: `'TransportList'`)
- `/transport/:id/edit` → `TransportEdit` (meta.title: `'Edit Service Provider'`, meta.parent: `'TransportList'`, props: true)
**Vue files:**
- [frontend/src/views/transport/TransportList.vue](../../../frontend/src/views/transport/TransportList.vue) — 314 lines
- [frontend/src/views/transport/TransportForm.vue](../../../frontend/src/views/transport/TransportForm.vue) — 494 lines
**Line count:** TransportList.vue: 314 · TransportForm.vue: 494 · combined: 808
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-014 CLOSED 2026-04-22 (Patch 13)

---

## Purpose

**List:** Paginated, searchable list of logistics service providers (freight forwarders, CHAs, CFSs, transporters) with role-badge display and inline soft-delete.

**Form:** Shared create/edit form for service providers capturing identity, multi-role assignment, address, contact, banking, compliance details, and free-tag operating ports.

---

## Layout

### TransportList

**Outer container:** No `max-w-*` — full-width within shell.

**Page header** (`flex justify-between items-center mb-6`)
- Left: h2 "Service Providers" + subtitle `{{ totalItems }} providers`
- Right: `<router-link to="/transport/new">` — "Add Provider" (pi-plus, emerald-600 button)

**Search bar** (`bg-white rounded-xl shadow-sm p-4 mb-4`)
- `<input>` with pi-search icon, `max-w-md`
- Placeholder: "Search by name, contact, city..."
- Debounced 400ms via `onSearchInput` → resets `page` to 1

**Table container** (`bg-white rounded-xl shadow-sm overflow-hidden`)

Loading state: `v-if="loading"` — centered spinner "Loading providers..."

Empty state: `v-else-if="providers.length === 0"` — pi-truck icon, "No service providers found", "Add your first provider" link

**Data table** (`overflow-x-auto`)

| Column | Data | Notes |
|---|---|---|
| Name | `p.name` | `text-sm font-medium text-slate-800` |
| Roles | `p.roles[]` mapped via `roleLabelMap` + `roleColorMap` | Color-coded pill badges (see Business Rules) |
| Contact | `p.contact_person`; `p.phone` on second line | em-dash if absent |
| Location | `p.city + p.state` joined | em-dash if both absent |
| GST / PAN | Badge pair: `GST: {gst_number}` (indigo-50) + `PAN: {pan_number}` (slate-100) | em-dash if both absent |
| Actions | Edit (pi-pencil) → `/transport/{id}/edit`; Delete (pi-trash) → `confirmDelete(p)` | |

**Pagination** — identical pattern to ClientList (prev/next, windowed page buttons, ellipsis at ±2).

**Delete confirmation modal** — same pattern as ClientList: shows `deleteTarget.name`, Cancel + Delete buttons, backdrop-click dismisses, no typed confirmation.

---

### TransportForm

**Outer container:** `max-w-4xl`

**Page header** (`flex items-center gap-3 mb-6`)
- Left: back arrow button → `handleCancel()` → `/transport`
- Title: "Edit Service Provider" / "New Service Provider" (h2)
- Subtitle: "Update provider details" / "Register a new service provider"

**Loading state** (`v-if="loading"`) — full-panel spinner "Loading provider..." in edit mode

**Form body** (`<form @submit.prevent="handleSubmit" class="space-y-6">`)

**Success / Error banners** — shown at top of form (above sections)
- Success: emerald-50, pi-check-circle
- General error: red-50, pi-exclamation-circle

**Section 1 — Company Information** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-truck icon "COMPANY INFORMATION"

| Field | Label | Input | Notes |
|---|---|---|---|
| `name` | Company Name * | `<input type="text">` | Required. Validated non-empty. |
| `roles` | Roles * | Visual card grid (2×2) | Required — at least one. Card-based toggle, not a select. |

Roles section: renders `availableRoles` (4 entries) as clickable cards in a 2-column grid. Each card shows a checkbox (pointer-events-none), PrimeIcon, and label. Active card gets role-specific border/bg color. See Business Rules for role values.

**Section 2 — Address** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-map-marker icon "ADDRESS"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `address` | Street Address | `<input type="text">` | Optional. `md:col-span-2`. |
| `city` | City | `<input type="text">` | Optional. |
| `state` | State | `<select>` | Optional. Options from `INDIAN_STATES` (imported constant). |
| `country` | Country | `<input type="text">` | Optional. Default: `'India'`. |

**Section 3 — Contact Person** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-user icon "CONTACT PERSON"
Grid: 3 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `contact_person` | Name | `<input type="text">` | Optional. |
| `phone` | Phone | `<input type="text">` | Optional. Placeholder "+91 xxx xxx xxxx". |
| `email` | Email | `<input type="email">` | Optional. Validated if provided. |

**Section 4 — Banking & Compliance** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-wallet icon "BANKING & COMPLIANCE"
Grid: 3 columns (top row), 2 columns (bottom row)

| Field | Label | Input | Notes |
|---|---|---|---|
| `bank_name` | Bank Name | `<input type="text">` | Optional. |
| `bank_account` | Account Number | `<input type="text">` | Optional. |
| `ifsc_code` | IFSC Code | `<input type="text" maxlength="11">` | Optional. `font-mono uppercase`. Uppercased on submit. |
| `gst_number` | GST Number | `<input type="text" maxlength="15">` | Optional. `font-mono uppercase`. Validated if provided (GSTIN regex). |
| `pan_number` | PAN Number | `<input type="text" maxlength="10">` | Optional. `font-mono uppercase`. Validated if provided (PAN regex). |

**Section 5 — Operating Ports & Notes** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-compass icon "OPERATING PORTS & NOTES"

| Field | Label | Input | Notes |
|---|---|---|---|
| `operating_ports` | Operating Ports | Tag input + "Add" button | Free-text; comma-split on add; stored as `string[]`; Enter key triggers add. Tags shown as cyan pills with remove × button. |
| `notes` | Notes | `<textarea rows="3">` | Optional. |

Helper text for ports: "Press Enter or click Add. Separate multiple with commas."

**Action Buttons** (bottom, `justify-end`)
- "Cancel" → `handleCancel()` → `/transport`
- "Create Provider" / "Update Provider" submit button

---

## Data displayed

**List:** `p.name`, `p.roles[]`, `p.contact_person`, `p.phone`, `p.city`, `p.state`, `p.gst_number`, `p.pan_number`. Fields like `bank_name`, `bank_account`, `ifsc_code`, `operating_ports`, `notes`, `address` are fetched in the response but not shown in the table.

**Form (edit mode):** Pre-filled from `transportApi.get(id)` via explicit field-by-field assignment with `|| ''` / `|| []` fallbacks. Null API values become `''` (string fields) or `[]` (arrays). This differs from ClientForm's `Object.keys` strategy.

> **P-007 check:** `_serialize_provider` in `backend/routers/shipping.py` returns: `id`, `name`, `contact_person`, `phone`, `email`, `address`, `city`, `state`, `country`, `bank_name`, `bank_account`, `ifsc_code`, `gst_number`, `pan_number`, `roles[]`, `operating_ports[]`, `notes`, `is_active`, timestamps. **No `*_cny`, `factory_*`, `markup_*`, or `margin_*` fields. Clean.**

---

## Interactions

### TransportList

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadProviders()` | `GET /api/shipping/transport/?page=1&per_page=50` | Fills table |
| Search input | `onSearchInput()` (400ms debounce) | `GET /api/shipping/transport/?search=…&page=1&per_page=50` | Re-fills; page reset |
| Page change | `goToPage(p)` | `GET /api/shipping/transport/?page=p&per_page=50` | Re-fills table |
| Edit button | `router.push('/transport/{id}/edit')` | — | Navigate |
| Delete icon | `confirmDelete(provider)` | — | Opens modal |
| Modal "Delete" | `executeDelete()` | `DELETE /api/shipping/transport/{id}/` | Soft-deletes; reloads list |
| Modal "Cancel" / backdrop | `cancelDelete()` | — | Closes modal |

### TransportForm

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (edit) | `loadProvider()` | `GET /api/shipping/transport/{id}/` | Pre-fills form |
| Page mount (new) | nothing | — | Form at defaults |
| Role card click | `toggleRole(value)` | — | Adds/removes from `form.roles[]` |
| Port "Add" / Enter | `addPort()` | — | Splits comma string, adds unique ports to `operating_ports[]` |
| Port × button | `removePort(port)` | — | Removes tag from `operating_ports[]` |
| Submit (new) | `handleSubmit()` + `validate()` | `POST /api/shipping/transport/` | Creates provider; redirects after 800ms |
| Submit (edit) | `handleSubmit()` + `validate()` | `PUT /api/shipping/transport/{id}/` | Updates; redirects after 800ms |
| Cancel | `handleCancel()` | — | Navigate to `/transport` |

---

## Modals/dialogs triggered

| Modal | Trigger | Content | Notes |
|---|---|---|---|
| Delete Confirmation | Trash icon click (list) | Shows `deleteTarget.name`; Cancel + Delete buttons | Custom inline; backdrop-click dismisses; no typed confirmation (D-003 note) |

---

## API endpoints consumed

| Method | Path | Via | Notes |
|---|---|---|---|
| GET | `/api/shipping/transport/` | `transportApi.list(params)` | `page`, `per_page`, optional `search` |
| GET | `/api/shipping/transport/{id}/` | `transportApi.get(id)` | Edit pre-fill |
| POST | `/api/shipping/transport/` | `transportApi.create(payload)` | **G-014 CLOSED (Patch 13)** — ADMIN|OPERATIONS|SUPER_ADMIN only |
| PUT | `/api/shipping/transport/{id}/` | `transportApi.update(id, payload)` | **G-014 CLOSED (Patch 13)** — ADMIN|OPERATIONS|SUPER_ADMIN only |
| DELETE | `/api/shipping/transport/{id}/` | `transportApi.delete(id)` | **G-014 CLOSED (Patch 13)** — ADMIN|SUPER_ADMIN only; soft-delete (`is_active = False`) |

> These endpoints live in `backend/routers/shipping.py` under the `/shipping/transport/` sub-path — there is no separate `transport.py` router. The frontend `transportApi` in `api/index.js` maps to this path.

> Per D-001 (Option B): in Next.js these become `client.transport.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRoute()` and `useRouter()` inline. `INDIAN_STATES` imported from `../../utils/constants` (TransportForm only).

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons.

**TransportList:** `pi-plus`, `pi-search`, `pi-spin pi-spinner`, `pi-truck`, `pi-pencil`, `pi-trash`, `pi-chevron-left`, `pi-chevron-right`, `pi-exclamation-triangle`

**TransportForm:** `pi-arrow-left`, `pi-truck`, `pi-send`, `pi-file-edit`, `pi-warehouse`, `pi-map-marker`, `pi-user`, `pi-wallet`, `pi-compass`, `pi-check`, `pi-spin pi-spinner`, `pi-check-circle`, `pi-exclamation-circle`, `pi-times`

---

## Local state

### TransportList

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `providers` | `ref([])` | `[]` | Table rows |
| `loading` | `ref(false)` | false | Table loading spinner |
| `search` | `ref('')` | `''` | Search input (bound + debounced) |
| `page` | `ref(1)` | 1 | Current page |
| `perPage` | `ref(50)` | 50 | Items per page (hardcoded) |
| `totalItems` | `ref(0)` | 0 | Total count from API |
| `showDeleteConfirm` | `ref(false)` | false | Modal visibility |
| `deleteTarget` | `ref(null)` | null | Provider object for pending delete |
| `totalPages` | `computed` | — | `Math.ceil(totalItems / perPage)` |
| `roleLabelMap` | `const {}` | hardcoded | Role value → display label |
| `roleColorMap` | `const {}` | hardcoded | Role value → Tailwind CSS classes |

### TransportForm

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(false)` | false | Edit-mode fetch spinner |
| `saving` | `ref(false)` | false | Submit button loading |
| `errors` | `ref({})` | `{}` | Field + general errors |
| `successMsg` | `ref('')` | `''` | Success banner text |
| `form` | `ref({...})` | See below | All 16 form fields |
| `portInput` | `ref('')` | `''` | Temp input for adding operating port tags |
| `availableRoles` | `const []` | hardcoded | 4 role descriptors (value, label, icon, colors) |
| `isEdit` | `computed` | — | `!!route.params.id` |
| `providerId` | `computed` | — | `route.params.id` |

**`form` ref — all 16 fields with initial values:**
```
name: '', roles: [],
contact_person: '', phone: '', email: '',
address: '', city: '', state: '', country: 'India',
bank_name: '', bank_account: '', ifsc_code: '',
gst_number: '', pan_number: '',
operating_ports: [], notes: ''
```

---

## Permissions / role gating

- Routes `/transport`, `/transport/new`, `/transport/:id/edit` have **no `meta.roles`** — all INTERNAL users can navigate.
- `router.beforeEach` blocks CLIENT/FACTORY users entirely.
- **Backend (G-014 CLOSED, Patch 13):** `POST` and `PUT` for `/api/shipping/transport/` require ADMIN|OPERATIONS|SUPER_ADMIN; `DELETE` requires ADMIN|SUPER_ADMIN.
- **Migration note:** In Next.js, gate transport mutation pages to ADMIN|OPERATIONS|SUPER_ADMIN (create/edit) and SUPER_ADMIN (delete) — backend already patched (G-014). "Add Provider" button visible only to `hasPermission(user, 'manage_transport')`.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

**TransportList:**

| Key | en | ta | Type |
|---|---|---|---|
| `internal.transport_list.title` | "Service Providers" | "" | `InternalString` |
| `internal.transport_list.search_placeholder` | "Search by name, contact, city..." | "" | `InternalString` |
| `internal.transport_list.btn_add` | "Add Provider" | "" | `InternalString` |
| `internal.transport_list.col_name` | "Name" | "" | `InternalString` |
| `internal.transport_list.col_roles` | "Roles" | "" | `InternalString` |
| `internal.transport_list.col_contact` | "Contact" | "" | `InternalString` |
| `internal.transport_list.col_location` | "Location" | "" | `InternalString` |
| `internal.transport_list.col_gst_pan` | "GST / PAN" | "" | `InternalString` |
| `internal.transport_list.empty` | "No service providers found" | "" | `InternalString` |
| `internal.transport_list.delete_title` | "Delete Provider" | "" | `InternalString` |

**TransportForm:**

| Key | en | ta | Type |
|---|---|---|---|
| `internal.transport_form.title_new` | "New Service Provider" | "" | `InternalString` |
| `internal.transport_form.title_edit` | "Edit Service Provider" | "" | `InternalString` |
| `internal.transport_form.section_company` | "Company Information" | "" | `InternalString` |
| `internal.transport_form.section_address` | "Address" | "" | `InternalString` |
| `internal.transport_form.section_contact` | "Contact Person" | "" | `InternalString` |
| `internal.transport_form.section_banking` | "Banking & Compliance" | "" | `InternalString` |
| `internal.transport_form.section_ports` | "Operating Ports & Notes" | "" | `InternalString` |
| `internal.transport_form.btn_cancel` | "Cancel" | "" | `InternalString` |
| `internal.transport_form.btn_create` | "Create Provider" | "" | `InternalString` |
| `internal.transport_form.btn_update` | "Update Provider" | "" | `InternalString` |

[D-005: Tamil may remain `""` for internal pages.]

---

## Empty / error / loading states

### TransportList

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner | |
| Empty | `providers.length === 0` after load | Yes — pi-truck icon, message, add link | |
| Load failure | `catch` in `loadProviders` | **No** — `console.error` only | **P-002 gap.** |
| Delete failure | `catch` in `executeDelete` | **No** — `console.error` only | Modal closes silently; row remains. |

### TransportForm

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Form loading (edit) | `loading === true` | Yes — full-panel spinner | |
| Load failure (edit) | `catch` in `loadProvider` | Yes — `errors.general = 'Failed to load provider data'` | |
| Field validation error | `validate()` fails | Yes — `text-xs text-red-500` + input border | |
| Other backend error | `catch` in `handleSubmit` | **P-002:** `errors.general = detail \|\| 'Failed to save provider'` | Raw backend detail rendered |
| Save in progress | `saving === true` | Yes — spinner on button + disabled | |
| Success | `successMsg` set | Yes — emerald banner, 800ms then redirect | |

---

## Business rules

### TransportList

1. **Per-page fixed at 50.** Same as ClientList and FactoryList.
2. **Search resets page to 1.**
3. **Defensive total handling.** `totalItems.value = data.total || providers.value.length` — handles API responses that may not include a `total` field. [UNCLEAR: Does `GET /api/shipping/transport/` always return a `total` field, or does it vary?]
4. **Role display.** `roleLabelMap` maps role values to human labels; `roleColorMap` maps to Tailwind pill classes. Unknown role values fall back to `'bg-slate-100 text-slate-600'`.

### TransportForm

5. **Mode detection.** `isEdit = !!route.params.id`.
6. **Role selection required.** `validate()` fails with "Select at least one role" if `form.roles` is empty.
7. **`availableRoles` hardcoded.** 4 roles: `FREIGHT_FORWARDER` ("Freight Forwarder"), `CHA` ("CHA (Customs House Agent)"), `CFS` ("CFS (Container Freight Station)"), `TRANSPORT` ("Transport"). **P-015 candidate** — same pattern as FactoryForm's `commonPorts`.
8. **Role toggle.** `toggleRole(value)` splices the value out if present, pushes if absent. Uses `Array.splice` on `form.roles` — direct mutation of reactive array.
9. **Operating ports tag input.** `addPort()` splits `portInput` by comma, uppercases each, deduplicates against existing ports, then pushes. Enter key also triggers add. `removePort(port)` filters the array (immutable pattern).
10. **Empty string → null.** 12 optional string fields converted before submit: `contact_person`, `phone`, `email`, `address`, `city`, `state`, `bank_name`, `bank_account`, `ifsc_code`, `gst_number`, `pan_number`, `notes`. Note: `country` is NOT in the list (stays as `'India'` if unchanged). `operating_ports` stays as `[]` (not converted).
11. **Uppercase on submit.** `gst_number`, `pan_number`, `ifsc_code`.
12. **Edit pre-fill strategy.** Field-by-field assignment with `|| ''` / `|| []` fallbacks — null API values become `''` or `[]` (unlike ClientForm's null-preserve strategy).
13. **800ms success delay before redirect.**

---

## Known quirks

- **`Array.splice` direct mutation in `toggleRole`.** Calls `form.value.roles.splice(idx, 1)` — mutates the reactive array in place. Vue's reactivity system tracks array mutations, so this works, but it's inconsistent with the immutable pattern used in `removePort` (`form.value.operating_ports = form.value.operating_ports.filter(...)`).
- **No uniqueness check on provider name.** The backend does not appear to enforce name uniqueness for service providers. Two providers can share a name.
- **`country` not null-converted.** `country` is not in the `optionalFields` list, so it stays as `'India'` even if the user clears the input. Cleared input → empty string sent to backend.
- **Defensive `data.total || providers.value.length` in loadProviders.** The fallback hides potential API contract mismatches.
- **P-002:** General backend errors rendered raw.
- **D-003:** Delete modal has no typed confirmation guard.

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

- `INDIAN_STATES` imported from shared constant — good pattern.
- GSTIN and PAN regex (`TransportForm`) — also in `ClientForm.vue`. **P-016 candidate:** extract to `src/lib/validators.ts`.
- Empty-string → null loop — also in FactoryForm and ClientForm. **P-016 candidate:** shared utility.
- Pagination rendering logic — also in ClientList, ProductList, FactoryList. **P-016 candidate:** shared `<Pagination>` component.
- `roleLabelMap` and `roleColorMap` in `TransportList` are separate from `availableRoles` in `TransportForm`. They encode the same 4 roles with overlapping display info. **Migration:** unify into a single `SERVICE_PROVIDER_ROLES` constant in `src/lib/constants.ts`.

---

## Migration notes

1. **List → Server Component.** `app/transport/page.tsx` — fetch initial page server-side; `<TransportTable>` Client Component for interactivity.
2. **Form → two Next.js pages.** `app/transport/new/page.tsx` and `app/transport/[id]/edit/page.tsx`. Share a `<TransportFormFields>` component.
3. **Form library.** React Hook Form + Zod. Port 4 validation rules: name required, roles ≥ 1, email format, GSTIN regex, PAN regex.
4. **Role constant.** Define `SERVICE_PROVIDER_ROLES` in `src/lib/constants.ts` — replaces `availableRoles` in TransportForm and `roleLabelMap`/`roleColorMap` in TransportList. Eliminates P-015 hardcoding.
5. **Operating ports.** Free-text tag input — no backend enum. Keep as free-text in Next.js. Port the comma-split add and × remove pattern. Consider `useFieldArray` from React Hook Form.
6. **Fix `toggleRole` mutation.** Use immutable pattern: `form.roles = form.roles.includes(v) ? form.roles.filter(r => r !== v) : [...form.roles, v]`.
7. **Error states on list.** Add a user-visible error banner for load/delete failures (P-002 fix).
8. **Delete confirmation.** Consider typed confirmation for delete (D-003).
9. **Role-conditional rendering.** "Add Provider" and edit/delete actions should be gated per `hasPermission(user, 'manage_transport')` — backend already patched (G-014 CLOSED, Patch 13).
10. **Shared validators.** Extract GSTIN, PAN, email regex to `src/lib/validators.ts`.
11. **[UNCLEAR: transport API total field]** Verify whether `GET /api/shipping/transport/` always returns `{ items: [], total: N }` or sometimes returns a bare array. Resolve before migrating the list component.
12. **D-001:** `transportApi.*` → `client.transport.*` via generated SDK.
13. **D-005:** All `InternalString` entries; Tamil can remain `""`.
