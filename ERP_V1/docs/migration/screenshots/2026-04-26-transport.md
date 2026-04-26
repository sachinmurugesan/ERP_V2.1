# R-16 visual evidence — `/transport` (2026-04-26)

This is a placeholder for the binary screenshot
`docs/migration/screenshots/2026-04-26-transport.png`. The live R-16
verification produced visual evidence captured inline via the Claude
Preview MCP `preview_screenshot` tool during the
`feat/migrate-transporters-list` Phase 3 execution; the resulting JPEG
was rendered in the chat transcript but not auto-persisted to disk
(the MCP tool returns the image inline; no `--out` parameter exists).

## What the screenshot showed

Authenticated as `ops@test.dev` (OPERATIONS role), navigated to
`http://localhost:3100/transport`, three seeded providers visible:

- **Manrope sans-serif** typography throughout (header h1, body, chips)
- **Service Providers** h1 with **3 providers** subtitle
- **+ Add provider** button visible top-right (emerald) — TRANSPORT_CREATE granted
- **Search bar** card with magnifying-glass icon properly inset (`pl-9`)
- 6-column desktop table in the agreed order: NAME · ROLES · LOCATION · CONTACT · GST/PAN · ACTIONS
- **Avatar** with hex-derived colour per company name (CC = teal, EM = emerald, ML = purple)
- **Role badges** rendering with the correct design-system chip tone:
  - `CFS` → orange (`chip-warn`)
  - `Transport` → purple (`chip-purple` — added in this PR)
  - `Freight Forwarder` → blue (`chip-info`)
  - `CHA` → green (`chip-ok`)
- **GST/PAN** badge pair (indigo + slate)
- **Edit pencil** visible per row — TRANSPORT_UPDATE granted to OPERATIONS
- **Delete trash** absent from every row — TRANSPORT_DELETE = `[ADMIN]` only; OPERATIONS correctly denied
- **Pagination footer**: `Page 1 of 1 · Showing 1–3 of 3` + `Rows per page: 50` selector + Prev/Next disabled
- **Sidebar** with `Transport` item highlighted (active route)
- **Zero console errors**

## R-16 console-check results (verbatim from `preview_eval`)

```
R16_check_1_fontFamily   = "Manrope, ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_1_pass         = true   (contains "Manrope")
R16_check_2_styleSheets  = 2
R16_check_2_pass         = true   (> 0)
R16_check_3_fSans        = "\"Manrope\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"
R16_check_3_pass         = true   (non-empty)

URL                      = http://localhost:3100/transport
heading                  = "Service Providers"  (h1.text-xl.font-semibold.text-slate-800)
subtitle                 = "3 providers"
addProvider_visible      = true
editLinks_count          = 6     (3 rows × 2 layouts in jsdom-style render)
deleteButtons_count      = 0     (OPS lacks TRANSPORT_DELETE — correct)
search_input_present     = true
search_aria_label        = "Search providers by name, contact, or city"
console_errors           = 0
```

## Tech-debt note

Persisting the actual PNG to disk requires either (a) a Puppeteer
script bootstrapped with the dev-server session cookie, or (b) Chrome
headless with cookie injection via DevTools Protocol. Neither is
currently wired into the migration workflow. Filed as follow-up:
introduce `pnpm screenshot:migration <route>` script that uses
Playwright (already installed for E2E tests in other gstack-using
projects) to log in, navigate, and write the PNG to this directory.
