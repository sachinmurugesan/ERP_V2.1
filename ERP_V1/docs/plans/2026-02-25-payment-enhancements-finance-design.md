# Payment Enhancements + Finance Module Design

**Date**: 2026-02-25
**Status**: APPROVED

## Scope

Five features grouped into 3 implementation phases:

### Phase 1: Stage Transition Safety
1. **Confirmation dialog** before every forward stage transition
2. **Go-back capability** — reverse to previous stage from any stage
3. **Underpayment warning** — when advancing from Stage 4 with balance outstanding, require reason (saved to timeline)

### Phase 2: Client Credit + Overpayment
4. **Client credit tracking** — excess payments auto-create credit records; credits can be applied as advance on future orders

### Phase 3: Finance Section
5. **Separate Finance nav** with sub-pages: Receivables, Client Ledger, Factory Ledger
6. **Downloadable statements** — both Excel (.xlsx) and PDF for client and factory ledgers
7. Each ledger entry has a **Remark** column (e.g., "Advance for ORD-202602-010")

---

## Phase 1: Stage Transition Safety

### 1A. Confirmation Dialog

**Frontend (`OrderDetail.vue`)**:
- Replace direct `transitionTo(status)` calls with `confirmTransition(status)`
- Show modal: "Move to S{n} · {name}?" with [Cancel] [Confirm]
- On confirm → call existing `transitionTo()`

### 1B. Go-Back Capability

**Backend (`orders.py`)**:
- Add `REVERSE_TRANSITIONS` map — mirror of `VALID_TRANSITIONS` (each status maps to its predecessor)
- New endpoint: `PUT /orders/{id}/go-back/` — validates reverse is allowed, sets previous status
- No destructive validation needed going backward (data already exists)
- Log reverse in timeline with auto-generated note

**Frontend (`OrderDetail.vue`)**:
- Add "Go Back" button next to the Next Stage buttons (secondary style, left-aligned)
- Confirmation dialog: "Go back to S{n} · {name}?"
- Calls new `goBack` API

### 1C. Underpayment Warning on Stage 4 Transition

**Backend (`orders.py`)**:
- In `validate_transition()` for ADVANCE_PENDING → ADVANCE_RECEIVED:
  - Keep existing "at least one payment" check
  - Add new field in response: `warnings` array (separate from blocking `errors`)
  - Warning: `{ type: "UNDERPAYMENT", message: "Outstanding balance: Rs X,XXX", balance: float }`
- New optional body field on transition: `transition_reason` — saved to timeline when provided

**Frontend (`OrderDetail.vue`)**:
- When transition response includes `warnings`:
  - Show amber warning modal with balance details
  - Require reason text input before allowing proceed
  - Send `transition_reason` in the transition PUT body

---

## Phase 2: Client Credit / Overpayment

### New Table: `client_credits`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| client_id | FK → clients | Client who has credit |
| source_order_id | FK → orders | Order where overpayment happened |
| amount | Float | Credit amount in INR |
| status | Enum | AVAILABLE / APPLIED / EXPIRED |
| applied_to_order_id | FK → orders | Order where credit was applied (nullable) |
| applied_at | DateTime | When credit was applied |
| notes | Text | Auto-generated remark |
| created_at | DateTime | When credit was created |

### Backend Logic

**Auto-create credit**: In `finance.py` payment creation — after saving payment, check if total_paid > PI total. If so, auto-create `ClientCredit` with amount = surplus.

**Apply credit**: New endpoint `POST /finance/orders/{order_id}/apply-credit/` — takes `credit_id`, creates a Payment record of type CLIENT_ADVANCE with source=credit, marks credit as APPLIED.

**List credits**: `GET /finance/clients/{client_id}/credits/` — returns available credits for a client.

### Frontend

- In Record Payment modal: if client has available credits, show "Apply Credit" option with dropdown of available credits
- In Client Payments summary: show credit applied vs. direct payment distinction

---

## Phase 3: Finance Section

### Navigation

Replace existing "Receivables" nav item with "Finance" section:
```
Finance (pi-chart-line icon)
  ├── Receivables
  ├── Client Ledger
  └── Factory Ledger
```

### 3A. Receivables Page

Expand existing stub `Receivables.vue`:
- Table: Order#, Client, Factory, PI Total (INR), Paid, Outstanding, Last Payment Date, Days Outstanding
- Filter by: Client, Status (Outstanding / Settled / All)
- Sort by: Days Outstanding (default desc), Amount
- Summary row: Total Outstanding across all orders

### 3B. Client Ledger Page

New `ClientLedger.vue`:
- Filter: Client dropdown, Date range
- Table columns: Date, Order#, Remark, Debit (INR), Credit (INR), Running Balance, Method, Reference
- Remark examples: "Advance for ORD-202602-010", "Balance payment", "Credit applied from ORD-202602-005"
- Download buttons: Excel | PDF

### 3C. Factory Ledger Page

New `FactoryLedger.vue`:
- Filter: Factory dropdown, Date range
- Table columns: Date, Order#, Remark, Amount (Original Currency), Exchange Rate, Amount (INR), Method, Reference
- Remark examples: "1st remittance via LC", "2nd remittance via Bank Transfer"
- Download buttons: Excel | PDF

### Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/finance/receivables/` | All orders with outstanding balances |
| GET | `/finance/client-ledger/{client_id}/` | Payment history for a client across all orders |
| GET | `/finance/factory-ledger/{factory_id}/` | Payment history for a factory across all orders |
| GET | `/finance/client-ledger/{client_id}/download/` | Download statement (query: format=xlsx\|pdf) |
| GET | `/finance/factory-ledger/{factory_id}/download/` | Download statement (query: format=xlsx\|pdf) |

### Statement Format

**Excel**: Raw data table with all columns + summary row at bottom
**PDF**: Formatted with:
- Company header (HarvestERP)
- Client/Factory name and details
- Date range
- Ledger table with running balance
- Period totals: Total Debit, Total Credit, Net Balance

---

## Implementation Priority

1. Phase 1: Stage transitions (confirm + go back + underpayment warning)
2. Phase 2: Client credit tracking
3. Phase 3: Finance section (Receivables → Client Ledger → Factory Ledger → Downloads)

## UI/UX Notes

- Make UI unique with distinctive visual identity per section
- Payment sections: use card-based layouts with gradient headers
- Finance pages: clean data-dense tables with smart filters
- Statements: professional formatting suitable for client sharing
