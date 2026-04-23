# Internal Factories List

**Type:** page (list with delete)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/factories` → `FactoryList` (meta.title: `'Factories'`, meta.icon: `'pi-building'`)
**Vue file:** [frontend/src/views/factories/FactoryList.vue](../../../frontend/src/views/factories/FactoryList.vue)
**Line count:** 318
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-012 CLOSED 2026-04-22 (Patch 11): inline role enforcement added to all factory mutation endpoints

---

## Purpose

Paginated, searchable list of registered factories with quality star ratings, server-side pagination, and a single-factory delete confirmation flow; navigates to a separate form for create and edit.

---

## Layout

### Outer container
`max-w-6xl mx-auto p-4 md:p-6`

**Zone 1 — Page header**
- `h1` "Factories"
- Right: "+ Add Factory" button → `/factories/new`

**Zone 2 — Search bar** (`bg-white rounded-xl shadow-sm p-4 mb-4`)
- `<input>` with pi-search icon — 400ms debounce → `loadFactories()`
- Placeholder: "Search factories..."

**Zone 3 — Factory table** (`bg-white rounded-xl shadow-sm overflow-hidden`)

**Loading state:** centred spinner + "Loading factories..."

**Empty state:** pi-building icon + "No factories found"

**Table header** (`bg-slate-50 border-b`):

| Col | Header |
|---|---|
| 1 | Code |
| 2 | Company Name |
| 3 | Location |
| 4 | Port of Loading |
| 5 | Contact |
| 6 | Quality |
| 7 | Actions |

**Table rows:**

| Col | Content | Format |
|---|---|---|
| 1 | `factory.factory_code` | font-mono text-sm text-teal-700 |
| 2 | `factory.company_name` + `factory.company_name_chinese` sub-label | name in bold; Chinese name as text-xs text-slate-400 below |
| 3 | `factory.city` + `factory.province` + `factory.country` | city+province comma-joined; country on second line text-xs text-slate-400 |
| 4 | `factory.port_of_loading` | teal-50 badge or `—` if absent |
| 5 | `factory.primary_contact_name` + `factory.primary_contact_phone` | name bold; phone as text-xs text-slate-400 below |
| 6 | Quality stars — 1–5 filled/empty pi-star-fill / pi-star | amber-400 filled stars, slate-200 empty stars; numerical value not shown |
| 7 | Edit icon → `/factories/{id}/edit`; Delete icon → `confirmDelete(factory)` |

**Zone 4 — Pagination** (shown when `totalPages > 1`)
- "Showing X–Y of Z factories"
- Smart page buttons: first, last, current±1, ellipsis at ±2 gaps
- Previous / Next chevron buttons (disabled at boundaries)

**Delete Confirmation Modal** (`showDeleteConfirm`):
- `pi-exclamation-triangle` icon + "Delete Factory"
- Shows `factory.factory_code — factory.company_name`
- Cancel / Delete buttons → `executeDelete()` → `factoriesApi.delete(id)`

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `factory_code` | `factoriesApi.list()` | font-mono teal-700 | Unique factory identifier |
| `company_name` | `factoriesApi.list()` | bold | Primary display name |
| `company_name_chinese` | `factoriesApi.list()` | text-xs slate-400 sub-label | Optional; shown below English name |
| `city`, `province` | `factoriesApi.list()` | "city, province" | Comma-joined; either may be absent |
| `country` | `factoriesApi.list()` | text-xs slate-400 | Below city/province |
| `port_of_loading` | `factoriesApi.list()` | teal-50 badge | Shown as `—` if absent |
| `primary_contact_name` | `factoriesApi.list()` | bold | |
| `primary_contact_phone` | `factoriesApi.list()` | text-xs slate-400 | Below name |
| `quality_rating` | `factoriesApi.list()` | 5-star visual | Integer 1–5; filled stars = rating; empty stars = 5 − rating |

**P-007 checklist:** No `*_cny`, `factory_price`, or `markup_*` fields observed in `FactoryOut` responses — serializer returns only identity, location, contact, and quality data. Clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadFactories()` | `GET /api/factories/?page=1&per_page=50` | Populates `factories` |
| Search input (400ms debounce) | `loadFactories()` | `GET /api/factories/?search=...` | Filters results |
| Pagination prev/next/page | `goToPage(n)` | `GET /api/factories/?page=n` | Changes page |
| "+ Add Factory" button | navigate | none | `/factories/new` |
| Edit icon | navigate | none | `/factories/{id}/edit` |
| Delete icon | `confirmDelete(factory)` | none | Opens delete confirmation modal |
| Delete confirm | `executeDelete()` | `DELETE /api/factories/{id}/` | Removes factory; reloads list |
| Delete cancel | close modal | none | Clears `deleteTarget` |

---

## Modals/dialogs triggered

| Modal | Trigger | Purpose |
|---|---|---|
| Delete Confirmation | Delete trash icon on row | Confirm single factory deletion |

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/factories/` | `factoriesApi.list()` | `page`, `per_page=50`, `search` | Returns `{items, total, page, per_page, pages}` |
| DELETE | `/api/factories/{id}/` | `factoriesApi.delete(id)` | — | Soft delete (sets `deleted_at` + `is_active=False`; no restore UI). **G-012 CLOSED (Patch 11)** |

> Per D-001 (Option B): in Next.js these become `client.factories.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline for navigation.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-building`, `pi-spinner pi-spin`, `pi-search`, `pi-star-fill`, `pi-star`, `pi-pencil`, `pi-trash`, `pi-exclamation-triangle`, `pi-chevron-left`, `pi-chevron-right`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `factories` | `ref([])` | `[]` | Current page of factory records |
| `loading` | `ref(true)` | `true` | Gates loading spinner |
| `search` | `ref('')` | `''` | Search input (400ms debounced) |
| `page` | `ref(1)` | `1` | Current page |
| `perPage` | `ref(50)` | `50` | Items per page (fixed — no UI to change) |
| `totalItems` | `ref(0)` | `0` | Total factory count from API |
| `showDeleteConfirm` | `ref(false)` | `false` | Delete modal visibility |
| `deleteTarget` | `ref(null)` | `null` | Factory object pending deletion |

**Computed:**
| Name | Derived from | Purpose |
|---|---|---|
| `totalPages` | `ceil(totalItems / perPage)` | Controls pagination visibility |

No `watch`, no `onUnmounted`.

---

## Permissions / role gating

- Route `/factories` has **no `meta.roles`** — all INTERNAL users reach this page.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- **Backend: G-012 CLOSED (Patch 11, 2026-04-22).** The factories router now has inline role enforcement on all mutation endpoints: `create_factory`, `update_factory`, `delete_factory` require `require_role(["ADMIN", "OPERATIONS"])`. CLIENT and FACTORY tokens are rejected with HTTP 403. `list_factories` remains auth-only — all INTERNAL users may view the factory list.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.factories.title` | "Factories" | "" | `InternalString` |
| `internal.factories.add_factory` | "+ Add Factory" | "" | `InternalString` |
| `internal.factories.search_placeholder` | "Search factories..." | "" | `InternalString` |
| `internal.factories.loading` | "Loading factories..." | "" | `InternalString` |
| `internal.factories.empty` | "No factories found" | "" | `InternalString` |
| `internal.factories.col_code` | "Code" | "" | `InternalString` |
| `internal.factories.col_company` | "Company Name" | "" | `InternalString` |
| `internal.factories.col_location` | "Location" | "" | `InternalString` |
| `internal.factories.col_port` | "Port of Loading" | "" | `InternalString` |
| `internal.factories.col_contact` | "Contact" | "" | `InternalString` |
| `internal.factories.col_quality` | "Quality" | "" | `InternalString` |
| `internal.factories.col_actions` | "Actions" | "" | `InternalString` |
| `internal.factories.delete_title` | "Delete Factory" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — centred spinner + "Loading factories..." | |
| Empty | `factories.length === 0 && !loading` | Yes — pi-building icon + "No factories found" | |
| Load error | `catch (e)` in `loadFactories()` | **No — P-002 (swallow variant):** `console.error` only; `factories = []`; empty state shown | No user-visible error state |
| Delete error | `catch (e)` in `executeDelete()` | **No — P-002 (swallow variant):** `console.error` only; modal closes; list not reloaded | Silent failure — user sees no confirmation of error |

---

## Business rules

1. **Factory delete is soft (no restore UI).** `DELETE /api/factories/{id}/` sets `deleted_at` and `is_active=False`; the record is hidden but not permanently destroyed. There is no Bin view — no UI to restore a deleted factory.
2. **`perPage` is fixed at 50.** There is no per-page selector. A deployment with >50 factories requires pagination navigation; there is no option to see all on one page.
3. **Quality rating display is visual only.** The numeric `quality_rating` value is not shown in text — only the star icons convey the rating. Screen reader accessibility is not addressed.
4. **Search is server-side.** The `search` param is sent to the backend; there is no client-side filtering of the current page.

---

## Known quirks

- **No user-visible error state on load failure.** `loadFactories()` catches errors with `console.error` only. A network failure or 5xx shows the same "No factories found" empty state as a genuinely empty database. User has no way to distinguish failure from empty.
- **Delete error silently discarded.** If `DELETE /api/factories/{id}/` returns an error (e.g., factory has linked orders), the modal closes with no feedback. The list may or may not have changed. No P-002 toast or alert is shown.
- **Delete confirmation does not clarify soft-delete outcome.** The modal says "Delete Factory" but does not indicate that there is no Bin or restore UI — unlike the product delete flow which shows the Bin.
- **Star ratings not annotated for accessibility.** The 5-star display uses only visual icons with no `aria-label` or numeric fallback.

---

## Dead code / unused state

None observed — all refs used in the template.

---

## Duplicate or inline utilities

None observed. Quality star rendering (`v-for n in 5` with conditional icon class) is inline but simple enough to not warrant extraction.

---

## Migration notes

1. **Backend role enforcement: G-012 CLOSED (Patch 11, 2026-04-22).** `POST /api/factories/`, `PUT /api/factories/{id}/`, `DELETE /api/factories/{id}/` now enforce `require_role(["ADMIN", "OPERATIONS"])`. `list_factories` remains auth-only — no action required before migration.
2. **Add error toast on load and delete failure.** Replace `console.error` with a toast notification per P-002 pattern.
3. **Warn that delete is permanent.** Update the delete confirmation modal copy to state "This cannot be undone" — unlike the product delete which has a bin.
4. **Factory soft-delete already in place (confirmed).** The backend sets `deleted_at` and `is_active=False` (no bin/restore UI). Do not add hard-delete to the Next.js backend. Add a restore endpoint if a Bin view is desired.
5. **Pagination.** The 50-item ceiling with no per-page control will become a usability issue as factory count grows. Add a per-page selector and wire to URL search params for back/forward support (P-009 cross-cutting pattern).
6. **Quality rating accessibility.** Add `aria-label="Quality rating: {n} out of 5"` to the star display container.
7. **D-001:** `factoriesApi.*` → `client.factories.*` via generated SDK.
8. **D-005:** All `InternalString`; Tamil can remain `""`.
