# Wave 8 Session A — Order Detail Shell + 4 Sub-tabs — COMPLETE

Completed: 2026-04-22
Profiles written: 5 of 5 (schema-compliant)

## Files
1. internal_order_detail.md (OrderDetail.vue, 956 lines — shell/orchestrator)
2. ordertab_dashboard.md (OrderDashboardTab.vue, 552 lines)
3. ordertab_items.md (OrderItemsTab.vue, 3,331 lines — largest component in codebase)
4. ordertab_payments.md (PaymentsTab.vue, 1,454 lines)
5. ordertab_production.md (ProductionTab.vue, 122 lines)

## Security findings surfaced during Wave 8 Session A

### Finding 1: D-003 — 6 new alert() instances
- OrderDetail shell: 2 × alert() — `assignFactory()` and `approveInquiry()` error handlers
- OrderItemsTab: 4 × alert() — all in `handlePriceExcelUpload()` (empty file × 2, column detection failure, parse error)
- Total D-003 instances now known across Wave 1–8: significant; requires a pre-migration sweep to catalog all remaining instances
- Action: Replace all with toast notifications using the shared toast system to be established in Wave 0

### Finding 2: D-004 concern — factory cost data exposed to OPERATIONS (×2 locations)
- **OrderDashboardTab**: `estProfit` renders `factory_total_inr` (factory cost aggregate) via the computed profit estimate. Dashboard tab is visible to all INTERNAL roles including OPERATIONS (no role gate on `dashboard` slug). If D-004 strictly restricts factory cost to SUPER_ADMIN+FINANCE, OPERATIONS should not see this.
- **PaymentsTab**: Factory Payments section renders `factoryPaymentSummary.factory_total_inr` and `factory_total_cny`. Tab visible to all INTERNAL roles post-PI.
- Status: **[UNCLEAR]** — both may be intentional design choices (OPERATIONS needs financial visibility for order management). Requires product decision before migration. Document outcome in DECISIONS.md.
- No new G-ticket raised (LOW/UNCLEAR severity; no confirmed unauthorized access pattern).

### Finding 3: [UNCLEAR] verifyPayment role gate
- `paymentsApi.verifyPayment` (approve/reject client-submitted payment proofs) has no client-side role check in PaymentsTab.vue
- Per AUTHZ_SURFACE.md, this action should be FINANCE-only
- Server-side enforcement must be verified against `backend/routers/payments.py`
- Action: Follow-up verification in Wave 8 Session B or Wave 0

## Cross-cutting patterns added/extended
- **P-020 instance #3**: `getInitials()` in OrderItemsTab — matches instances #1 (OrderList) and #2 (OrderDraft). Three files now duplicate this function. Extract priority: HIGH.
- **P-021 (NEW)**: Client-side Excel I/O via ExcelJS — see CROSS_CUTTING_SCRATCH.md. First confirmed instance: OrderItemsTab `handlePriceExcelUpload()`.
- **P-001 additional instances**: `stageStyles` in OrderDetail shell (same pattern as OrderList.vue); `PRODUCTION_STATUSES` duplicated between ProductionTab and shell.
- **P-011 additional instance**: `orderId = route.params.id` in OrderDetail shell (non-reactive param capture).
- **P-010 inline debounce**: `addItemSearchTimer` (400ms) in OrderItemsTab — another inline setTimeout debounce (matches OrderDraft pattern).
- **N+1 fetch pattern**: `customsApi.getBoe(shipment.id)` called per-shipment in OrderDashboardTab — documented in profile; not yet formalized as numbered pattern.

## Notable architecture observations
- OrderItemsTab is the most complex single component in the Vue codebase (3,331 lines). It encompasses at minimum 9 distinct concern areas that should each become a separate component or hook in Next.js.
- The `highlightSection` prop + `scrollIntoView()` pattern appears in both ItemsTab and PaymentsTab — these two components accept a prop that tells them to scroll to a named section. In Next.js this should be replaced with URL hash routing.
- The Transparency pricing logic (`isTransparencyClient`, `showDualPriceColumns`, `canEditFactoryPrices`, `cfp()`) is fully self-contained in OrderItemsTab. It should become a `useTransparencyPricing()` hook for reuse in the Next.js rebuild.
- OrderDetail shell has a stale-timeline bug: `ordersApi.timeline()` is not re-fetched after stage transitions. Users see a frozen timeline until manual reload.

## Cumulative migration state after Wave 8 Session A
- **Profiles:** 36 of 58 (62%)
- **Security patches shipped:** 13 (unchanged — no new G-tickets requiring immediate patches this session)
- **[UNCLEAR] items opened this session:** 3 (D-004 dashboard, D-004 payments, verifyPayment role gate)
- **Zero HIGH+ findings open**

## Next: Wave 8 Session B — 4 sub-tabs
- ordertab_packing.md (PackingTab.vue)
- ordertab_booking.md (BookingTab.vue)
- ordertab_sailing.md (SailingTab.vue)
- ordertab_shipping_docs.md (ShippingDocsTab.vue)

Prerequisite check for Session B:
1. Verify `backend/routers/payments.py` for verifyPayment role check (the Wave 8-A [UNCLEAR])
2. Confirm production status list source-of-truth location
