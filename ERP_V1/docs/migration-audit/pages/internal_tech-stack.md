# Tech Stack

**Type:** page
**Portal:** internal
**Route:** `/tech-stack` (`meta.roles: ['ADMIN']`)
**Vue file:** [frontend/src/views/TechStack.vue](../../../frontend/src/views/TechStack.vue)
**Line count:** 582
**Migration wave:** Wave 1 (ADMIN; purely informational — largely hard-coded content)
**Risk level:** low (no writes; one POST to rebuild the graph; everything else is static reference data)

## Purpose (one sentence)
ADMIN-only architecture showcase page — hero KPI strip, an embedded Knowledge Graph iframe, and a sticky category navigator that swaps content between Overview / Security / Frontend / Backend / Database / Architecture / AI Integration panels.

## Layout (top→bottom, left→right, exhaustive)

### Full-page shell
`<div class="min-h-screen" style="background: #f6fafe; font-family: 'Inter'">`. Uses inline `<style>` fonts `Inter` (body) and `JetBrains Mono` (numbers, code refs) — these must already be linked in `index.html` (no `<link>` in this file).

### Zone 1 — Hero block (gradient header)
- Style: `linear-gradient(135deg, #f0f4f8 0%, #f6fafe 100%)`.
- Eyebrow: `SUPPLY CHAIN MANAGEMENT SYSTEM` (emerald, monospace, letter-spaced).
- Title: `HarvestERP` at 3.5rem, tight letter-spacing, charcoal.
- Subtitle: `Interactive architecture overview — precision-built for import operations.`
- **KPI strip (6 columns on md+):** monospace numbers with caption labels, each from the constant `stats` object (lines 24-37):
  - `stats.totalLines` (49,322) — Lines of Code
  - `stats.tables` (46) — DB Tables
  - `stats.apiEndpoints` (215) — Endpoints
  - `stats.orderStages` (17) — Order Stages
  - `stats.vueComponents` (60) — Components
  - `stats.services` (7) — Services

### Zone 2 — Knowledge Graph card
- White card with header: gradient indigo→purple tile + title `Codebase Knowledge Graph` + subtitle `1,433 nodes · 10,485 edges · 37 communities — powered by graphify`.
- Right cluster: `Full Screen` anchor → `/graphify/graph.html`; `Report` anchor → `/graphify/GRAPH_REPORT.md`.
- `<iframe id="graphify-iframe" src="/graphify/graph.html" style="height: 500px;">`.

### Zone 3 — Sticky category navigator
- `sticky top-0 z-20` with backdrop blur.
- Horizontally scrollable row of 7 pill-buttons: `Overview`, `Security`, `Frontend`, `Backend`, `Database`, `Architecture`, `AI Integration`. Active pill uses `linear-gradient(135deg, #006c49, #10b981)` white text; inactive uses slate-grey. Has manual hover state logic on `mouseenter` / `mouseleave` (inline `style` toggles).
- Bound to `activeCategory: ref('overview')`.

### Zone 4 — Category content (one of 7 panels, `v-if` per panel)

**Overview panel** (default)
- "Codebase Distribution" card — progress bar 60/40 (frontend/backend) with side-by-side number cards (`stats.frontendLines` 29,470 indigo / `stats.backendLines` 19,852 emerald).
- "22-Status Order Workflow" — row of 22 stage pills with arrow separators. Each pill shows the label from the `orderStages` constant (lines 72-95): `CLIENT_DRAFT`, `DRAFT`, …, `AFTER_SALES`, `COMPLETED`. `title` attribute holds the description.
- "Quick Metrics" — 4-card grid: `stats.apiMethods` (201), `stats.schemaModels` (54), `stats.tests` (55), `stats.schemas` (7).

**Security panel**
- Posture header with `95% ENFORCED` emerald pulse dot + "6 critical/high vulnerabilities fixed — 55 automated tests passing".
- 6-item **Fix List** from `securityFixes` constant (lines 107-114). Each fix: check icon + `Fix {id}: {title}` + severity pill (`CRITICAL` red / `HIGH` amber) + description.
- **Defense-in-Depth Layers** — 4 collapsible cards from `securityLayers` (lines 116-121):
  1. `Edge & Gateway` (4 items: SlowAPI rate limit, 200MB payload firewall, security headers, CORS whitelist).
  2. `Identity & Access` (6 items: Argon2id, JWT access/refresh, RBAC 5 roles, RLS, field-level stripping, Vue Router guards + 401 auto-logout).
  3. `Application & Memory` (4 items: 1MB chunked streaming, Pydantic 500-item cap, filename sanitization, 4 exception handlers).
  4. `Data & Database` (4 items: pagination cap 200, parameterized queries, immutable audit trail, soft delete + bin).
- Each layer card toggles via `toggleSec(i)` / `expandedSec` — expanded card lists bullet items.
- **Test Summary** — 4-card grid: 55 tests, 5 RBAC roles, 3 isolated portals, 0 data leaks.

**Frontend panel**
- `Frontend Stack` 2-column grid of cards from `frontendStack` constant (lines 49-58, 8 items): Vue 3, Vite, PrimeVue, Tailwind CSS, Pinia, Vue Router, Axios, SheetJS. Each card: name + version pill + purpose + detail.
- `Utilities & Composables` — 4-card grid hard-coded inline in template: `useApiError`, `useAuth`, `formatters.js`, `constants.js`.

**Backend panel**
- `Backend Stack` 2-column grid from `backendStack` (lines 60-70, 9 items): FastAPI, Uvicorn, SQLAlchemy, Pydantic, Alembic, openpyxl, Pillow, slowapi, Anthropic SDK.
- `Schema Layer` — lists 7 schema filenames.
- `Exception Hierarchy` — 6 rows: `EntityNotFoundError` (404), `AccessDeniedError` (403), `DuplicateEntityError` (409), `InvalidStageTransitionError` (400), `FileTooLargeError` (413), `ValidationError` (400).

**Database panel**
- Header with 46-tables badge.
- `dbTableGroups` grid (lines 97-105): 7 groups (Master Data, Products, Orders, Financial, Logistics, Operations, System). Each group shows all tables as monospace chips.
- **Alembic Migration History** — 2 rows: `39d330b9efa7 baseline_schema`, `fb606be1a020 drop_dead_tables_fix_is_split`.

**Architecture panel**
- 8 cards from `archLayers` (lines 123-132) — 1 Presentation … 8 Database — shown as a stacked-with-arrow chain.
- `Design Patterns` grid — 6 inline-literal cards: Snapshot, Schema-First API, Service Layer, Variant System, Exception Hierarchy, Soft Delete + Bin.

**AI Integration panel**
- Eyebrow `ANTHROPIC INTEGRATION` + title `Claude AI — Structured Tool Use` + monospace `model: claude-haiku-4-5-20251001`.
- 2 cards: `Conflict Resolution` (referencing `services/conflict_resolver.py` + `services/ai_client.py`) + `Column Mapping` (referencing `services/column_mapper.py`).
- Decision Flow strip: 6 labeled steps: `Excel Upload` → `Detect Conflicts` → `Send to Claude` → `Tool Use Response` → `Auto-Select` → `User Confirms`.

## Data displayed
All statistics and lists are **hard-coded constants in the file** (`stats`, `frontendStack`, `backendStack`, `orderStages`, `dbTableGroups`, `securityFixes`, `securityLayers`, `archLayers`, inline arrays in template). **No backend data binds to this page** — it is a marketing/arch-review snapshot.

The file also contains some numbers that **do not match the current `api/index.js`**:
- `stats.apiMethods = 201` and `stats.apiEndpoints = 215` — inventory Pass A counted **222 methods** in `api/index.js`. [UNCLEAR — needs Sachin review: was 201 correct at a snapshot time? Should these numbers be dynamic?]
- `stats.vueComponents = 60` — Pass A inventory counts 41 pages + 22 components = 63.
- `stats.orderStages = 17` in the hero but the stage list on the Overview panel has 22 labels. The label "22-Status Order Workflow" acknowledges the gap.

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click a category pill (`Overview` etc.) | sets `activeCategory` | none | swaps panels |
| Click a security layer card | `toggleSec(i)` | none | expands/collapses bullet list |
| Click `Full Screen` (iframe header) | native anchor | none | new tab `/graphify/graph.html` |
| Click `Report` (iframe header) | native anchor | none | new tab `/graphify/GRAPH_REPORT.md` |
| Click `Full Screen` in Overview's Knowledge Graph card | native anchor | none | same as above |
| `rebuildGraph()` (defined, **not wired to any button in template**) | sets `graphRebuilding = true` | `POST /api/graphify/rebuild/` via raw axios | reloads iframe source |

**Note:** `rebuildGraph` is defined but **not bound to any UI element** — dead hook (possibly referenced from a button that got removed). [UNCLEAR — needs Sachin review: bring back the button, or delete the function?]

## Modals/dialogs triggered (inline)
None.

## API endpoints consumed (from src/api/index.js)
**None.** The defined-but-unwired `rebuildGraph` calls `axios.post('/api/graphify/rebuild/')` directly; it is not through the `api/index.js` module registry.

## Composables consumed
None.

## PrimeVue components consumed
None. Heavy use of inline CSS-in-JS style strings for visual flair (gradients, font tokens, letter-spacing, custom colors). Icons: PrimeIcons `pi-share-alt`, `pi-external-link`, `pi-file`.

## Local state (refs, reactive, computed, watch)
- `activeCategory: ref('overview')`.
- `graphRebuilding: ref(false)` — unused in template.
- `graphLastBuilt: ref(null)` — unused in template.
- `expandedSec: ref(null)` — active security-layer index.

All content arrays/objects (`stats`, `categories`, `frontendStack`, `backendStack`, `orderStages`, `dbTableGroups`, `securityFixes`, `securityLayers`, `archLayers`) are non-reactive plain constants in `<script setup>` scope.

## Permissions/role gating
- Route `meta.roles: ['ADMIN']`.
- Sidebar exposure: ADMIN only.

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
No loading state — content is entirely static after first render (except the iframe which loads asynchronously on its own). No error banners.

## Business rules (the non-obvious ones)
1. **The page is purely informational.** Numbers drift from reality (201 vs 222 API methods, 60 vs 63 components) because they are hard-coded. A true "live" tech stack page should ingest counts from a backend endpoint.
2. **The `orderStages` list has 22 entries** despite the hero KPI stating 17 stages, and the panel header saying "22-Status Order Workflow" and "17 logical stages, 22 internal statuses. All transitions are manual with gate validations." This is a content-authoring nuance, not a bug.
3. **Inline CSS Is Extensive** — mostly because Tailwind 4's JIT doesn't compile arbitrary gradient color values in some contexts; the author used `style="background: linear-gradient(...)"` for precision. This is OK but makes any theming harder.
4. **`graphify` static assets** are backend-built. The rebuild button (if resurrected) hits `/api/graphify/rebuild/` which is a sidecar AST→graph service (referenced in [CLAUDE.md](../../../CLAUDE.md)).

## Known quirks
- **Dead `rebuildGraph` handler** — defined but no UI surface.
- **Hard-coded fonts** (`Inter`, `JetBrains Mono`) — requires them to be loaded globally.
- **Mouse-enter/leave inline `style` toggles** on nav pills — works but is brittle; could be Tailwind-only.
- **No print stylesheet** — the page is dense with gradient backgrounds; printing to PDF would look terrible.
- **Sticky nav inside a scrolling main** may collide with topbar z-index on some scroll positions. [UNCLEAR — quick visual check during migration.]
- **Tamil i18n: no strings**; title is "HarvestERP" which is an English brand. If bilingual is coming, this marketing surface might need localized variants.

## Migration notes
- **Claude Design template mapping:** **new pattern needed** — Marketing / Showcase. Unlike any CRUD surface elsewhere. In practice this is "About → Tech" in a corporate app.
- **Layer 2 components needed:** `HeroStrip`, `KPIStrip`, `IframeCard`, `StickyCategoryTabs`, `LayerTile` (expandable), `StageChain`, `TechCard`, `SimpleChart` (for the 60/40 bar), `StepFlow`.
- **New Layer 1 strings to add:** All section titles, eyebrows, all card descriptions (~80 strings). Unless Sachin wants this page to stay English-only.
- **Open questions for Sachin:**
  1. Keep this page as a pure marketing/reference page, or wire it to live counts (needs a new `GET /dashboard/tech-stats/` endpoint)?
  2. Resurrect the "Rebuild Graph" button?
  3. Move the knowledge-graph iframe to its own dedicated route (`/dev/graph`) and drop it from this page?
  4. This page reads like "investor deck" content. Does it belong in-app at all post-migration, or should it move to the `docs/` website?
