# Tech debt: per-page Topbar content requires layout refactor

## Problem

AppTopbar's right slot is designed to be set per-page (primary action button, contextual controls). Two migrations have now fallen back to in-page CTA placement:
- feat/migrate-orders-list (+ New Order button in page header)
- feat/migrate-products-list (Import Excel + Add product in page header)

The reason: setting Topbar content from a child RSC requires either context/provider plumbing or moving AppTopbar into the page rather than the (app) layout.

## Impact

- Inconsistent CTA placement across pages
- AppTopbar right slot is dead code today
- Third page to hit this (expected: internal_factory_ledger, internal_clients_list, etc.) will also need the fallback

## Proposed fix

One of:

A. Topbar context provider. A TopbarProvider at (app) layout exposes setTopbarContent(node) via context. Page components call it from useEffect or from a server action. Trade-off: requires client boundary, complexity on every page.

B. Move AppTopbar to per-page. Layout renders page shell (Sidebar + main), each page renders its own AppTopbar with its own right slot. Trade-off: some duplication, but zero context plumbing.

C. Keep current pattern (page-header CTA). Accept the AppTopbar right slot is dashboard-only.

## Priority

LOW. Current fallback (page-header CTA) works visually. Fix before page 5 of migrations OR when a page genuinely needs contextual topbar controls that can't fit in-page.

## Discovered during

feat/migrate-orders-list (first hit)
feat/migrate-products-list (second hit, now a pattern)
