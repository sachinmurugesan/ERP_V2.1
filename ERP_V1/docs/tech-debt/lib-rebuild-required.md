# Tech debt: @harvesterp/lib must be rebuilt after matrix.ts changes

## Problem

When matrix.ts is modified (new permissions added),
apps/web tests fail with undefined permission errors
because @harvesterp/lib ships as a pre-built
dist/index.js. Source changes don't reach apps/web
until the lib package is rebuilt.

## Symptoms

canAccess(role, Resource.TRANSPORT_CREATE) returns
undefined — PERMISSION_MATRIX entry not found because
the old build is still in dist/.

## Required step after any matrix.ts change

    cd harvesterp-web/packages/lib && pnpm build

Must happen BEFORE running apps/web tests, not after.

## Priority

LOW. Easily recovered when hit. Document and move on.
Consider automating via turbo build pipeline later.

## Discovered during

feat/migrate-transporters-list (commit 4b1aa3c).
22 test failures resolved by rebuilding the lib package.
