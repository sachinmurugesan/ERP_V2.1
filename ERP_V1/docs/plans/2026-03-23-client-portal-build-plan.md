# Client Portal — Complete Build Plan

**Date:** 2026-03-23
**Status:** ACTIVE
**Ref:** IAM_AND_MULTI_PORTAL_ARCHITECTURE.md

---

## Stage-by-Stage Build Status

### Legend
- **BE** = Backend endpoint exists
- **FE** = Frontend UI built
- `[x]` = Done | `[ ]` = Not built | `[~]` = Partial/broken

---

### Stage 0: CLIENT_DRAFT (Client submits inquiry) ✅ COMPLETE

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Submit new inquiry form | [x] | [x] | Working |
| Quick search products | [x] | [x] | Working |
| Browse product catalog | [x] | [x] | Working |
| Bulk paste codes + qty | [x] | [x] | Working — qty from paste carried to Quick Add |
| Quick Add (unlisted product) | [x] | [x] | Working — frontend-only, no orphans |
| Auto-generate PO reference | [x] | [x] | Working (SSP/YY-YY/MM/NNNN) |
| Client reference (optional) | [x] | [x] | Working |
| Notification to admin: new inquiry | [x] | [x] | Working |
| Cart visual: pending approval badge | [x] | [x] | Working — amber "Quick Add — Pending Review" badge |
| Order appears in "My Orders" | [x] | [x] | Working |
| Friendly status labels (not raw enum) | [x] | [x] | Added — "Inquiry Submitted" instead of "CLIENT_DRAFT" |
| Stage progress bar | [x] | [x] | Added — visual progress indicator |
| Pending product requests in OrderDetail | [x] | [x] | Added — shows Quick Add items awaiting review |
| Timeline in OrderDetail | [x] | [x] | Fixed — now loads from timeline endpoint |

**All Stage 0 bugs fixed:**
1. ~~Bulk paste qty lost~~ → Fixed: uses last token as qty
2. ~~Quick Add creates real product~~ → Fixed: frontend-only, ProductRequest on submit
3. ~~Orphaned products~~ → Fixed: no products created until submission
4. ~~full_name AttributeError~~ → Fixed: query User model for name

---

### Stage 1: DRAFT (Admin approved inquiry) ✅ COMPLETE

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status change to DRAFT | [x] | [x] | Working |
| Notification: "Inquiry approved" | [x] | [x] | Working |
| View order items (code, name, qty) | [x] | [x] | Working |
| Prices NOT visible yet | [x] | [x] | Correct — price columns hidden when null |
| Horizontal stepper timeline | [x] | [x] | Working — matches admin panel |
| Friendly label: "Under Review" | [x] | [x] | Working |

**Client can do:** View order, see items (no prices), track stage on stepper.
**Client cannot do:** Edit items, see factory info, cancel order.

---

### Stage 2: PENDING_PI (Admin setting prices) ✅ COMPLETE

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Pricing in Progress" | [x] | [x] | Working (blue badge) |
| Items show no prices | [x] | [x] | Correct — "Pricing will be provided..." info message |
| Stepper shows Stage 2 active | [x] | [x] | Working |

**Client can do:** View order, wait for PI.

---

### Stage 3: PI_SENT (Proforma Invoice sent) ✅ COMPLETE

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "PI Ready" | [x] | [x] | Working (indigo badge) |
| **Download PI (Excel)** | [x] | [x] | Working — indigo action bar with download button |
| **Download PI with images** | [x] | [x] | Working — second button in action bar |
| Selling prices visible in items | [x] | [x] | Working (columns appear when prices are set) |
| Total INR calculated | [x] | [x] | Working (footer row with sum) |
| PI action bar only shows Stage 3+ | [x] | [x] | Correct — `canDownloadPI` computed guard |

**Client can do:** View prices, download PI Excel, download PI with images.
**Security verified:** Price columns hidden before PI_SENT (hasPrices computed checks for null).

---

### Stage 4: ADVANCE_PENDING / ADVANCE_RECEIVED (Payment)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Advance Pending" | [x] | [x] | Working (amber badge) |
| **View payment details** | [x] | [ ] | **NOT BUILT — endpoint exists, no UI** |
| **Payment amount due** | [x] | [ ] | **NOT BUILT** |
| **Payment history** | [x] | [ ] | **NOT BUILT** |
| **Outstanding balance** | [x] | [ ] | **NOT BUILT** |
| Notification: "Payment received" | [ ] | [ ] | **NOT BUILT** |

**Endpoints ready but not wired:**
- `GET /api/orders/{id}/payments/` — returns full payment breakdown
- Fields: pi_total_inr, advance_percent, total_paid_inr, balance_inr

**Client can do:** See status badge only.
**Client cannot do:** View payment amounts, see balance due, download receipts.

---

### Stage 5: FACTORY_ORDERED (Sent to factory)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Factory Ordered" | [x] | [x] | Working (violet badge) |
| Factory identity hidden | [x] | [x] | Correct — factory_name stripped |
| Notification: "Order placed with supplier" | [ ] | [ ] | **NOT BUILT** |

**Client can do:** View order, see "Order placed with supplier" status.
**Client cannot do:** See which factory, estimated timelines.

---

### Stage 6–9: PRODUCTION (60% → 90%)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Production 60/80/90%" | [x] | [x] | Working (orange badge) |
| **Production progress bar** | [x] | [ ] | **NOT BUILT — endpoint exists, no UI** |
| **Estimated completion date** | [x] | [ ] | **NOT BUILT** |
| **Days remaining** | [x] | [ ] | **NOT BUILT** |
| **Overdue warning** | [x] | [ ] | **NOT BUILT** |
| Notification: "Production milestone" | [ ] | [ ] | **NOT BUILT** |

**Endpoints ready but not wired:**
- `GET /api/orders/{id}/production-progress/`
- Returns: percent, target_date, days_remaining, is_overdue

**Client can do:** See status badge change through production stages.
**Client cannot do:** View progress %, estimated dates, milestone photos.

---

### Stage 9: PLAN_PACKING

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Plan Packing" | [x] | [x] | Working |

**Client can do:** View status only.

---

### Stage 10: FINAL_PI (Revised after packing)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Final PI" | [x] | [x] | Working |
| **Download revised PI** | [x] | [ ] | **NOT BUILT in UI** |
| Updated selling prices (if qty changed) | [x] | [x] | Working |
| Notification: "Revised PI available" | [ ] | [ ] | **NOT BUILT** |

**Client can do:** View updated prices.
**Client cannot do:** Download revised PI document.

---

### Stage 11: PRODUCTION_100 (Complete)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Production 100%" | [x] | [x] | Working (green badge) |

**Client can do:** View status only.

---

### Stage 12: BOOKED (Container booked)

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Booked" | [x] | [x] | Working (cyan badge) |
| Order appears in Shipments page | [x] | [x] | Working (filtered by status) |
| **Container number** | [x] | [ ] | **NOT BUILT in UI** |
| **Vessel name** | [x] | [ ] | **NOT BUILT** |
| **ETD (Estimated Time of Departure)** | [x] | [ ] | **NOT BUILT** |
| **ETA (Estimated Time of Arrival)** | [x] | [ ] | **NOT BUILT** |
| **Port of Loading / Discharge** | [x] | [ ] | **NOT BUILT** |
| Notification: "Container booked" | [ ] | [ ] | **NOT BUILT** |

**Endpoints ready but not wired:**
- `GET /api/orders/{id}/shipments/`

**Client can do:** See order in Shipments page.
**Client cannot do:** View any actual shipping details.

---

### Stage 13: LOADED → SAILED → ARRIVED

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status progression | [x] | [x] | Working (blue badges) |
| **Vessel tracking** | [x] | [ ] | **NOT BUILT** |
| **Sailing date** | [x] | [ ] | **NOT BUILT** |
| **Arrival date** | [x] | [ ] | **NOT BUILT** |
| **Shipping documents (B/L, COO, CI, PL)** | [x] | [ ] | **NOT BUILT** |
| **Document download** | [x] | [ ] | **NOT BUILT** |
| Notification: "Vessel sailed" / "Arrived" | [ ] | [ ] | **NOT BUILT** |

**Endpoints ready but not wired:**
- `GET /api/orders/{id}/shipping-documents/`

**Client can do:** See status badge change.
**Client cannot do:** View any shipping details, download documents.

---

### Stage 14: CUSTOMS_FILED → CLEARED

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Customs Filed" / "Cleared" | [x] | [x] | Working |
| **Customs milestones** | [x] | [ ] | **NOT BUILT in UI** |
| **BOE number** | [x] | [ ] | **NOT BUILT** |
| **Clearance date** | [x] | [ ] | **NOT BUILT** |
| Notification: "Customs cleared" | [ ] | [ ] | **NOT BUILT** |

**Endpoints ready but not wired:**
- `GET /api/customs/{id}/milestones/`

---

### Stage 15: DELIVERED

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Delivered" | [x] | [x] | Working (emerald badge) |
| **Create after-sales claim** | [x] | [ ] | **NOT BUILT — no form in UI** |
| **Upload claim photos** | [x] | [ ] | **NOT BUILT** |
| **Delivery confirmation** | [ ] | [ ] | **NOT BUILT** |
| Notification: "Order delivered" | [ ] | [ ] | **NOT BUILT** |

**Client can do:** See delivered status.
**Client cannot do:** Submit claims, upload evidence, confirm delivery.

---

### Stage 16: AFTER_SALES

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees claims in After-Sales page | [x] | [x] | Working (read-only list) |
| **View claim resolution** | [x] | [ ] | **NOT BUILT** |
| **View compensation details** | [x] | [ ] | **NOT BUILT** |
| **Add remarks to claim** | [ ] | [ ] | **NOT BUILT** |

---

### Stage 17: COMPLETED

| Feature | BE | FE | Status |
|---------|----|----|--------|
| Client sees status: "Completed" | [x] | [x] | Working (green badge) |
| **Order summary / receipt** | [ ] | [ ] | **NOT BUILT** |

---

## Cross-Stage Features

| Feature | BE | FE | Status |
|---------|----|----|--------|
| **Order Timeline** | [x] | [~] | **BUG: endpoint exists but not called** |
| **My Payments page** | [x] | [ ] | **NOT BUILT — entire page missing** |
| **PI Download button** | [x] | [ ] | **NOT BUILT — button missing from OrderDetail** |
| **Notification: stage change** | [~] | [x] | Partial — only some stages trigger notifications |
| **Email notifications** | [ ] | [ ] | **NOT BUILT** |
| **Profile edit** | [ ] | [ ] | Profile is read-only |
| **Password change** | [ ] | [ ] | **NOT BUILT** |
| **Order export (CSV/Excel)** | [ ] | [ ] | **NOT BUILT** |

---

## Build Score by Stage

| Stage | Backend | Frontend | Score |
|-------|---------|----------|-------|
| 0: CLIENT_DRAFT | 100% | 80% | **~90%** |
| 1: DRAFT | 100% | 90% | **~95%** |
| 2: PENDING_PI | 100% | 95% | **~97%** |
| 3: PI_SENT | 100% | 30% | **~65%** (PI download missing) |
| 4: PAYMENT | 100% | 10% | **~55%** (entire payment UI missing) |
| 5: FACTORY_ORDERED | 100% | 90% | **~95%** |
| 6-9: PRODUCTION | 100% | 20% | **~60%** (progress bar missing) |
| 10: FINAL_PI | 100% | 30% | **~65%** |
| 11: PRODUCTION_100 | 100% | 90% | **~95%** |
| 12: BOOKED | 100% | 15% | **~57%** (no shipment details) |
| 13: SAILING | 100% | 10% | **~55%** (no tracking, no docs) |
| 14: CUSTOMS | 100% | 10% | **~55%** (no milestone display) |
| 15: DELIVERED | 100% | 20% | **~60%** (no claim form) |
| 16: AFTER_SALES | 80% | 30% | **~55%** |
| 17: COMPLETED | 80% | 70% | **~75%** |

**Overall: Backend 97% | Frontend 42% | Combined ~65%**

---

## Implementation Plan (Prioritized)

### Phase 1: Critical Bug Fixes (Day 1)
- [ ] Fix bulk paste qty not carried to Quick Add items
- [ ] Fix orphaned PENDING_APPROVAL products cleanup
- [ ] Fix cart visual badge for pending approval items
- [ ] Fix timeline not loading in ClientOrderDetail

### Phase 2: PI & Payment — Highest Business Impact (Day 2-3)
- [ ] Add PI download button to ClientOrderDetail (Stage 3+)
- [ ] Build payment section in ClientOrderDetail (Stage 4+)
- [ ] Build dedicated "My Payments" page with history across all orders

### Phase 3: Production Tracking (Day 4)
- [ ] Add production progress bar to ClientOrderDetail (Stage 6-11)
- [ ] Show estimated completion date, days remaining, overdue warning

### Phase 4: Shipment & Documents (Day 5-6)
- [ ] Add shipment details panel to ClientOrderDetail (Stage 12+)
- [ ] Show container #, vessel, ETD/ETA, ports
- [ ] Add shipping documents download (B/L, COO, CI, PL)
- [ ] Enhance ClientShipments page with actual tracking data

### Phase 5: Customs & Delivery (Day 7)
- [ ] Add customs milestones display (Stage 14)
- [ ] Add delivery confirmation section (Stage 15)
- [ ] Build after-sales claim creation form
- [ ] Add photo upload for claims

### Phase 6: Notifications & Polish (Day 8)
- [ ] Stage-change notifications for all 17 stages
- [ ] Notification for: PI ready, payment received, vessel sailed, delivered
- [ ] ClientOrderDetail: show different sections based on current stage
- [ ] Profile edit and password change

### Phase 7: Order Detail Redesign — Purchase Order Format (Day 9-10)
- [ ] Redesign items table to look like professional Purchase Order
- [ ] Add order header: company logo, addresses, PO reference
- [ ] Add terms & conditions section
- [ ] Add print/PDF export capability

---

## Security Checklist (Per IAM Document)

- [x] Row-level security: client sees only own orders
- [x] Field-level filtering: factory prices/markup/identity hidden
- [x] JWT authentication with client_id enforcement
- [x] Portal isolation: CLIENT users can't access /dashboard
- [x] No factory data in API responses to CLIENT role
- [ ] Rate limiting on client endpoints
- [ ] CSRF protection
- [ ] Input validation on all client-facing forms
- [ ] Audit logging for client actions
