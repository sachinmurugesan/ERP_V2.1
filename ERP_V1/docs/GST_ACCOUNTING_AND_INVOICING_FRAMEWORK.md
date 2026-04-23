# GST, Accounting & Invoicing Framework for HarvestERP

> **For:** Supply chain import-export ERP (China → India)
> **Business:** Indian Pvt Ltd company imports from Chinese factories, sells to Indian clients
> **GST Context:** Importer is registered under GST, pays IGST at customs on imports, charges CGST+SGST or IGST on domestic sales
> **Last Audited:** April 2026 (against Finance Act 2025 amendments + April 2026 GST changes)

---

## 0. AUDIT NOTES — Corrections Applied

| # | Issue Found | Correction |
|---|-------------|------------|
| 1 | CN time limit was "September 30" | Corrected to **30th November** following FY end (Section 34 post-amendment) |
| 2 | Missing Finance Act 2025 CN amendment | Added: Supplier cannot reduce tax via CN unless recipient reverses ITC first |
| 3 | E-Invoice / IRN completely missing | Added: Mandatory for turnover > ₹5 crore, QR code + IRN via IRP portal |
| 4 | GSTIN on BOE requirement missing | Added: Must declare GSTIN on Bill of Entry to claim import ITC |
| 5 | GSTR filing deadlines missing | Added: GSTR-1 (11th), GSTR-3B (20th), GSTR-9 (31 Dec) |
| 6 | Invoice numbering April 2026 change | Added: Fresh numbering series mandatory from 1 April each year |
| 7 | IMS (Invoice Management System) missing | Added: Mandatory from Oct 2025, review invoices on GST portal |
| 8 | BCD non-ITC not prominent enough | Clarified: Only IGST is ITC-eligible, BCD+SWC become cost |
| 9 | Document retention period missing | Added: Minimum 6 years retention |
| 10 | 180-day payment rule missing details | Added: Auto-reverse ITC if payment not made within 180 days |

**Sources:**
- [Section 34 CGST Act — Credit Notes](https://www.aubsp.com/cgst-act-section-34-explained/)
- [Finance Act 2025 — Section 34(2) Amendment](https://taxguru.in/goods-and-service-tax/analysis-amendment-section-34-2-cgst-act-2017-finance-bill-2025.html)
- [Rule 46 — Tax Invoice Fields](https://accorgconsulting.com/2025/04/24/gst-invoice-checklist-mandatory-fields-best-practices/)
- [Rule 55 — Delivery Challan](https://www.caclubindia.com/articles/gst-on-free-warranty-repairs-no-tax-full-legal-explanation-with-procedures-54724.asp)
- [ITC on Imports](https://piceapp.com/blogs/claiming-input-tax-credit-itc-for-imports/)
- [GST Changes from April 2026](https://www.kanakkupillai.com/learn/gst-changes-from-april-2026/)
- [GST FY 2026-27 Compliance Checklist](https://taxguru.in/goods-and-service-tax/gst-fy-2026-27-compliance-checklist-10-key-actions-businesses.html)
- [GST Compliance Calendar](https://ebizfiling.com/blog/compliance-calendar-of-gst-returns-with-due-dates-2025-2026/)

> **DISCLAIMER:** This document is for ERP system design purposes. Consult a qualified CA/GST practitioner for compliance advice specific to your business.

---

## 1. Current System Status

### What EXISTS (Implemented)

| Module | Status | Details |
|--------|--------|---------|
| Proforma Invoice (PI) | ✅ Full | Excel generation, revision tracking, advance calculation |
| Bill of Entry (BOE) | ✅ Full | Per-shipment duty calc (BCD + SWC + IGST), HSN tariff master |
| Landed Cost | ✅ Full | Per-item proportional cost split (freight, duty, clearance, sourcing) |
| Payment Tracking | ✅ Full | Client & factory payments, multi-currency, verification, audit |
| Credit System | ✅ Full | Client/factory overpayment credits, auto-apply to next order |
| IGST Credit Tracking | ✅ Basic | Order-level IGST credit claimed/date/reference |
| Exchange Rates | ✅ Full | Master rates + order-level + BOE-level CBIC rates |
| HSN Tariff Master | ✅ Full | HSN code, BCD%, IGST%, SWC%, effective date |

### What's MISSING (Not Implemented)

| Document | Required By | Priority |
|----------|-------------|----------|
| Tax Invoice (domestic sale to client) | GST Act Section 31 | CRITICAL |
| Credit Note | GST Act Section 34 | CRITICAL |
| Debit Note | GST Act Section 34 | HIGH |
| Delivery Challan | Rule 55 of CGST Rules | MEDIUM |
| E-Way Bill integration | E-Way Bill Rules | MEDIUM |
| GSTR-1 export data | Monthly/quarterly filing | HIGH |
| GSTR-3B summary data | Monthly filing | HIGH |
| Input Tax Credit (ITC) register | Section 16-21 | HIGH |
| CGST/SGST split (intra-state) | For domestic billing | HIGH |

---

## 2. Document Lifecycle — Complete Flow

```
IMPORT SIDE (China → India)
─────────────────────────────────────────────────────
Factory Invoice (CI)      ← Factory issues (in CNY/USD)
Packing List              ← Factory issues
Bill of Lading (BOL)      ← Shipping line issues
Certificate of Origin     ← Factory provides
Bill of Entry (BOE)       ← CHA files at customs (duties paid here)
                             BCD + SWC + IGST calculated
Out of Charge (OOC)       ← Customs releases goods
Delivery Order (DO)       ← Port/CFS releases container

DOMESTIC SIDE (Importer → Indian Client)
─────────────────────────────────────────────────────
Proforma Invoice (PI)     ← Importer sends to client (quotation, no GST)
Tax Invoice               ← Importer issues on sale (WITH GST) ← MISSING
E-Way Bill                ← Required if value > ₹50,000 ← MISSING
Delivery Challan          ← For replacement/free goods ← MISSING

AFTER-SALES ADJUSTMENTS
─────────────────────────────────────────────────────
Credit Note               ← For returns, price reduction, quality issues ← MISSING
Debit Note                ← For additional charges, price increase ← MISSING

GST FILING
─────────────────────────────────────────────────────
GSTR-1                    ← Outward supply details (invoices + CN/DN) ← MISSING
GSTR-3B                   ← Monthly summary + tax payment ← MISSING
ITC Register              ← Input tax credit tracking ← MISSING
```

---

## 3. Tax Invoice — What the Importer Needs

### When is Tax Invoice issued?
- When goods are **delivered to the Indian client**
- At or before the **DELIVERED** stage in the order workflow
- Tax Invoice replaces/supplements the Proforma Invoice

### Tax Invoice Fields (GST Rule 46)

```
MANDATORY FIELDS:
├── Invoice Number (sequential, max 16 chars, unique per financial year)
├── Invoice Date
├── Supplier (Importer) Details:
│   ├── Name, Address
│   ├── GSTIN
│   └── State Code
├── Buyer (Client) Details:
│   ├── Name, Address
│   ├── GSTIN (if registered)
│   ├── State Code
│   └── Place of Supply
├── HSN Code (per item)
├── Description of Goods
├── Quantity + Unit
├── Taxable Value (per item)
├── Tax Rate:
│   ├── IGST% (inter-state) OR
│   └── CGST% + SGST% (intra-state, same state)
├── Tax Amount:
│   ├── IGST Amount OR
│   └── CGST Amount + SGST Amount
├── Total Invoice Value
├── Reverse Charge (Y/N)
└── Signature / Digital Signature
```

### Tax Calculation Logic

```python
# Determine tax type based on place of supply
if supplier_state == buyer_state:
    # INTRA-STATE: Split into CGST + SGST
    cgst_rate = gst_rate / 2  # e.g., 9%
    sgst_rate = gst_rate / 2  # e.g., 9%
    cgst_amount = taxable_value * cgst_rate / 100
    sgst_amount = taxable_value * sgst_rate / 100
else:
    # INTER-STATE: Full IGST
    igst_rate = gst_rate  # e.g., 18%
    igst_amount = taxable_value * igst_rate / 100
```

### Invoice Numbering
```
Format: INV-YYMM-NNNN
Example: INV-2604-0001

Rules:
- Sequential, no gaps
- Reset per financial year (April 1)
- Max 16 characters
- Unique across all invoices
```

---

## 4. Credit Note — After-Sales Adjustments

### When Credit Note is Required (Section 34 CGST Act)

| After-Sales Scenario | Credit Note? | Amount |
|---------------------|-------------|--------|
| Price Mismatch (overcharged) | YES | Price difference × qty + GST |
| Quality Issue → Compensation | YES | Compensation amount + GST |
| Product Missing (short delivery) | YES | Missing qty × unit price + GST |
| Quality Issue → Replacement | NO (use Delivery Challan) | — |
| Product Mismatch → Return | YES (for wrong item) | Full value of wrong item + GST |

### Credit Note Fields

```
MANDATORY FIELDS:
├── Credit Note Number (sequential)
├── Credit Note Date
├── Original Invoice Reference (number + date)
├── Reason for Credit Note
├── Supplier & Buyer Details (same as original invoice)
├── Per-item breakdown:
│   ├── Description
│   ├── HSN Code
│   ├── Quantity affected
│   ├── Taxable Value (reduction)
│   ├── Tax Rate (same as original)
│   └── Tax Amount (reduction)
├── Total Credit Amount (taxable + tax)
└── Digital Signature
```

### Credit Note Rules (Updated per Finance Act 2025)
- Must be issued **before 30th November following the end of the financial year** in which the supply was made
- Must reference the original Tax Invoice number and date
- Reduces the supplier's output tax liability
- **NEW (2025 Amendment):** Supplier cannot reduce tax liability via CN unless the **recipient has reversed the associated ITC first** — prevents unjust enrichment
- Buyer must **reverse ITC** for the credited amount in GSTR-3B
- Reported in GSTR-1 Table 9B
- After the deadline, a **financial credit note** (without GST) can still be issued for accounting purposes

### Credit Note Numbering
```
Format: CN-YYMM-NNNN
Example: CN-2604-0001
```

---

## 5. Debit Note — Additional Charges

### When Debit Note is Required

| Scenario | Debit Note? |
|----------|------------|
| Price increase after invoice | YES |
| Additional charges discovered | YES |
| Supplementary invoice | YES |

### Debit Note = same fields as Credit Note but INCREASES the value

```
Format: DN-YYMM-NNNN
```

---

## 6. Delivery Challan — Replacement Goods

### When Required (Rule 55 CGST Rules)
- Sending replacement goods **without charging** (warranty/after-sales)
- Goods sent on **approval basis**
- Goods sent for **job work**

### Delivery Challan Fields
```
├── Challan Number (sequential)
├── Challan Date
├── Supplier Details + GSTIN
├── Receiver Details
├── Description of Goods
├── Quantity
├── HSN Code
├── Taxable Value (declared value, even though no charge)
├── Reason: "Replacement against Tax Invoice INV-XXXX-NNNN"
├── After-Sales Claim Reference
└── Signature
```

### Key Rule
- No GST charged on delivery challan for warranty replacements
- Must be converted to Tax Invoice within **prescribed time** if goods are not returned
- E-Way Bill still required if value > ₹50,000

---

## 7. ITC (Input Tax Credit) Register

### What the Importer Claims as ITC

```
ITC Sources:
├── IGST paid on imports (via BOE) ← Already tracked
├── IGST/CGST/SGST on domestic purchases:
│   ├── CHA services
│   ├── Freight (domestic leg)
│   ├── CFS charges
│   ├── Transport
│   └── Other service providers
└── Reverse Charge Mechanism (RCM) payments

ITC Utilization Order (Section 49A):
├── IGST Credit → First set off against IGST, then CGST, then SGST
├── CGST Credit → Set off against CGST, then IGST
└── SGST Credit → Set off against SGST, then IGST
```

### ITC Reversal Required When
- Credit Note received from supplier
- Goods returned
- Payment not made within 180 days (Section 16(2))
- Goods used for exempt supplies

---

## 8. GSTR Filing Data

### GSTR-1 (Outward Supplies) — Data Needed

| Table | What | From HarvestERP |
|-------|------|-----------------|
| 4A | B2B Invoices (to registered buyers) | Tax Invoices where client has GSTIN |
| 5 | B2C Large (>₹2.5L inter-state) | Tax Invoices to unregistered clients |
| 7 | B2C Small | Tax Invoices to small unregistered clients |
| 9B | Credit/Debit Notes | Credit Notes & Debit Notes |
| 11 | HSN-wise summary | Aggregate by HSN code |
| 12 | Documents issued | Invoice/CN/DN serial number ranges |

### GSTR-3B (Monthly Summary) — Data Needed

| Row | What | Source |
|-----|------|--------|
| 3.1(a) | Outward taxable supplies | Sum of all Tax Invoices |
| 3.1(d) | Exempt supplies | Any exempt items |
| 4(A)(1) | ITC from imports | BOE IGST amounts |
| 4(A)(5) | ITC from other sources | Domestic service invoices |

---

## 9. After-Sales → Accounting Treatment (Complete)

### Price Mismatch
```
Step 1: Client reports price difference
Step 2: Admin verifies against original PI/Tax Invoice
Step 3: Admin resolves as COMPENSATE_BALANCE
Step 4: System auto-generates Credit Note (CN)
Step 5: CN amount = price_diff × qty × (1 + GST_rate)
Step 6: CN reduces next Tax Invoice total
Step 7: GSTR-1: CN reported in Table 9B
Step 8: Client reverses ITC for CN amount
```

### Quality Issue → Replacement
```
Step 1: Client reports quality issue with photos
Step 2: Admin resolves as REPLACE_NEXT_ORDER
Step 3: System creates Delivery Challan (not Tax Invoice)
Step 4: Replacement items added to next order at ₹0
Step 5: No GST impact (warranty replacement)
Step 6: Delivery Challan references original Tax Invoice
```

### Quality Issue → Compensation
```
Step 1: Client reports quality issue
Step 2: Admin resolves as COMPENSATE_BALANCE
Step 3: System auto-generates Credit Note
Step 4: CN amount = affected_qty × unit_price × (1 + GST_rate)
Step 5: Amount deducted from next Tax Invoice
Step 6: GSTR-1: CN in Table 9B
```

### Product Missing → Short Delivery
```
Step 1: Client reports missing items (received_qty < ordered_qty)
Step 2: Option A: Deliver missing items (Delivery Challan)
Step 3: Option B: Issue Credit Note for missing value
Step 4: If CN: reduce Tax Invoice value by missing amount + GST
```

---

## 10. Implementation Priority

### Phase 1 — CRITICAL (Week 1-2)
1. **Tax Invoice model** — number, date, buyer/seller GSTIN, HSN-wise items, CGST/SGST/IGST split
2. **Tax Invoice generation** — auto-generate at DELIVERED stage
3. **Tax Invoice PDF** — GST-compliant format with proper headers
4. **Credit Note model** — linked to original Tax Invoice, after-sales resolution
5. **Credit Note auto-generation** — trigger on COMPENSATE_BALANCE resolution

### Phase 2 — HIGH (Week 3-4)
6. **Debit Note model** — for price increases
7. **Delivery Challan** — for replacement goods
8. **ITC Register** — import IGST + domestic service ITC
9. **GSTR-1 data export** — CSV/JSON for filing

### Phase 3 — MEDIUM (Week 5-6)
10. **GSTR-3B summary** — auto-calculated from invoices/BOE
11. **E-Way Bill data** — integration fields
12. **Invoice/CN/DN sequential number management** — financial year reset
13. **GST tab in order detail** — consolidated view of all GST documents

### Phase 4 — ENHANCEMENT (Week 7-8)
14. **GST Reconciliation** — match GSTR-2A (supplier data) with ITC claimed
15. **Annual Return (GSTR-9) data** — aggregate yearly
16. **Tally export** — XML/JSON for Tally ERP integration
17. **HSN-wise summary reports** — for GSTR-1 Table 11

---

## 11. GST Tab Design (Order Detail Page)

```
┌────────────────────────────────────────────────────┐
│  GST & Invoicing                                    │
├────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Tax Invoice ──────────────────────────────┐     │
│  │ INV-2604-0001  │ 01 Apr 2026  │ ₹45,88,015│     │
│  │ IGST: ₹8,25,842  │  Status: ISSUED        │     │
│  │ [Download PDF]  [View Details]              │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─ Credit Notes ─────────────────────────────┐     │
│  │ CN-2604-0001 │ Price Mismatch │ -₹12,506   │     │
│  │ CN-2604-0002 │ Quality Comp.  │ -₹23,243   │     │
│  │ [Generate CN]                               │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─ ITC Summary ──────────────────────────────┐     │
│  │ Import IGST (BOE):     ₹8,25,842          │     │
│  │ IGST Credit Claimed:   ✅ Yes              │     │
│  │ CN ITC Reversal:       -₹6,434            │     │
│  │ Net ITC Available:     ₹8,19,408          │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─ Delivery Challans ────────────────────────┐     │
│  │ DC-2604-0001 │ Replacement │ 20 units      │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└────────────────────────────────────────────────────┘
```

---

## 12. Key GST Rules for Importers

1. **IGST on imports** is paid at customs (via BOE) and claimed as ITC. **BCD and SWC are NOT eligible for ITC** — they become part of landed cost.
2. **GSTIN on BOE is mandatory** — importer must declare GSTIN on Bill of Entry to claim import ITC. Without it, ITC cannot be claimed.
3. **Domestic sales** attract CGST+SGST (intra-state, same state) or IGST (inter-state, different states).
4. **Credit Notes** must reference original invoice. Deadline: **30th November** following the FY end. Post-deadline: only financial CN (no GST adjustment).
5. **2025 CN Amendment**: Supplier cannot reduce output tax via CN unless recipient has reversed ITC first (Finance Act 2025).
6. **Delivery Challans** for free replacements — no GST charged but declared value required. No ITC reversal needed by manufacturer.
7. **E-Way Bill** mandatory for goods movement > ₹50,000. Required even for Delivery Challan movements.
8. **HSN codes** mandatory: 4-digit for turnover ₹5-10 crore, 6-digit for > ₹10 crore, 8-digit for exports.
9. **ITC utilization order** (Section 49A): IGST credit first → set off against IGST, then CGST, then SGST.
10. **180-day payment rule** (Section 16(2)): ITC auto-reversed if supplier not paid within 180 days from invoice date. Re-claimable once paid.
11. **Document retention**: All GST records, invoices, BOE, CN/DN must be retained for **minimum 6 years** from due date of annual return.

---

## 13. E-Invoice / IRN Requirements (CRITICAL — Missing from System)

### What is E-Invoice?
Every B2B tax invoice must be reported to the **Invoice Registration Portal (IRP)** which generates a unique **Invoice Reference Number (IRN)** and a signed QR code. Without IRN, the invoice is not valid under GST.

### Who must comply?
| Annual Turnover | E-Invoice Mandatory From |
|-----------------|--------------------------|
| > ₹500 crore | Oct 2020 |
| > ₹100 crore | Jan 2021 |
| > ₹50 crore | Apr 2021 |
| > ₹20 crore | Apr 2022 |
| > ₹10 crore | Oct 2022 |
| > ₹5 crore | Aug 2023 |
| **All B2B** (proposed) | **April 2026** (check notification) |

### What the ERP must do:
1. Generate invoice JSON in e-invoice schema
2. Push to IRP (NIC portal) via API
3. Receive IRN + signed QR code
4. Embed QR code on printed invoice
5. Store IRN for GSTR-1 auto-population

### E-Invoice JSON includes:
- Supplier/Buyer details with GSTIN
- Invoice number, date, type
- Item-wise: HSN, quantity, unit, taxable value, tax rates, tax amounts
- Document totals
- IRN hash

---

## 14. IMS — Invoice Management System (Mandatory from Oct 2025)

### What it is:
Buyers must **review and accept/reject** supplier invoices on the GST portal before claiming ITC. This includes:
- Domestic purchase invoices
- Bill of Entry records for imports

### Impact on HarvestERP:
- When client receives a Tax Invoice, they must accept it on IMS
- System should track IMS acceptance status per invoice
- Unaccepted invoices = ITC at risk for the buyer

---

## 15. GSTR Filing Deadlines

| Return | Frequency | Due Date | What's Reported |
|--------|-----------|----------|-----------------|
| **GSTR-1** | Monthly | 11th of next month | All outward supplies (invoices, CN, DN) |
| **GSTR-1** (QRMP) | Quarterly | 13th of month after quarter | For turnover < ₹5 crore |
| **GSTR-3B** | Monthly | 20th of next month | Summary + tax payment |
| **GSTR-3B** (QRMP) | Quarterly | 22nd/24th based on state | Summary + tax payment |
| **GSTR-9** | Annual | 31st December following FY | Annual return |
| **GSTR-9C** | Annual | 31st December (if turnover > ₹5 crore) | Reconciliation statement |

### What HarvestERP should export:
- **GSTR-1 data**: Table 4A (B2B invoices), Table 7 (B2C), Table 9B (CN/DN), Table 11 (HSN summary), Table 12 (Doc serial ranges)
- **GSTR-3B data**: Row 3.1 (outward supplies), Row 4 (ITC from imports + domestic)

---

## 16. April 2026 GST Changes (NEW)

1. **Fresh invoice numbering** — must start new series from 1st April 2026
2. **IMS review** — review Bill of Entry records in IMS for all import periods
3. **Multi-factor authentication** — mandatory for GST portal access
4. **HSN code updates** — verify all HSN codes against latest HS 2025 nomenclature
5. **E-invoice threshold** — may be lowered further (check latest notification)
