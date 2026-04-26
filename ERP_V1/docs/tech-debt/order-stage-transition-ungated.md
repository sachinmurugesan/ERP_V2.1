# Tech debt: order stage transitions not role-gated on backend

## Problem

backend/routers/orders.py endpoints:
- `transition_order` (PUT /{id}/transition/) — line 2448
- `go_back_order` (PUT /{id}/go-back/) — line 2521
- `jump_to_stage` (PUT /{id}/jump-to-stage/) — line 2553

All three accept any authenticated user with order
access. No role check. Only `/reopen/` is gated
(ADMIN/SUPER_ADMIN only, line 2498).

## Impact

A FINANCE or VIEWER user could call these endpoints
directly and move orders through the workflow
without permission. Validation gates exist for data
preconditions (e.g. "must have ≥1 ACTIVE item to
leave DRAFT") but not for caller role.

## Mitigation applied

The Next.js proxy at
`apps/web/src/app/api/orders/[id]/transition/`
enforces a role check (ADMIN | OPERATIONS |
SUPER_ADMIN only) before forwarding to backend.
This prevents unauthorized transitions via the
web UI.

Direct API calls to the backend still bypass this
gate. Full fix requires backend changes.

The proxy gate is documented inline in the route
file with a `⚠️ SECURITY GATE` comment block
referencing this tech-debt doc and the research
finding.

## Full fix

Add role checks to backend/routers/orders.py for:
- `transition_order`
- `go_back_order`
- `jump_to_stage`

Only ADMIN, OPERATIONS, SUPER_ADMIN should be able
to advance stages. FINANCE and VIEWER should be
read-only. The pattern to follow is the existing
`reopen_order` (line 2498) which already enforces
ADMIN/SUPER_ADMIN.

Suggested implementation: add a `require_stage_movers`
dependency in `backend/core/security.py`:

```python
require_stage_movers = require_role(
    [UserRole.ADMIN, UserRole.OPERATIONS, UserRole.SUPER_ADMIN]
)
```

Then add `Depends(require_stage_movers)` to the three
handler signatures.

## Priority

HIGH before production deployment.

## Discovered during

orders-complete-audit-2026-04-26 research, §5.5.
Mitigation applied in feat/orders-foundation PR
(commit ea08ee4 — see
`apps/web/src/app/api/orders/[id]/transition/route.ts`).
