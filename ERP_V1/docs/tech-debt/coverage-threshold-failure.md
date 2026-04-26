# Tech debt: function coverage below 70% threshold

## Problem

apps/web vitest config sets coverage threshold at 70% for
functions. Current function coverage is 64.12%. The threshold
check fails on every test run but does not block tests from
passing — coverage failure and test failure are independent.

## Impact

- Coverage threshold is meaningless if it doesn't block
  merges
- Current state is unknown coverage for ~30% of functions
- Likely culprit: route handlers and RSC page components
  are difficult to unit test and have low coverage

## Fix options

A. Raise coverage (add tests for uncovered functions)
B. Lower threshold to match reality (64% → adjust as needed)
C. Exclude difficult-to-test files (RSC pages, route handlers)
   from coverage calculation

Recommended: Option C first (exclude RSC pages and route
handlers, which are integration-tested via R-16/R-17
verification rather than unit tests), then reassess threshold.

## Priority

MEDIUM. Fix before production deployment.

## Discovered during

CSS pipeline smoke test addition 2026-04-26 (commit 480618c).
Confirmed pre-existing via baseline test run.
