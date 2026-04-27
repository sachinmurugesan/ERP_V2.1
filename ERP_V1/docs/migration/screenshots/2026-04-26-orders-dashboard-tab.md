# R-16 + R-17 visual evidence — `/orders/[id]` (2026-04-26)

This is a placeholder for the binary screenshot
`docs/migration/screenshots/2026-04-26-orders-dashboard-tab.png`.
Live R-16/R-17 verification produced visual evidence captured inline via
the Claude Preview MCP `preview_screenshot` tool; the resulting JPEG was
rendered in the chat transcript but not auto-persisted to disk (the MCP
tool returns the image inline; no `--out` parameter exists).

Same screenshot-persistence gap as the order-shell sandbox migration —
see `docs/migration/screenshots/2026-04-26-order-shell.md`.

## What the desktop screenshot showed (1400x900 viewport)

URL: `http://localhost:3100/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=dashboard`
Auth: ADMIN (admin@harvesterp.com)
Order: DRAFT, Test Probe Corp · Acme Test Factory · PO R17-DASH-001

- **Sidebar (left)**: HarvestERP banner + nav (Dashboard, Orders [active], Products, Clients, Factories, Transport, After Sales, Returns 3, Warehouse, Receivables, Client Ledger, Users, Audit Logs, Settings).
- **Topbar**: HarvestERP wordmark + admin avatar + theme/notification icons.
- **Order header**: back arrow + **DRAFT ORDER** h1 + **S1 Draft** stage chip + **Test Probe Corp · Acme Test Factory · PO: R17-DASH-001** identity line + **Delete** button on the right.
- **Stage stepper card**: 17 horizontal circles, first (Draft) is current/blue, others gray-upcoming. Stage labels visible: Draft, Pending PI, PI Sent, Payment, Factory Ordered, Production 60%, Production 80%, Production 90%, Plan Packing, Final PI, Production 100%, Booked, Sailing, Customs, Delivered, After-Sales, Completed.
- **Transition action bar**: single emerald **→ Next: S2 · Pending PI** button.
- **Sticky tab nav**: 4 visible tabs — Dashboard (active, emerald-underline + emerald-50 bg + emerald-700 text), Order Items, Queries, Files. PostPI tabs hidden because order is DRAFT (correct progressive disclosure).
- **Dashboard tab content**: 6 cards in 2-column grid:
  - **Order summary** (left): Order # DRAFT, Stage S1 Draft, Client Test Probe Corp, Factory Acme Test Factory, PO reference R17-DASH-001, Currency INR, Created 26 Apr 2026
  - **Factory & costs** (right): "Restricted to Finance role" placeholder + "Factory cost data is restricted to the Finance role. (Policy D-004)" — **D-004 enforcement working as designed for ADMIN role**
  - **Client payments** (left): PI total ₹0.00, Total received ₹0.00, Balance ₹0.00, Payment count 0
  - **Shipment status** (right): "No shipments yet" empty state
  - **Customs / BOE** (left, below fold): "No shipments yet"
  - **Stage progress** (right, below fold): Current S1 Draft, Stages complete 0 / 17
- **Console errors**: 0.

## R-16 console-check results (verbatim from `preview_eval`)

```
R16_check_1_fontFamily   = "Manrope, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_1_pass         = true   (contains "Manrope")
R16_check_2_styleSheets  = 2
R16_check_2_pass         = true   (> 0)
R16_check_3_fSans        = "\"Manrope\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_3_pass         = true   (non-empty)

URL                          = http://localhost:3100/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=dashboard
order header h1              = "DRAFT ORDER"
stage chip text              = "S1 Draft"
visible_tabs                 = ["Dashboard", "Order Items", "Queries", "Files"]
dashboard_rendered           = true
factory_restricted_for_admin = true
factory_financials_visible   = false   ✅ D-004 enforced
sticky_tab_bar_present       = true
console_errors               = 0
```

## R-16 — non-dashboard tab fallback (post-flip behaviour)

Clicked the Order Items tab at `?tab=items`:

```
url                          = http://localhost:3100/orders/de2258e0-34f5-4fd3-8c70-539671425eb4?tab=items
fallback_rendered            = true
fallback_text                = "Order Items tab. Tab content is being migrated to the new design. Go to dashboard tab →"
no_redirect_loop             = true   ✅ no auto-redirect (would have looped post-nginx-flip)
go_to_dashboard_link_present = true
```

This validates the deferred-fallback fix from Commit 5 — the user does NOT experience an infinite redirect loop when clicking a not-yet-migrated tab.

## R-17 scorecard (5 dimensions × 0-10, threshold = 7)

Reference: `Design/screens/procurement.jsx` (workflow stepper + line items + sidebar) + `Design/screens/settings.jsx` (sub-nav with chip-style triggers + content card) + the prior `2026-04-26-order-shell.md` baseline (8.6 average).

| Dimension | Score | Notes |
|---|---|---|
| Typography | **9** | Manrope loads. Order header h1 verified at 20 px font-semibold (text-xl). Stage chip = 11 px uppercase per `.chip` token. Tab labels at 14 px font-medium with active emerald-700 text + emerald-600 border. Card titles use the `font-semibold leading-none tracking-tight` Card primitive. SummaryRow values use `font-medium text-slate-900`. Hierarchy clean: identity > stepper > action > tabs > content. |
| Layout | **9** | Sidebar + main content split mirrors `procurement.jsx`. Page header (back arrow + h1 + chip + identity line + actions) matches the cadence. Stage stepper as dedicated card row. Transition action bar as separate row. Sticky tab bar with content panel below. Dashboard cards in a 2-column grid (`md:grid-cols-2`) — collapses to 1 column on mobile per Phase 2 §3.2 plan. |
| Spacing | **8** | `.card` framing on stepper, action bar, tab content, and each dashboard card. ~16 px vertical gaps between sections (`space-y-3` / `space-y-4`). Stepper at 1400 px = ~64 px per circle (tight but readable). Dashboard card padding via primitive's `p-6` is comfortable. SummaryRow uses `space-y-2` for clean vertical rhythm. |
| Color | **9** | Brand emerald CTAs (Next button). Sidebar active = emerald. Tab active = emerald-underline + emerald-700 text. Stepper current = blue. Stepper upcoming = gray. Restricted-card slate-50 background with slate-200 border + slate-700 heading + slate-500 detail — fits the "informational, not destructive" tone for the D-004 placeholder. Card backgrounds use the `bg-card` token. No off-brand colors. |
| Component usage | **8** | `<StageChip>` uses DS `.chip` class ✅. `<Tabs>` primitive with emerald-underline active state ✅. `<Card>` / `<CardHeader>` / `<CardTitle>` / `<CardContent>` primitives used throughout the dashboard ✅. `<RoleGate>` from composed/ wraps Card 2 ✅. `<Skeleton>` for loading ✅. `<Button>` primitive for actions ✅. `formatINR` / `formatDate` from `@harvesterp/lib` for all values ✅. The Card primitive wraps in `rounded-xl border bg-card text-card-foreground shadow` (Tailwind utility classes) rather than the `.card` token class — same audit-rec-#6 pattern as the previous transporters/factory-ledger/order-shell migrations. |
| **Average** | **8.6 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

## Verdict: PASS

No source fixes required. R-16 and R-17 both clean. Screenshot evidence captured inline in the chat transcript; binary PNG persistence deferred to a future tooling improvement (same gap noted in the order-shell migration).

## Caveats / known issues surfaced during verification

1. **Preview MCP screenshot persistence.** Same as the order-shell migration — the `preview_screenshot` MCP tool returns the JPEG inline in the chat transcript but does not write to disk. The `.png` file referenced at the top of this doc is therefore notional. Tracked as the same tech-debt: introduce a `pnpm screenshot:migration <route>` Playwright helper that bootstraps a session cookie + writes the PNG.

2. **Order created mid-verification.** The dev DB had no orders at start of session (the previous probe order had been wiped). Created a fresh DRAFT order via `POST /api/orders/` (id `de2258e0-34f5-4fd3-8c70-539671425eb4`, client Test Probe Corp, factory Acme Test Factory). The order is empty by design — no items, no payments, no shipments, no BOE — so this verification only exercises the empty-state code paths. A follow-up R-16/R-17 with a populated order (PI sent, payment received, shipment booked, BOE filed) is recommended once the relevant migration tabs land and seed data is re-flowed.
