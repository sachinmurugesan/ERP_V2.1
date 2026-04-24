# Tech debt: factory-ledger date filter applies to payments only

## Problem

`GET /api/finance/factory-ledger/{factory_id}/?start_date&end_date` applies
the date range to the **payments** query only. Factory-order *debits* are
always included regardless of range — the backend filters
`FactoryPayment.payment_date` but never constrains `Order.created_at`
(see [backend/routers/finance.py:1555-1566](../../backend/routers/finance.py#L1555)).

Net effect: a user filtering "show me 2026-Q1 activity" sees Q1 payments
but every factory order ever placed, which makes the running balance look
wrong for narrow ranges.

## Impact

- Surprises finance users who assume the date range filters the full
  ledger.
- Running balance column misleading for date-filtered views.
- Net balance totals include debits outside the filtered range.

## Current mitigation (frontend, ships 2026-04-24 with feat/migrate-factory-ledger)

The Next.js factory-ledger page shows an info tooltip beside the From/To
inputs: *"Date range filters payments only — factory-order debits are
always included for the selected factory."*

## Proper fix (backend)

Either:

- **A:** extend the date filter to apply to `Order.created_at` as well,
  matching user expectation. Tighten running-balance semantics to the
  filtered window.
- **B:** add a `debits_range_filter=true|false` query param so the caller
  can opt in. Default to current behaviour for backward compatibility.

Recommend A. Requires:
1. Schema/query change in `get_factory_ledger`.
2. Re-test downstream reconcilation reports (check other callers of this
   endpoint).
3. Remove the frontend tooltip once behaviour matches expectation.

## Priority

LOW. Workaround explains the quirk clearly; no data integrity issue.

## Discovered during

feat/migrate-factory-ledger Phase 2 (2026-04-24). Existed in Vue source
already — documented in `docs/migration-audit/pages/internal_factory_ledger.md`
as "date filter applies to payments but not debits".
