# Factory Profile

**Type:** page
**Portal:** factory (`/factory-portal/*` — `user_type === 'FACTORY'`)
**Route:** `/factory-portal/profile` → `FactoryProfile`
**Vue file:** [frontend/src/views/factory/FactoryProfile.vue](../../../frontend/src/views/factory/FactoryProfile.vue)
**Line count:** 30
**Migration wave:** Wave 3 (factory portal)
**Risk level:** none (reads only from in-memory auth session; no API calls; no mutations; no sensitive data beyond what the authenticated user already knows about themselves)

---

## Purpose (one sentence)

Read-only identity card displaying the authenticated factory user's name, email, role badge, and account type sourced entirely from the cached `useAuth` session — no API call is made.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-2xl mx-auto` — rendered inside `FactoryLayout`'s `<router-view />` slot.

**Zone 1 — Page title**
- `h1` "Factory Profile" (`text-xl md:text-2xl font-bold text-slate-800 mb-6`)

**Zone 2 — Profile card** (`bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6`)

Four stacked field groups (`space-y-4`), each with a label and value:

| # | Label | Value | Rendering |
|---|---|---|---|
| 1 | "FULL NAME" | `user?.full_name \|\| '-'` | `text-lg font-medium text-slate-800` |
| 2 | "EMAIL" | `user?.email \|\| '-'` | `text-lg text-slate-800` |
| 3 | "ROLE" | `user?.role \|\| '-'` | Violet pill badge: `px-3 py-1 rounded-full text-sm font-medium bg-violet-100 text-violet-700` |
| 4 | "ACCOUNT TYPE" | `user?.user_type \|\| '-'` | `text-sm text-slate-600` |

Labels are rendered as `<label class="text-xs font-medium text-slate-500 uppercase">`.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `user?.full_name` | `useAuth().user` | `text-lg font-medium` | Fallback `'-'` |
| `user?.email` | `useAuth().user` | `text-lg` | Fallback `'-'` |
| `user?.role` | `useAuth().user` | violet pill badge | Fallback `'-'`; will always be `'FACTORY'` for factory portal users |
| `user?.user_type` | `useAuth().user` | `text-sm text-slate-600` | Fallback `'-'`; will always be `'FACTORY'` for factory portal users |

**Pricing fields:** None. No sensitive financial or order data on this page.

---

## Interactions (every clickable/typeable element)

None. The page is purely display — no buttons, no links, no form fields.

---

## Modals/dialogs triggered

None observed.

---

## API endpoints consumed

None. All data sourced from `useAuth().user` (populated at login; persisted in memory for the session lifetime).

---

## Composables consumed

- **`useAuth`** — reads `user` ref for all four displayed fields. No write operations.

---

## PrimeVue components consumed

None — hand-rolled Tailwind. No PrimeIcons used.

---

## Local state

None. The only binding is `const { user } = useAuth()` — a direct ref from the composable. No `ref`, `reactive`, `computed`, `watch`, or lifecycle hooks declared.

---

## Permissions / role gating

- Route is under `FactoryLayout`, restricted to `user_type === 'FACTORY'` by `router.beforeEach` ([router/index.js:378-380](../../../frontend/src/router/index.js#L378)).
- No API calls — no server-side permission checks triggered by this page.
- The page can only be reached by an authenticated FACTORY user; `user` is guaranteed non-null on this route.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `factory.profile.title` | "Factory Profile" | "" | `PortalString` |
| `factory.profile.label_name` | "Full Name" | "" | `PortalString` |
| `factory.profile.label_email` | "Email" | "" | `PortalString` |
| `factory.profile.label_role` | "Role" | "" | `PortalString` |
| `factory.profile.label_account_type` | "Account Type" | "" | `PortalString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries before Wave 3 is migration-ready (D-005).]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | — | N/A | No async data; no loading state needed |
| Empty / null user | `user` is `null` | Partially — each field shows `'-'` | Functionally unreachable on an authenticated route; `router.beforeEach` redirects unauthenticated users before this component mounts |
| Error | — | N/A | No API calls; no error states |

---

## Business rules (non-obvious)

1. **`user.role` and `user.user_type` are always identical for factory portal users.** Both will read `'FACTORY'`. The distinction exists in the data model (`role` controls permissions within the FACTORY tier; `user_type` controls portal routing), but for the factory portal there is currently only one factory role. Displaying both fields is redundant today.
2. **No edit capability.** Factory users cannot update their name, email, or any profile field through this page. There is no "Edit Profile" button, form, or linked route.
3. **Data freshness.** The displayed values reflect the JWT payload at login time. If `full_name` or `email` is updated in the backend after the user's session starts, the displayed values will not update until the next login.

---

## Known quirks

- **Redundant `role` / `user_type` display.** For all current factory portal users these two values are always `'FACTORY'` and `'FACTORY'`. One of the two fields provides no additional information. [UNCLEAR — are multi-role factory users planned?]
- **No edit functionality.** If a factory user needs to change their contact email or name, there is no self-service path. They would need an INTERNAL admin to make the change.
- **No `factory_id` or factory company name displayed.** The user sees their personal identity but not which factory entity they belong to (e.g., "Sunrise Exports Ltd."). This could be useful context on a profile page.

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

None observed.

---

## Migration notes

1. **Trivial migration.** Replace `useAuth().user` with `useSession()` (Next.js Auth.js) or equivalent. Four field bindings to wire up.
2. **D-005:** All visible strings are `PortalString`; Tamil translations must be non-empty before merge.
3. **Consider showing factory company name.** Add `user?.factory_name` (or a derived field from the auth session) so the user can see which factory entity their account belongs to. Requires the JWT to include `factory_name`, or a separate `/api/factories/{id}` read on mount.
4. **Consider adding a "Contact Support" link.** Factory users with no edit path need a clear way to request profile changes. A `mailto:` link or support-ticket link would be a low-effort improvement.
5. **Remove or consolidate the `role`/`user_type` redundancy.** In the Next.js rebuild, either render one field with a clear label ("Portal: Factory"), or conditionally show `user_type` only when it differs from `role`.
6. **[UNCLEAR — needs Sachin review]:** Are there plans for factory staff sub-roles (e.g., `FACTORY_ADMIN`, `FACTORY_VIEWER`) that would make the `role` field meaningful on this page in future?
