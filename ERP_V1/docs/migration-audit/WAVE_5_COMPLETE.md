# Wave 5 — Internal Tracking — COMPLETE

Completed: 2026-04-22
Profiles written: 7 of 7 (all schema-compliant)

## Files
1. internal_aftersales.md (AfterSales.vue, 328 lines)
2. internal_finance_layout.md (FinanceLayout.vue, 52 lines)
3. internal_receivables.md (Receivables.vue, 161 lines)
4. internal_client_ledger.md (finance/ClientLedger.vue, 172 lines)
5. internal_factory_ledger.md (finance/FactoryLedger.vue, 175 lines)
6. internal_returns_pending.md (ReturnsPending.vue, 633 lines)
7. internal_warehouse_stock.md (WarehouseStock.vue, 11 lines — STUB)

## Security findings surfaced during Wave 5
None net-new. Two potential findings investigated and resolved:
- client-ledger handler missing current_user param → confirmed
  router-level require_finance gates it adequately
- factory_price rendered in ReturnsPending → confirmed G-007
  patch (INTERNAL-only gate) already in place

## Cross-cutting patterns added
- P-017: Near-identical sibling page components (ClientLedger +
  FactoryLedger — extract shared <LedgerPage> in Wave 0)
- P-018: Unimplemented stub routes in production navigation
  (WarehouseStock — requires product decision)
- P-005 confirmed instances #3 and #4 (internal AfterSales +
  internal ReturnsPending)

## Outstanding product decisions
- WarehouseStock route fate (pending Sachin's A/B/D)
- consolidateByProduct() status: broken / vestigial / unknown
  (pending Sachin's call)

## Schema compliance
6 of 7 profiles passed on first check. 1 profile (client_ledger)
had CL-01: missing P-017 cross-reference in Duplicate utilities
section. Fixed in same session.

## Cumulative migration state after Wave 5
- Profiles: 25 of 58 (43%)
- Security patches: 13 shipped (1 CRITICAL + 12 HIGH closed)
- Zero HIGH+ findings open
- MEDIUM/LOW items deferred to Wave 0

## Next: Wave 6 — Excel ingestion (4 component profiles)
- ExcelUpload.vue (shared between orders and products)
- ColumnMappingDialog.vue
- ConflictResolutionPanel.vue
- ParsedResultsTable.vue

Note: these are components, not pages. Metadata Type field =
"component" for all four. Different from all prior waves.
