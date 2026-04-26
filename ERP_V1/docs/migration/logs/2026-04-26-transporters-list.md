# Page Migration — Transporters List

## Header

- **Page name:** Transporters List (`/transport`) — internal portal "Service Providers" page
- **Date started:** 2026-04-26
- **Date completed:** — (in progress)
- **Audit profile:** [docs/migration-audit/pages/internal_transport.md](../../migration-audit/pages/internal_transport.md)
- **Vue source:** [frontend/src/views/transport/TransportList.vue](../../../frontend/src/views/transport/TransportList.vue) — 313 lines
- **Peer (out of scope):** [TransportForm.vue](../../../frontend/src/views/transport/TransportForm.vue) — 494 lines
- **Reference image:** none provided
- **Closest reference screens:** [`Design/screens/settings.jsx`](../../../Design/screens/settings.jsx) (member-list density + role chips) and [`Design/screens/inventory.jsx`](../../../Design/screens/inventory.jsx) (search-bar-over-table cadence)
- **Research doc:** [docs/migration/research/factory-ledger-clients-transporters-2026-04-24.md](../research/factory-ledger-clients-transporters-2026-04-24.md), Target 3 (Transporters), commit `0756b3d` (in `main` history ✓)
- **Branch:** `feat/migrate-transporters-list` (created from `main` at HEAD `fb1ad13`)
- **Scope:** Internal transporters list page + Layer 1 permissions (`TRANSPORT_CREATE`, `TRANSPORT_UPDATE`, `TRANSPORT_DELETE`). **Excludes:** transporter form (CREATE/EDIT), detail view, rate-card / route-management sub-pages.

---

## Phase 1 — Discovery findings

### 1. Research document — confirmed authoritative

Target 3 (Transporters) section A through L of the research doc reads as authoritative. All findings carry forward and were re-verified against live backend on 2026-04-26:

- 313-line Vue source (`TransportList.vue`) with 6-column table, server-side search (400 ms debounce), prev-next-windowed pagination, and inline delete-confirm modal.
- OpenAPI **untyped** for list/get/create/update/delete (all return `unknown` in the SDK) — must use the local-interface pattern from CONVENTIONS Section 10.
- G-014 closed (Patch 13): `POST/PUT /api/shipping/transport/` → `[ADMIN, OPERATIONS, SUPER_ADMIN]`; `DELETE` → `[ADMIN, SUPER_ADMIN]`.
- No Cluster D risk — `_serialize_provider` returns no `factory_*` / `markup_*` / `*_cny` / `margin_*` fields. Clean data shape.
- Permission matrix gap blocks the migration: must add `TRANSPORT_CREATE/UPDATE/DELETE` first (Layer 1 commit), exactly mirroring the clients-list cadence.
- All Layer 2 components needed already exist (Pagination, DeleteConfirmDialog, ClientAvatar with `variant="hex"`).

**One open question vs research doc — role-badge component placement.** Research §G says "can stay inline as a `<ProviderRoleBadge role={r} />` local component; not worth Layer 2 unless future screens also show these roles." Phase 2 must decide whether to (a) keep it local in `_components/`, or (b) lift to `composed/role-badge.tsx` so future screens (Shipments, etc.) can re-use.

### 2. Audit profile — complete

[`docs/migration-audit/pages/internal_transport.md`](../../migration-audit/pages/internal_transport.md) is complete and current. Two `[UNCLEAR]` markers (lines 340 and 396) about whether `GET /api/shipping/transport/` always returns a `total` field — **both RESOLVED** by the research doc (line 537: "verified live: yes, always returned") and re-confirmed by live verification (Phase 1.6 below). The defensive `data.total || providers.value.length` fallback should be removed in the migration.

### 3. Vue source — read in full (313 lines)

**Path:** `frontend/src/views/transport/TransportList.vue` · `<script setup>` + `<template>` (Vue 3 composition).

**Sections:**
- **Page header** (`flex justify-between items-center mb-6`) — h2 "Service Providers" + `{{ totalItems }} providers` subtitle on left; `router-link to="/transport/new"` "Add Provider" button (emerald-600) on right. **No RoleGate on the button** — visible to every INTERNAL user (G-014 backend-enforced; frontend gate missing).
- **Search bar** (`bg-white rounded-xl shadow-sm p-4 mb-4`) — single `<input>` with pi-search icon, `max-w-md`. Placeholder: "Search by name, contact, city...". 400 ms debounce, resets `page` to 1.
- **Table container** with loading / empty / data states.
- **Pagination** — same windowed pattern as clients-list (`±1` window, ellipsis at `±2`, prev/next chevrons). Renders only when `totalPages > 1`.
- **Delete confirm modal** — custom inline; backdrop-click dismisses; subject is `deleteTarget.name`; **no typed-confirmation guard** (D-003 again).

**Key logic:**
- `loadProviders()` on mount → `GET /api/shipping/transport/?page=1&per_page=50`.
- `onSearchInput()` debounced 400 ms → resets `page` then refetches.
- `goToPage(p)` standard pagination.
- `confirmDelete(provider)` opens modal; `executeDelete()` calls `transportApi.delete(id)` then re-loads list.
- `cancelDelete()` closes the modal silently.
- All `catch` blocks are `console.error` only — load + delete errors swallowed (P-002 — must fix in migration).

**Dead code:** none.

**Known bugs / quirks:**
1. **P-002** — load and delete errors silently swallowed.
2. **D-003** — delete modal has no typed confirmation; one mis-click trash → "Delete" deletes the row (soft-delete only, but no undo affordance in UI).
3. **"Add Provider" visible to all INTERNAL roles** regardless of permission (G-014 closed at backend; UI didn't catch up).
4. **Defensive `data.total || providers.value.length`** — hides API contract drift. Backend always returns `total` (verified live).
5. **Per-page hardcoded at 50** with no selector.
6. **Role badge styling duplicated** — `roleLabelMap` + `roleColorMap` in TransportList vs `availableRoles` in TransportForm. Migration consolidates into a single `SERVICE_PROVIDER_ROLES` constant.

### 4. Column inventory (6 columns)

| # | Header | Source | Format notes |
|---|---|---|---|
| 1 | Name | `provider.name` | `text-sm font-medium text-slate-800` |
| 2 | Roles | `provider.roles[]` | Wrap of pill badges; 4 colours: blue/green/orange/purple. `"No roles"` italic if empty. |
| 3 | Contact | `contact_person` + `phone` 2nd line | em-dash if both absent |
| 4 | Location | `[city, state].filter(Boolean).join(', ')` | em-dash if both absent |
| 5 | GST / PAN | Badge pair: `GST: {gst}` (indigo-50) + `PAN: {pan}` (slate-100) | em-dash if both absent |
| 6 | Actions | Edit (pi-pencil → `/transport/{id}/edit`) + Delete (pi-trash → confirm modal) | right-aligned, icon-only |

**Not displayed but in response:** `email`, `address`, `country`, `bank_name`, `bank_account`, `ifsc_code`, `operating_ports` (string[]), `notes`, `is_active`, `created_at`, `updated_at`.

### 5. Filter inventory

Single search input. No status / role-type / city / port filters in the Vue source. (Audit profile confirms.)

### 6. Action inventory (with current role-gate status)

| Action | Trigger | Endpoint | Backend gate (G-014, Patch 13) | Vue UI gate today |
|---|---|---|---|---|
| Add Provider | Header CTA → `/transport/new` | POST `/api/shipping/transport/` | ADMIN \| OPERATIONS \| SUPER_ADMIN | **None — visible to all INTERNAL** ❌ |
| Edit | Row pencil → `/transport/{id}/edit` | PUT `/api/shipping/transport/{id}/` | ADMIN \| OPERATIONS \| SUPER_ADMIN | **None — visible to all INTERNAL** ❌ |
| Delete | Row trash → confirm modal → DELETE | DELETE `/api/shipping/transport/{id}/` | ADMIN \| SUPER_ADMIN | **None — visible to all INTERNAL** ❌ |
| Search | input + 400 ms debounce | GET `/api/shipping/transport/?search=…` | INTERNAL — any | (no gate needed) |
| Paginate | prev/next/numbered | GET `/api/shipping/transport/?page=N` | INTERNAL — any | (no gate needed) |

**Migration must add three RoleGate wrappers** — one per write action. Same shape as the fix the clients-list migration applied (commit `9346455`).

### 7. Vue bugs to fix during migration

Same class as clients-list:
- **Bug 1** — P-002 silent error catches on load + delete. Fix: surface load failures in a page-level error banner; delete failures in the dialog.
- **Bug 2** — Add/Edit/Delete buttons visible to roles without backend permission. Fix: wrap each in `<RoleGate />` keyed to `TRANSPORT_CREATE` / `TRANSPORT_UPDATE` / `TRANSPORT_DELETE`.
- **Bug 3** — Defensive `data.total || providers.value.length`. Fix: drop the fallback (backend always returns `total`).

### 8. Endpoint verification (live shapes, 2026-04-26)

Verified with admin JWT against the running backend:

| # | Method | URL | Status | Response shape | Notes |
|---|---|---|---|---|---|
| 1 | GET | `/api/shipping/transport/?per_page=5` | **200** | `{items: [], total: 0, page: 1, per_page: 5, pages: 0}` | Empty seed; envelope confirmed |
| 2 | POST | `/api/shipping/transport/` (full payload) | **200** | Full `ServiceProvider` (20 fields) | All fields echo correctly |
| 3 | GET | `/api/shipping/transport/?per_page=5` (after seed) | **200** | `{items: [{...}], total: 1, ...}` | `total` always present |
| 4 | GET | `/api/shipping/transport/?search=probe` | **200** | `{items: [{...}], total: 1, ...}` | Server-side search hits name |
| 5 | DELETE | `/api/shipping/transport/{id}/` | **200** (after one 307 redirect-follow) | (no body) | Soft-delete confirmed; `is_active` flips |

**Live response entity shape** (matches `_serialize_provider` exactly):
```ts
interface ServiceProvider {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;            // default "India"
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  gst_number: string | null;
  pan_number: string | null;
  roles: Array<'FREIGHT_FORWARDER' | 'CHA' | 'CFS' | 'TRANSPORT'>;
  operating_ports: string[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;         // null on freshly-created rows
}
```

OpenAPI typed? **No** (untyped — `application/json: unknown` in the spec). Use local interface in `_components/types.ts` per CONVENTIONS Section 10.

### 9. Permission matrix — current state

Read [`harvesterp-web/packages/lib/src/auth/matrix.ts`](../../../../harvesterp-web/packages/lib/src/auth/matrix.ts) (215 lines).

**Confirmed missing:**
- `TRANSPORT_CREATE` — absent from `Resource` enum (line 95) and `PERMISSION_MATRIX` (line 191).
- `TRANSPORT_UPDATE` — absent.
- `TRANSPORT_DELETE` — absent.

**Insertion points** (mirroring the clients block — added in commit `9346455`):
- `Resource` enum: insert at **line 77**, immediately after `CLIENT_DELETE: "CLIENT_DELETE"` (line 76).
- `PERMISSION_MATRIX`: insert at **line 152**, immediately after `[Resource.CLIENT_DELETE]: [ADMIN]` (line 151).

**Proposed scopes** (mirroring backend G-014 Patch 13):
- `TRANSPORT_CREATE` → `[ADMIN, OPERATIONS]` (matches backend exactly)
- `TRANSPORT_UPDATE` → `[ADMIN, OPERATIONS]` (matches backend exactly)
- `TRANSPORT_DELETE` → `[ADMIN]` (matches backend `[ADMIN, SUPER_ADMIN]`; SUPER_ADMIN bypass implicit, so the matrix entry stores only ADMIN — same pattern as `CLIENT_DELETE` line 151)

Layer 1 commit will be the **first** commit on the feature branch.

### 10. Components to reuse vs anything new needed

**Existing — reuse as-is:**
- `apps/web/src/components/shells/app-topbar.tsx` — page header
- `apps/web/src/components/shells/navigation-sidebar.tsx` — sidebar nav (already includes Transport item with `pi-truck` icon-equivalent)
- `apps/web/src/components/composed/role-gate.tsx` — wrap Add/Edit/Delete buttons
- `apps/web/src/components/composed/pagination.tsx` — Layer 2, lifted in clients-list migration
- `apps/web/src/components/composed/delete-confirm-dialog.tsx` — Layer 2, lifted in clients-list (supports `requireTypedConfirmation`, `reasonRequired`, `isPending`)
- `apps/web/src/components/composed/client-avatar.tsx` — `variant="hex"` derives a stable colour from `name`. **Used as-is** for the transporter Name cell — no rename needed (the component already says it's "for company avatars in the clients list" in the file's own docstring; transporters are also a company-shaped entity, so the same component fits without modification). The `client-avatar` filename is a slight misnomer but renaming it would touch every consumer; defer until a third entity-shaped page lands.
- Primitives: `button`, `card`, `input`, `label`, `select`, `skeleton`, `table`, `textarea`, `alert-dialog`, `dropdown-menu` — all present.
- Lib utilities: `formatDate`, `resolveDisplayName`, session/JWT helpers — all present in `@harvesterp/lib` and `apps/web/src/lib/`.
- Empty-state CTA pattern (CONVENTIONS Section 10) — mandatory.
- Error card pattern — established in factory-ledger and clients-list.

**New — to be built locally (proposed):**
- `apps/web/src/app/(app)/transport/_components/constants.ts` — `SERVICE_PROVIDER_ROLES` constant: `Array<{ value: 'FREIGHT_FORWARDER' | 'CHA' | 'CFS' | 'TRANSPORT'; label: string; chipClass: string }>`. Mirrors `roleLabelMap` + `roleColorMap` from Vue. Stays local (will be imported by future TransportForm migration).
- `apps/web/src/app/(app)/transport/_components/provider-role-badge.tsx` — small wrapper that takes a single role and renders `<span className="chip chip-X">{label}</span>` based on the SERVICE_PROVIDER_ROLES lookup. **Layer 2 lift decision deferred to Phase 2** (research §G says "not worth Layer 2 unless future screens also show these roles"; R-15 = lift threshold of 2 known consumers — Phase 2 must establish whether Shipments page will also need it).
- `apps/web/src/app/(app)/transport/_components/types.ts` — local `ServiceProvider` interface (CONVENTIONS Section 10 local-interface rule).

**Nothing else new is needed.** No new primitives, no new shells, no new lib utilities.

### 11. Stop-condition check

| Condition | Status |
|---|---|
| Backend not responding | ✅ Live (login 200; GET/POST/DELETE all confirmed) |
| Research doc 0756b3d in `main` history | ✅ Confirmed via `git log` |
| Vue source over 1000 lines | ✅ 313 lines (well under) |
| `TRANSPORT_CREATE` already exists in matrix.ts | ✅ Confirmed missing (no reconcile needed) |
| Page dramatically more complex than clients (rate cards, route maps, fleet UI) | ✅ Same shape — single 6-col table with role-badge wrap; no rate cards / routes / fleets in the **list** page |

All clear to proceed.

---

## Phase 2 — UX Reasoning

### 2.1 User goal

**Primary persona:** OPERATIONS — picks a logistics partner when creating or progressing a shipment. Needs to find the right CHA / freight forwarder / transporter quickly given a city, port, or remembered name.

**Secondary persona:** ADMIN — maintains the catalogue (adds new providers, fixes typos in GST numbers, off-boards inactive partners).

**Tertiary persona:** FINANCE — reconciles a transport invoice; needs to look up the provider's GST/PAN/contact for matching. Read-only access.

One-sentence goal: *Find a service provider by name or location, see their roles + contact + compliance details at a glance, and (if authorised) create or edit one.*

### 2.2 Information hierarchy

For an OPERATIONS user scanning the list, ranked 1 (most important) → 5 (least):

1. **Name** — the human label they're searching for. Always present.
2. **Roles** — single most discriminating field. A user looking for a CHA filters mentally by the green pill; a user looking for a transporter filters by the purple pill. Without role visibility, the list is undifferentiated.
3. **Location** (city, state) — second-most discriminating; "Chennai-based CHA" is a typical mental query.
4. **Contact** (person + phone) — needed once the user has picked a row to call.
5. **GST / PAN** — needed for finance reconciliation; rarely scanned, useful when present.

The Vue source orders columns: Name → Roles → Contact → Location → GST/PAN → Actions. **Contact (rank 4) is placed before Location (rank 3).** Minor mis-prioritisation but not catastrophic for a list of <500 rows. Recommend swapping Contact ↔ Location in the migration to put the second-most discriminating column adjacent to roles. This matches `Design/screens/inventory.jsx` cadence (most-discriminating data on the left).

### 2.3 Filter architecture

Vue source: single search input, no dimensional filters. With 4 role values and a small (<500) row count, the search bar is sufficient. **No filter drawer needed.** A future role chip-toggle row (e.g. "All / FF / CHA / CFS / Transport" pill toggle) would be useful once the catalogue grows past ~100 rows; defer as a follow-up.

Same single-row filter approach as clients-list. No drawer.

### 2.4 Similarity to clients-list

**~85% identical pattern.** Differences:
- 6 columns vs clients' 6 columns (same count).
- Roles column is multi-valued (1–4 pill badges per row) vs clients' single GSTIN cell. **Only structurally novel column.**
- Search placeholder "Search by name, contact, city..." vs clients' "Search by company name, GSTIN, city, contact..." — same intent, near-identical fields.
- Endpoint base is `/api/shipping/transport/` vs `/api/clients/`.
- Backend DELETE scope is `[ADMIN]` exactly mirroring clients (research said `[ADMIN, SUPER_ADMIN]`; SUPER_ADMIN bypass means matrix stores `[ADMIN]` — same as clients).
- No Cluster D field stripping needed (transporters have no factory-cost / margin fields).

**Implication:** the Next.js implementation is largely a copy-paste of `apps/web/src/app/(app)/clients/` with these renames + the role-badge addition. That's good — it solidifies the pattern. Phase 3 implementation budget should be **shorter** than clients (no Cluster D projection logic, no margin field stripping, no new Layer 2 lift).

### 2.5 DELETE permission scope

Backend G-014 Patch 13: `DELETE /api/shipping/transport/{id}/` requires `ADMIN | SUPER_ADMIN`. SUPER_ADMIN bypass is implicit in the matrix. Matrix entry: `[ADMIN]`.

This **exactly mirrors** the clients-list pattern (`CLIENT_DELETE: [ADMIN]`). No defense-in-depth UI hardening needed because the backend already excludes OPERATIONS — UI matches backend exactly.

**Recommendation:** `TRANSPORT_DELETE: [ADMIN]`. Same as `CLIENT_DELETE`.

Edge case to confirm with user: should OPERATIONS be allowed to delete? Backend says no. The UI should match. Confirming because clients-list intentionally shipped UI **stricter** than backend (UI excluded OPERATIONS even though backend allows them — defense in depth). For transporters there's no such mismatch — backend already excludes OPERATIONS, so UI just mirrors backend.

### 2.6 Avatar / role-badge component decisions

**Avatar — three options for the Name cell:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Reuse `ClientAvatar` as-is with `variant="hex"` | Zero new code; deterministic colour-from-name; already tested. The component file's own docstring already mentions "company avatars" generically. | Filename is misleading (`client-avatar.tsx` for non-client entities). |
| B | Rename `client-avatar.tsx` → `entity-avatar.tsx` (move + update all imports) | Cleaner naming. | Touches every existing consumer; breaks git blame; cosmetic-only fix mid-migration. |
| C | Create a `transporter-avatar.tsx` separately | Specific naming. | Pure duplication of an already-generic component. |

**Recommendation: A.** Reuse `ClientAvatar` as-is. Rename to "EntityAvatar" later if a third entity-shaped page (e.g. Factories list) lands and the misnomer becomes painful. R-15 (lift threshold = 2 known upcoming consumers) doesn't apply because this is rename-not-lift.

**Role-badge — three options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| α | Local `_components/provider-role-badge.tsx` in the transport route | Scoped; doesn't leak the role taxonomy to other parts of the codebase. | Future Shipments / Bookings page would have to re-implement (or move it later). |
| β | Layer 2 `composed/role-badge.tsx` — generic, takes `tone` + `label` | Reusable for any pill-badge use-case. | Generic-by-design loses the typed `SERVICE_PROVIDER_ROLES` enum coupling. |
| γ | Layer 2 `composed/provider-role-badge.tsx` — specific to provider roles | Typed; future-proof for Shipments / Bookings. | Premature lift if Shipments doesn't actually use it. |

**Recommendation: α (local).** Per research §G ("not worth Layer 2 unless future screens also show these roles"). R-15 (lift threshold = 2 consumers) is not yet met — Shipments page might use it but no concrete plan exists. Defer the lift decision to whichever migration lands second. The local file path is `apps/web/src/app/(app)/transport/_components/provider-role-badge.tsx`.

### 2.7 Vue bug fixes (planned for migration)

Same class as clients-list. Three fixes — all are pure UI hardening with backend already correct:

1. **P-002 silent error catches.** Replace both `console.error` blocks with user-visible state:
   - Load failure → page-level error banner (red-50 card with retry button), same shape as factory-ledger uses.
   - Delete failure → keep dialog open; surface the error inside the dialog via a `mutation.error` slot already supported by the Layer 2 `<DeleteConfirmDialog>`.
2. **Role gating on Add / Edit / Delete buttons.** Wrap each in `<RoleGate />` keyed to the new permissions.
3. **Defensive `data.total || providers.length`.** Drop the fallback (backend always returns `total`).

### 2.8 Responsive strategy

Same pattern as clients-list:
- **Desktop (≥1024 px):** full 6-column table.
- **Tablet (768–1023 px):** collapse Roles + GST/PAN into a stacked sub-cell on the Name column (or hide GST/PAN since it's lowest-priority). Keep Contact + Location visible.
- **Mobile (<768 px):** card-per-row with Name + role-pill stack at top, contact + location stacked below, action menu in a kebab.

No responsive complexity beyond what clients-list already established. jsdom test pattern (Section 6 responsive-table rule) applies — scope queries to one layout.

### 2.9 State coverage

- **Loading** — Skeleton rows (per CONVENTIONS Section 10 indirect — Skeleton is the canonical loading state). 5 skeleton rows in the table body, no centered spinner.
- **Fresh empty** (`total === 0` and no search) — Pattern A from CONVENTIONS Section 10: pi-truck-equivalent icon, heading "No service providers yet.", primary CTA "Add your first provider" wrapped in `<RoleGate resource={TRANSPORT_CREATE}>`.
- **Filtered empty** (`total === 0` with active search) — Pattern B: "No providers match this search." + ghost button "Clear search". No CTA.
- **Error (load)** — Page-level error banner with retry.
- **Error (delete)** — Inline inside `<DeleteConfirmDialog>`.
- **Permission-denied** — list itself is INTERNAL-only; no D-004 scope needed for transporters (no factory-cost data). FINANCE sees the list read-only; the Add/Edit/Delete buttons simply aren't rendered for them.

### 2.10 Accessibility + responsive notes

- Role-pill badges should have implicit `aria-label="Roles: Freight Forwarder, Transport"` derived from concatenating the role labels — screen readers don't know the colours mean role types.
- Pencil + trash icon-only buttons: ensure `aria-label="Edit {name}"` / `aria-label="Delete {name}"` per row.
- Search input: `aria-label="Search providers by name, contact, or city"`.
- `aria-sort` left out (no per-column sort in v1 — same scope decision as clients-list).
- Table caption: `<caption className="sr-only">Service providers</caption>` for screen-reader context.

### 2.11 Recommendation

**POLISH** (not LIFT, not REDESIGN).

The Vue source is structurally sound. Migration retains layout, pattern, and 6-column structure but adds:
- Three RoleGate wrappers (security fix — not visual).
- One column-order tweak (Location ahead of Contact).
- Pattern A/B empty states.
- Skeleton loading.
- Error banners (replacing console.error).
- One new local component (`<ProviderRoleBadge>`) consolidating the duplicated role styling.

Phase 3 budget estimate: **5–7 hours** as research §H predicted (when bundled with prior shared extractions). All Layer 2 components are already lifted.

### 2.12 Awaiting user decisions

1. **Column order — swap Location ahead of Contact?** Recommend YES per §2.2 hierarchy analysis. Confirm before Phase 3 proceeds.
2. **`TRANSPORT_DELETE` matrix scope = `[ADMIN]`?** Recommend YES (mirrors backend G-014 exactly). Confirm scope is right.
3. **Avatar component — reuse `ClientAvatar` with `variant="hex"`?** Recommend YES (Option A from §2.6). Confirm before Phase 3.
4. **Role-badge component placement — local in `_components/` (Option α)?** Recommend YES. Confirm.
5. **D-003 typed-confirmation on delete dialog — apply or skip for v1?** Clients-list shipped without it (decision: keep parity with Vue). Recommend SAME — skip typed confirmation; soft-delete + standard confirm dialog is sufficient. Confirm.
6. **Per-page selector — 25 / 50 / 100 dropdown like clients-list?** Recommend YES (already implemented in the Layer 2 `<Pagination>` via `onPerPageChange` prop). Confirm whether to enable it on this page.
7. **Mobile breakpoint behaviour — copy clients-list approach exactly?** Recommend YES. Confirm.
8. **Sidebar "Transport" item gating?** Currently the navigation sidebar shows the item to all INTERNAL roles (matches clients-list approach where the item is gated by `ORDER_LIST` since every internal role can view). Recommend keeping it visible to all INTERNAL — the list page itself has no permission requirement; only the write actions are gated. Confirm.

Once these eight decisions are answered, Phase 3 implementation can proceed with no ambiguity.

---

## Phase 2 — User decisions (recorded 2026-04-26)

All eight Phase-2 questions answered by user:

1. **Column order:** Swap Location ahead of Contact → final `Name | Roles | Location | Contact | GST/PAN | Actions`. ✅
2. **TRANSPORT_DELETE scope:** `[ADMIN, SUPER_ADMIN]` (matrix entry `[ADMIN]`; SUPER_ADMIN implicit via `canAccess()` bypass). Mirrors backend G-014 exactly. OPERATIONS cannot delete. ✅
3. **Avatar:** Reuse `ClientAvatar` as-is with `variant="hex"`. No rename. ✅
4. **ProviderRoleBadge:** Local component (`_components/provider-role-badge.tsx`). Not lifted to Layer 2. ✅
5. **Delete dialog:** Standard confirm, no typed-confirmation guard. ✅
6. **Per-page selector:** Yes. 25/50/100, default 50. ✅
7. **Mobile breakpoints:** Copy clients-list pattern. Tablet (768–1023 px) collapses Roles column to a count badge. ✅
8. **Sidebar:** Transport visible to all INTERNAL; write actions RoleGated. ✅

**Pre-Phase-3 decisions (added after surfacing 4 discrepancies between user's Phase 3 spec and Phase 1 verified facts):**

A. **Role taxonomy:** Use backend's `FREIGHT_FORWARDER / CHA / CFS / TRANSPORT` (not the typed-shorthand `ROAD/AIR/SEA/MULTIMODAL`). ✅
B. **Backend URL:** `/api/shipping/transport/` (internal); Next.js proxy mounts at `/api/transport/`. ✅
C. **`matrix.ts` syntax:** Object-literal + bare destructured roles, UPPERCASE values. ✅
D. **`chip-purple`:** Option B — add new tone variant to `globals.css` + `Design/styles/components.css` as a single-line each, byte-paired by-line. ✅
E. **Tone mapping:** `FREIGHT_FORWARDER → chip-info`, `CHA → chip-ok`, `CFS → chip-warn`, `TRANSPORT → chip-purple` (new). ✅

---

## Phase 3 — Implementation notes

### Files created (12 new)

| Path | Lines | Purpose |
|---|---|---|
| `harvesterp-web/apps/web/src/app/(app)/transport/page.tsx` | 99 | RSC wrapper: session redirect, role resolve, initial RSC fetch with field-projection (drops 7 sensitive fields server-side). |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/types.ts` | 79 | `ServiceProviderRole` enum, `TransporterListItem` (13 fields, projected), raw upstream type for the proxy. |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/constants.ts` | 50 | `SERVICE_PROVIDER_ROLES` single-source-of-truth (label + chipClass per role) replacing Vue's two duplicated maps. |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/provider-role-badge.tsx` | 95 | Local `<ProviderRoleBadge>` (single pill) + `<ProviderRolesCell>` (responsive: pill wrap on desktop/mobile, count badge on tablet). |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/columns.tsx` | 105 | 6-column desktop schema in agreed priority order: Name · Roles · Location · Contact · GST/PAN. |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/transport-mobile-card.tsx` | 92 | Per-row card layout for `< md`. Role-gated Edit + Delete actions. |
| `harvesterp-web/apps/web/src/app/(app)/transport/_components/transport-client.tsx` | 261 | TanStack Query orchestrator. Search debounce, role gating, error banner with retry, delete dialog with error surface, pagination wiring, both empty-state patterns. |
| `harvesterp-web/apps/web/src/app/api/transport/route.ts` | 70 | GET proxy: forwards page/per_page/search; field-projection strips email/address/country/bank_*/ifsc_code/notes. |
| `harvesterp-web/apps/web/src/app/api/transport/[id]/route.ts` | 47 | DELETE proxy with status mapping (403/404/5xx → meaningful error messages). |
| `harvesterp-web/apps/web/tests/components/provider-role-badge.test.tsx` | 130 | 14 unit tests covering all 4 roles, unknown-role fallback, multi-role wrap, count badge, pluralisation, empty state. |
| `harvesterp-web/apps/web/tests/api/transport-routes.test.ts` | 211 | 14 proxy tests covering auth, query forwarding, field-stripping, status mapping. |
| `harvesterp-web/apps/web/tests/app/transport-list.test.tsx` | 290 | 23 integration tests covering header, column order, role gating (ADMIN/OPS/FINANCE/undefined), empty states, loading skeleton, error banner, pagination, delete dialog (open/cancel/confirm/error), mobile cards. |

### Files modified (5)

| Path | Δ lines | Purpose |
|---|---|---|
| `harvesterp-web/packages/lib/src/auth/matrix.ts` | +16 | Three `TRANSPORT_*` permissions with G-014 verification comment. Inserted after CLIENT_* block. |
| `harvesterp-web/apps/web/src/app/globals.css` | +1 | `chip-purple` tone variant. |
| `ERP_V1/Design/styles/components.css` | +1 | `chip-purple` tone variant (paired with globals.css). |
| `ERP_V1/nginx/nginx.dev.conf` | +14 | `location = /transport` block (internal portal, dev). |
| `ERP_V1/nginx/nginx.conf` | +42 | `location = /transport` × 3 (admin / client / factory portals). |
| `ERP_V1/docs/migration/MIGRATED_PATHS.md` | +2 | N=10; new row for `/transport`. |
| `harvesterp-web/apps/web/tests/infra/nginx-config.test.ts` | +1 | `EXPECTED_MIGRATED_PATHS` += `/transport`. |

### Tests added: **51 new** (14 + 14 + 23). Web baseline 496 → **549** (target was 536+).

### nginx config: **dev** + 3 prod portals (admin / client / factory) — verified by `grep -c "location = /transport"`: dev=1, prod=3.

### `MIGRATED_PATHS.md`: 9 → 10.

---

## Live Verification (R-16 — passed 2026-04-26)

Authenticated as freshly-seeded OPERATIONS user (`ops@test.dev` / `Pass1234!`) and navigated to `http://localhost:3100/transport`. Three providers seeded via admin JWT: Maersk India, Chennai Container Freight Station, Express Cargo Movers — covering all four role values (`FREIGHT_FORWARDER`, `CHA`, `CFS`, `TRANSPORT`).

### R-16 three console checks (all required to pass)

```
getComputedStyle(document.body).fontFamily
  → "Manrope, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
  → contains "Manrope" ✅

document.styleSheets.length
  → 2  ✅ (> 0)

getComputedStyle(document.documentElement).getPropertyValue('--f-sans')
  → "\"Manrope\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
  → non-empty ✅
```

**All three pass.** First attempt failed (CSS pipeline desync from prior preview-server run); recovered per R-16 protocol: stopped preview server, killed background dev process on port 3000, `rm -rf apps/web/.next`, restarted via `preview_start "web-next"`, re-verified — clean.

### Functional + role-gating verification

| Check | Expected (OPS) | Actual | Result |
|---|---|---|---|
| Page heading "Service Providers" | yes | "Service Providers" | ✅ |
| Subtitle "{N} providers" | "3 providers" | "3 providers" | ✅ |
| Search input + aria-label | "Search providers by name, contact, or city" | matches | ✅ |
| Add provider button visible | yes (OPS has TRANSPORT_CREATE) | yes | ✅ |
| Edit link per row | yes (OPS has TRANSPORT_UPDATE) | 6 (3 rows × desktop+mobile) | ✅ |
| Delete button per row | **no** (OPS lacks TRANSPORT_DELETE) | **0** | ✅ |
| Browser console errors | 0 | 0 | ✅ |

### FINANCE role
Not separately verified live in this run — covered by unit tests `transport-list.test.tsx > role gating > FINANCE sees no Add / Edit / Delete (read-only)` (passes). Live FINANCE verification deferred unless user requests — same scope decision as factory-ledger.

### Visual evidence
Captured via Claude Preview MCP `preview_screenshot` and rendered inline in the chat transcript. Per-shot description + R-16 raw values saved to [`docs/migration/screenshots/2026-04-26-transport.md`](../screenshots/2026-04-26-transport.md). Persisting the binary PNG requires Puppeteer-with-cookie-bootstrap which is not currently in the migration workflow — flagged as tech-debt in the screenshot placeholder.

---

## Visual fidelity (R-17 — passed 2026-04-26)

**Reference compared against:** [`Design/screens/settings.jsx`](../../../Design/screens/settings.jsx) (member-list density + role chip cadence) with cross-reference to [`Design/screens/inventory.jsx`](../../../Design/screens/inventory.jsx) (search-bar-over-table cadence).

**Scorecard (R-17, 5 dimensions × 0–10, threshold = 7):**

| Dimension | Score | Notes |
|---|---|---|
| Typography | 9 | Manrope loads from `--f-sans` (R-16 verified). h1 at 20 px font-semibold; subtitle 13 px slate-500. Column headers 11 px uppercase 0.6 px letter-spacing per `.label` cadence. Multi-tier hierarchy clean. |
| Layout | 9 | Header (h1 + count) left, primary CTA right — matches `settings.jsx` Topbar shape. Card-framed search row + card-framed table. 6-column priority order Name → Roles → Location → Contact → GST/PAN → Actions per Phase 2 §2.2. Pagination footer inside card. Reads identically to `settings.jsx` member-list cadence. |
| Spacing | 8 | Card framing on search + table; row padding inside `.tbl` consistent with `inventory.jsx`. Pill wrap uses `gap-1` (4 px), slightly tighter than reference's 6 px but acceptable. |
| Color | 9 | All four role chips render with intended DS tones: `chip-info` blue, `chip-ok` green, `chip-warn` amber, `chip-purple` (NEW). Visually distinct without clashing. Brand-emerald primary CTA. Hex-derived avatar circles deterministic per name. No off-token colours. |
| Component usage | 8 | Role badges use DS `.chip` + tone classes — the audit recommendation #6 cohort issue partially addressed. Body still uses primitives (`<Card>`, `<Input>`, `<Button>`, `<Table>`) which is the newer-cohort pattern (same as clients-list, factory-ledger). The role-badge layer is where DS-class adoption matters most for visual fidelity, and this page consumes them correctly. |
| **Average** | **8.6 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

**Verdict:** PASS. No fixes required.

**Caveats:**
- Pill-wrap gap is 4 px (Tailwind `gap-1`) vs reference 6 px. Below `Spacing` threshold drift.
- Mobile-card layout uses raw `bg-white rounded-xl` like clients-list (audit recommendation #6 still open at the cohort level).

---

## Issues encountered and resolutions

### Issue 1: Vue Bug — P-002 silent error catches (load + delete)

- **Date raised:** 2026-04-26 (Phase 1 audit)
- **Problem:** Both `loadProviders()` and `executeDelete()` in `TransportList.vue` catch errors with `console.error` only — user sees no indication of failure.
- **Fix applied:** Migration replaces both:
  - Load failure → page-level red banner with Retry button (matches clients-list / factory-ledger pattern).
  - Delete failure → message surfaces inside the `<DeleteConfirmDialog>` body via a `deleteError` state, dialog stays open.
- **Date resolved:** 2026-04-26 (Phase 3, Step 4)
- **Tests added:** `transport-list.test.tsx > load error (Bug 1 fix)` (1 test) + `transport-list.test.tsx > delete dialog > DELETE failure surfaces in the dialog (Bug 1 fix — delete error)` (1 test).

### Issue 2: Vue Bug — No RoleGate on Add/Edit/Delete

- **Date raised:** 2026-04-26 (Phase 1 audit)
- **Problem:** Vue source renders Add/Edit/Delete buttons unconditionally. Backend G-014 (Patch 13) blocks unauthorised mutations, but the UI shows the affordances to roles that can't use them.
- **Fix applied:** Each write action wrapped in `canAccess(role, Resource.TRANSPORT_*)` checks. ADMIN sees all three; OPERATIONS sees Add+Edit (no Delete); FINANCE sees none. Verified live (R-16) and via 4 dedicated tests.
- **Date resolved:** 2026-04-26 (Phase 3, Step 4)
- **Tests added:** `transport-list.test.tsx > role gating (Bug 2 fix)` (4 tests covering ADMIN / OPERATIONS / FINANCE / undefined).

### Issue 3: Vue Bug — Defensive `data.total || providers.length`

- **Date raised:** 2026-04-26 (Phase 1 audit)
- **Problem:** Vue `loadProviders()` line 43 sets `totalItems.value = data.total || providers.value.length` — falls back to current page length when backend doesn't return `total`, masking API contract drift.
- **Fix applied:** Migration trusts `data.total` directly (verified live in Phase 1.6 + Phase 3 Step 3 — backend always returns `{items, total, page, per_page, pages}`). The `RawTransportListResponse` interface declares `total: number` (not optional), so any future contract drift surfaces as a type error rather than silently defaulting.
- **Date resolved:** 2026-04-26 (Phase 3, Step 4)
- **Tests added:** Implicitly covered by `transport-routes.test.ts > preserves wrapper fields` (1 test) — asserts the proxy passes through the exact `total` value.

### Issue 4: Test failures from stale @harvesterp/lib build

- **Date raised:** 2026-04-26 (Phase 3, Step 5 first run)
- **Problem:** 22/51 transport tests failed with `Cannot read properties of undefined (reading 'includes')` at `canAccess(role, Resource.TRANSPORT_CREATE)`. Root cause: `@harvesterp/lib` exposes built `dist/index.js` (per `package.json` exports), and my matrix.ts source change wasn't reflected in the built output because I hadn't run `pnpm build` after editing.
- **Fix applied:** `cd packages/lib && pnpm build` → `tsup` rebuilt `dist/index.js` (26.73 KB) and `dist/index.d.ts` (27.72 KB). All 51 tests pass on re-run.
- **Date resolved:** 2026-04-26 (Phase 3, Step 5)
- **Tests added:** None (build issue, not source bug). Worth proposing as CONVENTIONS rule: "After any change to `packages/lib/src/`, run `pnpm --filter @harvesterp/lib build` before testing apps that consume it" — same pattern bit clients-list migration would have hit if it hadn't run lib tests first.

### Issue 5: R-16 first-pass failure (CSS pipeline desync)

- **Date raised:** 2026-04-26 (Phase 3, Step 7 first attempt)
- **Problem:** First R-16 verification on the preview-managed dev server returned `fontFamily = "Times New Roman"`, `styleSheets.length = 0`, `--f-sans = ""` — the same CSS-pipeline desync that triggered the 2026-04-26 morning audit. Cause: preview server was already running (`reused: true`) when I cleared `.next` for my background server, leaving the preview's in-memory module cache pointing at file paths that no longer existed.
- **Fix applied:** Per R-16 recovery protocol — stopped the preview server (`preview_stop`), killed the background dev process on port 3000 (`taskkill /F /PID 28324`), `rm -rf apps/web/.next`, restarted via `preview_start "web-next"` (got `reused: false` confirmation). On re-verification all three console checks passed cleanly.
- **Date resolved:** 2026-04-26 (Phase 3, Step 7 second attempt)
- **Tests added:** None for this incident — it's a dev-environment race condition, not a source bug. The CSS-pipeline smoke test added in commit `480618c` covers the static-manifest case; runtime concurrent-server desync is not covered. Possible follow-up: extend the smoke test to fetch the live `/_next/static/css/...` URLs and assert 200, or add a `pnpm dev:clean` script that wraps the kill-clean-restart sequence.

---

## Proposed rules for CONVENTIONS.md (if any)

### Proposed P-024: Rebuild `@harvesterp/lib` after source changes before testing dependents

When `packages/lib/src/` is modified (especially `matrix.ts`, `roles.ts`, or any other Layer-1 export), run:

```sh
pnpm --filter @harvesterp/lib build
```

before running tests in `apps/web`. The lib package's `package.json` exports `./dist/index.js` (built output), not source. Without a rebuild, consuming apps see the previous published shape and tests fail in confusing ways (`undefined.includes is not a function` rather than a clean import error).

Surfaced during this migration's Phase 3 Step 5 — see Issue 4. Proposing as P-024 because (a) it's a sharp edge any developer working on Layer 1 will hit, and (b) the failure mode isn't obvious from the test output. Could also be enforced by a Husky pre-test hook, deferred to user discussion.

### Proposed P-025: `pnpm dev:clean` script for CSS-pipeline-desync recovery

Add an `apps/web` script alias `dev:clean` that runs:

```sh
rm -rf .next && pnpm dev
```

R-16 (post-2026-04-26 amendment) already documents the recovery sequence inline; codifying it as a script reduces friction on every developer machine. Surfaced during this migration's Issue 5.

(Both deferred for explicit user decision at end of migration.)

---

## Open questions deferred

- **Live FINANCE verification.** This migration's R-16 was performed as OPERATIONS. FINANCE role gating is fully covered by unit tests; if a separate live walkthrough is required for compliance, tag it on the next migration that touches the same area.
- **Per-page selector default of 50.** Matches clients-list and products-list. If telemetry later shows users typically need more, consider 100 default for transporters specifically.
- **Future Shipments page consuming `<ProviderRoleBadge>`.** When the second consumer lands, lift `<ProviderRoleBadge>` to `apps/web/src/components/composed/provider-role-badge.tsx` (R-15 trigger). The local component is intentionally portable — its imports already use `@/...` aliases.
- **Audit recommendation #6 (DS-class cohort consistency).** Transporters joins the newer cohort that uses primitives + selective DS-class adoption (chip family). Cohort-wide decision still open.

---

## Final status

- **Tests passing:** **549 / 549** (web; baseline 496 → +53), **280 / 280** (lib), **infra tests included in web 549**.
- **Lint:** ✅ — 0 errors, 0 warnings.
- **Build:** ✅ — `/transport` weighs 3.9 kB / 143 kB first-load. Both proxy routes built.
- **Coverage gate:** Pre-existing failure documented in `docs/tech-debt/coverage-threshold-failure.md`. Functions improved from 64.12% → 65.01%. Not introduced by this migration.
- **nginx config:** ✅ — dev (1) + all 3 prod portals (3) — verified by `grep -c`.
- **`MIGRATED_PATHS.md`:** ✅ — 9 → 10.
- **`nginx-config.test.ts` EXPECTED_MIGRATED_PATHS:** ✅ — `/transport` added.
- **R-16 console checks:** ✅ — all three pass; zero browser console errors.
- **R-17 visual fidelity:** ✅ — average 8.6 / 10; every dimension ≥ 7.
- **Three Vue bugs documented + fixed.**
- **Committed in PR:** branch `feat/migrate-transporters-list` (commits below — pending final test commit).
- **Merged:** **NOT YET — awaiting user review per scope boundary.**
- **Deployed to staging / production:** —

