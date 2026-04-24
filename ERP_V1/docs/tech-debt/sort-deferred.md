# Tech debt: sort functionality deferred on data tables

## Problem

Two migrations have shipped data tables without sort:
- feat/migrate-orders-list
- feat/migrate-products-list

Sort on columns is a standard expectation for data tables. Defaulting to "deferred" on every migration silently decides that sort is out of scope for the migration project.

## Impact

Users currently cannot sort orders by date, value, client. Cannot sort products by category, variant count, or last updated. Must use search + filter to approximate.

## Proposed fix

Add sort support to existing data tables:
- Orders: sort by order_number, client_name, stage, value_cny, created_at
- Products: sort by part_code, product_name, category, variant count, updated_at

Backend already returns data in server-sorted order; client-side sort of current page is trivial. Full sort across pagination requires backend ORDER BY parameter.

## Priority

MEDIUM. Sort is a baseline expectation for data tables. Fix before production deployment.

## Discovered during

feat/migrate-orders-list and feat/migrate-products-list.
Flagged by products-list Phase 3 review.
