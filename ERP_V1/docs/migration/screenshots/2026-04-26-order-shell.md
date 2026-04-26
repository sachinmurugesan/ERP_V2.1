# R-16 + R-17 visual evidence — `/orders-shell-preview/[id]` (2026-04-26)

This is a placeholder for the binary screenshot
`docs/migration/screenshots/2026-04-26-order-shell.png`.
Live R-16/R-17 verification produced visual evidence
captured inline via the Claude Preview MCP
`preview_screenshot` tool during the
`feat/order-detail-shell` Phase 3 verification; the
resulting JPEG was rendered in the chat transcript
but not auto-persisted to disk (the MCP tool returns
the image inline; no `--out` parameter exists).

Same screenshot-persistence gap as the transporters
migration — see
`docs/migration/screenshots/2026-04-26-transport.md`.
Filed as the same tech-debt: introduce a
`pnpm screenshot:migration <route>` Playwright
helper that bootstraps a session cookie + writes
the PNG.

## What the desktop screenshot showed (1400x900 viewport)

URL: `http://localhost:3100/orders-shell-preview/6214e677-0399-43ed-a467-257479ec8015?tab=dashboard&_inspect=1`
Auth: ADMIN (admin@harvesterp.com)

- **Sidebar (left)**: HarvestERP banner + nav (Dashboard, Orders, Products, Clients, Factories, Transport, After Sales, Returns, Warehouse, Receivables, Client Ledger, Users, Audit Logs, Settings).
- **Topbar**: HarvestERP wordmark + admin avatar + theme/notification icons.
- **Sandbox preview notice** (blue, top): "This is a Phase 1 sandbox of the order-detail shell at /orders-shell-preview/[id]. The real route at /orders/[id] still serves the Vue page. Tab content panels are deliberately deferred — clicking any tab redirects to the Vue legacy view."
- **Order header**: back arrow + **DRAFT ORDER** h1 + **S1 Draft** stage chip + **Test Probe Corp · Acme Test Factory · PO: R16-PROBE-001** identity line + **Delete** button on the right.
- **Stage stepper card**: 17 horizontal circles, first (Draft) is current/blue-pulsing, others gray-upcoming. Stage labels below: Draft, Pending PI, PI Sent, Payment, Factory Ordered, Production 60%, Production 80%, Production 90%, Plan Packing, Final PI, Production 100%, Booked, Sailing, Customs, Delivered, After-Sales, Completed.
- **Transition action bar**: single emerald **→ Next: S2 · Pending PI** button.
- **Sticky tab nav**: 4 visible tabs — Dashboard (active, emerald-underline + emerald-50 bg), Order Items, Queries, Files. Other tabs hidden because order is in DRAFT (no PostPI tabs visible — correct progressive disclosure).
- **Active tab panel** (Dashboard, inspect-mode fallback): blue-50 card with "Dashboard tab" + "Tab content not yet migrated. In production this redirects to the Vue legacy view." + "Open in legacy view →" link. (The auto-redirect was suppressed by `?_inspect=1`.)
- **Console errors**: 0.

## R-16 console-check results (verbatim from `preview_eval`)

```
R16_check_1_fontFamily   = "Manrope, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_1_pass         = true   (contains "Manrope")
R16_check_2_styleSheets  = 2
R16_check_2_pass         = true   (> 0)
R16_check_3_fSans        = "\"Manrope\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_3_pass         = true   (non-empty)

URL                      = http://localhost:3100/orders-shell-preview/6214e677-0399-43ed-a467-257479ec8015?tab=dashboard&_inspect=1
page h1                  = "DRAFT ORDER"
stage chip text          = "S1 Draft"
visible_tabs             = ["Dashboard", "Order Items", "Queries", "Files"]
stepper desktop circles  = 17
factory_banner_present   = false  (factory IS assigned)
client_draft_banner      = false  (status is DRAFT not CLIENT_DRAFT)
transition_bar_present   = true
transition button count  = 1      ("Next: S2 · Pending PI")
sticky_tab_bar_classes   = "sticky top-0 z-10 -mx-4 bg-white px-4 pt-2 shadow-sm md:-mx-0 md:px-0"
console_errors           = 0
```

## R-17 scorecard (5 dimensions × 0-10, threshold = 7)

Reference: `Design/screens/procurement.jsx` (workflow stepper + line items + sidebar) + `Design/screens/settings.jsx` (sub-nav with chip-style triggers + content card).

| Dimension | Score | Notes |
|---|---|---|
| Typography | **9** | Manrope loads. h1 = 20 px font-semibold. Stage chip = 11 px uppercase per `.chip` token. Stepper labels at 11 px. Tab labels at 14 px font-medium. Hierarchy clean: identity > stepper > action > tabs > content. |
| Layout | **9** | Sidebar + main content split mirrors `procurement.jsx`. Page header (back arrow + h1 + chip + identity line + actions) matches `procurement.jsx` cadence. Stage stepper as a dedicated card row. Transition action bar as separate row. Sticky tab bar with content panel below. |
| Spacing | **8** | `.card` framing on stepper, action bar, tab content. ~16 px vertical gaps between sections. Stepper at 1400 px = ~64 px per circle (tight but readable). The sandbox-preview notice is slightly prominent — could be smaller. |
| Color | **9** | Brand emerald CTAs (Next button). Sidebar active = emerald. Tab active = emerald-underline + emerald-50 bg + emerald-700 text (Vue parity). Stepper current = blue. Stepper upcoming = gray. Sandbox notice = blue-50/blue-200/blue-800. No off-brand colors. |
| Component usage | **8** | `<StageChip>` uses DS `.chip` class ✅. New emerald-underline `<Tabs>` primitive ✅. `<CarryForwardStepper>` (Layer 2 lift) ✅. `<Button>`, `<DropdownMenu>`, `<AlertDialog>`, `<DeleteConfirmDialog>` primitives. Card wrappers use Tailwind `rounded-lg border border-slate-200 bg-white` rather than `.card` class — could be tighter to DS class adoption (same audit-rec-#6 pattern as transporters/factory-ledger). |
| **Average** | **8.6 / 10** | All five dimensions ≥ 7 → **R-17 PASS** |

## Verdict: PASS

No source fixes required. Screenshot evidence captured inline in the chat transcript; binary PNG persistence deferred to a future tooling improvement.

## Caveats / known issues surfaced during verification

1. **Auto-redirect bug found + fixed during verification.** The `<DeferredTabFallback>` was firing the `window.location.assign("/orders/{id}?tab=...")` redirect as soon as the shell rendered, making the shell un-inspectable in dev setups without nginx fronting Vue. Fix: added `?_inspect=1` query-param escape hatch + `inspectMode` prop chain through OrderTabs + DeferredTabFallback. Production behavior unchanged (redirect still fires by default). Same commit also fixed a related bug where the OrderTabs URL-sync effect was stripping `_inspect=1` from the URL on every tab change. See commit on `feat/order-detail-shell`.

2. **Mobile sidebar layout pre-existing issue.** At 375 px viewport (mobile), the `(app)` layout's NavigationSidebar takes ~80% of the viewport and the main content squeezes into a narrow strip. This is a layout-wrapper issue affecting every migrated page — not a defect of the order-shell migration. Out of scope for this PR. Tracked as a separate cross-page concern.

3. **Tablet stepper overflow.** At 768 px viewport with sidebar visible, the stepper's 17 circles overflow horizontally with a scroll indicator. Compact mode is on, but the available width (~528 px) isn't enough for 17 circles at 32 px each + connectors. Acceptable since Phase 2 §2.6 spec didn't require all 17 to fit — horizontal scroll is the documented fallback.
