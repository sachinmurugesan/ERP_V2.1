# HarvestERP Migrated Paths Registry

This file lists every URL path currently served by the Next.js app.
nginx routes these paths to Next.js; all other paths route to Vue.

**This is the single source of truth for "what's migrated and what isn't."**
Every page migration PR must update this file.

## Adding a migrated page

1. Build the page in `harvesterp-web/apps/web/src/app/your-path/page.tsx`
2. Test locally: `docker compose up`
3. Add `location = /your-path` blocks in **both** nginx configs:
   - `nginx/nginx.dev.conf` (dev)
   - `nginx/nginx.conf` (all three portal server blocks: admin/client/factory)
4. Add a row to the **Currently migrated** table below with the date and PR
5. Remove (or mark deprecated) the corresponding Vue route in `frontend/src/router/`
6. Run smoke tests: `bash scripts/smoke-test.sh http://localhost`
7. Open the PR — reviewer checks: nginx blocks ✓, MIGRATED_PATHS.md row ✓, Vue route removed ✓

## Rolling back a migration

1. Remove the `location =` block from `nginx/nginx.dev.conf` and `nginx/nginx.conf`
2. Restore the Vue route if it was removed
3. Remove the row from this table (or mark it `REVERTED`)
4. Run `bash scripts/smoke-test.sh http://localhost`

---

## Currently migrated (N=9)

| Path | Migrated | PR | Notes |
|------|----------|----|-------|
| `/login` | 2026-04-23 | Task 7/9 | Login page scaffold |
| `/dashboard` | 2026-04-23 | feat/migrate-dashboard | Internal operations dashboard (5 KPI counters, client-inquiries attention strip, active shipments + recent activity with 30 s polling). Client and factory dashboards still on Vue — follow-up migrations. |
| `/orders` | 2026-04-24 | feat/migrate-orders-list | Internal orders list (exact match only). 9 stage-group filter tabs with live counts, debounced search, 8-column table with stage chips, kebab row actions (View + role-gated Delete), typed-confirmation delete dialog, prev/next pagination. `/orders/{id}` and `/orders/new` stay on Vue — separate migrations. |
| `/products` | 2026-04-24 | feat/migrate-products-list | Internal products list (exact match only). Parent+variant accordion, search + category + per-page filters, bulk edit (5 fields with Apply buttons) + bulk delete, same-page Bin tab toggle, 3-scenario confirm dialog (single / bulk with DELETE / bin-permanent with part-code), prev/next pagination, per-row card layout on mobile. `/products/upload-excel` and the admin duplicate-cleanup modal stay on Vue — separate migrations. |
| `/products/new` | 2026-04-24 | feat/migrate-products-form | CREATE form and VARIANT mode (via `?parent_id={id}`). 5-section Card layout, React Hook Form + Zod validation, variant resolution dialog when an existing part code is reused. |
| `/products/{id}` | 2026-04-24 | feat/migrate-products-form | DETAIL view — read-only presentation with Edit button (role-gated), right-sidebar image gallery + lightbox. New mode added during migration — previously Vue had no standalone detail page. |
| `/products/{id}/edit` | 2026-04-24 | feat/migrate-products-form | EDIT form + right-sidebar image gallery with upload/delete (AlertDialog confirmation). Unsaved-changes guard on dirty form. |
| `/finance/factory-ledger` | 2026-04-24 | feat/migrate-factory-ledger | Internal finance page gated by `FACTORY_LEDGER_VIEW` (FINANCE + SUPER_ADMIN bypass; ADMIN excluded per D-004 with dedicated `AdminForbiddenState` screen). 3-card summary (debit/credit/net), 10-column transactions table with sticky Date column on mobile horizontal scroll, xlsx/pdf downloads via new `useBlobDownload()` hook, date-range filter with asymmetry tooltip. Introduces the `<LedgerPage>` Layer 2 composed component (ported from ui-gallery + generalized with `columns` prop). Sibling finance tabs (receivables, client-ledger, payments) remain Vue. |
| `/clients` | 2026-04-26 | feat/migrate-clients-list | Internal clients list (exact match only). Search input with 400ms debounce + per-page selector (25/50/100, default 50) + windowed pagination, 6-column table on desktop (Company Name with hex-coloured `<ClientAvatar>` · GSTIN · Location · Contact · IEC/PAN · Actions), per-row card layout below 768px. Cluster D fields (`factory_markup_percent`, `sourcing_commission_percent`) stripped server-side in the API proxy before reaching the browser. Add/Edit/Delete actions role-gated via new `CLIENT_CREATE`/`CLIENT_UPDATE`/`CLIENT_DELETE` permissions (CLIENT_DELETE is `[ADMIN]` only — stricter than backend by design). Introduces 3 Layer 2 lifts: `<Pagination>`, `<DeleteConfirmDialog>`, `<ClientAvatar>`. `/clients/new` and `/clients/{id}/edit` stay Vue (separate migration). |

---

## Internal / framework paths (always Next.js)

These are never listed in the table above — they are structural and always
routed to Next.js regardless of migration state.

| Path prefix | Notes |
|-------------|-------|
| `/_next/*` | Next.js static assets, JS chunks, CSS, HMR WebSocket |
| `/_next/webpack-hmr` | Next.js Webpack HMR WebSocket (dev only) |
| `/api/auth/*` | Next.js API routes: login, logout, session, refresh |

---

## Backend-only paths (always FastAPI)

| Path prefix | Notes |
|-------------|-------|
| `/api/*` (except `/api/auth/`) | FastAPI endpoints (orders, products, etc.) |
| `/uploads/` | G-019 `internal` nginx directive — served via X-Accel-Redirect |

---

## Migration progress

```
Total application routes:   ~40 (estimated)
Migrated so far:             2
Remaining (Vue):            ~38
```

Track full migration progress in the sprint board. Target: complete migration
within 3–6 months of Task 9 cutover date (2026-04-23).
