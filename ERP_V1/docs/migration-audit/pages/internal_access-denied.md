# Access Denied

**Type:** page
**Portal:** shared (rendered inside admin layout when user is authenticated; bare route otherwise)
**Route:** `/access-denied`
**Vue file:** [frontend/src/views/AccessDenied.vue](../../../frontend/src/views/AccessDenied.vue)
**Line count:** 32
**Migration wave:** Wave 1 (foundational)
**Risk level:** trivial

## Purpose (one sentence)
Static, two-button error page shown when the router's `beforeEach` guard denies a route based on `meta.roles`.

## Layout (top→bottom, left→right, exhaustive)

### Single centered block
- Outer wrapper: `flex items-center justify-center min-h-[60vh]` — centers within the main content area (note: renders **inside** the admin layout's `<main>` slot when the user is authenticated, not on a bare chrome-less page).
- Inner column: `text-center max-w-md`.

**Zone 1 — Icon**
- 80×80 rounded-full tile (`w-20 h-20 rounded-full bg-red-50`) centered, containing an inline SVG "banned / no-entry" glyph (diagonal strike through a circle). Stroke color `text-red-400`, width `1.5`.

**Zone 2 — Copy**
- `<h1>Access Denied` in `text-2xl font-bold text-slate-800`.
- `<p>` explanatory line: `You don't have permission to view this page. Contact your administrator to request access.` — `text-slate-500`.

**Zone 3 — Buttons (flex row, centered, gap 3)**
- **Go to Dashboard** (primary) — emerald-600 background, white text. `router.push('/')` on click. Note: path is `/` which the router redirects to `/dashboard`.
- **Go Back** (secondary) — slate-100 background, slate-700 text. `router.back()` on click.

## Data displayed
| Field | Source | Format | Notes |
|---|---|---|---|
| — | static | — | No dynamic data. |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click **Go to Dashboard** | `router.push('/')` | none | navigates to `/` → redirects to `/dashboard` (internal users) |
| Click **Go Back** | `router.back()` | none | returns to previous history entry |

## Modals/dialogs triggered (inline in this Vue file)
None.

## API endpoints consumed (from src/api/index.js)
None.

## Composables consumed
None. Only `useRouter()` from `vue-router`.

## PrimeVue components consumed
None. Inline SVG icon, hand-rolled buttons, no PrimeIcons.

## Local state (refs, reactive, computed, watch)
None. The file is pure template + `useRouter()`.

## Permissions/role gating
- Route is reachable by any authenticated user; the guard short-circuits at [router/index.js:347](../../../frontend/src/router/index.js#L347) (`if (to.path === '/access-denied') return next()`).
- This page is **the** destination of the `meta.roles` denial path at [router/index.js:391-396](../../../frontend/src/router/index.js#L391).
- CLIENT / FACTORY users are sent to their own portal before this page ever renders for them ([router/index.js:373-381](../../../frontend/src/router/index.js#L373)) — so in practice only INTERNAL users with insufficient role land here.

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
Not applicable — the whole page is a single static state.

## Business rules (the non-obvious ones)
1. **"Go to Dashboard" always works for internal users**, because the `beforeEach` guard only re-denies if they try to re-enter a `meta.roles`-gated route. `/` redirects to `/dashboard` which has no role gate.
2. **Go Back is unsafe for the router.back() path** — if the user landed here directly (new tab, shared link), `router.back()` returns them to the blank session. This is a minor UX issue.
3. The rounded-red-circle SVG is **not** a PrimeIcon — it's an inline `<svg>` with a hand-drawn path. Reusing the same visual in the redesign should preserve the "circle + diagonal slash" metaphor (universally recognizable as "denied").

## Known quirks
- Renders inside the admin layout (so it has sidebar + topbar around it) because `App.vue` shows the admin layout for any authenticated non-portal route.
- There is no way for a CLIENT/FACTORY user to see this page — they'd be caught by portal isolation earlier.
- No telemetry hook — the ERP has no record of "user X attempted to access Y and was denied."

## Migration notes
- **Claude Design template mapping:** **Guided Operator** (single action page) — probably shared with a generic "Empty / Error" pattern.
- **Layer 2 components needed:** `EmptyState` (icon + title + body + primary/secondary actions). Same primitive should serve 404, 500, offline, etc.
- **New Layer 1 strings to add:** `errors.access_denied.title`, `errors.access_denied.body`, `common.go_dashboard`, `common.go_back`.
- **Open questions for Sachin:**
  1. Should we add an "audit log entry" for denied access attempts? Currently silent.
  2. Should the page offer "Request access" (mailto/contact admin) instead of just telling the user to contact their admin?
