# SEAMS.md — apps/web Task 7

Architectural seam documentation for Task 8+ continuation.

---

## 1. Session cookie — where it lives

| Concern | Location | Notes |
|---------|----------|-------|
| Cookie name | `src/lib/session.ts` → `SESSION_COOKIE` | `harvesterp_session` |
| Set cookie | `src/lib/session.ts` → `setSessionCookie()` | httpOnly, SameSite=Lax, 8h maxAge |
| Clear cookie | `src/lib/session.ts` → `clearSessionCookie()` | Called by logout route |
| Read cookie (server) | `src/lib/session.ts` → `getSessionToken()` | Used in RSC, API routes, middleware |
| Read cookie (client) | Browser sends automatically (same-origin, httpOnly) | Never exposed to JS |

**Task 8** will add refresh token flow here: `refreshSessionCookie(refreshToken)` that calls FastAPI `/api/auth/refresh` and updates the cookie without a login round-trip.

---

## 2. RSC vs Client+React Query split

### RSC (Server Component) data fetching

Pattern: `await getServerClient()` → typed `client.GET(path)`

Used in:
- `src/app/(app)/layout.tsx` — fetches current user for Sidebar
- `src/app/(app)/dashboard/page.tsx` → `RecentOrdersCard` — fetches recent orders

Characteristics:
- Data available before HTML streams to client
- Token injected from cookie server-side via `getServerClient()`
- Never crosses the client boundary; no token exposure

### Client+React Query pattern

Pattern: `useQuery({ queryFn: () => fetch('/api/auth/session') })`

Used in:
- `src/app/(app)/dashboard/_components/quick-stats-card.tsx`

Characteristics:
- Goes through Next.js API route handlers (not directly to FastAPI)
- Cookie sent automatically by browser (same-origin, httpOnly)
- React Query handles caching, polling, and error states
- **Task 9** formalization: nginx strangler-fig may route `/api/orders/*` etc. directly to FastAPI; client code does not change (same fetch path)

### Decision: when to use which?

| Scenario | Pattern |
|----------|---------|
| Page-level data needed before render | RSC via `getServerClient()` |
| Interactive/real-time data (polling, user-triggered refetch) | Client + React Query |
| Form submissions | Client fetch to `/api/auth/*` route handler |
| Server actions (mutations) | Server Action (not implemented in Task 7; add per-feature) |

---

## 3. Component provenance

### Ported from apps/ui-gallery (identical interface)

| Component | Path | Changes from ui-gallery |
|-----------|------|------------------------|
| `Icon` | `src/components/design-system/icon.tsx` | None |
| `HarvestERPLogo` | `src/components/design-system/logo.tsx` | None |
| `DSAvatar` | `src/components/design-system/ds-avatar.tsx` | None |
| `Button` | `src/components/primitives/button.tsx` | None |
| `Card` + sub-components | `src/components/primitives/card.tsx` | None |
| `Input` | `src/components/primitives/input.tsx` | `InputProps` type alias (exactOptionalPropertyTypes compat) |
| `Sidebar` | `src/components/shells/sidebar.tsx` | `onNavigate` wired by NavigationSidebar |
| `Topbar` | `src/components/shells/topbar.tsx` | `onToggleTheme` wired by AppTopbar |
| `RoleGate` | `src/components/composed/role-gate.tsx` | None |

### Net-new components (not in ui-gallery)

| Component | Path | Purpose |
|-----------|------|---------|
| `Label` | `src/components/primitives/label.tsx` | Form label (shadcn pattern, no radix dep) |
| `NavigationSidebar` | `src/components/shells/navigation-sidebar.tsx` | Next.js router bridge for Sidebar |
| `AppTopbar` | `src/components/shells/app-topbar.tsx` | ThemeProvider bridge for Topbar |
| `LoginForm` | `src/app/(auth)/login/_components/login-form.tsx` | Client-side login form |
| `QuickStatsCard` | `src/app/(app)/dashboard/_components/quick-stats-card.tsx` | React Query demo card |

---

## 4. Style/token deviations from Layer 2

**None.** The globals.css and tailwind.config.ts are exact mirrors of apps/ui-gallery, with one change:

- `content: ["./src/**/*.{ts,tsx}"]` (no `./index.html` — Next.js doesn't use one)

The two files will drift if ui-gallery tokens are updated. **Task 8 action**: extract shared Tailwind config and globals.css into `packages/ui-tokens` or expose a CSS bundle from `@harvesterp/lib`.

---

## 5. Option B flag (as requested by Task 7 spec)

Task 7 used **Option A** (port-on-demand): components copied file-by-file from apps/ui-gallery to apps/web as needed.

**Option B** (extract shared `packages/ui` package) is the recommended Wave 1 action:
- Extract `apps/ui-gallery/src/components/` → `packages/ui/src/`
- Both `apps/web` and `apps/ui-gallery` import from `@harvesterp/ui`
- One canonical source of truth for all Layer 2 components
- Eliminates copy-paste drift between apps

Estimated scope: 1 task (~2h), creates `packages/ui` with its own build pipeline.

---

## 6. Middleware seam (Task 9)

`middleware.ts` adds `X-Handled-By: nextjs` to every response. Task 9's nginx strangler-fig proxy reads this header to route traffic:

```
location / {
    proxy_pass http://next-app:3000;
    # If X-Handled-By: nextjs not set, fall through to Vue legacy
}
```

Current public-path list in middleware:
```
/login, /api/auth/, /_next/, /favicon, (files with extensions)
```

When migrating a Vue page to Next.js: add its route to the Next.js app, no middleware changes needed (it will be authenticated automatically).

---

## 7. Auth gaps for Task 8

- [ ] **Session refresh**: no refresh-token cookie set by login route. FastAPI returns `refresh_token` but it's currently discarded. Task 8 adds `harvesterp_refresh` cookie + middleware refresh interceptor.
- [ ] **Session expiry redirect**: middleware only checks cookie presence, not JWT expiry. Task 8 adds JWT decode + expiry check (or delegates to `/api/auth/session` probe).
- [ ] **CSRF protection**: SameSite=Lax handles most cases. If strict CSRF tokens needed, add to Task 8.
- [ ] **Logout all sessions**: current logout only clears client cookie. Server-side token invalidation depends on FastAPI implementation.
