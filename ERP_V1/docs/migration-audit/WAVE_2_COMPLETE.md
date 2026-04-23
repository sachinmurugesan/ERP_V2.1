# Wave 2 — Client Portal — COMPLETE

Completed: 2026-04-22
Profiles written: 9 of 9

## Files
1. client_dashboard.md
2. client_orders_list.md
3. client_orders_new.md
4. client_orders_detail.md
5. client_products.md
6. client_ledger.md
7. client_shipments.md
8. client_after_sales.md
9. client_returns_pending.md

## Security findings surfaced during Wave 2
- G-001 through G-006: portal permission audit (Cluster G)
- G-007: unloaded_items cross-tenant leak — CLOSED 2026-04-21
- G-008: show_returns policy decision — [YES/NO]
- G-009: frontend route guards deferred

## Cross-cutting patterns captured
P-001 through P-009 in CROSS_CUTTING_SCRATCH.md

## Total security patches landed during Wave 2
Patches 6, 7, 8 (G-002, G-003, G-007)

## Next: Wave 3 — Factory Portal (4 profiles)
- factory_dashboard.md
- factory_orders.md (includes reuse pattern for /production and /packing routes)
- factory_order_detail.md
- factory_profile.md
