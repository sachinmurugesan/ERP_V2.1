# Page Migration — Clients List

## Header

- **Page name:** Clients List (`/clients`)
- **Date started:** 2026-04-25
- **Date completed:** — (in progress)
- **Audit profile:** [docs/migration-audit/pages/internal_clients_list.md](../../migration-audit/pages/internal_clients_list.md)
- **Vue source:** [frontend/src/views/clients/ClientList.vue](../../../frontend/src/views/clients/ClientList.vue) — 297 lines
- **Peer (out of scope):** [ClientForm.vue](../../../frontend/src/views/clients/ClientForm.vue) — 443 lines
- **Reference image:** none provided
- **Research doc:** [docs/migration/research/factory-ledger-clients-transporters-2026-04-24.md](../research/factory-ledger-clients-transporters-2026-04-24.md) (committed 0756b3d, in main history ✓)
- **Branch:** `feat/migrate-clients-list`
- **Scope:** Internal clients list page + Layer 1 permissions for client CRUD (`CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE`). Excludes: client form (CREATE/EDIT), client detail, client ledger, client portal access.

---

## Phase 1 — Discovery findings

### 1. Research document — confirmed

Target 2 (Clients) of the research doc reads as authoritative. All findings carry forward:
- 297-line Vue source with 6-column table + standard pagination + delete-confirm modal.
- OpenAPI typed (`$ref`) for list/get/create/update; DELETE untyped (204).
- G-013 closed (DELETE backend-gated to ADMIN | OPERATIONS | SUPER_ADMIN).
- Cluster D open: `factory_markup_percent` + `sourcing_commission_percent` ship in list response and aren't rendered. Frontend-projection workaround applies.
- Permission matrix gap blocks the migration: must add `CLIENT_CREATE/UPDATE/DELETE` first (Layer 1 commit), exactly mirroring 3909ec1 cadence.

**One correction vs research doc — `<ClientAvatar>` exists in `apps/ui-gallery`** at `apps/ui-gallery/src/components/composed/client-avatar.tsx` (104 lines). Same pattern as the LedgerPage discovery: the prototype is real, just not consumed by `apps/web`. Phase 2 §2.13 elects to port + adapt (not from-scratch).

### 2. Audit profile

[docs/migration-audit/pages/internal_clients_list.md](../../migration-audit/pages/internal_clients_list.md) is complete and current. No `[UNCLEAR]` markers. Aligns 1:1 with Vue source. Cluster D + P-002 + D-003 noted; G-013 marked CLOSED (Patch 12).

### 3. Vue source — read in full

**Path:** `frontend/src/views/clients/ClientList.vue` · **297 lines** · `<script setup>` + `<template>` (Vue 3 composition).

**Sections:**
- **Page header** (`flex justify-between items-center mb-6`) — h2 "Clients" + `{{ totalItems }} clients` subtitle on left; `router-link to="/clients/new"` "Add Client" button (emerald-600) on right. **No RoleGate on the button** — visible to every INTERNAL user (G-013 backend-enforced; frontend gate missing).
- **Search bar** (`bg-white rounded-xl shadow-sm p-4 mb-4`) — single `<input>` with pi-search icon, `max-w-md`. Placeholder: "Search by company name, GSTIN, city, contact...". 400 ms debounce, resets `page` to 1.
- **Table container** with loading / empty / data states.
- **Pagination** — same windowed pattern as products-list (`±1` window, ellipsis at `±2`, prev/next chevrons). Renders only when `totalPages > 1`.
- **Delete confirm modal** — custom inline; backdrop-click dismisses; subject is `deleteTarget.company_name`; **no typed-confirmation guard** (D-003).

**Key logic:**
- `loadClients()` on mount → `GET /api/clients/?page=1&per_page=50`.
- `onSearchInput()` debounced 400 ms → resets `page` then refetches.
- `goToPage(p)` standard pagination.
- `confirmDelete(client)` opens modal; `executeDelete()` calls `clientsApi.delete(id)` then re-loads list.
- `cancelDelete()` closes the modal silently.
- All `catch` blocks are `console.error` only — load + delete errors swallowed (P-002 — must fix in migration).

**Dead code:** none.

**Known bugs / quirks:**
1. P-002 — load and delete errors silently swallowed.
2. D-003 — delete modal has no typed confirmation; one mis-click trash → "Delete" deletes the row.
3. "Add Client" visible to all INTERNAL roles regardless of permission (G-013 closed at backend; UI didn't catch up).
4. `factory_markup_percent` + `sourcing_commission_percent` fetched but never rendered (Cluster D — wasted bandwidth + sensitive-data risk).
5. Per-page hardcoded at 50 with no selector.

### 4. Column inventory (6 columns)

| # | Header | Source | Format notes |
|---|---|---|---|
| 1 | Company Name | `client.company_name` | `font-medium text-slate-800` |
| 2 | GSTIN | `client.gstin` | `font-mono`; "Not provided" italic if null |
| 3 | Location | `[city, state].filter(Boolean).join(', ')` + `pincode` 2nd line | em-dash if both absent |
| 4 | Contact | `contact_name` + `contact_phone` 2nd line | em-dash if absent |
| 5 | IEC / PAN | Badge pair: `IEC: {iec}` (indigo-50) + `PAN: {pan}` (slate-100) | em-dash if both absent |
| 6 | Actions | Edit (pi-pencil → `/clients/{id}/edit`) + Delete (pi-trash → confirm modal) | right-aligned, icon-only |

**Not displayed but in response:** `factory_markup_percent`, `sourcing_commission_percent` (Cluster D), `is_active`, timestamps, `client_type`, `notes`, `address`, `contact_email`, `pincode` (only on second line of Location), `iec`/`pan` (combined into one badge cell).

### 5. Filter inventory

Single search input. No status / country / type filters in the Vue source. (Audit profile confirms.)

### 6. Action inventory

| Action | Placement | Visible when | Vue handler |
|---|---|---|---|
| Search | Top filter bar | Always | `onSearchInput()` |
| Pagination prev/next | Bottom-right of table card | `totalPages > 1` | `goToPage()` |
| Page number jump | Same | Same | `goToPage(p)` |
| Add Client | Page header right | Always (no role gate) | `router-link to="/clients/new"` |
| Edit row | Right cell of each row | Always (no role gate) | `router.push('/clients/{id}/edit')` |
| Delete row | Right cell of each row | Always (no role gate) | Opens modal → `executeDelete()` |

No bulk operations. No inline editing. No import / export. No status toggle. No row-click navigation (only icon-button click).

### 7. Endpoint verification

**LIVE verification BLOCKED — postgres is down** (psycopg2 OperationalError on backend startup). Both preview servers were lost mid-session and Docker Desktop is not running.

Falling back to **documented shapes** verified during the factory-ledger Phase 1 (24 hours ago) when the DB was up:

| Method | URL | Last live status | OpenAPI | Notes |
|---|---|---|---|---|
| GET | `/api/clients/` | 200 — `{items, total, page, per_page, pages}` (verified 2026-04-24 with admin JWT, empty DB) | **Yes** (`$ref`) | Query: `page`, `per_page`, optional `search` |
| GET | `/api/clients/{id}/` | (not verified live; OpenAPI `$ref`) | Yes | Detail — out of scope this migration |
| POST | `/api/clients/` | (not verified) | Yes | Create — out of scope |
| PUT | `/api/clients/{id}/` | (not verified) | Yes | Update — out of scope |
| DELETE | `/api/clients/{id}/` | 204 — soft-delete | Untyped | Backend-gated to ADMIN \| OPERATIONS \| SUPER_ADMIN (G-013) |

**Other endpoints noted in research / OpenAPI:**
- `/api/clients/search/` — likely autocomplete fallback
- `/api/clients/{id}/categories/`, `/brands/`, `/product-access/`, `/portal-permissions/` — sub-routes for client form / detail (out of scope)

**Action item:** Phase 3 must re-verify the GET shape with admin JWT live before merging (R-16). DB-restart precondition documented in §11 stop-conditions.

### 8. Permission matrix current state

[harvesterp-web/packages/lib/src/auth/matrix.ts](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts) — verified line-by-line:

**Resource enum (lines 59–92):**
- Line 69 — `PRODUCT_CREATE`
- Line 70 — `PRODUCT_UPDATE`
- Line 74 — `FACTORY_LEDGER_VIEW`
- Line 84 — `CLIENT_PORTAL_ACCESS` (separate concept — role-based access to the client portal, not internal CRUD)
- **Confirmed missing:** `CLIENT_LIST`, `CLIENT_VIEW`, `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE`.

**PERMISSION_MATRIX (lines 99+):**
- Line 124 — `[Resource.PRODUCT_CREATE]: [ADMIN, OPERATIONS]`
- Line 129 — `[Resource.PRODUCT_UPDATE]: [ADMIN, OPERATIONS]`
- Line 145 — `[Resource.FACTORY_LEDGER_VIEW]: [FINANCE]`
- Line 164 — `[Resource.CLIENT_PORTAL_ACCESS]: [CLIENT]`

**Insertion plan for Phase 3 (Layer 1 commit):**
- Add `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE` keys to the Resource enum **immediately after line 70** (next to PRODUCT_*) — they share the same conceptual cluster (internal entity CRUD).
- Add their PERMISSION_MATRIX entries **immediately after line 129** (next to PRODUCT_UPDATE) for the same reason.
- Reuse the exact line/comment style from PRODUCT_CREATE/PRODUCT_UPDATE (commit 3909ec1).

### 9. ClientAvatar prototype found

`apps/ui-gallery/src/components/composed/client-avatar.tsx` (104 lines) — produces an initials-on-coloured-circle avatar. API:

```ts
interface ClientAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  variant?: "hex" | "class";  // hex = name-derived hash; class = role-derived Tailwind pair
  role?: UserRole;             // required when variant="class"
  className?: string;
}
```

Depends on `getInitials`, `getAvatarClass`, `getAvatarHexColor` from `@harvesterp/lib`. No primitive dependencies in `apps/web` are missing — it would port cleanly.

**Use case for clients-list:** the company-name cell could prefix a small avatar with the company initials. Adds visual distinction without needing logos. Optional.

### 10. Components to reuse from prior migrations

Already in `apps/web`:
- **Composed:** `RoleGate`, `KpiCard` (n/a here), `StageChip` (n/a), `UserDropdown` (in shell), `LedgerPage` (n/a), `AdminForbiddenState` (n/a — clients are not D-004), `ImageGallery`/`Lightbox` (n/a).
- **Primitives:** `Button`, `Card`, `Input`, `Select` (native), `Label`, `AlertDialog`, `Textarea`, `Table`, `Skeleton`, `DropdownMenu`.
- **Lib:** `formatINR`, `formatDate`, `Resource`, `canAccess`, `RoleGate`, `getInitials`/`getAvatarClass`/`getAvatarHexColor` (for ClientAvatar port).
- **Hooks:** `useBlobDownload` (n/a — no clients export today).

In `apps/web/src/app/(app)/products/_components/` (mineable for clients-list):
- **`pagination.tsx`** — windowed pagination, exact pattern needed. Lift to Layer 2 in this migration (per research doc's `<Pagination>` proposal).
- **`empty-state.tsx`** — generic empty state with CTA. Reuse directly or copy-port.
- **`error-card.tsx`** — error banner. Reuse directly or copy-port.
- **`filter-row.tsx`** — single-input filter row scaffold. Reuse if filter-row pattern fits.
- **`product-confirm-dialog.tsx`** — three-scenario dialog (likely too rich for clients; clients only have one delete scenario). Build a simpler `<DeleteConfirmDialog>` thin wrapper over `AlertDialog` per research doc.
- **`product-mobile-card.tsx`** — per-row card layout for mobile. Adapt for `client-mobile-card.tsx`.
- **`product-row-kebab.tsx`** — kebab menu for row actions. Adapt for `client-row-kebab.tsx` if we add more row actions later.

### 11. New components needed

Layer 2 lifts (proposed for this migration):
1. **`<Pagination>`** — lift `pagination.tsx` from products `_components/` to `apps/web/src/components/composed/pagination.tsx`. Generalized API: `{ page, totalPages, onPageChange }`. Used by clients-list now + retroactive cleanup of products-list/orders-list deferred to follow-up cleanup PR.
2. **`<DeleteConfirmDialog>`** — thin Layer 2 wrapper over `AlertDialog` accepting `subject` (e.g. company name). Used by clients-list, will be reused by transporters-list next migration.
3. **`<ClientAvatar>`** — port from `ui-gallery` if Phase 2 decision approves the visual treatment.

App-local (clients-list `_components/`):
1. `clients-client.tsx` — client wrapper with TanStack Query, search debounce, pagination state, delete-flow state.
2. `types.ts` — local interfaces (`ClientListItem`, `ClientsListResponse`); `ClientListItem` projects out the Cluster D fields.
3. `columns.tsx` — column definitions for the table.
4. `client-mobile-card.tsx` — mobile card variant.
5. `empty-state.tsx` and `error-card.tsx` — local copies if Layer 2 lift is deferred.

API proxy:
1. `apps/web/src/app/api/clients/route.ts` — GET (forward query params) + (out of scope: POST for future create migration).
2. `apps/web/src/app/api/clients/[id]/route.ts` — DELETE.

### 12. Stop-condition check

- Research doc 0756b3d in main history? **Yes.**
- Audit profile present? **Yes.**
- Vue source <1500 lines? **Yes** (297 lines).
- Existing CLIENT_CREATE/UPDATE/DELETE keys? **No** (verified absent).
- `GET /api/clients/` returns 404 or 500? **500 currently — but only because postgres is down (DB outage, not endpoint problem)**. Confirmed against documented shape from 24h-ago verification.
- Vue source >2000 lines? No.

**Phase 1 proceeds.** Live re-verification of the GET response shape required before Phase 3 implementation per R-16 — once the user starts Docker Desktop / postgres, I'll re-curl and either confirm the documented shape or stop and report drift.

---

## Phase 2 — UX reasoning report

### User goal

An OPERATIONS user (or ADMIN) needs to do one of two things, both common:

1. **Find a specific client** (by company name, GSTIN, city, or contact name) — fast lookup before logging an order or sending an invoice.
2. **Scan the catalogue** of clients to identify gaps (missing GSTIN / missing contact details, dormant accounts) — periodic data-quality work.

A FINANCE user reads the same data passively (often paired with the client ledger). A SUPER_ADMIN does both plus the occasional delete.

### Information hierarchy

Ranked most-to-least important:

1. **Company name** (the primary identifier — every other lookup is mediated through it).
2. **Search** (the action that gets used 80%+ of the time on this page).
3. **Contact** (name + phone — needed for the "I need to call them about X" workflow).
4. **GSTIN / IEC / PAN** (compliance fields — often the actual reason a finance user opens the page).
5. **Location** (city + state — disambiguates clients with similar names).
6. **Pagination** (background plumbing once you've narrowed via search).
7. **Add / Edit / Delete actions** (low-frequency for any individual user; gated by role).

### Current layout assessment

**POLISH** — the Vue layout's hierarchy is correct:
- Search bar above the table (the action used most).
- Company Name as the first column.
- Contact and GSTIN positioned where the eye lands second.
- Pagination tucked into the table footer.

The port should faithfully preserve this content order with these improvements at the margins:

1. **RoleGate the "Add Client" button** (G-013 — current Vue version is open to all INTERNAL roles; backend rejects the actual POST but the button shouldn't dangle).
2. **RoleGate the row Edit + Delete buttons** (same reason — show only when user can act).
3. **Surface load + delete errors** instead of swallowing them (P-002 fix — banner for load, toast for delete).
4. **Per-page selector** (the hardcoded 50 is fine for default but a "25 / 50 / 100" picker matches products-list).
5. **Empty-vs-error distinction** — currently every load failure looks like "no results"; an actual error needs its own banner.
6. **Cluster D projection** — strip `factory_markup_percent` + `sourcing_commission_percent` in the API proxy before they ever reach the client component.
7. **Optional: `<ClientAvatar>` prefix** in the Company Name cell — adds visual texture without rearranging layout. Awaiting decision §2.13.

No content reorder needed.

### Specific suggestions

1. **Keep the 6 columns in current order** (Company Name · GSTIN · Location · Contact · IEC/PAN · Actions). It matches scan-priority for the data-quality use case and fits desktop comfortably.
2. **Move "Actions" column on mobile into a kebab menu inside the company-name card** rather than its own column — the icons-only column wastes width below tablet.
3. **Per-page selector** added to the pagination footer (25 / 50 / 100, default 50).
4. **Single search input** — keep the Vue placeholder "Search by company name, GSTIN, city, contact..." — it correctly advertises multi-field search.
5. **Delete confirmation** — keep the simple subject-only modal (clients don't have the multi-scenario complexity of products-list's bulk-with-DELETE-typing dialog). New `<DeleteConfirmDialog>` Layer 2 wraps `AlertDialog` for clients + transporters reuse.
6. **CTA empty state** — Section 10 rule applies: "+ Add your first client" CTA when no clients exist; "Clear search" link when search returns no results.

### Interactions inventory

| Element | Behaviour | Discoverable? |
|---|---|---|
| Search input | 400 ms debounce → refetch + reset to page 1 | ✓ (placeholder text explains scope) |
| Add Client button | Navigates to `/clients/new` (Vue fall-through until form migrates) | Visible only to ADMIN/OPERATIONS/SUPER_ADMIN per `CLIENT_CREATE` |
| Edit pencil | Navigates to `/clients/{id}/edit` (Vue fall-through) | Visible only to roles with `CLIENT_UPDATE` |
| Delete trash | Opens confirm modal | Visible only to roles with `CLIENT_DELETE` |
| Confirm modal Cancel / backdrop | Dismisses | ✓ |
| Confirm modal Delete | `DELETE /api/clients/{id}/` → reload | ✓ |
| Pagination prev / next / page-number | Refetch | ✓ |
| Per-page select | Refetch + reset to page 1 | ✓ (new in this migration) |

All interactions discoverable. Nothing hidden or mislabeled.

### State coverage

| State | Vue handling | Next.js target |
|---|---|---|
| Initial load | Spinner | Skeleton rows (table-shape) |
| Loading on filter change | Spinner | Skeleton rows |
| Empty (no clients in DB) | "No clients found" + "+ Add your first client" link | Same — `<EmptyState>` with CTA per Section 10 |
| Empty (search returned nothing) | Same UI as above | Differentiate: "No clients match `<query>`" + "Clear search" ghost button |
| Load error | **Swallowed** | Inline error banner + Retry button |
| Delete error | **Swallowed** (modal closes silently, row stays) | Toast error + keep modal open + show inline banner inside modal |
| Forbidden (CLIENT or FACTORY tries to reach `/clients`) | Vue route guard | Sidebar already filtered (no `CLIENT_*_VIEW` key needed — INTERNAL-only route guard handles it server-side); render generic 403 if reached |

### Accessibility notes

- Table needs `<caption>` ("Clients list, page X of Y") — silenced via `sr-only` for sighted users.
- Search input must be associated with a `<label>` (sr-only acceptable).
- Pagination buttons need `aria-label` ("Previous page", "Next page", "Page 3 of 7").
- Delete confirm modal: focus trap + return focus to the trash icon on close (Radix AlertDialog handles this).
- Row actions need accessible labels — the icon-only buttons currently have `title=` but should have `aria-label`.
- ClientAvatar (if used): `role="img"` + `aria-label={company_name}` (the prototype already does this).

### Responsive notes

Same pattern as products-list:
- **Desktop (≥1024 px):** full 6-column table.
- **Tablet (768–1023 px):** hide Location and IEC/PAN; show Company Name · GSTIN · Contact · Actions.
- **Mobile (<768 px):** card-per-row layout. Each card shows Company Name (with optional avatar) + GSTIN below + Contact + Location + Actions kebab. Same pattern as `product-mobile-card.tsx`.

### Role-based behavior

| Role | View list | Add | Edit | Delete | Sidebar item |
|---|---|---|---|---|---|
| SUPER_ADMIN | ✓ (bypass) | ✓ (bypass) | ✓ | ✓ | Visible (already filtered to INTERNAL-only) |
| ADMIN | ✓ | ✓ | ✓ | ✓ | Visible |
| OPERATIONS | ✓ | ✓ | ✓ | ✗ (proposed) | Visible |
| FINANCE | ✓ (read-only) | ✗ | ✗ | ✗ | Visible |
| CLIENT / FACTORY | ✗ (route guard) | — | — | — | Hidden (already filtered out — sidebar mapping uses `ORDER_LIST` resource which they have) |

Note: NavigationSidebar's `NAV_RESOURCE_MAP` currently maps `clients` to `ORDER_LIST` (any internal role can see it). That's the right behaviour for the list page. The new `CLIENT_CREATE/UPDATE/DELETE` keys gate buttons inside the page only.

### Layer 1 permission prep approach (§2.11)

Proposed scopes (Phase 2 §2.11 in spec):
- `CLIENT_CREATE` → `[ADMIN, OPERATIONS]` (SUPER_ADMIN via bypass)
- `CLIENT_UPDATE` → `[ADMIN, OPERATIONS]` (same)
- `CLIENT_DELETE` → `[ADMIN]` (SUPER_ADMIN via bypass)

**Justification for the more-restrictive DELETE:**
- Backend `DELETE /api/clients/{id}/` (G-013) actually accepts ADMIN | OPERATIONS | SUPER_ADMIN. So the proposed `[ADMIN]` is **stricter than backend**, which is the safe direction (frontend never lets a user attempt an action they'll be denied).
- Soft-delete only on backend (`deleted_at = utcnow`), so the data-loss exposure is recoverable. ADMIN-only at the frontend is a process-of-record protection, not a security boundary.
- Matches the products-list precedent indirectly: `PRODUCT_CREATE` and `PRODUCT_UPDATE` are both `[ADMIN, OPERATIONS]`, but products didn't add a separate `_DELETE` key — bulk delete uses bulk-edit gating.

**Decision needed:** confirm `[ADMIN]` for CLIENT_DELETE, or relax to `[ADMIN, OPERATIONS]` to match the backend. Recommend **`[ADMIN]`** — clients are master data and shouldn't be casually deleted by ops.

### Sort scope decision (§2.12)

Sort tech debt is still an open item across orders / products / factories / clients. Adding sort here would force retroactive consistency.

**Recommendation: defer sort.** Add to clients-list when the broader sort decision lands (separate PR that updates orders, products, clients, transporters, factories together).

### ClientAvatar approach (§2.13)

Prototype exists (104 lines). Visual treatment: small coloured circle with company initials, `name`-derived hash colour by default.

**Recommendation: port + use** in the Company Name cell on desktop and as the card icon on mobile. Reuses well-tested visual code; differentiates rows; costs ~10 minutes to port. Approve to lift.

### Recommendation: POLISH

Faithful port of content + columns. Visual layer rebuilt with design system primitives. State coverage extended (P-002 errors surfaced, error vs empty distinguished, retry, role-gated actions). One Layer-1 prep commit (3 permission keys), three Layer-2 lifts (`<Pagination>`, `<DeleteConfirmDialog>`, `<ClientAvatar>`).

### Awaiting user decision on

| # | Decision | Recommendation |
|---|---|---|
| 1 | Layer 1 permission scopes | `CREATE/UPDATE`: `[ADMIN, OPERATIONS]`; `DELETE`: `[ADMIN]` (stricter than backend, master-data protection) |
| 2 | Column count + order (6 cols, current) | **Keep faithful** — Company · GSTIN · Location · Contact · IEC/PAN · Actions |
| 3 | Mobile collapse strategy | **Card layout below 768 px** with kebab for actions |
| 4 | Per-page selector (25 / 50 / 100, default 50) | **Yes** — matches products-list |
| 5 | Empty vs search-empty differentiation | **Yes** — different copy + "Clear search" ghost on search-empty |
| 6 | Cluster D projection (strip margin fields in API proxy) | **Yes** — server-side filter before payload reaches client component |
| 7 | `<DeleteConfirmDialog>` lift to Layer 2 | **Yes** — used by clients now + transporters next |
| 8 | `<Pagination>` lift to Layer 2 | **Yes** — already 3+ known consumers |
| 9 | `<ClientAvatar>` port + use in cell | **Yes** — port from ui-gallery, use in Company Name cell |
| 10 | Sort scope | **Defer** to a separate cross-list sort PR |
| 11 | Bulk operations | **None** — Vue source has no bulk; don't add |
| 12 | Export functionality | **None** — Vue source has no export; don't add |
| 13 | Empty-state copy | "No clients yet — add your first client to get started" |

### New components / extractions in Phase 3

**Layer 1 (1 commit, separate)**
- `matrix.ts` — add `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DELETE` (both Resource enum + PERMISSION_MATRIX).

**Layer 2 (3 components)**
- `apps/web/src/components/composed/pagination.tsx` — lifted from products `_components`.
- `apps/web/src/components/composed/delete-confirm-dialog.tsx` — thin wrapper over `AlertDialog` with `subject` prop.
- `apps/web/src/components/composed/client-avatar.tsx` — ported from ui-gallery.

**Page (app-local)**
- `apps/web/src/app/(app)/clients/page.tsx` — RSC shell, role check, initial fetch.
- `_components/clients-client.tsx` — TanStack Query interactive wrapper.
- `_components/types.ts` — local `ClientListItem` (Cluster-D-projected) + `ClientsListResponse`.
- `_components/columns.tsx` — 6-column schema.
- `_components/client-mobile-card.tsx` — mobile card variant.

**API proxy**
- `apps/web/src/app/api/clients/route.ts` — GET (forwards search + page + per_page).
- `apps/web/src/app/api/clients/[id]/route.ts` — DELETE.

**nginx + tests**
- `nginx.dev.conf` + `nginx.conf` (3 portals) — `location = /clients` exact match.
- `MIGRATED_PATHS.md` 8 → 9.
- `nginx-config.test.ts` — extend `EXPECTED_MIGRATED_PATHS`.
- ~30+ new tests (3 Layer 2 components, page, API proxy, sidebar already covered).

### STOP — awaiting approval on the 13 decisions above + Layer 1 permission scopes before Phase 3.

**Pre-Phase-3 prerequisite:** restart Docker Desktop / postgres so live R-16 verification can happen at the end of Phase 3. Phase 1 endpoint shape verification was satisfied from documented shapes (24h-ago live data); Phase 3 needs a live shape re-confirm before merge.

---

## Phase 3 — Implementation notes

### Step 3 — Endpoint verification (LIVE 2026-04-26)

After Docker fix + db restart, re-verified `/api/clients/` end-to-end with admin JWT:

**POST /api/clients/** — created `Test Probe Corp` (id `0f9afce8-90aa-4b2d-9464-63aed581fd93`). Status 200. Returned the full ClientResponse shape immediately.

**GET /api/clients/?per_page=5** — returns:

```json
{
  "items": [{
    "id": "0f9afce8-...", "company_name": "Test Probe Corp",
    "gstin": "22AAAAA0000A1Z5", "iec": "0123456789", "pan": "AAAAA0000A",
    "address": null, "city": "Mumbai", "state": "MH", "pincode": null,
    "contact_name": "Probe", "contact_phone": "+91 99999 99999",
    "contact_email": "probe@test.dev", "notes": null,
    "is_active": true, "client_type": "REGULAR",
    "factory_markup_percent": null, "sourcing_commission_percent": null
  }],
  "total": 1, "page": 1, "per_page": 5, "pages": 1
}
```

**17 ClientResponse fields confirmed.** Cluster D fields (`factory_markup_percent`, `sourcing_commission_percent`) present in raw response — will be stripped in the Next.js API proxy per Phase 2 decision 6.

No drift from research doc. Proceeding with Step 4.

---

## Issues encountered and resolutions

### Issue 1: Vue bug, fixed during migration — "Add Client" button lacked role gate

- **Date raised:** 2026-04-26 (Phase 3 Step 4)
- **Problem:** Vue `ClientList.vue` rendered the "Add Client" `<router-link>` for every INTERNAL user. Users without `POST /api/clients/` permission saw the button, clicked it, navigated to `/clients/new`, then hit a backend 403 with no clear feedback. G-013 backend gate is closed (`[ADMIN, OPERATIONS, SUPER_ADMIN]`), but the frontend never caught up.
- **Root cause:** Vue layout was written before G-013 closed; the role gate was never added retroactively.
- **Fix applied:** Next.js page wraps the button (header CTA + empty-state CTA) in a `canAccess(role, Resource.CLIENT_CREATE)` check. Layer 1 commit `9346455` introduced `CLIENT_CREATE` with the matching scope.
- **Date resolved:** 2026-04-26
- **Tests added:** `clients-list.test.tsx` covers ADMIN/OPERATIONS/FINANCE button visibility.

### Issue 2: Vue bug, fixed during migration — Edit pencil lacked role gate

- **Date raised:** 2026-04-26 (Phase 3 Step 4)
- **Problem:** Same as Issue 1 — the per-row Edit pencil rendered for every INTERNAL user; clicking it navigated to `/clients/{id}/edit` and hit backend 403 (G-013).
- **Root cause:** Same — Vue UI not updated after G-013.
- **Fix applied:** RoleGate the per-row Edit link via `canAccess(role, Resource.CLIENT_UPDATE)` in both desktop table and mobile card. Layer 1 commit `9346455` introduced `CLIENT_UPDATE`.
- **Date resolved:** 2026-04-26
- **Tests added:** `clients-list.test.tsx` covers per-role Edit link visibility.

### Issue 3: Vue bug, fixed during migration — Delete trash icon lacked role gate

- **Date raised:** 2026-04-26 (Phase 3 Step 4)
- **Problem:** Same pattern — trash icon visible to all INTERNAL users, opened a delete confirmation, then hit backend 403 on confirm. The original Vue users were silently failing here too.
- **Root cause:** Same as 1 and 2.
- **Fix applied:** RoleGate the per-row Delete button via `canAccess(role, Resource.CLIENT_DELETE)`. Permission is intentionally STRICTER than backend (`[ADMIN]` only — not OPERATIONS) — defense-in-depth UI hardening per Phase 2 decision 1.
- **Date resolved:** 2026-04-26
- **Tests added:** `clients-list.test.tsx` covers per-role Delete button visibility (OPERATIONS sees no delete; ADMIN sees it).

### Issue 4: Pre-flight blocker — Docker Desktop crash on stale unix-socket files

- **Date raised:** 2026-04-26 (pre-Phase 3)
- **Problem:** Docker Desktop refused to start the engine. UI showed an "unexpected error" dialog citing `remove C:\Users\sachi\AppData\Local\Docker\run\dockerInference: The file cannot be accessed by the system.` Then a second crash on `docker-secrets-engine\engine.sock`.
- **Root cause:** A previous Docker Desktop crash left several 0-byte `AF_UNIX` socket "ghost files" with broken Win32 reparse-point semantics — Win32 file APIs (`del`, `Remove-Item`, `[System.IO.File]::Delete`) all returned "The file cannot be accessed by the system." The Inference Manager and Secrets Engine subsystems try to delete + recreate their socket files on startup; when delete fails, they crash, which kills the whole daemon before the named pipe is created.
- **Fix applied:** (a) Killed all Docker processes via PowerShell. (b) Renamed the parent `Docker\run` and `docker-secrets-engine` directories aside (`.bak.<timestamp>`) — Win32 can rename a directory containing a broken socket, even though it can't delete the socket itself. Docker recreates the parent directory cleanly on next launch. (c) Set `EnableDockerAI: false` in `%APPDATA%\Docker\settings-store.json` so the Inference Manager subsystem doesn't even try to start. (d) `wsl --shutdown` + relaunch.
- **Date resolved:** 2026-04-26 (engine UP within seconds after fix)
- **Tests added:** none — pure infra issue, not a code regression.

### Issue 5: Git fscache transient inconsistency

During the Docker Desktop pre-flight debugging session, `git status` briefly reported several tracked files (`.gitignore`, `docker-compose.yml`, `CONVENTIONS.md`, `backend/Dockerfile`, nginx configs, root `README.md`) as deleted with status `D`.

**Initial hypothesis:** `wsl --shutdown` affected mounted files.

**Investigation (post-merge) revealed this was wrong:**
- Project files are 100% on Windows NTFS, no WSL involvement (the only WSL distro installed is `docker-desktop`, which has no `/mnt/c` mount; no Ubuntu or any other distro exists; `df -T /c/Dev/Template_1/ERP_V1` confirms the project lives on the NTFS `C:` volume).
- Real cause: Windows git `core.fscache` transient inconsistency triggered by Docker Desktop's process flurry killing file watchers.

**Workaround applied:** `git restore .gitignore CONVENTIONS.md docker-compose.yml backend/Dockerfile nginx/nginx.conf nginx/nginx.dev.conf README.md`

**Workaround was a no-op coincidence** — files were physically present, cache self-healed. The restore happened to coincide with cache refresh.

**No action needed.** Symptom benign and transient. Amended after Investigation 2 (Filesystem) confirmed the actual cause.

---

## Live Verification (R-16)

Performed 2026-04-26 against the running stack (`web-next` on `:3100`, FastAPI on `:8001`, postgres in Docker container `harvestdb`).

### Test data seeded
- `Test Probe Corp` client (id `0f9afce8-90aa-4b2d-9464-63aed581fd93`) created via `POST /api/clients/` with admin JWT.
- `finance@test.dev` user (FINANCE role) — already seeded from prior factory-ledger migration.

### ADMIN role checkpoints (all PASS)

| # | Check | Result |
|---|---|---|
| 1 | Login as `admin@harvesterp.com` | 200 + cookie set |
| 2 | Navigate to `/clients` | Page rendered: title "Clients", count "1 client" |
| 3 | List loads with seeded data | Test Probe Corp visible in desktop table |
| 4 | Search input + 400 ms debounce | Typed "probe" → 1-row result + count line updated |
| 5 | Pagination footer present | nav `Clients pagination` rendered with rows-per-page selector |
| 6 | "Add client" button visible | ✓ (CLIENT_CREATE granted) |
| 7 | Edit pencil visible per row | ✓ (CLIENT_UPDATE granted) |
| 8 | Delete trash visible per row | ✓ (CLIENT_DELETE granted) |
| 9 | Delete dialog opens with company name | ✓ "Delete Test Probe Corp?" + Cancel + Delete buttons |
| 10 | Browser console errors | **Zero** |

### FINANCE role checkpoints (all PASS — read-only)

| # | Check | Result |
|---|---|---|
| 1 | Login as `finance@test.dev` | 200 |
| 2 | `/clients` loads | Title "Clients", 1 row visible |
| 3 | "Add client" hidden | ✓ (no CLIENT_CREATE) |
| 4 | Edit links hidden | ✓ (no CLIENT_UPDATE) |
| 5 | Delete buttons hidden | ✓ (no CLIENT_DELETE) |
| 6 | Browser console | Zero errors |

### Sidebar
"Clients" item appears in the sidebar for both ADMIN and FINANCE (it's gated by `ORDER_LIST` which all internal roles have — correct behaviour for the list page itself).

### Cluster D verification
The browser-side response from `/api/clients` was inspected: rows contained 15 fields (no `factory_markup_percent` or `sourcing_commission_percent`). Server-side projection in the proxy is working.

---

## Proposed rules for CONVENTIONS.md (if any)

None this migration. R-14 (RSC prop forwarding) and R-16 (live happy-path verification) both applied. R-16 caught zero new bugs this time — the proxy projection + role gating worked as designed.

---

## Open questions deferred

- Sort across all list pages (cross-list cleanup PR).
- Inline migration of remaining ad-hoc dialog/pagination consumers (orders, products) to the new shared `<Pagination>` and `<DeleteConfirmDialog>` Layer 2 components — separate cleanup PR per Phase 2 decisions 7 + 8.
- Cluster D backend projection endpoint (we strip in proxy today; backend should add `/api/clients/list-projection/`). Low priority.

---

## Final status

- **Tests passing:** web 489/489 (was 433 → +56), lib 280/280, infra 39/39.
- **Build:** ✅ — `/clients` page weighs ~6 kB / 124 kB first-load.
- **Lint:** ✅ — 0 errors, 0 warnings.
- **TypeScript:** ✅ — `tsc --noEmit` clean.
- **nginx config:** ✅ — dev + all 3 prod portals.
- **MIGRATED_PATHS.md:** ✅ — 8 → 9.
- **Live R-16 verification:** ✅ — ADMIN happy path + FINANCE read-only path both verified, zero console errors.
- **Three Vue bugs fixed + logged.**
- **Committed in PR:** branch `feat/migrate-clients-list` (8 commits, not yet merged).
- **Merged:** not yet (awaiting review).

---

## Proposed rules for CONVENTIONS.md (if any)

_(empty — populated toward end of migration)_

---

## Open questions deferred

_(empty — populated as work progresses)_

---

## Final status

_(empty — populated at end)_
