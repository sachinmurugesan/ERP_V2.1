# Wave 7 — Order Creation — COMPLETE

Completed: 2026-04-22
Profiles written: 2 of 2 (schema-compliant)

## Files
1. internal_orders_list.md (OrderList.vue, ~438 lines)
2. internal_orders_draft.md (OrderDraft.vue, 1,563 lines — largest file in the Vue frontend; profile 6,542 words)

## Security findings surfaced during Wave 7
Two follow-up audits triggered by OrderDraft profile flags:

Follow-up 1 (POST /api/orders/ role check): CLEAN
- create_order has current_user dependency
- Inline role check: role in (ADMIN, SUPER_ADMIN, OPERATIONS)
- CLIENT/FACTORY correctly blocked
- Verified 2026-04-22; no new ticket

Follow-up 2 (productsApi.search response fields): CLEAN on primary concern
- ProductOut carries no per-unit factory pricing (those fields live on OrderItem, not Product — architecturally correct)
- Two LOW findings surfaced as side-effects:
  - G-016 (LOW): notes field returned despite being in CLIENT_HIDDEN_FIELDS — deferred to Wave 0
  - G-017 (LOW/UNCLEAR): factory_part_number classification — deferred to Wave 0 + product decision

## Cross-cutting patterns added/extended
- P-014 variant: read-endpoints-without-current_user-driving-filter_for_role (documented in CROSS_CUTTING_SCRATCH.md)
- P-010 × 2 instances: inline setTimeout debouncing (product search 300ms + browser search 400ms in OrderDraft)
- processBulkPaste() extraction note: 80-line monolithic function needs pure classifier extraction for testability
- P-020 confirmed absent in OrderDraft (no avatar duplication)

## Cumulative migration state after Wave 7
- Profiles: 31 of 58 (53%)
- Security patches: 13 shipped (1 CRITICAL + 12 HIGH closed)
- Follow-up verifications completed: 2 (both clean on primary concerns; 2 LOW findings deferred to Wave 0)
- Zero HIGH+ findings open

## Next: Wave 8 — Order Detail Shell + 14 Sub-tabs (15 profiles)
Split across 3-4 sessions:
- Session A: OrderDetail shell + 4 tabs (dashboard, items, payments, production)
- Session B: 4 tabs (packing, booking, sailing, shipping-docs)
- Session C: 4 tabs (customs, after-sales, final-draft, queries)
- Session D: 3 tabs (files, landed-cost) + CROSS_CUTTING.md consolidation

## Milestone: 53% through audit phase. Largest single file (1,563 lines) profiled. Remaining work is distributed across 15 smaller files.
