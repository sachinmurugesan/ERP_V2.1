# Tech debt: 3 foundation PR proxies had wrong shape contracts

## Problem

Foundation PR #1 built proxies for `timeline`,
`next-stages`, and `transition` with shape contracts
that did not match actual backend responses. Tests
mocked the upstream-fetch return values to match
EXPECTED shapes rather than live shapes — so the
tests passed while the shapes were wrong.

Concretely:

| Proxy | Built-with shape | Backend actually returns |
|---|---|---|
| `GET /api/orders/[id]/timeline` | `{events: []}` | `{current_status, current_stage, current_name, timeline: [...], overrides: [...]}` |
| `GET /api/orders/[id]/next-stages` | `{options: []}` | `{current_status, current_stage, next_stages, prev_stage, reachable_previous, reachable_forward, highest_unlocked_stage}` (4 lists in one shot) |
| `PUT /api/orders/[id]/transition` | `target_status` in body | Backend reads `target_status` from query string; rejects with 422 if in body |

Additionally, two endpoints had no proxy at all:
- `PUT /api/orders/[id]/go-back/`
- `PUT /api/orders/[id]/jump-to-stage/`

These are needed by the order-detail shell for the
"Go back" button and stepper-circle / "Return to S{n}"
jump-forward UI.

## Root cause

Live endpoint verification was not done during
foundation PR development. The shapes were inferred
from the orders research doc rather than curl-verified.
The proxy tests then mocked the EXPECTED upstream-fetch
return values to match the inferred shape, hiding the
mismatch.

## Fix

All three proxy shapes corrected and the two new
proxies (go-back, jump-to-stage) added in
`feat/order-detail-shell` commit `0642f23`:

`fix(api): correct order proxy shapes and add go-back
+ jump-to-stage routes`

Tests rewritten to assert against the actual backend
shape (verified live 2026-04-26 via curl probe).

## Lesson — proxy test methodology

Proxy unit tests must do one of these to be meaningful:

A. **Curl-verify the actual backend response shape
   first**, then mock THAT exact shape in the proxy
   test. The mock must be a faithful capture of a real
   backend response, not an inferred / aspirational
   shape.

B. **Use integration tests against a real backend
   instance** (e.g. spun up via docker-compose in CI).

The current approach in foundation PR #1 (mock the
expected shape based on the research doc) was
**insufficient for shape validation**. It validated
that the proxy correctly forwards mocked input — not
that the proxy correctly handles real backend output.

## Prevention going forward

For every new proxy in future PRs:

1. **First** — curl the real backend endpoint with a
   valid auth token and real entity id. Capture the
   actual response (`/tmp/probe-{endpoint}.json` or
   similar). Inspect its shape.
2. Define the local TypeScript interface from the
   captured shape (not from the OpenAPI spec, which
   for HarvestERP order endpoints almost always says
   `unknown` because the FastAPI handlers return
   bare `dict`).
3. Mock the EXACT captured shape in the proxy test.
4. Add at least one test that asserts the proxy
   passes through a non-trivial wrapper field — not
   just that the bare items array is forwarded.

Codify this in CONVENTIONS.md as part of the
proxy-route migration checklist (proposed for a
future commit — flagged in this migration's
"Proposed rules" section).

## Priority

Resolved. Document retained for postmortem reference.

## Discovered during

`feat/order-detail-shell` Phase 1 endpoint verification
(2026-04-26). All three mismatches surfaced within
60 seconds of curl-probing the live endpoints.
Mitigation applied in commit `0642f23` (commit #1 of
the order-detail-shell migration, ahead of any
consumer code).
