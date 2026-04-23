# HarvestERP Migration — Decisions Charter

**Status:** PROPOSED — awaiting sign-off
**Created:** 2026-04-21
**Owner:** Sachin M
**Scope:** Binding architectural decisions for the Vue 3 → Next.js frontend rebuild. Every page profile from Wave 2 onward MUST respect the commitments made here.

> This is a living charter. When a decision changes, update it in place and bump the `Updated:` date on the affected record. Do not delete history — mark superseded decisions as `SUPERSEDED by D-XXX` and leave them.

---

## Wave 2 Launch Checklist

Wave 2 (client portal) and every subsequent wave are **blocked** until all five items are green. Un-checking any of these after work starts is grounds for a halt.

- [ ] **D-001** API access policy **accepted** (record owner's signature below)
- [ ] **D-002** Order-tab slug contract **frozen** — 14 slugs listed, external references grep'd and mapped
- [ ] **D-003** Destructive-action UX policy **accepted** — `<ConfirmDialog>` props locked
- [ ] **D-004** SUPER_ADMIN **hotfix shipped** to production Vue app + permission matrix Layer-1 file drafted
- [ ] **D-005** Bilingual policy **accepted**
- [ ] **Pass B prompt template updated** to reference this file (every profile's "role gating", "API endpoints", "modals", and "bilingual labels" sections use the agreed conventions)

**Two profiles written pre-interrupt** (`client_layout.md`, `client_profile.md`) must be re-audited against this charter before they are considered final.

---

## D-001 — API access policy

**Status:** PROPOSED — Option B recommended
**Surfaced by:** Wave 1 audit (appears in `Login.vue`, `Users.vue`, `TechStack.vue` — three pages bypass `api/index.js` and call `axios` directly).

### Problem
Three Wave-1 pages write to the backend via raw `axios` instead of the 222-method module registry in `src/api/index.js`. The registry's request/response interceptors (401 refresh, 409/429/403 warnings, token injection) are registered on a **specific axios instance**, not on the global default — so module calls and direct-axios calls live in two partially-overlapping worlds. Any future centralized concern (request signing, telemetry, rate-limit handling, error normalization) will silently miss the bypass sites.

The effect compounds in migration: the inventory claim "222 API methods across 22 modules" is technically incomplete because there are HTTP calls that don't appear in any module list.

### Options

| Option | Description | Trade-off |
|---|---|---|
| **A** | Catalog and migrate as-is. Treat the bypass as legitimate; replicate in Next.js using a second client. | Faster migration; perpetuates the inconsistency. |
| **B** | Catalog and normalize during migration. In Next.js, every HTTP call goes through a single client (TanStack Query + a typed SDK generated from the FastAPI OpenAPI spec). The bypass dies in the new codebase. | Slower migration; cleaner result. |

### Recommendation — **Option B**
You're rebuilding the frontend anyway. Marginal cost of normalizing is small; marginal cost of carrying the bypass forward is years of "why doesn't this call show up in the network panel correctly" debugging.

### Consequences if accepted
- Wave 0 adds a task: generate a typed API client from the FastAPI `/openapi.json`. Candidate tools: `openapi-typescript-codegen`, `orval`, or `kubb`. Pick one during Wave 0 kickoff.
- Every page profile's "API endpoints consumed" section gets a consistent format going forward: `client.orders.create()`-style calls, not `ordersApi.create()`.
- Existing Vue app: **no change required**. Bypass stays as-is until the page is migrated.

### Bypass site classifications

Each of the three Wave-1 bypass sites gets a binding disposition. This is the **only** ambiguity Option B permits — every other HTTP call goes through the generated SDK.

| Site | Disposition | Rationale |
|---|---|---|
| [`Login.vue`](../../frontend/src/views/Login.vue) — `POST /api/auth/login` via `useAuth.login()` | **EXCEPTION (keep bypass)** | Login cannot use the authenticated client — there is no bearer token yet. The auth flow *must* talk to a dedicated pre-auth axios instance (or `fetch`). Carry this exception forward to Next.js as `src/lib/auth-client.ts` — a tiny, explicitly-pre-auth HTTP layer with no interceptors that depend on a session. |
| [`Users.vue:172`](../../frontend/src/views/Users.vue) — `api.put('/clients/:id/brands/', ...)` with `include_no_brand` | **FIX (normalize to SDK)** | The bypass exists only because `clientsApi.setBrands` has the wrong signature (accepts `brands` but not `include_no_brand`). The fix is to extend the backend schema / SDK surface, not to preserve the bypass. In Next.js, this becomes `client.clients.setBrands({id, brands, include_no_brand})`. |
| [`TechStack.vue:13`](../../frontend/src/views/TechStack.vue) — `axios.post('/api/graphify/rebuild/')` | **DELETE (do not port to new app)** | Page is a marketing/showcase surface with hard-coded stats, a dead `rebuildGraph` handler, and outdated numbers (says 201 API methods, actually 222). Do not include in the Next.js scope. If the graph rebuild endpoint is still needed, it becomes a backend admin script. |

### Action items
- [ ] **D-001-A1** Pick OpenAPI codegen tool (Wave 0)
- [ ] **D-001-A2** Wire the three classifications above into the corresponding page profiles: `Login.vue` → EXCEPTION note + reference pre-auth client spec; `Users.vue` → FIX note + backend schema extension; `TechStack.vue` → DELETE — remove from migration scope
- [ ] **D-001-A3** Update Pass B prompt: "API endpoints" section uses generated-SDK naming from the `openapi.json` schema, not `xxxApi.method()` references. Pre-auth / EXCEPTION sites are allowed to cite the raw endpoint.

---

## D-002 — Order-tab slug contract

**Status:** PROPOSED — Option C → almost certainly A
**Surfaced by:** Wave 1 audit (`Sidebar.vue` notification deep-link map, `ClientLayout.vue` deep-link map, `OrderDetail.vue` `activeTab` state). Sub-tab slugs are referenced by notifications and possibly external systems.

### Problem
The 14 order-tab slugs are a **URL contract** with the outside world. Email notifications, push notifications, and likely browser bookmarks reference strings like `/orders/:id?tab=shipping-docs`. Renaming `shipping-docs` to `shipping_documents` silently breaks every email link sent in the past 18 months.

### The 14 slugs (inventory — DO NOT RENAME without completing the audit below)

Two columns below are **audit inputs** — fill during Day 3. `Backend references` = grep `backend/` (routers, schemas, notification/email templates) for the slug literal. `Last modified` = `git log -1 --format=%ad <path> -- <subpath>` for the tab component's `.vue` file.

| # | slug | used by | notification types that deep-link here | Backend references | Last modified |
|---|---|---|---|---|---|
|  1 | `dashboard` | `OrderDetail.vue` | `ORDER_STAGE_CHANGE` | _(Day 3)_ | _(Day 3)_ |
|  2 | `items` | `OrderDetail.vue`, `ClientOrderDetail.vue` | `ITEMS_PENDING_APPROVAL`, `ITEMS_PENDING_CONFIRMATION`, `ITEMS_CLIENT_CONFIRMED`, `ITEMS_APPROVED`, `ITEM_CONFIRMED`, `PRICES_SENT_FOR_REVIEW` | _(Day 3)_ | _(Day 3)_ |
|  3 | `payments` | `OrderDetail.vue`, `ClientOrderDetail.vue` | `PAYMENT_SUBMITTED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED` | _(Day 3)_ | _(Day 3)_ |
|  4 | `production` | `OrderDetail.vue`, `ClientOrderDetail.vue` | — (no notification) | _(Day 3)_ | _(Day 3)_ |
|  5 | `packing` | `OrderDetail.vue`, `ClientOrderDetail.vue` | `PACKING_DECISION` | _(Day 3)_ | _(Day 3)_ |
|  6 | `booking` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
|  7 | `sailing` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
|  8 | `shipping-docs` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
|  9 | `customs` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
| 10 | `after-sales` | `OrderDetail.vue` | `AFTER_SALES_SUBMIT` | _(Day 3)_ | _(Day 3)_ |
| 11 | `final-draft` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
| 12 | `queries` | `OrderDetail.vue`, `ClientOrderDetail.vue` | `ITEM_QUERY_CREATED`, `ITEM_QUERY_REPLY` | _(Day 3)_ | _(Day 3)_ |
| 13 | `files` | `OrderDetail.vue` | — | _(Day 3)_ | _(Day 3)_ |
| 14 | `landed-cost` | `OrderDetail.vue` | — (transparency clients only) | _(Day 3)_ | _(Day 3)_ |

> Record format for `Backend references`: count + comma-separated file list, e.g. `3 · services/notifications.py, templates/email/payment_submitted.html, docs/ops/stage_guide.md`. Zero references → `0 · none`.
> Record format for `Last modified`: `YYYY-MM-DD` of the last commit that touched the tab's `.vue` file. Helps identify cold/legacy slugs vs actively-evolving ones.

### Options

| Option | Description |
|---|---|
| **A** | Freeze the slugs. Document as immutable. New Next.js app uses these exact strings as route segments forever. |
| **B** | Version the URL contract. Old slugs redirect to new slugs. Adds a redirect layer but lets you modernize naming. |
| **C** | Audit external dependencies first. Grep email templates, notification service, SMS, third-party integrations for these strings, then decide. |

### Recommendation — **Option C, then almost certainly A**
Spend 2 hours grep-ing downstream systems. The expected outcome is that 9+ of the 14 are externally referenced, at which point Option A is the only honest choice.

### External audit template (fill during Day 3)

Grep the following systems for each slug. Record findings inline.

| System to grep | Repo / location | Result |
|---|---|---|
| Email templates | `backend/` templates + `services/notifications.py` | [ ] searched — _findings: _ |
| Push notifications | `backend/services/notifications.py` | [ ] searched — _findings: _ |
| SMS templates (if any) | — | [ ] N/A or path: _ |
| Admin playbooks / runbooks | `docs/ops/` | [ ] searched — _findings: _ |
| Third-party integrations | webhooks, CRM, accounting | [ ] searched — _findings: _ |
| User-facing docs / FAQ | `docs/` | [ ] searched — _findings: _ |

### Action items
- [ ] **D-002-A1** Complete external audit (Day 3)
- [ ] **D-002-A2** After audit, promote Option A/B to accepted status, lock the 14 slugs in a dedicated `CROSS_CUTTING.md` section
- [ ] **D-002-A3** Update Pass B prompt: tab slugs in OrderDetail sub-tab profiles (Wave 8) must reference this table, not invent new names

---

## D-003 — Destructive-action UX policy (replace native `confirm()` / `alert()`)

**Status:** PROPOSED — build Layer-2 `<ConfirmDialog>` in Wave 0
**Surfaced by:** Wave 1 audit (`Settings.vue` uses `confirm('Delete this category?')`, `confirm('Delete this transit route?')`; `Users.vue` uses `alert()` on toggle-active failure). Likely recurs in master data CRUD pages in Wave 4.

### Problem
Destructive ops in the current Vue app are gated by the browser's default `window.confirm()` / `window.alert()` dialogs. Users dismiss these reflexively without reading. There is no "type DELETE to confirm" pattern, no description of consequences, no bilingual copy. This is a **safety hole in the existing app**, not just a style issue.

### Decision
Build a Layer-2 `<ConfirmDialog>` component in Wave 0 with these exact props:

```tsx
// String types are defined in D-005. DialogString requires a non-empty `ta` at the type level.
import type { DialogString } from './types/strings'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  title: DialogString
  message: DialogString
  consequenceText: DialogString                   // "This will delete 47 line items and cannot be undone"

  destructive?: boolean                           // renders red CTA
  requireTypedConfirmation?: string               // e.g. "DELETE" — user must type this exactly
  confirmLabel?: DialogString                     // default: "Delete" if destructive, else "Confirm"
  cancelLabel?: DialogString

  // Carry upstream context so the user sees exactly what they're about to affect.
  // Example: { summary: "Shipment SH-023 · 47 line items · ETD 2026-05-02", affectedItems: 47 }
  // `summary` is the dev-facing / English fallback; `bilingualSummary` is rendered when present.
  preserveContext?: {
    summary: string
    bilingualSummary?: DialogString
    affectedItems?: number
  }

  onConfirm: () => void | Promise<void>
}
```

Every page profile that currently uses native `confirm()` / `alert()` gets a **migration note**:
> Replace native `confirm()` with `<ConfirmDialog destructive message={{en: '…', ta: '…'}} consequenceText={{en: '…', ta: '…'}} onConfirm={…} />`.

For the highest-stakes operations (hard-delete users, bulk-cancel orders, FX rate change that affects settled orders), also set `requireTypedConfirmation="DELETE"`.

### Sites that must use this in the rebuild
Known from Wave 1 audit:
- [ ] `Settings.vue` — `deleteCategory` (medium risk)
- [ ] `Settings.vue` — `deleteTransit` (low risk)
- [ ] `Users.vue` — `toggleActive` error (was `alert`, becomes toast instead)

Wave 4+ will surface more — every master-data `delete` call, every order cancellation, every BOE/shipment deletion.

### Action items
- [ ] **D-003-A1** Write component spec (props + accessibility + keyboard behavior) as part of Wave 0
- [ ] **D-003-A2** Update Pass B prompt: every native `confirm()` / `alert()` call in profiled code gets a explicit "Replace with `<ConfirmDialog>`" line in migration notes

---

## D-004 — SUPER_ADMIN role consistency (**production data exposure — highest priority**)

**Status:** PROPOSED — three-part action, hotfix in existing app is immediate
**Surfaced by:** Wave 1 audit (`Users.vue:336` caption states SUPER_ADMIN has "real factory pricing visibility", but `useAuth.js:138-145` treats SUPER_ADMIN and ADMIN identically; `Sidebar.vue:125-132` role-color map has no entry for SUPER_ADMIN).

### Problem
SUPER_ADMIN is a distinct role with "real factory pricing visibility" per `Users.vue`. But every auth guard in the codebase uses `user.role === 'ADMIN'` or `isAdmin` — which treats SUPER_ADMIN and ADMIN as equivalent. Translated: **a regular ADMIN may already be seeing data (factory COGS, real margins) they shouldn't.** This is a live-app data exposure, independent of the migration.

### Actions

#### Action 1 — Audit + hotfix (THIS WEEK)

**Backend first.** A Vue-only fix is worthless if the API still leaks — an attacker can hit `/api/orders/:id` directly as an ADMIN and read whatever the backend serialiser returns. Fix the server, then fix the UI.

- [ ] **D-004-A1** **Backend audit.** Grep `backend/core/security.py`, every `require_admin` / `get_current_user` dependency, every `current_user.role ==` / `is_admin` check, and every response serialiser that returns factory pricing / real cost / margin fields. For each: decide SUPER_ADMIN (factory pricing, real COGS, margins) vs ADMIN (user management, settings, audit logs, non-financial ops). Ship backend hotfix first. Log: `Backend shipped: [date] · [sha]`.
- [ ] **D-004-A2** **Frontend hotfix (existing Vue).** Only after A1 is shipped. Grep for every `isAdmin`, `user.role === 'ADMIN'`, `hasRole('ADMIN')`, `'ADMIN'` literal. Apply the same decision as the corresponding backend check. Log: `Frontend shipped: [date] · [sha]`.
- [ ] **D-004-A3** Confirm with team who should be SUPER_ADMIN today. Expected: only Sachin during the migration.
- [ ] **D-004-A4** End-to-end smoke test: log in as ADMIN (not SUPER_ADMIN), hit every page that previously showed factory pricing, confirm the pricing fields are stripped both in the network response and in the rendered DOM.

#### Action 2 — Permission matrix Layer-1 file (Wave 0 of migration)
Build `src/lib/permissions.ts` as the single source of truth:

```ts
export const PERMISSIONS = {
  // Pricing visibility
  'view_factory_real_pricing':           ['SUPER_ADMIN'],
  'view_factory_quoted_pricing':         ['SUPER_ADMIN', 'ADMIN'],
  'view_supplier_chinese_yuan_pricing':  ['SUPER_ADMIN'],  // raw CNY from Chinese supplier — confirm scope with Sachin
  'view_selling_pricing':                ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'],

  // User + org management
  'manage_users':                ['SUPER_ADMIN', 'ADMIN'],
  'view_audit_logs':             ['SUPER_ADMIN', 'ADMIN'],
  'manage_system_settings':      ['SUPER_ADMIN', 'ADMIN'],

  // Master data
  'view_products_master':        ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'VIEWER'],
  'edit_products_master':        ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'manage_factories':            ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'manage_clients':              ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'FINANCE'],
  'manage_transport':            ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],

  // Orders
  'create_orders':               ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'transition_order_stages':     ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'approve_client_inquiries':    ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],

  // Finance
  'view_finance':                ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  'verify_payments':             ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  'view_client_ledger':          ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  'view_factory_ledger':         ['SUPER_ADMIN', 'FINANCE'],  // ADMIN deliberately excluded?

  // After-sales / warehouse / quality
  'view_aftersales':             ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'resolve_aftersales':          ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],
  'view_warehouse_stock':        ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'],

  // Review queues
  'approve_product_requests':    ['SUPER_ADMIN', 'ADMIN'],
} as const

export type Permission = keyof typeof PERMISSIONS
export function hasPermission(user: User | null, perm: Permission): boolean {
  if (!user) return false
  return PERMISSIONS[perm].includes(user.role as never)
}
```

- [ ] **D-004-A5** Sachin reviews + edits the above matrix during Wave 0 (several rows marked `[UNCLEAR]` in Wave 1 profiles go here).
- [ ] **D-004-A6** Rule: **no component in the Next.js app checks `user.role` directly.** Everything goes through `hasPermission(user, '…')`.

#### Action 3 — Document in `CROSS_CUTTING.md` (Wave 9)
- [ ] **D-004-A7** When the final `CROSS_CUTTING.md` is generated, the permission matrix is included verbatim as the canonical source of truth. Every page profile's "Permissions / role gating" section references the permission keys, not role names.

### Action items (rolled up)
- [ ] **D-004 — Ship hotfix in production Vue app** (blocks Wave 2)
- [ ] **D-004 — Draft `permissions.ts` skeleton** (blocks Wave 2)
- [ ] **D-004 — Full matrix reviewed with Sachin** (Wave 0)

---

## D-005 — Bilingual (Tamil + English) policy

**Status:** PROPOSED — Option B for first release, architecture for Option C
**Surfaced by:** Wave 1 audit found zero Tamil strings in any of the 9 Wave-1 files. The Pass B template requires a "Bilingual labels (Tamil + English pairs)" section in every profile.

### Problem
Inventory-wide: **zero Tamil strings anywhere in the current codebase.** The bilingual requirement is forward-looking, not reverse-engineered. The question is when and where Tamil gets added.

### Options

| Option | Description |
|---|---|
| **A** | Tamil everywhere, including admin/internal pages. Max consistency; biggest translation scope. |
| **B** | Tamil on user-facing portals only (client + factory). Internal/admin stays English-only. Practical, matches actual user need. |
| **C** | User-language preference — each user picks. Components render in their language with optional secondary tooltip. |

### Recommendation — **Option B for first stable release, Option C as architecture goal**

Layer 1's `strings.ts` stores both `{ en, ta }` for every label, **even if `ta` is empty for internal pages today**. The render layer picks which to show based on (a) current portal and (b) future user preference. Switching from B → C becomes a render-layer change, not a string-extraction change.

### Consequences / conventions
- Every page profile's "Bilingual labels" section is populated as `{ en, ta }` pairs. If `ta` is not yet known, write `ta: null` or `ta: ''` — never omit the key.
- For internal / admin pages (Wave 1, parts of Wave 4/5), `ta` is permitted to be an empty string in Layer 1 — but the key must exist.
- For client / factory portals (Waves 2 + 3) and any user-facing confirmation dialogs, `ta` is **mandatory non-empty** before the page is considered migration-ready. Translations get reviewed by a native speaker before merge.

### Type-level enforcement pattern

The convention above is carried by runtime discipline alone if we stop there. To make it impossible to ship a PortalString or DialogString without a Tamil translation, use three distinct TypeScript types at the string layer:

```ts
// src/lib/types/strings.ts — the single source of truth for string shapes.

/**
 * Internal / admin pages — ta is optional and may be empty or omitted.
 * Use for anything inside /dashboard, /settings, /users, /audit-logs, etc.
 */
export type InternalString = { en: string; ta?: string }

/**
 * User-facing portal strings (client portal + factory portal).
 * ta is required at the TYPE level — TypeScript fails to compile without it.
 * Empty string counts as "missing" at lint time via a custom ESLint rule.
 */
export type PortalString = { en: string; ta: string }

/**
 * Dialog / confirmation / toast / error copy seen by any user-facing operator
 * (internal OR portal). These are the moments where a misread string can cause
 * a destructive action to happen by accident — so ta is required for every
 * <ConfirmDialog>, <Toast>, and inline error banner, regardless of portal.
 */
export type DialogString = { en: string; ta: string }
```

**Rules for every `strings.ts` entry:**
1. Every string literal is annotated as one of `InternalString | PortalString | DialogString`.
2. `PortalString` and `DialogString` cannot be declared with `ta: ''` — a custom ESLint rule (`no-empty-tamil`) fails the build. (Plain type-level enforcement only catches missing keys, not empty values; ESLint closes that gap.)
3. `InternalString` is permitted with omitted `ta` or `ta: ''`. A follow-on pass during Option-B → Option-C migration upgrades these to `PortalString` as translations land.
4. Components consume strings by type: a `<ConfirmDialog>` prop typed `DialogString` cannot accept an `InternalString` — TypeScript fails at the call site.

This is **directly consumed by D-003** — every label prop on `<ConfirmDialog>` is typed `DialogString`, and `preserveContext.bilingualSummary` uses `DialogString` too.

### Action items
- [ ] **D-005-A1** Pick i18n library (likely `next-intl` or `i18next`) in Wave 0
- [ ] **D-005-A2** Name a translator / reviewer for Tamil strings
- [ ] **D-005-A3** Update Pass B prompt: bilingual-labels section always structured as `{ en, ta }` pairs, annotated with the string type (`InternalString` / `PortalString` / `DialogString`). Empty `ta` allowed for `InternalString` only.
- [ ] **D-005-A4** Ship `src/lib/types/strings.ts` with the three types + the `no-empty-tamil` ESLint rule during Wave 0. Block the build on violations in client/factory portals and all dialog sites.

---

## D-006 — Portal permission enforcement policy

**Status:** RATIFIED 2026-04-21  
**Surfaced by:** Security session 2026-04-20 to 2026-04-21 (G-002, G-003, G-004 findings).

### Decision

Frontend-only portal permissions (`show_*`, `items_*`) are **deprecated as a security mechanism.** All portal permissions MUST be enforced server-side in the API layer. Frontend continues to hide UI affordances for UX, but the backend is the sole authority.

Prior to this decision, `show_payments` (enforced) and `show_packing` (enforced) were the only portal permissions checked at the backend. The remaining 10 flags were enforced by the Vue component layer only — a CLIENT could bypass them by calling the API directly.

### Canonical enforcement pattern

Established by Patches 6 and 7 (`backend/routers/shipping.py`, `backend/routers/aftersales.py`):

```python
if current_user.user_type == "CLIENT":
    client = db.query(Client).filter(Client.id == current_user.client_id).first()
    if not client:
        raise HTTPException(status_code=403, detail="Access denied")
    perms = client.portal_permissions or {}
    if not perms.get("show_<field>", False):
        raise HTTPException(status_code=403, detail="<Feature> access not enabled for your account")
```

INTERNAL and FACTORY callers pass through unchanged. The check fires before any data query.

### Consequences for Wave 0

- Every remaining open portal permission finding (G-001, G-005, G-006, Clusters C/D) must be fixed server-side before any Next.js page reaches production.
- In the new SDK layer, portal permission checks must live in FastAPI dependencies or inline guards — not in Next.js middleware or React components alone.
- When generating the typed SDK from OpenAPI, endpoints that enforce portal permissions must be documented with the specific permission flag required.

### Blocks production rollout

Production rollout of the new Next.js frontend is blocked until G-001, G-005, and G-006 are CLOSED under this policy.

### Action items
- [x] **D-006-A1** Patch G-002 and G-003 (Patches 6 and 7) — DONE 2026-04-21
- [ ] **D-006-A2** Patch G-001 (frontend route guard + confirm backend already enforces)
- [ ] **D-006-A3** Patch G-005 / Clusters C and D (strip pricing fields from CLIENT/FACTORY responses)
- [ ] **D-006-A4** Patch G-006 (backend enforcement for `show_production`, `show_files`)
- [ ] **D-006-A5** Document enforcement pattern in Wave 0 SDK layer spec

---

## D-007 — `consolidateByProduct()` dead code disposition

**Status:** RATIFIED 2026-04-22
**Surfaced by:** Wave 5 audit (`ReturnsPending.vue`, `internal_returns_pending.md`).

### Problem

`ReturnsPending.vue` defines a `consolidateByProduct()` function intended to merge unloaded items from the same product across multiple orders into a single row. The implementation uses `reduce` keyed on `item.id` — a field that is unique per record — so each group always contains exactly one entry. Cross-order consolidation never occurs in practice. The function is a no-op.

### Decision

**Do not port `consolidateByProduct()` to the Next.js rebuild.** In the rebuild, render the merged flat list (unloaded items + after-sales carry-forwards) directly without client-side consolidation. If genuine product-level consolidation is required as a feature, implement it server-side and return pre-aggregated rows from the API.

### Consequences

- `internal_returns_pending.md` migration note already records this as dead code.
- No backend changes required.
- Wave 0: remove the function and simplify the item list rendering to a flat map.

### Action items
- [ ] **D-007-A1** Remove `consolidateByProduct()` from Next.js `ReturnsPending` equivalent page during Wave 0 implementation.

---

## D-008 — WarehouseStock route fate

**Status:** RATIFIED 2026-04-22 — **Option A selected**
**Surfaced by:** Wave 5 audit (`WarehouseStock.vue`, `internal_warehouse_stock.md`, P-018).

### Problem

`WarehouseStock.vue` is an 11-line stub registered in the internal sidebar navigation at `/warehouse`. It has no implementation, no API calls, and no script logic — only a static card with a heading and description. Any INTERNAL user can navigate to it and sees only a placeholder. This is P-018 (unimplemented stub route in production navigation).

### Options

| Option | Description |
|---|---|
| **A** | Remove `/warehouse` route from `router/index.js` and `Sidebar.vue` navigation. Do not migrate to Next.js. Stock data remains accessible via Orders, Shipments, and UnloadedItems views. |
| **B** | Keep `/warehouse` route and navigation entry. Migrate the stub to Next.js as a placeholder. Implementation deferred to post-migration feature work. |
| **D** | Defer decision to Wave 0. Audit finding recorded; route remains as stub in Vue until Wave 0 determines feature scope. |

### Decision — **Option A**

Remove the `/warehouse` route and its sidebar navigation entry. Do not carry the stub forward into Next.js. The planned statuses described in the static card text (IN_TRANSIT, AT_PORT, CLEARED, DISPATCHED, DELIVERED) partially overlap with existing `OrderStatus` values — if a dedicated warehouse view is needed in the future, it should be scoped and implemented as a new feature, not migrated from a placeholder.

### Consequences

- `router/index.js`: remove the `/warehouse` → `WarehouseStock` route entry.
- `Sidebar.vue`: remove the Warehouse Stock navigation item.
- `WarehouseStock.vue`: file can be deleted.
- No backend changes required — no API exists for this route.

### Action items
- [ ] **D-008-A1** Remove `/warehouse` route from `router/index.js` (existing Vue app — pre-migration cleanup).
- [ ] **D-008-A2** Remove Warehouse Stock nav item from `Sidebar.vue`.
- [ ] **D-008-A3** Delete `frontend/src/views/WarehouseStock.vue`.
- [ ] **D-008-A4** Do not create a `/warehouse` route in the Next.js app.

---

## D-009 — Cluster A resolution (factory ledger AUTH_TOO_PERMISSIVE)

**Status:** CLOSED 2026-04-22 — Patch 18
**Surfaced by:** Wave 5 audit (`FactoryLedger.vue`, `internal_factory_ledger.md`). Logged in `AUTHZ_SURFACE.md` as AUTH_TOO_PERMISSIVE.

### Problem

`/api/finance/factory-ledger/{factory_id}/` and its `/download/` variant are protected by two conflicting dependencies:

- **Router-level** (`/api/finance` main router in `main.py`): `require_finance` = `ADMIN | FINANCE`
- **Endpoint-level** (`finance.py:1475`, `finance.py:1835`): `require_factory_financial` = `SUPER_ADMIN | FINANCE`

Effective access = intersection = **FINANCE only**. Per D-004, SUPER_ADMIN should have factory cost data access and ADMIN should not. The current implementation achieves ADMIN exclusion but incorrectly excludes SUPER_ADMIN. SUPER_ADMIN users receive a silent 403 (swallowed by P-002) and see an empty ledger.

### Decision

Resolve during Wave 0 backend work. Recommended approach: widen the router-level `require_finance` dependency for the factory-cost sub-routes (factory-ledger and its download endpoint) to include SUPER_ADMIN, and rely on the endpoint-level `require_factory_financial` (SUPER_ADMIN | FINANCE) as the authoritative check. Alternatively, move these endpoints to a dedicated router mounted with `require_factory_financial` directly.

Do not change the existing Vue app — the fix belongs in the Next.js backend from the start.

### Consequences

- After fix: effective access = SUPER_ADMIN | FINANCE (correct per D-004).
- ADMIN remains excluded from factory cost data (D-004 compliant).
- SUPER_ADMIN can access Factory Ledger and its download endpoint.
- `internal_factory_ledger.md` migration note 1 already documents the recommended fix.

### Action items
- [x] **D-009-A1** `require_finance` widened to `[SUPER_ADMIN, ADMIN, FINANCE]` in `core/security.py`. All 9 endpoints retain `require_factory_financial` at endpoint level. Effective access = SUPER_ADMIN | FINANCE confirmed 27/27 (2026-04-22).
- [ ] **D-009-A2** Add frontend role gate in Next.js: show Factory Ledger tab only to FINANCE and SUPER_ADMIN; hide from ADMIN.
- [x] **D-009-A3** `AUTHZ_SURFACE.md` Cluster A entry updated to RESOLVED (2026-04-22).

---

## D-010 — OPERATIONS role scope for margin and supplier finance data

**Status:** RATIFIED 2026-04-22
**Surfaced by:** Wave 8 Session A audit (`ordertab_dashboard.md` Q-001, `ordertab_payments.md` Q-002) — OPERATIONS role visibility of `factory_total_inr` in the dashboard `estProfit` computation and the Factory Payments section.

### Decision

**OPERATIONS role is excluded from factory/supplier margin and finance data.**

Specifically:

- **`estProfit` (Order Dashboard tab):** `estProfit` is derived from `factory_total_inr` (aggregate factory cost). OPERATIONS cannot see this figure. Visibility restricted to **SUPER_ADMIN | FINANCE | ADMIN** only.
- **Factory Payments section (Payments tab):** The Factory Payments section — which renders `factory_total_inr`, `factory_total_cny`, and all factory remittance records — is restricted to **SUPER_ADMIN | FINANCE | ADMIN**. OPERATIONS excluded.

### Rationale — Scenario 2 (growing team, external hires expected)

OPERATIONS handles logistics execution: shipping coordination, packing decisions, production tracking, customs, and after-sales. Supplier payment amounts and order-level margin data belong with the finance function. As the team grows and external OPERATIONS hires are onboarded, factory cost and margin data must not be visible to those roles by default. Role separation from day one avoids a permission audit later. This decision was made with knowledge that OPERATIONS does not need factory cost visibility to execute their core function.

### Implementation (Wave 0 backend tasks)

1. **`backend/routers/dashboard.py` (or payment summary endpoints):** Strip `factory_total_inr` from responses when `current_user.role == "OPERATIONS"`. Use `filter_for_role` or an inline exclusion guard before serialisation.

2. **`backend/routers/finance.py` — Factory Payments endpoints:** Confirm that `paymentsApi.factoryList`, `paymentsApi.factoryCreate`, and `paymentsApi.factoryDelete` endpoints carry a role guard excluding OPERATIONS. Existing `require_finance` router-level guard covers `verify_payment`; verify that the same coverage applies to factory remittance list/create/delete.

3. **Frontend DashboardTab:** Hide the Factory & Costs panel (estProfit row) when `current_user.role === 'OPERATIONS'`. Backend enforcement is the primary control; frontend is defence-in-depth.

4. **Frontend PaymentsTab:** Hide the Factory Payments section when `current_user.role === 'OPERATIONS'`. Same defence-in-depth principle.

5. **Severity:** MEDIUM (information disclosure, not privilege escalation). Now unblocked by this ratification. Tracked in `SECURITY_BACKLOG.md`.

### Related open item — CustomsTab `unit_price_cny` (Wave 0 product decision required)

`unit_price_cny` in the CustomsTab BOE per-part table is the same family of factory pricing data. It requires a **separate Wave 0 product decision** (see `ordertab_customs.md` Q-001) because it is operationally tied to customs duty calculation. Two options:

- **(a)** Extend D-010 exclusion to CustomsTab — restrict BOE creation/editing to ADMIN|FINANCE|SUPER_ADMIN only; customs filing becomes a finance function.
- **(b)** Accept `unit_price_cny` exposure as operationally necessary — document the explicit OPERATIONS exception.

This sub-decision does not block Wave 0 start; it must be resolved before Wave 8 (CustomsTab) migration.

### Consequences

- `ordertab_dashboard.md` Q-001 updated to RESOLVED.
- `ordertab_payments.md` Q-002 updated to RESOLVED.
- `ordertab_customs.md` Q-001 updated to RELATED TO D-010 — separate sub-decision pending Wave 0.

### Action items

- [ ] **D-010-A1** Strip `factory_total_inr` from OPERATIONS role responses on dashboard payment summary endpoints (Wave 0 backend).
- [ ] **D-010-A2** Confirm factory payment list + create + delete endpoints exclude OPERATIONS (Wave 0 backend verification).
- [ ] **D-010-A3** Hide Factory & Costs panel / estProfit row in DashboardTab for OPERATIONS callers (Wave 0 frontend defence-in-depth).
- [ ] **D-010-A4** Hide Factory Payments section in PaymentsTab for OPERATIONS callers (Wave 0 frontend defence-in-depth).
- [ ] **D-010-A5** CustomsTab `unit_price_cny` — resolve Wave 0 product decision: option (a) or (b). Record outcome in DECISIONS.md as D-010 amendment.

---

## Day-by-day plan (this week)

| Day | Work |
|---|---|
| **Day 1 (today)** | Review this file. Accept / reject / edit each recommendation. Sign at the bottom. |
| **Day 2** | Ship the SUPER_ADMIN hotfix in the existing Vue app (D-004 Actions A1–A4). Record commit SHA in this file. |
| **Day 3** | Grep downstream systems for the 14 order-tab slugs (D-002 external audit). Fill the table. Lock the final decision (A or B). |
| **Day 4** | Update the Pass B prompt template so Wave 2 onward references this file as a constraint. Update checklist. |
| **Day 5** | Re-audit the two pre-interrupt profiles (`client_layout.md`, `client_profile.md`) against this charter. Touch up as needed. Launch Wave 2. |

---

## Sign-off

| Decision | Recommendation | Accepted? | Notes |
|---|---|---|---|
| D-001 API policy | Option B (single client) | [ ] | |
| D-002 Slug contract | Option C → A (audit then freeze) | [ ] | |
| D-003 ConfirmDialog | Build Layer-2 component | [ ] | |
| D-004 SUPER_ADMIN | Hotfix + permission matrix | [ ] | |
| D-005 Bilingual | Option B (portals-only today, C-ready) | [ ] | |
| D-006 Portal permission enforcement | Backend-authoritative; frontend UX only | [x] RATIFIED 2026-04-21 | Canonical pattern in shipping.py / aftersales.py |
| D-007 `consolidateByProduct()` | Dead code — do not port | [x] RATIFIED 2026-04-22 | No-op confirmed: groups by item.id (unique) |
| D-008 WarehouseStock route | Option A — remove route + nav + file | [x] RATIFIED 2026-04-22 | |
| D-009 Cluster A factory ledger auth | Widen router dep to include SUPER_ADMIN | [x] CLOSED 2026-04-22 — Patch 18 | `require_finance` = [SUPER_ADMIN, ADMIN, FINANCE]; 9 endpoints retain endpoint-level `require_factory_financial`; 27/27 matrix pass |
| D-010 OPERATIONS visibility scope | Exclude OPERATIONS from estProfit + Factory Payments | [x] RATIFIED 2026-04-22 | Scenario 2: external hires; margin + supplier finance belong with finance function |

**Signed:** _____________  **Date:** _________

---

## Open questions carried forward (to be resolved during Wave 0)

Lifted from Wave 1 profiles. These don't block the launch checklist but need answers before Wave 0 ends:

- `D-004` Should ADMIN see the factory ledger? (Permission matrix row `view_factory_ledger` currently excludes ADMIN — deliberate?)
- `D-001` Are `clientsApi.setBrands` and `clientsApi.getMarkups` dead code, or do they power paths we haven't audited?
- Should `Session Expired` appear on `/login?session_expired=true`? (Login page currently ignores the query param.)
- Sidebar notification polling — stay at 10s, or migrate to SSE/WebSocket?
- Should user deletion (hard delete) ever be permitted for GDPR / right-to-erasure?
- `Settings.vue` — is seeding idempotent or overwriting? (confirm backend behavior)
