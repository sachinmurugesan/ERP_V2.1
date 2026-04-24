# Tech debt: silent error catches in RSC data fetches

## Pattern

Several RSC data-fetch functions catch errors and return empty arrays or null, hiding real problems from the UI.

## Known instances

1. `factory-ledger/page.tsx` `fetchFactories()` — silent catch, returns `[]` on error (caught bug: `per_page=500` → 422 → `[]`)
2. *[potentially others — audit needed]*

## Why this is wrong

- Violates CONVENTIONS Section 1 P-002 rule (never swallow errors)
- Makes distinguishing "no data" from "fetch failed" impossible in UI
- Debugging requires adding `console.log` or network inspection

## Correct pattern

Use the `FactoryLedgerClient` banner pattern: return `{ data, error }` object, render error banner when `error` is present.

## Priority

MEDIUM. Fix before more RSC data fetches accumulate this pattern.

## Discovered during

`feat/migrate-factory-ledger` live verification.
