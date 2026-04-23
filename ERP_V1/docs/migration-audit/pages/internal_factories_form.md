# Internal Factories Form (New / Edit)

**Type:** page (shared form — two modes)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Routes:**
- `/factories/new` → `FactoryNew` (meta.title: `'New Factory'`, meta.parent: `'FactoryList'`)
- `/factories/:id/edit` → `FactoryEdit` (meta.title: `'Edit Factory'`, meta.parent: `'FactoryList'`, props: true)
**Vue file:** [frontend/src/views/factories/FactoryForm.vue](../../../frontend/src/views/factories/FactoryForm.vue)
**Line count:** 437
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low (backend mutations now guarded — G-012 CLOSED 2026-04-22)

---

## Purpose

Shared factory/supplier registration form used for creating a new factory and editing an existing one; detects mode from route params and converts empty optional fields to null before submission.

---

## Layout

### Outer container
`max-w-4xl` (wider than ProductForm's `max-w-3xl`)

**Page header** (`flex items-center gap-3 mb-6`)
- Left: back arrow button → `handleCancel()` → `/factories`
- Title: "Edit Factory" / "New Factory" (h2)
- Subtitle: "Update factory/supplier details" / "Register a new factory/supplier"

**Loading state** (`v-if="loading"`) — full-panel spinner "Loading factory..." shown while fetching in edit mode; form hidden

**Form body** (`<form @submit.prevent="handleSubmit" class="space-y-6">`)

**Section 1 — Company Information** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-building icon "COMPANY INFORMATION"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `factory_code` | Factory Code * | `<input type="text">` | Required. Placeholder "FAC-001". Validated non-empty. |
| `company_name` | Company Name * | `<input type="text">` | Required. Validated non-empty. |
| `company_name_chinese` | Chinese Name | `<input type="text">` | Optional. |
| `country` | Country | `<input type="text">` | Optional. Default: `'China'`. |

**Section 2 — Address & Shipping** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-map-marker icon "ADDRESS & SHIPPING"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `address` | Address | `<input type="text">` | Optional. `md:col-span-2`. |
| `city` | City | `<input type="text">` | Optional. |
| `province` | Province | `<input type="text">` | Optional. |
| `port_of_loading` | Port of Loading | `<select>` | Optional. Hardcoded list of 10 Chinese ports (see Business Rules). Helper text: "Used to estimate transit times". |
| `quality_rating` | Quality Rating | `<select>` | Optional. Values: null, 1–5 with label. Validated ≤ 5 if set. |

**Section 3 — Primary Contact** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-user icon "PRIMARY CONTACT"
Grid: 2 columns

| Field | Label | Input | Notes |
|---|---|---|---|
| `primary_contact_name` | Contact Name | `<input type="text">` | Optional. |
| `primary_contact_phone` | Phone | `<input type="text">` | Optional. Placeholder "+86 xxx xxxx xxxx". |
| `primary_contact_wechat` | WeChat | `<input type="text">` | Optional. |
| `primary_contact_email` | Email | `<input type="email">` | Optional. |

**Section 4 — Bank Details** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-wallet icon "BANK DETAILS (FOR PAYMENTS)"
Grid: 3 columns

| Field | Label | Input |
|---|---|---|
| `bank_name` | Bank Name | `<input type="text">` |
| `bank_account` | Account Number | `<input type="text">` |
| `bank_swift` | SWIFT Code | `<input type="text">` |

**Section 5 — Notes** (`bg-white rounded-xl shadow-sm p-6`)
Header: pi-file-edit icon "NOTES"
- `notes`: `<textarea rows="3">` — Optional.

**Action Buttons** (bottom, `justify-end`)
- "Cancel" button → `handleCancel()` → `/factories`
- "Create Factory" / "Update Factory" submit button (pi-check / pi-spin during save)

**Success banner** (`v-if="successMsg"`) — emerald, pi-check-circle, shown after successful save before redirect.
**Error banner** (`v-if="errors.general"`) — red, pi-exclamation-circle.

---

## Data displayed

In edit mode, the form is pre-filled from `factoriesApi.get(id)`. Only fields defined in `form` ref keys are written; undefined/null values from the API are left at their defaults.

No pricing fields (`factory_price`, `*_cny`, `markup_*`) appear anywhere. P-007 checklist clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (edit) | `loadFactory()` | `GET /api/factories/{id}/` | Pre-fills form |
| Page mount (new) | nothing | — | Form starts empty |
| Submit (new) | `handleSubmit()` + `validate()` | `POST /api/factories/` | Creates factory; redirects to `/factories` after 800ms |
| Submit (edit) | `handleSubmit()` + `validate()` | `PUT /api/factories/{id}/` | Updates factory; redirects after 800ms |
| Cancel button | `handleCancel()` | — | Navigate to `/factories` |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Via | Mode | Notes |
|---|---|---|---|---|
| GET | `/api/factories/{id}/` | `factoriesApi.get(id)` | Edit | Pre-fills form |
| POST | `/api/factories/` | `factoriesApi.create(payload)` | New | **G-012 CLOSED** — requires INTERNAL + ADMIN\|SUPER_ADMIN |
| PUT | `/api/factories/{id}/` | `factoriesApi.update(id, payload)` | Edit | **G-012 CLOSED** — requires INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN |

> Per D-001 (Option B): in Next.js these become `client.factories.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRoute()` and `useRouter()` inline.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-arrow-left`, `pi-building`, `pi-map-marker`, `pi-user`, `pi-wallet`, `pi-file-edit`, `pi-check`, `pi-spin pi-spinner`, `pi-check-circle`, `pi-exclamation-circle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | `ref(false)` | false | Page-level loading while fetching in edit mode |
| `saving` | `ref(false)` | false | Submit button loading state |
| `errors` | `ref({})` | `{}` | Field-level + general errors (`factory_code`, `company_name`, `quality_rating`, `general`) |
| `successMsg` | `ref('')` | `''` | Success banner text after save |
| `form` | `ref({...})` | See below | Bound to all 17 form fields |
| `isEdit` | `computed` | — | `!!route.params.id` |
| `factoryId` | `computed` | — | `route.params.id` |
| `commonPorts` | `const []` | hardcoded | 10 Chinese port names for dropdown (see Business Rules) |

**`form` ref — all 17 fields with initial values:**
```
factory_code: '', company_name: '', company_name_chinese: '',
address: '', city: '', province: '', country: 'China',
port_of_loading: '',
primary_contact_name: '', primary_contact_phone: '',
primary_contact_wechat: '', primary_contact_email: '',
bank_name: '', bank_account: '', bank_swift: '',
quality_rating: null, notes: ''
```

---

## Permissions / role gating

- Routes `/factories/new` and `/factories/:id/edit` have **no `meta.roles`** — all INTERNAL users can navigate to these pages in the Vue app.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal entirely.
- **Backend (G-012 CLOSED):** `POST /api/factories/` requires INTERNAL + ADMIN|SUPER_ADMIN; `PUT /api/factories/{id}/` requires INTERNAL + ADMIN|OPERATIONS|SUPER_ADMIN.
- **Migration note:** In Next.js, the form page should be server-rendered with a `hasPermission(user, 'manage_factories')` check per D-004. OPERATIONS users can reach the edit form; only ADMIN/SUPER_ADMIN reach the new form. Render the "Create Factory" button on the list page conditionally.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.factory_form.title_new` | "New Factory" | "" | `InternalString` |
| `internal.factory_form.title_edit` | "Edit Factory" | "" | `InternalString` |
| `internal.factory_form.section_company` | "Company Information" | "" | `InternalString` |
| `internal.factory_form.section_address` | "Address & Shipping" | "" | `InternalString` |
| `internal.factory_form.section_contact` | "Primary Contact" | "" | `InternalString` |
| `internal.factory_form.section_bank` | "Bank Details" | "" | `InternalString` |
| `internal.factory_form.section_notes` | "Notes" | "" | `InternalString` |
| `internal.factory_form.btn_cancel` | "Cancel" | "" | `InternalString` |
| `internal.factory_form.btn_create` | "Create Factory" | "" | `InternalString` |
| `internal.factory_form.btn_update` | "Update Factory" | "" | `InternalString` |

[D-005: Tamil may remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Form loading (edit) | `loading === true` | Yes — full-panel spinner "Loading factory..." | Form hidden while loading |
| Load failure (edit) | `catch` in `loadFactory` | Yes — `errors.general = 'Failed to load factory data'` | Form shown empty with error banner |
| Field validation error | `validate()` fails | Yes — `text-xs text-red-500` below field; `border-red-300 bg-red-50` on input | Client-side only |
| Factory code conflict | `detail === 'Factory code already exists'` | Yes — shown as field error on `factory_code` | Backend 400, not the general banner |
| Other backend error | `catch` in `handleSubmit` | **P-002:** `errors.general = detail \|\| 'Failed to save factory'` | Raw backend `detail` rendered |
| Save in progress | `saving === true` | Yes — spinner on button + disabled | |
| Success | `successMsg` set | Yes — emerald banner (brief, before redirect) | 800ms delay then push to `/factories` |

---

## Business rules

1. **Mode detection.** `isEdit = !!route.params.id`. New: neither. Both mount the same component.
2. **Empty string → null normalization.** 13 optional fields are converted from `''` to `null` before submission: `company_name_chinese`, `address`, `city`, `province`, `port_of_loading`, all four contact fields, all three bank fields, `notes`.
3. **Quality rating coercion.** `quality_rating === '' || === 0` → `null`. Otherwise parsed as `parseInt`.
4. **Port of loading is a hardcoded local dropdown** — not loaded from the backend. 10 values: Shanghai, Ningbo, Guangzhou, Shenzhen, Qingdao, Tianjin, Xiamen, Dalian, Fuzhou, Lianyungang. A factory in a different port has no way to enter it in this UI — it would send `port_of_loading: null` since the field would not match any option.
5. **Factory code uniqueness.** Enforced by the backend (400 "Factory code already exists"). The error is surfaced as a field-level error, not the general banner.
6. **800ms success delay before redirect.** Same pattern as ProductForm.

---

## Known quirks

- **Hardcoded port list.** `commonPorts` is a 10-element array in the component. A factory in a non-listed Chinese port (e.g. Nantong, Zhanjiang) cannot be accurately registered — the field will be left blank. No free-text fallback.
- **No uniqueness check on company_name.** The backend enforces uniqueness on `factory_code` but not `company_name`. Two factories can share a company name.
- **`quality_rating` bind quirk.** Uses `v-model.number` but then still calls `parseInt` in submit logic. If the select returns a numeric value, the parseInt is redundant; if it returns a string `"null"` it would produce `NaN` — mitigated by the `=== null` guard first.
- **P-002:** General backend errors rendered raw to the user.

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

- `commonPorts` array (hardcoded in component) — same set of Chinese ports likely relevant elsewhere (e.g. shipping/booking forms). **P-015 candidate:** drives option lists from backend enums or a shared config in Next.js.

---

## Migration notes

1. **Two routes, one component → two distinct Next.js pages.** `app/factories/new/page.tsx` and `app/factories/[id]/edit/page.tsx`. Share a `<FactoryFormFields>` component for the field sections.
2. **Form library.** React Hook Form + Zod. Port the 3 client-side validation rules: `factory_code` required, `company_name` required, `quality_rating` in [1–5] if set.
3. **Port dropdown.** Drive from a backend enum or a shared `CHINESE_PORTS` constant in `src/lib/constants.ts` — not hardcoded in the component. Consider adding a free-text fallback `<input>` for ports not in the list.
4. **Role-conditional rendering.** "Create Factory" button visible only when `hasPermission(user, 'manage_factories')`. Edit page accessible to ADMIN + OPERATIONS; new page to ADMIN + SUPER_ADMIN only (per G-012 guard shape).
5. **Remove `quality_rating` parseInt call.** With Zod schema validation and a `z.number().int().min(1).max(5).nullable()` type, the parseInt is unnecessary.
6. **D-001:** `factoriesApi.*` → `client.factories.*` via generated SDK.
7. **D-005:** All `InternalString` entries; Tamil can remain `""`.
