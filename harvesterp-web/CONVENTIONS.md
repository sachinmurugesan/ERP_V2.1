# CONVENTIONS.md

Project rulebook for HarvestERP. Read at the start of every session by Claude Code and human developers. Rules here take precedence over other instructions unless explicitly overridden by the user.

---

## Section 1: Code Syntax Rules

- TypeScript strict mode always on. Never use `any`. Never use `@ts-ignore` or `@ts-expect-error`. If typing is blocked, stop and ask.
- Named exports, not default exports. Exception: Next.js page and layout files (framework requires default export).
- File naming: kebab-case for files, PascalCase for React components inside files, camelCase for functions and variables.
- One component per file unless sub-components are tightly coupled.
- Import order: React → external libraries → internal packages (`@harvesterp/*`) → relative imports → types. Blank line between groups.
- No inline styles. Tailwind utility classes only. Design tokens come from `@harvesterp/lib`.
- No magic numbers. Extract to named constants.
- `async`/`await`, not `.then()` chains.
- Never swallow errors. Rethrow or handle explicitly.
- Never use Unicode escapes (`\uXXXX`) in JSX attribute string values. Use the actual character (`—`, `€`, `₹`) or define as a named constant outside the JSX. Unicode escapes in attribute strings render as literal text in some React/Next.js rendering paths.
- Comments explain WHY, not WHAT.

**Example — import order:**

```ts
import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'

import { Button } from '@harvesterp/ui-gallery'
import { formatINR } from '@harvesterp/lib'

import { TransactionRow } from './transaction-row'

import type { Transaction } from '@/types/transaction'
```

---

### Design system: single source of truth

All visual design tokens live in one place: `C:\Dev\Template_1\ERP_V1\Design\`

Structure:
- `Design/styles/tokens.css` — colors, spacing, typography, radii, shadows, fonts (the foundation)
- `Design/components/` — React component references (`primitives.jsx`, `shell.jsx`)
- `Design/screens/` — reference screens demonstrating compositions

Apps consume these via `@harvesterp/lib` (TypeScript mirror of `tokens.css`).

**Rules:**
- Never define colors, spacing values, or other design tokens outside `Design/styles/tokens.css`.
- Never import raw color hex values into components (use tokens from `@harvesterp/lib`).
- Never create a second "theme file" or "colors file" in any other location.
- If you need a new token, add it to `tokens.css` and regenerate `@harvesterp/lib` tokens.
- The goal: changing a color in `tokens.css` should propagate to the entire app (after one build command).

A "tweak pipeline" to automate this propagation is planned (see follow-up tasks). Until it exists, manual sync between `tokens.css` and `@harvesterp/lib/src/tokens/` is required when tokens change.

---

## Section 2: Git Workflow Rules

- Never commit directly to `main`. Always use a feature branch.
- Branch naming: `feat/description`, `fix/description`, `refactor/description`, `docs/description`, `test/description`, `chore/description`.
- Commit message format: `type(scope): short description`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- One logical change per commit. Small commits preferred.
- Every commit must pass lint + tests + build.
- Before any `git push`, Claude Code must:
  1. Run `pnpm lint` (must pass)
  2. Run `pnpm test` (must pass)
  3. Run `pnpm build` (must succeed)
  4. Report results
  5. Wait for user confirmation before pushing
- PRs must have clear title, description (what / why / how tested), link to audit profile for page migrations, screenshots for UI changes.
- Never force-push to shared branches. Never delete history.

**Example — commit message:**

```
feat(invoices): add INR summary cards above transaction list

Moves summary above the fold so users see balance before scrolling.
Tested with empty, loading, and error states.
```

---

## Section 3: Page Migration Workflow

When migrating a Vue page to Next.js, follow this sequence. Do not skip phases. Do not skip the UX Reasoning phase.

### Phase 1 — Discovery (no code yet)

1. Read the audit profile at `docs/migration-audit/pages/<name>.md` in full.
2. View the reference design screens at `C:\Dev\Template_1\ERP_V1\Design\screens\` — identify which screens relate to this page.
3. Review available components at `C:\Dev\Template_1\ERP_V1\Design\components\` and styles at `C:\Dev\Template_1\ERP_V1\Design\styles\`.
4. Read the source Vue file at `ERP_V1/frontend/src/views/<path>.vue`.
5. **If the user provides a reference design image during the migration request:** Include it as visual inspiration for layout and mood. Do NOT use it as a literal blueprint. Cross-reference against the existing design system at `C:\Dev\Template_1\ERP_V1\Design\`. If the reference uses a component or pattern not in the design system, flag it explicitly. Either adapt to the design system, or propose adding the new pattern to the system (user decides before Phase 3).

### Phase 2 — UX Reasoning (critical, do not skip)

Before writing any code, produce a UX reasoning report that answers:

1. What is the user's primary goal on this page? State in one sentence.
2. What is the information hierarchy? Rank elements by importance from 1 to 5 (most to least).
3. Is the current Vue layout's hierarchy aligned with user priority?
   - If YES: confirm it and proceed with faithful port.
   - If NO: propose a revised layout with specific reasoning. Example: "Current layout shows transaction list first; moving summary cards above table because users check balance before scanning transactions."
4. What interactions are there, and are they discoverable?
   - List every button, dropdown, filter, action.
   - Flag any that seem hidden, mislabeled, or placed inconsistently with similar pages.
5. What states does this page have (loading, empty, error, success, permission-denied)? Does the current design handle all of them?
6. Accessibility check: are there contrast issues, keyboard navigation problems, screen reader issues visible in the current design?
7. Responsive check: does the current design work on mobile / tablet, or is it desktop-only? Flag if unclear.

Present the UX reasoning to the user. Format:

```markdown
## UX Reasoning for <page name>

### User goal
<one sentence>

### Information hierarchy
1. <most important>
2. ...

### Current layout assessment
<faithful / minor adjustments / significant redesign recommended>

### Specific suggestions
<numbered list with reasoning>

### Interactions inventory
<list with flags>

### State coverage
<loading / empty / error / success — assessment>

### Accessibility notes
<any concerns>

### Responsive notes
<any concerns>

### Recommendation
One of:
- LIFT: port as-is, no UX changes
- POLISH: port with minor improvements (list them)
- REDESIGN: propose new layout (describe it)

### Awaiting user decision on: <specific questions needing user input>
```

STOP after this report. Wait for user response before writing code.

---

**Migration log file (mandatory for every page migration):**

Every page migration maintains a single log file at: `docs/migration/logs/<YYYY-MM-DD>-<page-name>.md`

This file is created at the start of Phase 2 and is APPENDED to throughout Phase 2, Phase 3, and any follow-up fixes. It captures the complete story of the migration — including corrections, fixes, and resolutions as they happen.

The log file has these sections (add as work progresses):

#### Header
- Page name
- Date started
- Date completed (filled at end)
- Audit profile: link to `docs/migration-audit/pages/<name>.md`
- Vue source: link to `ERP_V1/frontend/src/views/<path>.vue`
- Reference image: filename if user provided one

#### Phase 1 — Discovery findings
- What the audit profile says
- What the Vue source actually does
- What components from the design system will be used
- Any discrepancies between audit and Vue source (flag for profile update)

#### Phase 2 — UX reasoning report
- Full UX reasoning report (as specified in Phase 2 above)
- User's decisions on the report (LIFT / POLISH / REDESIGN + specific answers to "Awaiting user decision" questions)

#### Phase 3 — Implementation notes
- Files created (with brief purpose)
- Files modified (with brief purpose)
- Tests added (count + brief description)
- nginx config changes
- `MIGRATED_PATHS.md` update

#### Issues encountered and resolutions (APPENDED DURING WORK)

Every time something breaks, gets flagged, or needs a fix during or after the migration, add an entry here:

##### Issue <N>: <short title>
- **Date raised:** `<YYYY-MM-DD HH:MM>`
- **Problem:** what was wrong
- **Root cause:** why it happened
- **Fix applied:** what was changed to resolve
- **Date resolved:** `<YYYY-MM-DD HH:MM>`
- **Tests added:** if regression test added

Every correction, bug, type error, failed test, broken import, merge conflict, or similar gets logged here. If a fix takes multiple attempts, log each attempt. This becomes the institutional record of what went wrong and how it was fixed.

#### Proposed rules for CONVENTIONS.md (if any)
- Rules Claude thinks should be added based on patterns observed during this migration
- User reviews these at end of migration and approves / rejects
- Approved rules are added to CONVENTIONS.md in a SEPARATE commit (not this migration's commit)

#### Open questions deferred
- Anything flagged during migration that wasn't answered
- Marked with who needs to decide (user / finance / ops / etc.)

#### Final status
- Tests passing: N/N
- Build: ✅ / ❌
- nginx config: ✅ / ❌
- `MIGRATED_PATHS.md`: ✅ / ❌
- Committed in PR: #XXX
- Deployed to staging: date
- Deployed to production: date

The log file commits in the SAME PR as the page migration. It is a living document — corrections made weeks later still get appended to this file.

### Phase 3 — Implementation (after user approves UX approach)

7. Create feature branch: `feat/migrate-<page-name>`.
8. Build the Next.js page structure first (empty shell).
9. Wire data fetching.
10. Add states (loading, empty, error).
11. Write tests as you go.
12. Update nginx config (both `nginx.dev.conf` and `nginx.conf`, all 3 portal blocks).
13. Update `docs/migration/MIGRATED_PATHS.md`.
14. Run full test suite before PR.
15. Open PR with the template from Section 2.

If the audit profile has any `[UNCLEAR]` marker or contradicts backend reality, STOP and ask before proceeding.

---

## Section 4: Technology Stack

**Frontend**
- TypeScript (strict mode) for all new code
- Node.js 20+
- pnpm (never npm or yarn)
- Next.js 15 (App Router)
- React 18
- Tailwind CSS v3 + shadcn/ui
- `@harvesterp/ui-gallery` (internal Layer 2)
- React Server Components by default, TanStack Query for client state

**Backend**
- FastAPI (Python 3.11+)
- PostgreSQL 16

**Tooling**
- Vitest + React Testing Library
- ESLint + Prettier
- GitHub

Do not introduce new libraries without user approval.

**Vue legacy app** (`ERP_V1/frontend`): no new features, bug fixes only during migration.

---

### Stack stability

This technology stack is intentional and stable:
- **Frontend**: TypeScript (language) + Next.js 15 (framework)
- **Backend**: Python 3.11+ (language) + FastAPI (framework)
- **Database**: PostgreSQL 16

This is the modern corporate standard for B2B SaaS and enterprise applications. Companies using this exact stack include: Stripe, Airbnb (migrating), Netflix (for some services), Instagram, Dropbox, Shopify.

No language migration is planned. If a new language or major framework change is ever considered, discuss with user before proposing. Do not suggest language changes during routine work.

Libraries added on top of this stack require user approval. Do not introduce new dependencies silently.

---

## Section 5: When Claude Should Suggest vs Wait

**Proactively suggest when:**
- A task completes successfully — suggest next logical step.
- A test fails with clear root cause — suggest fix.
- A security or typing issue surfaces — flag and propose fix.
- A pattern emerges across pages that could be extracted — suggest it.
- A deviation from the audit profile is needed — flag with reasoning.

**WAIT for user when:**
- A business decision is needed.
- Credentials or data access is needed.
- Multiple valid approaches exist — ask which.
- A scope boundary was set — respect it.

**After each completed task produce:**
1. Summary of what was done.
2. Test / build / lint results.
3. Short recommendation for next step.
4. Clear handoff point.

---

## Section 6: Testing Rules

- Every new feature has tests.
- Test names are full sentences: `"login fails with invalid credentials"` not `"test login"`.
- Tests go in `tests/` folder mirroring source.
- Vitest for unit tests, React Testing Library for components.
- Mock external dependencies.
- Integration tests in `tests/integration/`, skipped in CI unless service is running.
- 80%+ coverage on new code — don't chase 100%.
- Every bug fix includes a regression test.
- Responsive tables: when testing a table that renders different layouts at different breakpoints, tests must scope queries to one layout (desktop OR mobile) with specific role or test-id selectors, not rely on media queries. jsdom does not honor media queries and renders all layouts simultaneously, causing duplicate-match failures.

---

## Section 7: Communication Style

- Plain English. Jargon defined inline.
- Short paragraphs. Bullet lists only when content is a list.
- When reporting completed work: state → results → deviations → next step.
- When asking for decisions: state decision → options + tradeoffs → recommendation → wait.
- When flagging risks: direct, not hedged. "This will break X" not "this might affect X."
- No unnecessary politeness or filler.
- Honest disagreement > false agreement.

---

## Section 8: Business Context

HarvestERP serves **Absodok Pvt Ltd** (Chennai, Tamil Nadu) and **GAM Agri Machines**.

**Locale**
- Primary currency: INR
- Secondary: USD, CNY
- Dates: `dd-mm-yyyy` or `dd MMM yyyy` (never US `mm/dd/yyyy`)
- Addresses: Indian postal format
- Phone: `+91` with 10 digits
- GST and HSN codes apply to products

**Three portals**
- Internal (admin) portal for Absodok team
- Client portal for buyers (Halder Solutions etc.)
- Factory portal for suppliers (Changzhou Xinlikang)

**Language**
- Code: English only
- User-facing strings in internal portal: English primary, Tamil optional (`InternalString` type)
- User-facing strings in client / factory portals: bilingual required (`PortalString` type)

**Settled product decisions (do not re-litigate)**
- Factory pricing / margin: `SUPER_ADMIN` and `FINANCE` only
- `OPERATIONS` role excludes profit estimates (D-010)
- Tyre imports and spare parts imports are separate concerns
- Bilingual support required for client / factory portals

**Things Claude should NEVER do**
- Modify Vue legacy code except critical bugs
- Commit secrets or API keys
- Disable failing tests — fix root cause instead
- Use `any` as an escape hatch
- Modify generated files (`sdk/src/generated/types.ts`)
- Delete user data or audit log entries

---

## Section 9: Rule Change Protocol

CONVENTIONS.md is a living document, but changes must be deliberate. Random edits create chaos.

### Proposing a new rule

During a migration, if Claude identifies a pattern that should become a project rule, log it in the migration log file (Section 3) under "Proposed rules for CONVENTIONS.md." Do NOT edit CONVENTIONS.md directly during the migration.

Example of a rule worth proposing:
- "Always show currency symbol before the number (₹1,200, not 1,200 ₹) based on Indian convention."
- "Loading states always use the Skeleton component, not spinner, for table rows."
- "Empty states always include a suggested next action, not just 'no data.'"

### Approving rule changes

At the end of each migration, user reviews proposed rules in the log file. For each proposed rule:
- APPROVE → rule gets added to CONVENTIONS.md
- REJECT → note reasoning in log file, rule does not persist
- DEFER → save for later review

### Committing rule changes

Approved rules are added to CONVENTIONS.md in a SEPARATE commit after the migration is merged. Commit message format:

```
docs(conventions): add rule about <summary>
```

This creates a clean history:
- Migration PR: the actual page work
- Follow-up PR: the rulebook updates

Both files (`harvesterp-web/CONVENTIONS.md` and `ERP_V1/CONVENTIONS.md`) must be updated together to stay identical.

### Why this process matters

Rules that change ad-hoc produce inconsistency. Rules that change deliberately, after observing real patterns across multiple migrations, become institutional knowledge that future engineers (or future versions of Claude) can rely on.

---

## Section 10: Approved Migration Patterns

Rules promoted out of migration logs via the Section 9 Rule Change Protocol. Each rule names the migrations it came from so future migrations can understand the context.

### Empty-state CTA rule

_Approved from: dashboard migration, orders-list migration._

Empty states always use a CTA pattern. Never ship a plain "No data" or "No results" text alone.

**Pattern A — no-data-yet empty state** (the resource has never had rows):
- Icon, sized ~40–48px, in `var(--fg-muted)`, relevant to the content type.
- Heading: `No [things] yet.` (e.g. "No orders yet.", "No invoices yet.")
- Primary CTA button: `Create your first [thing]`. Wrap in `<RoleGate>` when creation requires a specific permission.
- Optional muted secondary line for context (e.g. "When you create an order it will appear here.").

**Pattern B — filtered empty state** (rows exist, but the current filter/search hides them all):
- Heading: `No [things] match this filter.`
- Ghost button: `Clear filters`.
- No CTA button — the user already expressed intent; show them how to undo it.

A page with filters needs both patterns and switches between them based on whether any filter is active.

### Local interface rule for untyped SDK endpoints

_Approved from: dashboard migration, orders-list migration._

When an SDK endpoint has an unknown response type in the OpenAPI spec (FastAPI route without `response_model=`), define a local TypeScript interface in the consuming page's `_components/types.ts` file. Never use `any` or inline type assertions for response shapes.

The local interface serves as:
- a visible contract for reviewers of the migration,
- a type boundary for the rest of the page code, and
- an anchor the backend can later match when it adds a real `response_model` — at which point the interface is deleted and the generated SDK type is imported instead.

**Example:**

```typescript
// apps/web/src/app/(app)/orders/_components/types.ts
export interface OrderListItem {
  id: string;
  order_number: string | null;
  client_name?: string | null;
  stage_number: number;
  stage_name: string;
  total_value_cny: number | null;
  created_at: string;
  // ...all fields the page actually reads
}
```

Consumption uses the SDK's escape hatch:

```typescript
const response = await client.getJson<OrderListResponse>("/api/orders/", { params });
```

Not `client.GET(...)` (which would return `unknown`), and never a bare `any` cast.

---

## Footer notes

> **For Claude Code:** This file loads at session start. Rules here take precedence over other instructions unless user explicitly overrides. Flag conflicts to the user.

> **For humans:** Update this file when conventions change. Reflects what we actually do, not what we wish we did.
