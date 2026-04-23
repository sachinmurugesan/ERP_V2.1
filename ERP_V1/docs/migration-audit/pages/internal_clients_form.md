# Internal Clients Form (New / Edit)

**Type:** page (shared form — two modes)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Routes:**
- `/clients/new` → `ClientNew` (meta.title: `'New Client'`, meta.parent: `'ClientList'`)
- `/clients/:id/edit` → `ClientEdit` (meta.title: `'Edit Client'`, meta.parent: `'ClientList'`, props: true)
**Vue file:** [frontend/src/views/clients/ClientForm.vue](../../../frontend/src/views/clients/ClientForm.vue)
**Line count:** 443
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-013 CLOSED 2026-04-22 (Patch 12); Transparency Pricing fields remain editable by any INTERNAL user (no frontend role gate)

---

## Purpose

Shared client/buyer registration form for creating or editing client records (mode detected from route params), including a Transparency Pricing section with editable margin percentages that is currently not role-gated on frontend or backend.

---

## Layout

### Outer container
`max-w-4xl`

**Page header** (`flex items-center gap-3 mb-6`)
- Left: back arrow button → `handleCancel()` → `/clients`
- Title: "Edit Client" / "New Client" (h2)
- Subtitle: "Update client details" / "Register a new client/buyer"

**Loading state** (`v-if="loading"`) — full-panel spinner "Loading client..." shown while fetching in edit mode; form hidden

**Form body** (`<form @submit.prevent="handleSubmit" class="space-y-6">`)

**Success / Error banners** — shown at top of form (above sections)
- Success: emerald-50, pi-check-circle
- General error: red-50, pi-exclamation-circle

**Section 1 — Company Information** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-users icon "COMPANY INFORMATION"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `company_name` | Company Name * | `<input type="text">` | Required. `md:col-span-2`. Placeholder "Client company name". |
| `gstin` | GSTIN | `<input type="text" maxlength="15">` | Optional. `font-mono uppercase`. Placeholder "e.g. 27AAPFU0939F1ZV". Validated if provided. |
| `iec` | IEC (Import Export Code) | `<input type="text" maxlength="10">` | Optional. `font-mono uppercase`. Placeholder "e.g. 0305XXXXXX". No format validation. |
| `pan` | PAN | `<input type="text" maxlength="10">` | Optional. `font-mono uppercase`. Placeholder "e.g. AAPFU0939F". Validated if provided. |

**Section 2 — Address** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-map-marker icon "ADDRESS"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `address` | Street Address | `<input type="text">` | Optional. `md:col-span-2`. |
| `city` | City | `<input type="text">` | Optional. Placeholder "e.g. Mumbai, Delhi". |
| `state` | State | `<select>` | Optional. Options from `INDIAN_STATES` (imported constant). |
| `pincode` | Pincode | `<input type="text" maxlength="6">` | Optional. Validated: must be exactly 6 digits if provided. |

**Section 3 — Contact Person** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-user icon "CONTACT PERSON"
Grid: 3 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `contact_name` | Name | `<input type="text">` | Optional. |
| `contact_phone` | Phone | `<input type="text">` | Optional. Placeholder "+91 xxx xxx xxxx". |
| `contact_email` | Email | `<input type="email">` | Optional. Validated: basic email regex if provided. |

**Section 4 — Notes** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-file-edit icon "NOTES"
- `notes`: `<textarea rows="3">` — Optional.

**Section 5 — Transparency Pricing Settings** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-eye icon "TRANSPARENCY PRICING SETTINGS"

| Field | Label | Input | Notes |
|---|---|---|---|
| `client_type` | Client Type | `<select>` | Options: `REGULAR` ("Regular — Standard selling price model"), `TRANSPARENCY` ("Transparency — Marked-up factory price + expense breakdown"). Default: `REGULAR`. |
| `factory_markup_percent` | Factory Markup % | `<input type="number" step="0.01" min="0" max="100">` | Shown only when `client_type === 'TRANSPARENCY'`. `v-model.number`. Helper: "Hidden markup on real factory price." |
| `sourcing_commission_percent` | Sourcing Commission % | `<input type="number" step="0.01" min="0" max="100">` | Shown only when `client_type === 'TRANSPARENCY'`. `v-model.number`. Helper: "Visible commission on the marked-up invoice value." |

The Transparency fields appear inside an `indigo-50` card with `border-indigo-100` — visually distinguished but **not role-gated**.

**Action Buttons** (bottom, `justify-end`)
- "Cancel" button → `handleCancel()` → `/clients`
- "Create Client" / "Update Client" submit button (pi-check / pi-spin during save)

---

## Data displayed

In edit mode, form is pre-filled from `clientsApi.get(id)`. Uses `Object.keys(form.value).forEach(key => { if (data[key] !== undefined && data[key] !== null) { form.value[key] = data[key] } })` — only non-null API values overwrite form defaults. Null API values leave form fields at their initial defaults (`null` for markup/commission, `''` for strings, `'REGULAR'` for client_type).

> **Security note:** `factory_markup_percent` and `sourcing_commission_percent` are loaded from the API and displayed as editable inputs for any INTERNAL user regardless of role. These are sensitive margin parameters. **G-013 CLOSED (Patch 12)** — backend now enforces ADMIN|OPERATIONS|SUPER_ADMIN; the migration must also add frontend role-gating.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (edit) | `loadClient()` | `GET /api/clients/{id}/` | Pre-fills form |
| Page mount (new) | nothing | — | Form starts at defaults |
| Submit (new) | `handleSubmit()` + `validate()` | `POST /api/clients/` | Creates client; redirects to `/clients` after 800ms |
| Submit (edit) | `handleSubmit()` + `validate()` | `PUT /api/clients/{id}/` | Updates client; redirects after 800ms |
| Cancel button | `handleCancel()` | — | Navigate to `/clients` |
| `client_type` toggle | `v-if="form.client_type === 'TRANSPARENCY'"` | — | Shows/hides markup/commission fields |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Mode | Notes |
|---|---|---|---|---|
| GET | `/api/clients/{id}/` | `clientsApi.get(id)` | Edit | Pre-fills form |
| POST | `/api/clients/` | `clientsApi.create(payload)` | New | **G-013 CLOSED (Patch 12)** — ADMIN|OPERATIONS|SUPER_ADMIN only |
| PUT | `/api/clients/{id}/` | `clientsApi.update(id, payload)` | Edit | **G-013 CLOSED (Patch 12)** — ADMIN|OPERATIONS|SUPER_ADMIN only; markup_lock enforced server-side |

> Per D-001 (Option B): in Next.js these become `client.clients.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRoute()` and `useRouter()` inline. `INDIAN_STATES` imported from `../../utils/constants`.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-arrow-left`, `pi-users`, `pi-map-marker`, `pi-user`, `pi-file-edit`, `pi-eye`, `pi-check`, `pi-spin pi-spinner`, `pi-check-circle`, `pi-exclamation-circle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(false)` | false | Page-level loading in edit mode |
| `saving` | `ref(false)` | false | Submit button loading state |
| `errors` | `ref({})` | `{}` | Field-level + general errors |
| `successMsg` | `ref('')` | `''` | Success banner text |
| `form` | `ref({...})` | See below | Bound to all 15 form fields |
| `isEdit` | `computed` | — | `!!route.params.id` |
| `clientId` | `computed` | — | `route.params.id` |

**`form` ref — all 15 fields with initial values:**
```
company_name: '', gstin: '', iec: '', pan: '',
address: '', city: '', state: '', pincode: '',
contact_name: '', contact_phone: '', contact_email: '',
notes: '',
client_type: 'REGULAR',
factory_markup_percent: null, sourcing_commission_percent: null
```

---

## Permissions / role gating

- Routes `/clients/new` and `/clients/:id/edit` have **no `meta.roles`** — all INTERNAL users can navigate.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal entirely.
- **Transparency Pricing section is shown to all INTERNAL users** — no frontend role check. Any OPERATIONS or FINANCE user can edit `factory_markup_percent` and `sourcing_commission_percent`.
- **Backend (G-013 CLOSED, Patch 12):** `POST /api/clients/`, `PUT /api/clients/{id}/`, and `DELETE /api/clients/{id}/` now enforce ADMIN|OPERATIONS|SUPER_ADMIN role. Markup lock remains server-side.
- **Markup lock (backend, server-side only):** `update_client` blocks changes to `factory_markup_percent` or `client_type` (TRANSPARENCY → REGULAR downgrade) when the client has active orders in progress (PENDING_PI through DELIVERED). Returns HTTP 400 "Cannot change markup or client type while orders are in progress." This is a data-integrity guard, not a role-auth guard.
- **Migration note:** In Next.js:
  - Gate `/clients/new` to ADMIN|SUPER_ADMIN.
  - Gate `/clients/:id/edit` to ADMIN|OPERATIONS|SUPER_ADMIN.
  - The Transparency Pricing section should only render when `hasPermission(user, 'manage_client_pricing')` — restrict to ADMIN|SUPER_ADMIN.
  - Backend already patched per G-013 (Patch 12); frontend role-gating still needed.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.client_form.title_new` | "New Client" | "" | `InternalString` |
| `internal.client_form.title_edit` | "Edit Client" | "" | `InternalString` |
| `internal.client_form.section_company` | "Company Information" | "" | `InternalString` |
| `internal.client_form.section_address` | "Address" | "" | `InternalString` |
| `internal.client_form.section_contact` | "Contact Person" | "" | `InternalString` |
| `internal.client_form.section_notes` | "Notes" | "" | `InternalString` |
| `internal.client_form.section_pricing` | "Transparency Pricing Settings" | "" | `InternalString` |
| `internal.client_form.btn_cancel` | "Cancel" | "" | `InternalString` |
| `internal.client_form.btn_create` | "Create Client" | "" | `InternalString` |
| `internal.client_form.btn_update` | "Update Client" | "" | `InternalString` |

[D-005: Tamil may remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Form loading (edit) | `loading === true` | Yes — full-panel spinner "Loading client..." | Form hidden while loading |
| Load failure (edit) | `catch` in `loadClient` | Yes — `errors.general = 'Failed to load client data'` | Form shown empty with error banner |
| Field validation error | `validate()` fails | Yes — `text-xs text-red-500` below field; `border-red-300 bg-red-50` on input | Client-side only |
| Company name conflict | `detail === 'Client company name already exists'` | Yes — shown as field error on `company_name` | Backend 400, not general banner |
| Markup lock conflict | `detail === 'Cannot change markup...'` | Yes — shown in general error banner | Backend 400 during update |
| Other backend error | `catch` in `handleSubmit` | **P-002:** `errors.general = detail \|\| 'Failed to save client'` | Raw backend `detail` rendered |
| Save in progress | `saving === true` | Yes — spinner on button + disabled | |
| Success | `successMsg` set | Yes — emerald banner (brief, before redirect) | 800ms delay then push to `/clients` |

---

## Business rules

1. **Mode detection.** `isEdit = !!route.params.id`. Both modes mount the same component.
2. **Empty string → null normalization.** 11 optional fields are converted from `''` to `null` before submission: `gstin`, `iec`, `pan`, `address`, `city`, `state`, `pincode`, `contact_name`, `contact_phone`, `contact_email`, `notes`. Note: `factory_markup_percent` and `sourcing_commission_percent` use `v-model.number` and start as `null`; they are NOT in the null-conversion list.
3. **Uppercase normalization on submit.** `gstin`, `pan`, and `iec` are uppercased before submission.
4. **GSTIN validation.** 15-char regex: `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/`. Validated against the uppercased value. Optional — only fires if field is non-empty.
5. **PAN validation.** 10-char regex: `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/`. Optional.
6. **Pincode validation.** 6-digit numeric: `/^[0-9]{6}$/`. Optional.
7. **Email validation.** Basic regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Optional.
8. **IEC not validated.** The IEC field has `maxlength="10"` and is uppercased on submit but has no format regex. [UNCLEAR: Is the IEC format validated on the backend?]
9. **Transparency Pricing visibility.** `factory_markup_percent` and `sourcing_commission_percent` inputs only appear when `client_type === 'TRANSPARENCY'`. If a user switches back to REGULAR, the inputs are hidden but the values remain in `form` state and will still be submitted.
10. **Markup lock (backend).** Changing `factory_markup_percent` (to any different non-null value) or downgrading `client_type` from TRANSPARENCY → REGULAR is blocked if the client has any order in a locked stage (PENDING_PI through DELIVERED). Returns 400.
11. **Edit pre-fill strategy.** Uses `Object.keys(form.value).forEach(key => { if (data[key] !== undefined && data[key] !== null) { form.value[key] = data[key] } })` — null API values are NOT written; the field keeps its form default. This means a client with `factory_markup_percent: null` will show `null` (empty number input) in edit mode, which is correct.
12. **800ms success delay before redirect.** Same pattern as ProductForm and FactoryForm.

---

## Known quirks

- **Transparency fields submitted even when hidden.** If `client_type` is REGULAR, `factory_markup_percent` and `sourcing_commission_percent` are hidden in the UI but their values (null) are still included in the payload. This is harmless for new clients but could accidentally overwrite markup values when a user edits a TRANSPARENCY client and switches the select to REGULAR then back.
- **IEC not format-validated client-side.** The field accepts any 10-char string; no checksum or format check.
- **`state` not validated.** The select is populated from `INDIAN_STATES` so free-text entry is not possible, but the field can be left at the empty `""` value which is converted to `null` on submit.
- **P-002:** General backend errors rendered raw to the user.
- **Markup fields visible to all INTERNAL roles.** No frontend role check on the Transparency Pricing section.

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

- `INDIAN_STATES` imported from `../../utils/constants` — shared with `TransportForm.vue`. Good pattern already established.
- GSTIN and PAN regex patterns are duplicated between `ClientForm.vue` and `TransportForm.vue` (both validate GSTIN and PAN for their respective entities). **P-016 candidate:** extract to a shared `src/lib/validators.ts`.
- Empty-string → null normalization loop (`optionalFields.forEach`) is copy-pasted across FactoryForm, ClientForm, TransportForm. **P-016 candidate:** extract to `nullifyEmptyStrings(obj, keys)` utility.

---

## Migration notes

1. **Two routes, one component → two Next.js pages.** `app/clients/new/page.tsx` and `app/clients/[id]/edit/page.tsx`. Share a `<ClientFormFields>` component.
2. **Form library.** React Hook Form + Zod. Port 5 client-side validation rules: company_name required, GSTIN regex, PAN regex, email format, pincode 6-digit.
3. **Zod schema for markup fields.** `factory_markup_percent: z.number().min(0).max(100).nullable()`, `sourcing_commission_percent: z.number().min(0).max(100).nullable()`.
4. **Role-conditional rendering.** Transparency Pricing section should only render for ADMIN|SUPER_ADMIN (`hasPermission(user, 'manage_client_pricing')`). Gate the new client page to ADMIN|SUPER_ADMIN; edit page to ADMIN|OPERATIONS|SUPER_ADMIN.
5. **Markup lock UX.** The backend returns a 400 with a clear message — surface it as a field-level error on `factory_markup_percent`, not just the general banner.
6. **IEC validation.** Consider adding a format check for the IEC code (10-digit numeric starting with 0–9).
7. **Transparency fields on type change.** When `client_type` switches from TRANSPARENCY to REGULAR, reset `factory_markup_percent` and `sourcing_commission_percent` to `null` to avoid stale values in payload.
8. **Shared validators.** Extract GSTIN, PAN, and email regexes to `src/lib/validators.ts` — reused in ClientForm and TransportForm.
9. **D-001:** `clientsApi.*` → `client.clients.*` via generated SDK.
10. **D-005:** All `InternalString` entries; Tamil can remain `""`.
