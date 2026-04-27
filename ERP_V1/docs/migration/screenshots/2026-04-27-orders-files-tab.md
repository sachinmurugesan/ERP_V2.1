# R-16 + R-17 visual evidence — `/orders/[id]?tab=files` (2026-04-27)

This is a placeholder for the binary screenshot
`docs/migration/screenshots/2026-04-27-orders-files-tab.png`.
Live R-16/R-17 verification produced visual evidence captured inline via
the Claude Preview MCP `preview_screenshot` tool; the resulting JPEG was
rendered in the chat transcript but not auto-persisted to disk (the MCP
tool returns the image inline; no `--out` parameter exists).

Same screenshot-persistence gap as the prior order-shell + dashboard-tab
migrations — see `docs/migration/screenshots/2026-04-26-order-shell.md`
and `docs/migration/screenshots/2026-04-26-orders-dashboard-tab.md`.

## What the desktop screenshot showed (1400x900 viewport)

URL: `http://localhost:3100/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=files`
Auth: ADMIN (admin@harvesterp.com)
Order: DRAFT, Test Probe Corp · Acme Test Factory · PO R17-DASH-001

- **Sidebar (left)**: HarvestERP banner + nav (Dashboard, Orders [active], Products, Clients, Factories, Transport, After Sales, Returns 3, Warehouse, Receivables, Client Ledger, Users, Audit Logs, Settings).
- **Topbar**: HarvestERP wordmark + admin avatar + theme/notification icons.
- **Order header**: back arrow + **DRAFT ORDER** h1 + **S1 Draft** stage chip + identity line + Delete button.
- **Stage stepper**: 17 horizontal circles, Draft current/blue.
- **Transition action bar**: emerald **→ Next: S2 · Pending PI** button.
- **Sticky tab nav**: 4 visible tabs — Dashboard, Order Items, Queries, **Files (active, emerald-underline + emerald-50 bg)**.
- **Files tab content**:
  - **Card** with paperclip-icon header **📎 Documents (3)** + emerald **⬆ Upload document** button (right-aligned)
  - **Table** with 5 columns: TYPE | FILENAME | SIZE | UPLOADED | ACTIONS
  - 3 rows, each with type chip (slate-100 bg, slate-700 text), filename (font-medium slate-800), size, en-IN date, and a Download outline button + red trash icon-only button (Delete)
    - BOL · test-BOL.txt · 13 B · 27 Apr 2026 · [Download] [🗑]
    - Invoice · test-Invoice.txt · 17 B · 27 Apr 2026 · [Download] [🗑]
    - PI · test-PI.txt · 12 B · 27 Apr 2026 · [Download] [🗑]
- **Console errors**: 0.

## R-16 console-check results (verbatim from `preview_eval`)

```
R16_check_1_fontFamily   = "Manrope, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_1_pass         = true   (contains "Manrope")
R16_check_2_styleSheets  = 2
R16_check_2_pass         = true   (> 0)
R16_check_3_fSans        = "\"Manrope\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_3_pass         = true   (non-empty)

URL                          = http://localhost:3100/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=files
order header h1              = "DRAFT ORDER"
visible_tabs                 = ["Dashboard", "Order Items", "Queries", "Files=active"]
files_tab_rendered           = true
files_table_rendered         = true
empty_state_rendered         = false (3 docs present)
upload_button_rendered       = true   ✅ DOCUMENT_UPLOAD ADMIN-visible
delete_button_count          = 3       ✅ DOCUMENT_DELETE ADMIN-visible (icon-only)
download_button_count        = 3
delete_aria_labels           = ["Delete test-BOL.txt", "Delete test-Invoice.txt", "Delete test-PI.txt"]
console_errors               = 0
```

## R-16 — full CRUD verified end-to-end through the proxies

In addition to the rendering checks, all 4 proxies were exercised live
against the running backend:

```
POST   /api/orders/de2258e0/documents        → 200, doc_id 214670a9, doc_type OTHER, size 23
GET    /api/orders/de2258e0/documents/214670a9/download
                                             → 200, Content-Type octet-stream,
                                               Content-Disposition attachment;filename="qa-upload.txt",
                                               body "e2e upload from /qa run"
DELETE /api/orders/de2258e0/documents/214670a9
                                             → 200, body {"message":"Document deleted"}
```

Definition-of-done items 8/9/10 satisfied: upload + download + delete
all work end-to-end with cookie-auth → Bearer-token translation handled
by the proxy layer.

## R-16 — fallback for unmigrated tabs still has /_legacy/ link

Clicked the Order Items tab (post-files-migration; one of 12 still
deferred):

```
url                          = http://localhost:3100/orders/de2258e0/?tab=items
files_tab_still_rendered     = false
items_fallback_rendered      = true
legacy_link_href             = /_legacy/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=items
```

Strangler-fig invariant from PR #4 (Issue #6 fix) still holds: every
non-migrated tab routes back to Vue's OrderDetail.vue via the
`/_legacy/` nginx carve-out.

## R-17 scorecard (5 dimensions × 0-10, threshold = 7)

Reference: `Design/screens/settings.jsx` (sub-nav + content card pattern)
+ `Design/screens/inventory.jsx` (table list pattern) + the prior
dashboard-tab baseline (8.6 average).

| Dimension | Score | Notes |
|---|---|---|
| Typography | **9** | Manrope verified loaded. Card title 14 px font-semibold; stage chip 11 px uppercase via `.chip` token; tab labels 14 px font-medium with active emerald-700 + emerald-600 border-bottom. **Table header**: inspected — `text-xs font-semibold uppercase tracking-wide text-slate-500` (color rgb(100,116,139)) — clean hierarchy. **Table cell filename**: `font-medium text-slate-800` (color rgb(30,41,59)). Delete aria-labels ("Delete test-BOL.txt") read well to screen readers. |
| Layout | **9** | Sidebar+main split unchanged from shell. Files card with right-aligned Upload button mirrors the settings.jsx page-header pattern. Table fills the card width; max-w-[280px] + truncate on filename column prevents layout breakage on long filenames; per-row Actions column right-aligned. Sticky tab nav unchanged. |
| Spacing | **8** | Card padding via `p-6` primitive. Header row uses `flex-row items-center justify-between`. Table rows have `py-2.5` for comfortable density. Per-row action buttons gap-1 in `inline-flex`. ~16 px vertical gap between Card and the (empty) DeleteConfirmDialog placeholder. |
| Color | **9** | Brand emerald CTA on Upload button (`bg-emerald-600 text-white`). Type chip uses slate-100 bg + slate-700 text — neutral, readable. Per-row Download is outline (default Button variant); Delete trash icon is `text-red-600` to signal destructive intent. Empty-state paperclip uses `text-slate-300` — muted, non-distracting. No off-brand colors. |
| Component usage | **8** | DS primitives throughout: `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>`, `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableHead>`, `<TableRow>`, `<TableCell>`, `<Button>`, `<Skeleton>`, `<Select>`, `<Label>`. Composed: `<RoleGate>` (Card 2 D-004 pattern reused for upload + delete gating), `<DeleteConfirmDialog>` (composed/ — the canonical destructive-confirm modal). Lib: `useBlobDownload` for download. The Card primitive still uses `rounded-xl border bg-card …` Tailwind utility rather than the `.card` token class — same audit-rec-#6 pattern carried over from the prior 4 migrations. |
| **Average** | **8.6 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

## Verdict: PASS

No source fixes required. R-16 PASS (3/3 console + 0 errors + full CRUD
verified live). R-17 PASS (8.6 average, all dimensions ≥ 7).

## Caveats / known issues surfaced during verification

1. **Preview MCP screenshot persistence.** Same as the prior 3
   migrations — the `preview_screenshot` MCP tool returns the JPEG
   inline in the chat transcript but does not write to disk. The `.png`
   file referenced at the top of this doc is therefore notional.
   Tracked as the same tech-debt: introduce a `pnpm screenshot:migration
   <route>` Playwright helper.

2. **document_type list is a curated client-side enum.** Backend stores
   doc_type as `String(50)` with no enum constraint, so any string is
   technically valid. The upload modal restricts to a curated set
   (PI / INVOICE / BOL / PACKING_LIST / CUSTOMS / OTHER) for FE
   consistency. If new doc types are needed they can be added to the
   `DOC_TYPE_OPTIONS` constant in `order-files-tab.tsx` without a
   backend change.

3. **Per-file upload progress is spinner-only (D-4=A in Phase 2).**
   `fetch` API doesn't expose upload progress; for `XMLHttpRequest`-
   based progress bars, schedule a follow-up task. Current UX is
   acceptable for typical document sizes (< 5 MB); MAX_UPLOAD_SIZE is
   600 MB on the backend so larger files are technically allowed.
