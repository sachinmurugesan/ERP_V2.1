# Tech debt: silent error catches in RSC data fetches

## Pattern

Several RSC data-fetch functions catch errors and return empty arrays or null, hiding real problems from the UI.

## Known instances

1. `app/(app)/finance/factory-ledger/page.tsx` `fetchFactories()` — silent catch returns `[]` on error. Caught during factory-ledger merge verification: `per_page=500` exceeded backend `le=200` limit, got 422, returned `[]`, dropdown appeared empty instead of showing an error. Fixed the underlying request (0d44970) but the silent-catch pattern remains.

2. *[Audit other RSC fetch functions for this pattern as part of cleanup task]*

## Why this is wrong

- Violates CONVENTIONS.md Section 1 P-002 rule: never swallow errors
- Makes "no data" indistinguishable from "fetch failed" in UI
- Silent failures take longer to debug
- A 422 / 500 / 404 should surface as an error banner, not disguised as empty data

## Correct pattern

Return `{data, error}` from the RSC fetch. Render error banner when error is present. See `FactoryLedgerClient` error banner pattern for reference.

## Priority

MEDIUM. Fix before more RSC data fetches accumulate this pattern. Specifically audit upcoming migrations (clients list, transporters list) to avoid repeating this pattern.

## Discovered during

`feat/migrate-factory-ledger` live verification.
