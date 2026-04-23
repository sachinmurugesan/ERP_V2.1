# Login

**Type:** page
**Portal:** shared (renders outside any portal layout; `meta.public: true`)
**Route:** `/login`
**Vue file:** [frontend/src/views/Login.vue](../../../frontend/src/views/Login.vue)
**Line count:** 110
**Migration wave:** Wave 1 (foundational / auth shell)
**Risk level:** medium (authentication entry point — auth flow bug blocks all portals; session-refresh redirect path must be preserved)

## Purpose (one sentence)
Email/password sign-in form that authenticates against `/api/auth/login`, stores the access token in `localStorage`, and redirects the user to `data.user.portal` (falling back to `/dashboard`).

## Layout (top→bottom, left→right, exhaustive)

### Full-screen container
- Background: diagonal gradient `from-slate-900 via-slate-800 to-slate-900` — covers full viewport (`min-h-screen`), centers content vertically and horizontally with padding `p-4`.

### Centered column (max-width 28rem / `max-w-md`)

**Zone 1 — Logo header (top, centered)**
- 64x64 rounded tile (`w-16 h-16 rounded-2xl`) with gradient `from-emerald-400 to-cyan-400`, shadow-xl, containing a single emoji: 🏗️ (unicode `&#127959;&#65039;`).
- Title `HarvestERP` in `text-3xl font-bold text-white`.
- Subtitle `Supply Chain Management System` in `text-slate-400 text-sm`.

**Zone 2 — Login card** (white rounded-2xl, shadow-2xl, `p-8`)
- Card title: `Sign in to your account` (`text-xl font-bold text-slate-800`).
- Conditional error banner (visible only when `error !== ''`): red background (`bg-red-50 border border-red-200`), red-700 text, shows `pi pi-exclamation-circle` icon + message.
- `<form @submit.prevent="handleLogin">` with `space-y-4`:
  1. **Email field**: `<label>Email</label>`; wrapper `<div class="relative">` containing `pi pi-envelope` icon absolutely positioned (left-3), `<input type="email" placeholder="admin@harvesterp.com" autofocus>`. Green-500 focus ring. Disabled when `loading`.
  2. **Password field**: `<label>Password</label>`; icon `pi pi-lock` on left; `<input :type="showPassword ? 'text' : 'password'">`; trailing toggle button (right-3) with icon `pi pi-eye` / `pi-eye-slash`.
  3. **Submit button**: gradient `from-emerald-500 to-cyan-500`, full-width, shadow-lg. Shows spinner `pi pi-spin pi-spinner` + text `Signing in...` while `loading === true`, otherwise `Sign in`. Disabled during load.
- Footer hint (under separator): `text-xs text-slate-400 text-center` — literal copy: `See FIRST_RUN_CREDENTIALS.txt for initial login`.

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| Logo / brand | static | emoji + plain text | no API |
| Error message | `useAuth().login()` rejection → `e.response?.data?.detail` | plain string | shown in red banner |

## Interactions (every clickable/typeable element)
| Trigger | Action | API call | Result |
|---|---|---|---|
| Type in email `<input>` | updates `email` ref | none | — |
| Type in password `<input>` | updates `password` ref | none | — |
| Click password eye toggle | toggles `showPassword` | none | input type flips between `text` and `password` |
| Submit form (Enter, or click `Sign in`) | `handleLogin()` | `POST /api/auth/login` via `useAuth().login()` (direct axios call in composable, bypasses `api/index.js`) | on success `router.push(data.user?.portal || '/dashboard')`; on failure populates `error.value` |

## Modals/dialogs triggered (inline in this Vue file)
None. All content is inline on the full-screen login view.

## API endpoints consumed (from src/api/index.js)
**None.** Login calls `axios.post('/api/auth/login', …)` directly inside [composables/useAuth.js:84](../../../frontend/src/composables/useAuth.js#L84) — not through the `api/index.js` module registry. `withCredentials: true` is used so the refresh token can be set as an `httpOnly` cookie by the backend.

## Composables consumed
- **`useAuth`** — uses `login(email, password)` and the `loading` ref. `login()` stores the access token into `localStorage.harvesterp_token`, sets the axios `Authorization` default header, and returns `{ access_token, user }`.

## PrimeVue components consumed
**None.** The form is hand-rolled with Tailwind. The only PrimeIcons classes (`pi-envelope`, `pi-lock`, `pi-eye`, `pi-eye-slash`, `pi-exclamation-circle`, `pi-spin pi-spinner`) come from the `primeicons` package (bundled with PrimeVue but usable standalone as CSS).

## Local state (refs, reactive, computed, watch)
- `email: ref('')`
- `password: ref('')`
- `error: ref('')`
- `showPassword: ref(false)`
- `{ login, loading } = useAuth()` (loading is a module-level ref)

No `computed` or `watch` used.

## Permissions/role gating
- Route `meta.public: true` → bypasses the global `router.beforeEach` auth guard (see [router/index.js:344](../../../frontend/src/router/index.js#L344)).
- Guard has a reverse rule: if an already-authenticated user visits `/login`, they get redirected via `next(getPortalPath())` to their portal ([router/index.js:369-371](../../../frontend/src/router/index.js#L369)).
- The API response interceptor in [api/index.js:47-49](../../../frontend/src/api/index.js#L47) redirects expired sessions to `/login?session_expired=true` — **this page does NOT surface the `session_expired` query param** (no `useRoute()`, no banner for it). [UNCLEAR — needs Sachin review: should "Session expired, please sign in again" be shown when `?session_expired=true` is present?]

## Bilingual labels (Tamil + English pairs)
None. Entire file is English-only. The whole codebase appears to be English-only (no Tamil strings grep'd in any Wave-1 file). [UNCLEAR — needs Sachin review: is bilingual copy part of the migration, or is this a forward-looking requirement only?]

## Empty/error/loading states
- **Empty (initial):** email + password empty, no error banner, submit enabled.
- **Client-side validation:** if either field is empty on submit, `handleLogin()` sets `error.value = 'Please enter email and password'` and returns without calling the API. Guard at [Login.vue:16](../../../frontend/src/views/Login.vue#L16).
- **Loading:** `loading = true` disables all inputs and the submit button; submit shows spinner + `Signing in...`.
- **Server error:** `error.value = e.response?.data?.detail || 'Login failed. Please try again.'` rendered in red banner above the form.

## Business rules (the non-obvious ones)
1. **Portal routing is server-driven, not client-derived.** After login, the client trusts `data.user?.portal` returned by `/api/auth/login` and redirects there. It only falls back to `/dashboard` if the server did not return a portal. This means the backend must return `portal` based on `user_type` (CLIENT → `/client-portal`, FACTORY → `/factory-portal`, INTERNAL → `/dashboard`).
2. **Refresh token is NOT stored in localStorage.** Per [composables/useAuth.js:89](../../../frontend/src/composables/useAuth.js#L89), only the access token goes to `localStorage`. The refresh token is set as an `httpOnly` cookie by the backend (`withCredentials: true`).
3. **Silent refresh on 401.** Any subsequent 401 from `api/index.js` triggers a `POST /auth/refresh/` with `withCredentials: true`; if that succeeds the original request is retried transparently ([api/index.js:29-50](../../../frontend/src/api/index.js#L29)). This page is not involved in that path — but it is the destination if refresh fails.
4. **Dev hint literal** (`See FIRST_RUN_CREDENTIALS.txt for initial login`) is hard-coded and should be removed in a production build.

## Known quirks
- Hard-coded email placeholder `admin@harvesterp.com` stays even after a failed login.
- There is no "Forgot password" link anywhere in the codebase. [UNCLEAR — needs Sachin review.]
- There is no social / SSO option — only email + password.
- Autofocus on email field; tab order proceeds Email → Password → eye-toggle → Submit. The eye-toggle is a `<button type="button">` so it won't accidentally submit the form.

## Migration notes
- **Claude Design template mapping:** Likely **Guided Operator** (minimal chrome, single-task focus). Could also be a new **Auth Shell** pattern if login screens are split out in Layer 2.
- **Layer 2 components needed:** `AuthCard`, `BrandMark`, `PasswordInput` (with built-in show/hide eye), `InlineErrorBanner`, `GradientPrimaryButton`. These are primitive enough to generalize across Login, PasswordReset, MFA-challenge.
- **New Layer 1 strings to add:** `auth.login.title`, `auth.login.subtitle`, `auth.login.cta`, `auth.login.cta_loading`, `auth.login.email_label`, `auth.login.password_label`, `auth.login.empty_error`, `auth.login.generic_error`, `auth.login.dev_hint` (kill in prod build), `auth.login.session_expired_notice` (new string to cover `?session_expired=true` flag).
- **Open questions for Sachin:**
  1. Should `?session_expired=true` surface a toast/banner on this page? The interceptor already adds the flag but the page ignores it.
  2. Do you want a "Remember me" checkbox? Current implementation trusts the 7-day refresh token cookie for persistence — nothing configurable.
  3. Confirm: is bilingual (Tamil/English) copy part of this migration's scope? Current code has zero Tamil strings anywhere.
  4. Any branding changes (logo, gradient palette) before we lock Layer 2 primitives?
