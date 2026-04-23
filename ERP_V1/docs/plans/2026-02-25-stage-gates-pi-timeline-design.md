# Design: Stage Gates, PI Visibility & Clickable Timeline

**Date:** 2026-02-25
**Status:** Approved

## Overview

Three enhancements to the Order Detail workflow:

1. **Factory payment gate at BOOKED** — validate factory payments before booking
2. **PI section visibility** — restrict "Generate PI" to relevant stages only
3. **Clickable timeline navigation** — click any previous stage to jump back directly

---

## 1. Factory Payment Gate at BOOKED Stage

### Behavior

When transitioning to `BOOKED` (stage 10, from `PRODUCTION_100`):

- **Zero factory payments → Hard block (error)**
  "At least one factory payment must be recorded before booking a container"

- **Partial factory payment → Warning (with reason required)**
  "Factory payment is partial. ₹X paid of estimated ₹Y. You may proceed with a reason."

### Factory Ledger Enhancement: Double-Entry Format

Currently the factory ledger only shows payment entries (credits). Enhance to mirror the client ledger's double-entry format:

- **Debit entries:** Order CNY total × exchange rate as "Factory order for ORD-XXXX" when an order reaches FACTORY_ORDERED stage
- **Credit entries:** Each factory payment as before
- **Running balance:** Cumulative debit - credit showing outstanding amount owed to factory

This makes partial payment tracking natural — no new model needed.

### Backend Changes

- `orders.py` → `validate_transition()`: Add gate for `target_status == BOOKED`
  - Query `FactoryPayment` count and sum for the order
  - Zero payments → append to `errors`
  - Partial payment → append to `warnings` (object with type, message, balance details)

- `finance.py` → `GET /factory-ledger/{factory_id}/`: Enhance to include order value debit entries
  - Query orders for this factory that have reached FACTORY_ORDERED or later
  - Insert debit lines (order CNY total × exchange rate) alongside payment credit lines
  - Sort all entries by date, compute running balance
  - Update download endpoints (Excel + PDF) to match new format

---

## 2. PI Section Visibility

### Behavior

- **Generate PI button:** Only visible when `order.status` is `PENDING_PI` or `PI_SENT`
- **Download Excel / Excel with Images buttons:** Visible on all stages from `PI_SENT` onwards (where PI exists)
- PI section header remains visible on all post-PI stages

### Frontend Changes

- `OrderDetail.vue`: Add a computed `canGeneratePI` = status is PENDING_PI or PI_SENT
- Wrap Generate PI button in `v-if="canGeneratePI"`
- Download buttons remain gated by `isPostPI` (existing behavior)

---

## 3. Clickable Timeline Navigation

### Behavior

- Completed stage circles in the timeline become **clickable** (pointer cursor, hover effect)
- Current stage and future stages remain **non-clickable** (visual distinction)
- On click → **confirmation modal**: "Jump back to S{n} · {name}? This will revert from S{current}."
- After confirmation → call backend `jump-to-stage` endpoint
- **Go Back button is KEPT** alongside clickable timeline (both work)

### Backend Changes

- `orders.py`: New endpoint `PUT /{order_id}/jump-to-stage/`
  - Accepts `target_status` in request body
  - Validates target is a previous stage by walking the REVERSE_TRANSITIONS chain from current status
  - Sets `order.status = target_status` directly (no intermediate steps)
  - If jumping back from COMPLETED, clears `completed_at`
  - Returns serialized order

### Frontend Changes

- `OrderDetail.vue` timeline section:
  - Completed stages get `@click` handler + `cursor-pointer` + hover effect
  - New `jumpToStage(status, stageName, stageNumber)` function that opens a confirmation modal
  - New confirmation modal for stage jumps (distinct from existing go-back modal)
  - After confirmation, calls new API endpoint and reloads order

### API Addition

- `api/index.js`: Add `ordersApi.jumpToStage(id, data)` → `PUT /orders/${id}/jump-to-stage/`

---

## Files Affected

| File | Changes |
|------|---------|
| `backend/routers/orders.py` | Add BOOKED gate validation, add jump-to-stage endpoint |
| `backend/routers/finance.py` | Enhance factory ledger to double-entry format |
| `frontend/src/views/orders/OrderDetail.vue` | PI visibility, clickable timeline, jump modal |
| `frontend/src/api/index.js` | Add jumpToStage API call |
