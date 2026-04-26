# Tech debt: @harvesterp/lib must be rebuilt after matrix.ts changes

## Problem

When matrix.ts is modified (new permissions added),
apps/web tests fail with undefined permission errors
because @harvesterp/lib ships as a pre-built dist/index.js.
The source change to matrix.ts doesn't reach apps/web
until the lib package is rebuilt.

## Symptoms

Test failures like:
"canAccess(role, Resource.TRANSPORT_CREATE) blows up
because PERMISSION_MATRIX[Resource.TRANSPORT_CREATE]
is undefined"

## Fix

After any matrix.ts change, run before web tests:
    cd harvesterp-web/packages/lib && pnpm build

This is now a required step in the Layer 1 permission
commit sequence (Step 1 of every migration that adds
permissions).

Consider adding to CONVENTIONS.md Section 4
(Technology Stack) as a note under Layer 1.

## Priority

LOW for now — easily recovered when hit.
Worth automating in a future turbo build config.

## Discovered during

feat/migrate-transporters-list Step 5
(commit 4b1aa3c). 22 test failures resolved by
rebuilding @harvesterp/lib.
