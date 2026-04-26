# Tech debt: function coverage below 70% threshold

## Problem

apps/web vitest config sets coverage threshold at 70%
for functions. Current function coverage is 64.12%.
The threshold check fails on every test run but does
not block tests from passing — coverage failure and
test failure are independent in the current config.

## Impact

- Coverage threshold is meaningless if it doesn't
  block merges
- ~30% of functions have unknown coverage
- Likely culprit: RSC page components and route
  handlers are difficult to unit test

## Fix options

A. Add tests for uncovered functions (raises coverage)
B. Lower threshold to match reality (~64%)
C. Exclude RSC pages and route handlers from coverage
   calculation — these are verified by R-16/R-17
   live verification, not unit tests

Recommended: Option C first, then reassess threshold.

## Priority

MEDIUM. Fix before production deployment.

## Discovered during

CSS pipeline smoke test addition 2026-04-26
(commit 480618c). Confirmed pre-existing via baseline
test run at 489 tests.
