# Level 6: Shipping & Logistics — Design Document

**Date**: 2026-02-28
**Status**: Approved
**Enables**: Stage 10 (BOOKED) + Stage 11 (LOADED/SAILED/ARRIVED)

---

## Overview

Level 6 implements the shipping and logistics workflow after production is complete. It covers:
- **6A**: Service Provider master data (unified model with role tags)
- **6B**: Container Booking (shipment creation, HBL content, item allocation)
- **6C**: Sailing Tracker (time-based progress, 3-phase tracking per container)
- **Shipping Docs Tab**: Factory document upload/tracking (BOL, COO, CI, PL)

---

## 6A: Service Provider Master Data

### Database Design

**Replace** 4 separate tables (FreightForwarder, CHA, CFSProvider, TransportProvider) with a single unified table:

```
ServiceProvider
├── id: Integer (PK)
├── name: String (unique, required)
├── contact_person: String
├── phone: String
├── email: String
├── address: String
├── city: String
├── state: String
├── country: String (default: "India")
├── bank_name: String
├── bank_account: String
├── ifsc_code: String
├── gst_number: String
├── pan_number: String
├── roles: JSON array  →  e.g., ["FREIGHT_FORWARDER", "CFS"]
├── operating_ports: JSON array  →  e.g., ["JNPT", "CHENNAI"]
├── notes: Text
├── is_active: Boolean (default: true)
├── created_at: DateTime
└── updated_at: DateTime
```

**Role values**: FREIGHT_FORWARDER, CHA, CFS, TRANSPORT

### Sidebar & Navigation

- New top-level sidebar item: **"Transport"**
- Position: between Clients and After Sales
- Route: `/transport`

### Transport Page

**List View (DataTable)**:
| Column | Content |
|--------|---------|
| Name | Company name |
| Roles | Colored tag chips (blue=Freight, green=CHA, orange=CFS, purple=Transport) |
| Ports | Operating port chips |
| Contact | Phone / email |
| Status | Active/Inactive badge |

**Add/Edit Form**:
- Company details section (name, contact, phone, email, address)
- Financial section (bank, GST, PAN)
- **Role tag selector**: 4 clickable chips (Freight Forwarding | CHA | CFS | Transport). Click to add (fills with color), click X to remove. At least 1 role required.
- **Operating ports**: Multi-select chips for Indian ports (JNPT, Chennai, Tuticorin, Mundra, Kandla)
- Notes textarea
- Active toggle

### API Endpoints

```
GET    /transport/                           → List all providers (filter by role, port, active)
POST   /transport/                           → Create provider
GET    /transport/{id}                       → Get provider details
PUT    /transport/{id}                       → Update provider
DELETE /transport/{id}                       → Soft delete (set is_active=false)
GET    /transport/by-role/{role}             → Get providers filtered by role
GET    /transport/by-role/{role}/port/{port} → Get providers by role + operating port
```

---

## 6B: Container Booking

### When It Appears

- New **"Booking" tab** in order detail, appears at Stage 10 (BOOKED) and beyond
- Triggered when order transitions from PRODUCTION_100 → BOOKED

### Booking Form (Create Shipment)

#### Container Details
| Field | Type | Notes |
|-------|------|-------|
| Container Type | Select: 20FT / 40FT / 40HC | Required |
| Freight Terms | Select: Prepaid / Collect | Required |
| Port of Loading | Select (Chinese ports) | Auto-filled from factory |
| Port of Discharge | Select (Indian ports) | Auto-filled from order |

#### Service Provider Assignment

4 dropdown selectors, each filtered by role tag:

| Role | Dropdown Filter | Required |
|------|----------------|----------|
| Freight Forwarder | Providers tagged FREIGHT_FORWARDER | Yes |
| CHA | Providers tagged CHA + filtered by discharge port | Yes |
| CFS | Providers tagged CFS | Yes |
| Transport | Providers tagged TRANSPORT | No (can assign later) |

**Smart auto-fill**: If a selected company has multiple roles (e.g., XYZ tagged [FREIGHT, CFS]), selecting XYZ in Freight dropdown auto-fills the CFS dropdown too. User can override.

#### HBL Content (Auto-Generated, Editable)
| Field | Auto-Source | Editable |
|-------|-------------|----------|
| Shipper | Factory name + address | Yes |
| Consignee | Client name + address | Yes |
| Notify Party | Default = Consignee | Yes |
| Description of Goods | "Combine Harvester Spare Parts" | Yes |
| No. of Packages | packing_list.total_packages | Yes |
| Gross Weight (kg) | packing_list.total_gross_weight | Yes |
| Net Weight (kg) | packing_list.total_net_weight | Yes |
| CBM | packing_list.total_cbm | Yes |
| Vessel / Voyage | Empty (entered at SAILED) | — |
| B/L Number | Empty (entered at SAILED) | — |
| Container Number | Empty (entered at SAILED) | — |
| Seal Number | Empty (entered at SAILED) | — |
| ETD | Date picker | Yes |
| ETA | Date picker | Yes |

#### Item Allocation
- Table of all packing list items with `loaded_qty`
- Each item gets a pallet number assignment (select: 1–50 or "Loose")
- Validation: all loaded items must be allocated before booking is finalized

### Multiple Containers
- "Add Container" button creates additional shipments for the same order
- Each container has its own service providers, HBL content, and item allocation
- Container list view at top of Booking tab shows all containers with summary

### API Endpoints

```
GET    /shipping/orders/{order_id}/shipments/          → List shipments for order
POST   /shipping/orders/{order_id}/shipments/          → Create shipment
GET    /shipping/shipments/{id}                        → Get shipment details
PUT    /shipping/shipments/{id}                        → Update shipment
DELETE /shipping/shipments/{id}                        → Delete shipment

POST   /shipping/shipments/{id}/items/                 → Allocate items to container
PUT    /shipping/shipments/{id}/items/{item_id}        → Update item allocation (pallet)
DELETE /shipping/shipments/{id}/items/{item_id}        → Remove item from container
```

---

## 6C: Sailing Tracker

### When It Appears

- New **"Sailing" tab** in order detail, appears at Stage 11 (LOADED/SAILED/ARRIVED)
- Shows per-container tracking when order has multiple shipments

### Time-Based Progress Bar

```
LOADED ────────●──────────── SAILED ──────────────────── ARRIVED
  Feb 1        ▲ Today                                   Mar 1
               │
           [====████████░░░░░░░░░░░░░░░░]  50%
            14 of 28 days  •  ETA: 13 days remaining
```

**Calculation**:
- 0% at LOADED (before ETD)
- Progress starts counting from ETD (actual sailing date)
- Based on: `(today - ETD) / (ETA - ETD) * 100`
- Caps at 100% when ARRIVED or when ETA reached
- Auto-updates daily
- If revised ETA exists, uses revised ETA instead of original

### Three Phase Cards (Per Container)

**Phase 1 — LOADED** (Container packed at factory)
| Field | Type | Required |
|-------|------|----------|
| Loading Date | Date picker | Yes |
| Loading Notes | Text | No |

**Phase 2 — SAILED** (Vessel departed)
| Field | Type | Required |
|-------|------|----------|
| Container Number | Text (format: XXXX1234567) | Yes |
| Seal Number | Text | Yes |
| Vessel Name | Text | Yes |
| Voyage Number | Text | No |
| B/L Number | Text | Yes |
| Actual Departure Date | Date picker | Yes |
| Revised ETA | Date picker | No |

**Phase 3 — ARRIVED** (At Indian port)
| Field | Type | Required |
|-------|------|----------|
| Actual Arrival Date | Date picker | Yes |
| CFS Receipt Number | Text | No |
| Arrival Notes | Text | No |

### Phase Transitions
- Each phase has a "Mark as [SAILED]" / "Mark as [ARRIVED]" button
- Required fields must be filled before marking phase complete
- When ALL containers are ARRIVED → order can transition to CUSTOMS_FILED

### API Endpoints

```
PUT  /shipping/shipments/{id}/phase/sailed/    → Update to SAILED with sailing data
PUT  /shipping/shipments/{id}/phase/arrived/   → Update to ARRIVED with arrival data
GET  /shipping/shipments/{id}/progress/        → Get time-based progress percentage
```

---

## Shipping Docs Tab

### When It Appears

- New **"Shipping Docs" tab** in order detail
- Appears at Stage 11 (alongside Sailing tab)
- Positioned between Sailing tab and (future) Customs tab

### Document Checklist

4 required factory shipping documents:

| Document | Type Code | Description |
|----------|-----------|-------------|
| Bill of Lading | BOL | Shipping contract from carrier |
| Certificate of Origin | COO | Country of manufacture proof |
| Commercial Invoice | CI | Factory invoice for customs |
| Packing List | PL | Detailed packing breakdown |

### Per-Document UI
- Document type label
- Status badge: PENDING (red) / RECEIVED (green)
- Upload button → file upload (PDF/image)
- Received date (auto-set on upload, editable)
- View/download link when uploaded

### Behavior
- **Non-blocking** — does NOT prevent stage transitions
- **View/Edit toggle** (same pattern as Items & Packing tabs)
- Documents stored via existing document system, linked to shipment_id
- If multiple containers, docs can be per-container or per-order (user's choice)

### API Endpoints

```
GET  /shipping/orders/{order_id}/documents/           → List shipping docs for order
POST /shipping/orders/{order_id}/documents/            → Upload shipping document
PUT  /shipping/documents/{id}                          → Update doc status/date
GET  /shipping/documents/{id}/download                 → Download document file
```

---

## Tab System Updates

### New Tabs in Order Detail

| Tab | Appears At | Contains |
|-----|-----------|----------|
| Booking | Stage 10+ (BOOKED) | Container booking form, service providers, HBL, item allocation |
| Sailing | Stage 11+ (LOADED/SAILED/ARRIVED) | Progress bar, phase cards, phase transitions |
| Shipping Docs | Stage 11+ (LOADED/SAILED/ARRIVED) | Factory document upload/checklist |

### Updated Tab Order
Items → Payments → Production → Packing List → **Booking** → **Sailing** → **Shipping Docs** → Files

---

## Migration Notes

### Database Changes
1. Create new `service_providers` table
2. Migrate existing data from 4 old tables → new unified table (if any data exists)
3. Update `shipments` table FK columns: `freight_forwarder_id`, `cha_id`, `cfs_id`, `transport_id` → all point to `service_providers`
4. Add HBL content fields to `shipments` table (shipper, consignee, notify_party, description_of_goods, freight_terms, seal_number)

### Frontend Changes
1. New sidebar item "Transport" with route `/transport`
2. New page: `TransportList.vue` (service provider CRUD)
3. New components: `BookingTab.vue`, `SailingTab.vue`, `ShippingDocsTab.vue`
4. Update `OrderDetail.vue` tab system to include 3 new tabs
5. Update `api/index.js` with shipping and transport API methods
