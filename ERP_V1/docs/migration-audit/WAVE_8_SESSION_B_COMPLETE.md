# Wave 8 Session B — 4 Shipping Sub-tabs — COMPLETE

Completed: 2026-04-22
Profiles written: 4 of 4 (schema-compliant)

## Files
1. ordertab_packing.md (PackingListTab.vue, 1,244 lines)
2. ordertab_booking.md (BookingTab.vue, 861 lines)
3. ordertab_sailing.md (SailingTab.vue, 539 lines)
4. ordertab_shipping_docs.md (ShippingDocsTab.vue, 271 lines)

---

## Prerequisite checks resolved (from Wave 8 Session A)

### Check 1: verifyPayment role gate — RESOLVED CLEAN
- File: `backend/routers/finance.py:640–649`
- Actual role check: `current_user.role not in ("ADMIN", "SUPER_ADMIN", "FINANCE")`
- **CLEAN**: Backend enforces ADMIN | SUPER_ADMIN | FINANCE. This is broader than FINANCE-only (which AUTHZ_SURFACE.md noted). ADMIN and SUPER_ADMIN can also verify payments. No security gap. The Wave 8-A [UNCLEAR] is resolved — no G-ticket required.
- Note: The router is `finance.py`, not `payments.py`. AUTHZ_SURFACE.md entry "ROLE: FINANCE (router)" referred to the router module name, not a role restriction.

### Check 2: Production status list source of truth — RESOLVED
- File: `backend/enums.py` — `OrderStatus` enum defines all statuses including the 7 production statuses.
- The `PRODUCTION_STATUSES` list used in `ProductionTab.vue` and `OrderDetail.vue` should be derived from `OrderStatus` enum values in Next.js SDK types. Both locations should import `PRODUCTION_STATUSES` from `@/types/order-status.ts`.

---

## Security findings surfaced during Wave 8 Session B

### Finding 1: [UNCLEAR] ShippingDocsTab `/uploads/` direct file path
- **Component**: `ShippingDocsTab.vue` — View and Download links built as `<a href="/uploads/${doc.file_path}">`
- **Concern**: If the backend (FastAPI / nginx) serves `/uploads/` without authentication middleware, shipping documents (Commercial Invoice, Bill of Lading, Certificate of Origin, Packing List) are accessible to anyone who has the URL, even without being logged in.
- **Severity**: UNCLEAR — depends on backend file serving configuration (not verified this session).
- **Data sensitivity**: HIGH — these documents contain financial amounts, factory supplier identities, client GSTIN/IEC, and shipment details.
- **Action**: Verify whether `backend/uploads/` is served with auth requirement. If not, add an authenticated download proxy:
  - Backend: `GET /api/shipments/docs/{docId}/download/` with `current_user` check
  - Next.js: API route proxying the file through the session
- **No G-ticket raised yet** — pending verification of backend file serving configuration.

### Finding 2: D-003 — additional alert() and confirm() instances
- **PackingListTab**: ~10 `alert()` calls — highest count in the entire codebase. Affects: upload, delete, manual create, migrate, undo migrate, split (×2), unsplit, shipping decision, cancel balance (×2).
- **BookingTab**: 1 `confirm()` for container delete.
- **Total D-003 instances**: Continue to grow; Wave 0 pre-migration sweep is critical.

---

## Cross-cutting patterns added / extended (Wave 8 Session B)

### P-022 (FORMALIZED): `highlightSection` prop + scrollIntoView scroll pattern
- Previous mention: Wave 8 Session A COMPLETE noted it without a number ("not yet formalized").
- **Definition**: A parent shell or router passes a `highlightSection: String` prop to a sub-tab. The sub-tab watches the prop and uses `nextTick + el.scrollIntoView({ behavior: 'smooth' })` + a CSS flash animation to scroll to and highlight a named section.
- **Instances**:
  - #1: `OrderItemsTab.vue` — multiple sections
  - #2: `PaymentsTab.vue` — payment upload section
  - #3: `PackingListTab.vue` — `upload` section
- **Migration**: Replace with URL hash routing (`#upload`, `#payments`). Component scrolls to matching `id` anchor on mount or hash change. No prop threading.

### P-023 (NEW): N+1 per-entity API fetch in sequential loop
- **Definition**: A component loads a collection (e.g., shipments), then loops over each item and makes a separate API request per item in a sequential or parallel-but-uncoordinated loop.
- **Instances**:
  - #1: `OrderDashboardTab.vue` — `customsApi.getBoe(shipment.id)` per shipment (noted in Wave 8-A, not formalized)
  - #2: `SailingTab.vue` — `shipmentsApi.getProgress(s.id)` per shipment in `loadAllProgress()` (sequential `for` loop — fully sequential N+1)
- **Impact**: N sequential requests where N = number of shipments. For 3 containers, 3 round-trips before the UI can show progress data.
- **Migration**: Request bulk endpoints (`GET /api/shipments/progress/?order_id={id}`) returning a map. In Next.js, use `Promise.all` minimum as a stopgap.

### P-001 additional instances (hardcoded status arrays)
- `showPackingSection` in `PackingListTab.vue` (13 statuses)
- `isBookingStage` in `BookingTab.vue` (10 statuses)
- `isSailingStage` in `SailingTab.vue` AND `ShippingDocsTab.vue` (9 statuses — same list in two files)
- Total P-001 instances now includes all tab-level status guards. All should come from `backend/enums.py → OrderStatus` enum exported as SDK constants in Next.js.

### P-002 additional instances (silent console.error failures)
- `PackingListTab.vue`: 6 silent failures (loadPackingList, updateFactoryReady, updatePackType, updatePallet, downloadExcel, downloadPDF)
- `BookingTab.vue`: 2 silent failures (loadProviders, loadAddressData)
- `SailingTab.vue`: 1 fully silent failure (loadShippingDocs — `catch {}` with no logging)

---

## Notable architecture observations

### BookingTab: wizard auto-starts on mount when no shipments
This is the only sub-tab that immediately presents a write-mode UI on mount (wizard). All other tabs mount in read-only state. In Next.js, this should be preserved but the wizard should be URL-addressable (`?booking=new`) so the user can deep-link to create booking.

### Cross-tab dependency: ShippingDocsTab → SailingTab
The "Mark as Arrived" action in SailingTab is gated on `allDocsReceived()` which reads `shippingDocsMap` populated by the same endpoint as ShippingDocsTab (`shipmentsApi.listDocs`). Both tabs independently fetch this data. In Next.js, a shared React Query cache with key `['shipping-docs', orderId]` resolves this — updating docs in ShippingDocsTab automatically unblocks the Arrived button in SailingTab.

### BookingTab: in-tab navigation to `/transport/new`
The "+ Add New Provider" option navigates the entire app away from the order detail page. This is a UX regression point — users lose their partially-filled wizard form. This navigation pattern should not be ported to Next.js as-is.

### PackingListTab: dual split code paths (client-side vs server-side)
Pre-creation: `splitManualItem()`/`unsplitManualItem()` — pure client-side array manipulation.
Post-creation: `openSplit()`/`confirmSplit()`/`unsplitItem()` — server-side API calls.
These two code paths exist because the packing list must first be "submitted" before items become server-side entities. The split UX is identical from the user's perspective, hiding the implementation difference. In Next.js, both paths should have the same UX but will still use different underlying mechanisms.

### Status list proliferation across all 4 tabs
All four components in this session define their own hardcoded status arrays. Combined with Wave 8-A components, that is 9+ independent status array definitions for the order detail sub-tabs alone. The 14-status D-002 slug list and the backend `OrderStatus` enum are the correct sources of truth.

---

## Cumulative migration state after Wave 8 Session B

- **Profiles:** 40 of 58 (69%)
- **Security patches shipped:** 13 (unchanged — no new G-tickets requiring immediate patches this session)
- **[UNCLEAR] items opened this session:** 1 (ShippingDocsTab `/uploads/` file serving auth)
- **[UNCLEAR] items resolved this session:** 1 (verifyPayment role gate — CLEAN)
- **Zero HIGH+ findings open**

---

## Next: Wave 8 Session C — 5 sub-tabs

Remaining Wave 8 sub-tabs:
1. ordertab_customs.md (CustomsTab.vue)
2. ordertab_after_sales.md (AfterSalesTab.vue)
3. ordertab_final_draft.md (FinalDraftTab.vue)
4. ordertab_queries.md (QueriesTab.vue)
5. ordertab_files.md (FilesTab.vue)

Also note: `LandedCostTab.vue` is the 14th and final sub-tab (slug: `landed-cost`). Confirm whether this is Wave 8 Session C or a separate session depending on file sizes.

### Prerequisite checks for Session C
1. Verify whether `ShippingDocsTab` `/uploads/` is served with backend auth — check nginx config or FastAPI static file middleware.
2. Confirm `LandedCostTab.vue` file size (not yet checked for this wave plan).
