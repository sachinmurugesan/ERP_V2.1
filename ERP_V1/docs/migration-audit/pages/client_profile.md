# Client Profile

**Type:** page
**Portal:** client
**Route:** `/client-portal/profile`
**Vue file:** [frontend/src/views/client/ClientProfile.vue](../../../frontend/src/views/client/ClientProfile.vue)
**Line count:** 33
**Migration wave:** Wave 2
**Risk level:** trivial (read-only stub)

## Purpose (one sentence)
Static read-only summary of the authenticated client user's basic fields (full name, email, role, account type).

## Layout (top→bottom, left→right, exhaustive)

### Shell
`<div class="p-6 max-w-2xl mx-auto">` with a single `<h1>My Profile` and one white card.

### Card content (vertical stack, `space-y-4`)
Each field is a label/value pair:
- Full Name: `<label>FULL NAME` + `{{ user?.full_name || '-' }}`
- Email: `{{ user?.email || '-' }}`
- Role: emerald-100 pill showing `user.role` (or `-`)
- Account Type: `{{ user?.user_type || '-' }}`

## Data displayed
| Field | Source | Format | Notes |
|---|---|---|---|
| full_name, email, role, user_type | `useAuth().user` | plain | Values are already hydrated by the global `restoreSession()` in the router guard; no additional fetch |

## Interactions
None — the page has no clickable elements.

## Modals/dialogs triggered (inline)
None.

## API endpoints consumed (from src/api/index.js)
None.

## Composables consumed
- **`useAuth`** — reads `user`.

## PrimeVue components consumed
None.

## Local state
None.

## Permissions/role gating
- Route: `meta.requiresAuth: true, userType: 'CLIENT'`.
- No additional in-page gating.

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
- If `user` is null (edge case — shouldn't happen because `App.vue` blocks rendering until `user` loads), every field shows `-`.

## Business rules (the non-obvious ones)
- **Read-only.** No email change, no password change, no 2FA, no profile picture, no language preference — nothing. This page is effectively a placeholder awaiting roadmap items.
- **Role pill is always green** (`bg-green-100 text-green-700`) regardless of role value. For a CLIENT user the role is `CLIENT`, which is fine. For FACTORY/ADMIN users accidentally routed here, the pill would look generic. [UNCLEAR — can't happen in practice because of portal isolation.]

## Known quirks
- The page is 33 lines — the shortest of the 41 pages. It exists to satisfy the menu entry `Profile → /client-portal/profile`.
- There's no "edit" button, no way to request a change, no support link.

## Migration notes
- **Claude Design template mapping:** **Guided Operator** (read-only summary card) — trivial.
- **Layer 2 components needed:** `DefinitionList` (label + value rows), `RolePill`.
- **New Layer 1 strings to add:** `profile.title`, `profile.field.full_name`, `profile.field.email`, `profile.field.role`, `profile.field.account_type`.
- **Open questions for Sachin:**
  1. Should this page be expanded into a real profile editor (change password, notification prefs, language)?
  2. Should clients see which brands/categories they have access to? That metadata exists server-side (from the Users admin UI) and is not exposed here.
  3. Add a "Contact Support" link?
