# HarvestERP

Supply chain management system for importing combine harvester spare parts (China factories to India clients). Tracks orders through a 14-stage workflow from draft to delivery.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + SQLite (WAL mode)
- **Frontend:** Vue 3 + Vite 5 + Tailwind CSS 3 + PrimeVue
- **File Processing:** openpyxl + Pillow (image extraction/resize)

## Features

### Level 1 — Core CRUD
- Order, Product, Client, Factory management
- Dashboard with order summaries and alerts

### Level 2 — 14-Stage Workflow
- DRAFT > PENDING_PI > PI_SENT > ADVANCE_PENDING > ADVANCE_RECEIVED
- FACTORY_ORDERED > PRODUCTION (60/80/90/100%) > BOOKED
- SAILING (LOADED/SAILED/ARRIVED) > CUSTOMS (FILED/CLEARED)
- DELIVERED > COMPLETED
- Stage-specific validation and transition rules

### Level 3 — Excel Processing & PI Generation
- Streaming file upload (up to 500MB) with background processing
- Client Excel parser (barcode + mfr code + qty)
- Factory Excel parser (9-column format + embedded image extraction)
- Product auto-creation with approval status
- Apply parsed data to orders with image extraction on Apply
- PI generation (Excel with/without product images)
- Bulk price upload modal for Stage 2 pricing

### Data Protection
- Soft-delete for products referenced by active orders
- OrderItem snapshot columns (code, name, image) populated on DRAFT > PENDING_PI
- Product reactivation on re-upload via factory Excel

### Bulk Operations
- Bulk select/delete products with FK-aware soft/hard delete
- Bulk edit: category, material, HSN code via inline dropdowns

## Project Structure

```
backend/
  main.py              # FastAPI app, router registration, static files
  models.py            # SQLAlchemy ORM (34 tables)
  enums.py             # OrderStatus, JobStatus, etc.
  database.py          # Engine, session, WAL mode
  config.py            # Upload limits, image settings
  routers/
    orders.py          # Order CRUD + stage transitions
    products.py        # Product CRUD + bulk ops
    excel.py           # Upload, parse, apply, PI generation
    clients.py         # Client master
    factories.py       # Factory master
    ...

frontend/
  src/
    views/orders/      # OrderList, OrderDetail, OrderDraft
    views/products/    # ProductList, ProductForm
    api/index.js       # API client
    router/index.js    # Route definitions
```

## Running

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Key Rules

- **No pricing in product master** — prices come from factory Excel per order
- **Manufacturer code = primary product_code**
- **PI is client-facing** — no factory prices, Chinese names, or markup shown
