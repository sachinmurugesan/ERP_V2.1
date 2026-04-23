# HarvestERP Migration Runbook

Strangler-fig migration from Vue 3 → Next.js 15.
Pages migrate one at a time; both apps coexist behind a single nginx proxy.

## Table of contents

1. [Architecture](#architecture)
2. [Local development](#local-development)
3. [Adding a migrated page](#adding-a-migrated-page)
4. [Rollback](#rollback)
5. [Cookies and auth](#cookies-and-auth)
6. [Production deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)
8. [Tests](#tests)

---

## Architecture

```
Browser
  │
  ▼
nginx (port 80 dev / 443 prod)
  │
  ├── /login, /dashboard          → Next.js 15   (harvesterp-web/apps/web)
  ├── /_next/*                    → Next.js 15   (static assets + HMR)
  ├── /api/auth/*                 → Next.js 15   (auth API routes)
  ├── /api/*                      → FastAPI      (backend/)
  └── everything else             → Vue 3        (frontend/)
```

**Repos:**
| Component | Path | Dev port |
|-----------|------|----------|
| Vue 3 legacy app | `frontend/` | 5173 (Vite) |
| Next.js 15 new app | `harvesterp-web/apps/web/` | 3000 |
| FastAPI backend | `backend/` | 8001 |
| nginx proxy | `nginx/nginx.dev.conf` (dev) / `nginx/nginx.conf` (prod) | 80 / 443 |

The canonical list of migrated paths lives in **[MIGRATED_PATHS.md](./MIGRATED_PATHS.md)**.

---

## Local development

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- No process already on port 80 (`lsof -i :80` / `netstat -an | findstr :80`)

### Start the full stack

```bash
# From ERP_V1/ root
docker compose up

# Open http://localhost
# Migrated paths (/login, /dashboard) → Next.js
# Everything else → Vue
```

### Watch logs for a single service

```bash
docker compose logs -f nextjs   # Next.js dev server
docker compose logs -f vue      # Vite dev server
docker compose logs -f nginx    # nginx access + error log
docker compose logs -f api      # FastAPI
```

### Run smoke tests

```bash
# Requires the stack to be running
bash scripts/smoke-test.sh http://localhost
```

### Rebuild after dependency changes

```bash
docker compose build nextjs   # after pnpm lockfile changes
docker compose restart nextjs
```

---

## Adding a migrated page

Follow this checklist for every page you migrate from Vue to Next.js.

### 1. Build the page in Next.js

Create `harvesterp-web/apps/web/src/app/your-path/page.tsx` (and any
layout, loading, error segments needed).

Test it directly at `http://localhost:3000/your-path` first (bypass nginx).

### 2. Add nginx location blocks

**Both files** must be updated in the same PR.

**`nginx/nginx.dev.conf`** — add inside the `server` block, before `/api/auth/`:

```nginx
location = /your-path {
    proxy_pass         http://nextjs_upstream;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   X-Forwarded-Host  $host;
    proxy_set_header   Cookie            $http_cookie;
    proxy_pass_header  Set-Cookie;
}
```

**`nginx/nginx.conf`** — add the same block to **all three** portal server
blocks (`admin.absodok.com`, `client.absodok.com`, `factory.absodok.com`),
changing `X-Forwarded-Proto $scheme` to `X-Forwarded-Proto https`.

For a path prefix (e.g. `/orders/` and all its sub-pages), use a prefix
block instead of exact match:

```nginx
location /orders/ {
    proxy_pass http://nextjs_upstream;
    # ... same headers ...
}
```

### 3. Update MIGRATED_PATHS.md

Add a row to the **Currently migrated** table in
[MIGRATED_PATHS.md](./MIGRATED_PATHS.md):

```markdown
| `/your-path` | YYYY-MM-DD | #PR_NUMBER | Brief description |
```

### 4. Remove (or deprecate) the Vue route

- Remove the route entry from `frontend/src/router/index.js`
- Remove the Vue page component if it is no longer needed
- If the Vue route must stay temporarily (for fallback), mark it with a
  `// DEPRECATED: migrated to Next.js — remove after YYYY-MM-DD` comment

### 5. Smoke test and open PR

```bash
bash scripts/smoke-test.sh http://localhost
```

PR review checklist:
- [ ] `location` block added to `nginx/nginx.dev.conf`
- [ ] `location` block added to all three blocks in `nginx/nginx.conf`
- [ ] `MIGRATED_PATHS.md` row added
- [ ] Vue route removed (or marked deprecated with removal date)
- [ ] Smoke tests pass
- [ ] No regression on existing `/login` and `/dashboard` routes

---

## Rollback

To revert a specific page migration:

1. Remove the `location = /your-path` block from both `nginx/nginx.dev.conf`
   and `nginx/nginx.conf` (all three portal blocks)
2. Restore the Vue route in `frontend/src/router/index.js`
3. Remove or revert the row in `MIGRATED_PATHS.md`
4. Run `bash scripts/smoke-test.sh http://localhost` — confirm Vue serves the path
5. Deploy: `docker compose pull && docker compose up -d`

To roll back the entire migration infrastructure (revert to Vue-only):

1. Revert `docker-compose.yml` to remove `nextjs` and `nginx` services
2. Revert `nginx/nginx.conf` to remove all `nextjs_upstream` location blocks
3. This is a last resort — individual path rollbacks are preferred

---

## Cookies and auth

Both apps share the same cookies on the same domain.

| Cookie | Set by | Read by | Notes |
|--------|--------|---------|-------|
| `harvesterp_session` | Next.js `/api/auth/login` | Both apps | httpOnly, 8h, path=/ |
| `harvesterp_refresh` | Next.js `/api/auth/login` | Next.js only | httpOnly, 7d, path=/api/auth |

**Login flow:**

1. User visits `/login` → nginx routes to Next.js
2. User submits credentials → Next.js `POST /api/auth/login` calls FastAPI
3. On success: Next.js sets both cookies, redirects to `/dashboard`
4. Vue reads `harvesterp_session` for its own auth state checks
5. Token refresh: Next.js middleware proactively refreshes the access token
   when it is within 30 s of expiry (using `harvesterp_refresh`)

nginx must forward `Cookie` headers (`proxy_set_header Cookie $http_cookie`)
and pass `Set-Cookie` response headers (`proxy_pass_header Set-Cookie`) on
all locations that handle auth. This is already configured for `/login`,
`/dashboard`, `/api/auth/`, and `/api/` in both nginx configs.

---

## Production deployment

Production uses `nginx/nginx.conf` with three TLS server blocks
(`admin/client/factory.absodok.com`). Each block has identical routing rules.

The `docker-compose.prod.yml` file wires up nginx, certbot, FastAPI, and the
Vue container. For the Next.js migration, the prod compose must also include
a `nextjs` service. Add:

```yaml
nextjs:
  image: registry.example.com/harvesterpweb:latest  # or build: ../harvesterp-web
  environment:
    HARVESTERP_API_URL: http://api:8001
    HARVESTERP_COOKIE_SECURE: "true"
    NODE_ENV: production
  expose:
    - "3000"
```

> **Note:** A production multi-stage Dockerfile for Next.js (with `next build`
> + `next start`) should be created before first production deploy. The current
> `harvesterp-web/apps/web/Dockerfile` is dev-only. Track this as a follow-up task.

---

## Troubleshooting

### 502 Bad Gateway

One of the upstream containers is not ready.

```bash
docker compose ps          # check all service states
docker compose logs nextjs # check Next.js startup log (pnpm install can be slow)
docker compose logs vue    # check Vite startup
docker compose logs api    # check FastAPI
```

Next.js takes ~60 s on first start (pnpm install + compilation). nginx will
return 502 until Next.js is ready. This is expected — refresh after a minute.

### Login redirect loop

Cookies are not being forwarded by nginx.

Verify that the relevant `location` block has:
```nginx
proxy_set_header   Cookie  $http_cookie;
proxy_pass_header  Set-Cookie;
```

Also check that `HARVESTERP_COOKIE_SECURE` is `"false"` in dev (cookies over
plain HTTP are rejected if `Secure` flag is set).

### Stale Vue page after migration

Browser cached the Vue version of the path.

- Hard-refresh: `Ctrl+Shift+R` / `Cmd+Shift+R`
- Or clear site cookies/cache in DevTools → Application → Clear site data

For production, consider adding a cache-busting `Cache-Control: no-store`
header to migrated `location` blocks during the transition period.

### HMR not working in dev

WebSocket connections for hot-reload must be upgraded. Both nginx configs
include:
```nginx
proxy_set_header Upgrade    $http_upgrade;
proxy_set_header Connection "upgrade";
```
on the Vite (`/`) and Next.js (`/_next/webpack-hmr`) locations. If HMR
breaks after a config change, verify these headers are still present.

### "Cannot find module @harvesterp/lib"

The Next.js container mounts the full monorepo at `/workspace`. If
`node_modules` is missing or stale:

```bash
docker compose build nextjs
docker compose up nextjs
```

The startup command runs `pnpm install --frozen-lockfile` on every start;
changes to `pnpm-lock.yaml` require a rebuild.

---

## Tests

### Smoke tests (integration — requires running stack)

```bash
bash scripts/smoke-test.sh http://localhost
# Exits 0 if all pass; exits N if N tests failed
```

### nginx config unit tests (no running containers needed)

```bash
# In harvesterp-web/apps/web/
pnpm test -- --reporter verbose tests/infra/nginx-config.test.ts
```

These tests verify:
- `docs/migration/MIGRATED_PATHS.md` lists `/login` and `/dashboard`
- Both nginx configs contain the required `location` blocks

### nginx syntax validation (requires nginx binary)

```bash
nginx -t -c /absolute/path/to/nginx/nginx.dev.conf
nginx -t -c /absolute/path/to/nginx/nginx.conf
```

Or via Docker (no local nginx install needed):

```bash
docker run --rm \
  -v "$(pwd)/nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro" \
  nginx:alpine nginx -t
```
