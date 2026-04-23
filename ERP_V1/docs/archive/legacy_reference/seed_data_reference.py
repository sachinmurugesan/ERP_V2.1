"""
HarvestERP — Seed Data
Realistic dummy data for demonstration.
"""
from datetime import date, datetime, timedelta
from models import (
    Client, Product, Order, OrderItem, ProformaInvoice,
    ProductionMilestone, Shipment, ShipmentOrder, Payment,
    CustomsClearance, Document, DeliveryRecord, DamageClaim,
)


def seed_all(db):
    """Populate the database with realistic demo data."""

    # ──────────── CLIENTS ────────────
    clients = [
        Client(
            id="c1", name="Agri Parts India Pvt Ltd",
            gstin="33AABCU9603R1ZN", iec="AABCU9603",
            address="12, Industrial Estate, Coimbatore",
            city="Coimbatore", state="Tamil Nadu",
            contact_person="Rajesh Kumar", email="rajesh@agripartsindia.com", phone="+91-9876543210",
        ),
        Client(
            id="c2", name="Punjab Harvester Spares",
            gstin="03BBBPK8765H1Z5", iec="BBBPK8765",
            address="45, GT Road, Ludhiana",
            city="Ludhiana", state="Punjab",
            contact_person="Harinder Singh", email="harinder@punjabspares.in", phone="+91-9812345678",
        ),
        Client(
            id="c3", name="Green Fields Equipment Co.",
            gstin="29CCCGF1234J1Z8", iec="CCCGF1234",
            address="78, MIDC Area, Nagpur",
            city="Nagpur", state="Maharashtra",
            contact_person="Suresh Patil", email="suresh@greenfields.co.in", phone="+91-9988776655",
        ),
    ]
    db.add_all(clients)

    # ──────────── PRODUCTS ───────────
    products = [
        Product(id="p1", part_number="CH-BLD-001", name="Harvester Blade Assembly", category="Cutting System", hsn_code="84335990", bcd_rate=7.5, igst_rate=18, unit_price_cny=350, weight_kg=12.5, cbm=0.08),
        Product(id="p2", part_number="CH-BRG-002", name="Main Shaft Bearing SKF 6315", category="Bearings", hsn_code="84823000", bcd_rate=7.5, igst_rate=18, unit_price_cny=180, weight_kg=3.2, cbm=0.02),
        Product(id="p3", part_number="CH-BLT-003", name="Drive Belt Set (3-piece)", category="Belts & Pulleys", hsn_code="40103990", bcd_rate=10, igst_rate=18, unit_price_cny=95, weight_kg=1.8, cbm=0.01),
        Product(id="p4", part_number="CH-GBX-004", name="Gearbox Assembly 540 RPM", category="Transmission", hsn_code="84834090", bcd_rate=7.5, igst_rate=18, unit_price_cny=2800, weight_kg=85, cbm=0.35),
        Product(id="p5", part_number="CH-THR-005", name="Threshing Drum Assembly", category="Threshing", hsn_code="84335990", bcd_rate=7.5, igst_rate=18, unit_price_cny=1500, weight_kg=45, cbm=0.25),
        Product(id="p6", part_number="CH-SIV-006", name="Sieve Screen Set", category="Cleaning System", hsn_code="84339000", bcd_rate=7.5, igst_rate=18, unit_price_cny=220, weight_kg=8.5, cbm=0.05),
        Product(id="p7", part_number="CH-HYD-007", name="Hydraulic Pump 20cc", category="Hydraulics", hsn_code="84135090", bcd_rate=7.5, igst_rate=18, unit_price_cny=680, weight_kg=6.5, cbm=0.03),
        Product(id="p8", part_number="CH-FLT-008", name="Air Filter Element (Heavy Duty)", category="Filtration", hsn_code="84219990", bcd_rate=10, igst_rate=18, unit_price_cny=45, weight_kg=0.8, cbm=0.005),
        Product(id="p9", part_number="CH-SPR-009", name="Sprocket Z-17 Drive Chain", category="Transmission", hsn_code="84839000", bcd_rate=7.5, igst_rate=18, unit_price_cny=120, weight_kg=2.5, cbm=0.015),
        Product(id="p10", part_number="CH-RKR-010", name="Rasp Bar Set (8-piece)", category="Threshing", hsn_code="84335990", bcd_rate=7.5, igst_rate=18, unit_price_cny=280, weight_kg=14, cbm=0.06),
        Product(id="p11", part_number="CH-STR-011", name="Straw Walker Assembly", category="Separation", hsn_code="84339000", bcd_rate=7.5, igst_rate=18, unit_price_cny=950, weight_kg=35, cbm=0.22),
        Product(id="p12", part_number="CH-AUG-012", name="Grain Auger 3m", category="Conveying", hsn_code="84378000", bcd_rate=7.5, igst_rate=18, unit_price_cny=420, weight_kg=18, cbm=0.12),
        Product(id="p13", part_number="CH-CYL-013", name="Hydraulic Cylinder 50mm", category="Hydraulics", hsn_code="84129090", bcd_rate=7.5, igst_rate=18, unit_price_cny=520, weight_kg=8, cbm=0.04),
        Product(id="p14", part_number="CH-KNF-014", name="Knife Guard Set (50-piece)", category="Cutting System", hsn_code="82089000", bcd_rate=7.5, igst_rate=18, unit_price_cny=380, weight_kg=15, cbm=0.09),
        Product(id="p15", part_number="CH-ELV-015", name="Elevator Chain Assembly", category="Conveying", hsn_code="73158900", bcd_rate=7.5, igst_rate=18, unit_price_cny=310, weight_kg=12, cbm=0.07),
        Product(id="p16", part_number="CH-FAN-016", name="Cleaning Fan Blade Set", category="Cleaning System", hsn_code="84145990", bcd_rate=7.5, igst_rate=18, unit_price_cny=160, weight_kg=4, cbm=0.025),
        Product(id="p17", part_number="CH-SHL-017", name="Concave Shell Plate Set", category="Threshing", hsn_code="84339000", bcd_rate=7.5, igst_rate=18, unit_price_cny=450, weight_kg=22, cbm=0.15),
        Product(id="p18", part_number="CH-RDR-018", name="Header Reel Tine Set (24-piece)", category="Cutting System", hsn_code="84335990", bcd_rate=7.5, igst_rate=18, unit_price_cny=190, weight_kg=6, cbm=0.04),
        Product(id="p19", part_number="CH-TNK-019", name="Grain Tank Extension Kit", category="Storage", hsn_code="73090090", bcd_rate=7.5, igst_rate=18, unit_price_cny=780, weight_kg=28, cbm=0.18),
        Product(id="p20", part_number="CH-SEN-020", name="Yield Monitor Sensor Kit", category="Electronics", hsn_code="90318090", bcd_rate=7.5, igst_rate=12, unit_price_cny=1200, weight_kg=2, cbm=0.01),
    ]
    db.add_all(products)
    db.flush()

    # ──────────── ORDERS ─────────────
    today = date.today()
    orders = [
        Order(
            id="o1", order_number="ORD-2025-0001", client_id="c1",
            status="PRODUCTION_80", po_date=today - timedelta(days=45),
            po_reference="PO/API/2025/001", pi_number="PI-2025-0001",
            pi_date=today - timedelta(days=40), currency="INR",
            exchange_rate=12.1, total_value=28500, total_value_inr=395692.50,
            markup_percent=15, advance_percent=30,
        ),
        Order(
            id="o2", order_number="ORD-2025-0002", client_id="c2",
            status="SAILED", po_date=today - timedelta(days=60),
            po_reference="PO/PHS/2025/034", pi_number="PI-2025-0002",
            pi_date=today - timedelta(days=55), currency="INR",
            exchange_rate=12.05, total_value=156000, total_value_inr=2161260.00,
            markup_percent=15, advance_percent=30,
        ),
        Order(
            id="o3", order_number="ORD-2025-0003", client_id="c1",
            status="ADVANCE_PENDING", po_date=today - timedelta(days=10),
            po_reference="PO/API/2025/012", pi_number="PI-2025-0003",
            pi_date=today - timedelta(days=8), currency="INR",
            exchange_rate=12.15, total_value=8500, total_value_inr=118706.25,
            markup_percent=15, advance_percent=30,
        ),
        Order(
            id="o4", order_number="ORD-2025-0004", client_id="c3",
            status="CLEARED", po_date=today - timedelta(days=90),
            po_reference="PO/GFE/2025/007", pi_number="PI-2025-0004",
            pi_date=today - timedelta(days=85), currency="INR",
            exchange_rate=11.95, total_value=45000, total_value_inr=618056.25,
            markup_percent=15, advance_percent=30,
        ),
        Order(
            id="o5", order_number="ORD-2025-0005", client_id="c2",
            status="DRAFT", po_date=today - timedelta(days=2),
            po_reference="PO/PHS/2025/041", currency="INR",
            exchange_rate=12.2, total_value=12000, total_value_inr=168360.00,
            markup_percent=15, advance_percent=30,
        ),
    ]
    db.add_all(orders)
    db.flush()

    # ──────────── ORDER ITEMS ────────
    rate = 12.1
    items = [
        # Order 1 — Cutting + Bearings
        OrderItem(id="oi1", order_id="o1", product_id="p1", quantity=50, unit_price_cny=350, markup_percent=15, unit_price_inr=round(350*rate*1.15,2), total_price_cny=17500, total_price_inr=round(50*350*rate*1.15,2), hsn_code="84335990"),
        OrderItem(id="oi2", order_id="o1", product_id="p2", quantity=100, unit_price_cny=180, markup_percent=15, unit_price_inr=round(180*rate*1.15,2), total_price_cny=18000, total_price_inr=round(100*180*rate*1.15,2), hsn_code="84823000"),
        # Order 2 — Gearbox + Threshing
        OrderItem(id="oi3", order_id="o2", product_id="p4", quantity=20, unit_price_cny=2800, markup_percent=15, unit_price_inr=round(2800*12.05*1.15,2), total_price_cny=56000, total_price_inr=round(20*2800*12.05*1.15,2), hsn_code="84834090"),
        OrderItem(id="oi4", order_id="o2", product_id="p5", quantity=30, unit_price_cny=1500, markup_percent=15, unit_price_inr=round(1500*12.05*1.15,2), total_price_cny=45000, total_price_inr=round(30*1500*12.05*1.15,2), hsn_code="84335990"),
        OrderItem(id="oi5", order_id="o2", product_id="p11", quantity=25, unit_price_cny=950, markup_percent=15, unit_price_inr=round(950*12.05*1.15,2), total_price_cny=23750, total_price_inr=round(25*950*12.05*1.15,2), hsn_code="84339000"),
        # Order 3 — Filters + Belts
        OrderItem(id="oi6", order_id="o3", product_id="p8", quantity=200, unit_price_cny=45, markup_percent=15, unit_price_inr=round(45*12.15*1.15,2), total_price_cny=9000, total_price_inr=round(200*45*12.15*1.15,2), hsn_code="84219990"),
        # Order 4 — Hydraulics
        OrderItem(id="oi7", order_id="o4", product_id="p7", quantity=30, unit_price_cny=680, markup_percent=15, unit_price_inr=round(680*11.95*1.15,2), total_price_cny=20400, total_price_inr=round(30*680*11.95*1.15,2), hsn_code="84135090"),
        OrderItem(id="oi8", order_id="o4", product_id="p13", quantity=40, unit_price_cny=520, markup_percent=15, unit_price_inr=round(520*11.95*1.15,2), total_price_cny=20800, total_price_inr=round(40*520*11.95*1.15,2), hsn_code="84129090"),
        # Order 5 — Various parts
        OrderItem(id="oi9", order_id="o5", product_id="p9", quantity=100, unit_price_cny=120, markup_percent=15, unit_price_inr=round(120*12.2*1.15,2), total_price_cny=12000, total_price_inr=round(100*120*12.2*1.15,2), hsn_code="84839000"),
    ]
    db.add_all(items)

    # ──────────── PROFORMA INVOICES ──
    pis = [
        ProformaInvoice(id="pi1", pi_number="PI-2025-0001", order_id="o1", issue_date=today-timedelta(days=40), exchange_rate_locked=12.1, total_cny=28500, total_inr=395692.50, markup_type="FIXED_PERCENT", markup_value=15, payment_terms="30% advance, balance against BOL", delivery_terms="FOB Shanghai", status="APPROVED", approved_at=datetime.utcnow()-timedelta(days=38)),
        ProformaInvoice(id="pi2", pi_number="PI-2025-0002", order_id="o2", issue_date=today-timedelta(days=55), exchange_rate_locked=12.05, total_cny=156000, total_inr=2161260.00, markup_type="FIXED_PERCENT", markup_value=15, payment_terms="30% advance, balance against BOL", delivery_terms="FOB Shanghai", status="APPROVED", approved_at=datetime.utcnow()-timedelta(days=52)),
        ProformaInvoice(id="pi3", pi_number="PI-2025-0003", order_id="o3", issue_date=today-timedelta(days=8), exchange_rate_locked=12.15, total_cny=8500, total_inr=118706.25, markup_type="FIXED_PERCENT", markup_value=15, payment_terms="30% advance, balance against BOL", delivery_terms="FOB Shanghai", status="APPROVED", approved_at=datetime.utcnow()-timedelta(days=7)),
    ]
    db.add_all(pis)

    # ──────────── PRODUCTION MILESTONES ──
    milestones = [
        ProductionMilestone(id="pm1", order_id="o1", milestone_percent=60, expected_date=today-timedelta(days=25), actual_date=today-timedelta(days=24), notes="Raw material cut ready"),
        ProductionMilestone(id="pm2", order_id="o1", milestone_percent=80, expected_date=today-timedelta(days=15), actual_date=today-timedelta(days=13), notes="Assembly 80% done"),
        ProductionMilestone(id="pm3", order_id="o2", milestone_percent=60, expected_date=today-timedelta(days=50), actual_date=today-timedelta(days=49)),
        ProductionMilestone(id="pm4", order_id="o2", milestone_percent=80, expected_date=today-timedelta(days=42), actual_date=today-timedelta(days=40)),
        ProductionMilestone(id="pm5", order_id="o2", milestone_percent=90, expected_date=today-timedelta(days=35), actual_date=today-timedelta(days=34)),
        ProductionMilestone(id="pm6", order_id="o2", milestone_percent=100, expected_date=today-timedelta(days=30), actual_date=today-timedelta(days=29), notes="QC passed, packing complete"),
    ]
    db.add_all(milestones)

    # ──────────── SHIPMENTS ──────────
    shipments = [
        Shipment(
            id="s1", container_number="COSU6284173", container_type="40FT",
            max_weight_kg=26000, max_cbm=67.7,
            actual_weight_kg=22500, actual_cbm=48.5,
            seal_number="SL2025001",
            vessel_name="EVER GIVEN", voyage_number="EG2025-012",
            bol_number="COSU625031452", bol_type="TELEX_RELEASE",
            bol_date=today - timedelta(days=25),
            port_of_loading="Shanghai", port_of_discharge="Chennai",
            etd=today - timedelta(days=22), eta=today + timedelta(days=3),
            status="SAILED", freight_usd=2850.00,
        ),
        Shipment(
            id="s2", container_number="MSCU7391025", container_type="40HC",
            max_weight_kg=26000, max_cbm=76.3,
            actual_weight_kg=18200, actual_cbm=35.2,
            vessel_name="MSC GULSUN", voyage_number="MG2025-008",
            bol_number="MSCU738802941", bol_type="ORIGINAL",
            bol_date=today - timedelta(days=55),
            port_of_loading="Ningbo", port_of_discharge="Mundra",
            etd=today - timedelta(days=50), eta=today - timedelta(days=25),
            status="CLEARED", freight_usd=3200.00,
        ),
    ]
    db.add_all(shipments)
    db.flush()

    # Link shipments to orders
    ship_orders = [
        ShipmentOrder(id="so1", shipment_id="s1", order_id="o2", allocated_weight_kg=22500, allocated_cbm=48.5),
        ShipmentOrder(id="so2", shipment_id="s2", order_id="o4", allocated_weight_kg=18200, allocated_cbm=35.2),
    ]
    db.add_all(ship_orders)

    # ──────────── PAYMENTS ───────────
    payments = [
        Payment(id="pay1", order_id="o1", payment_type="CLIENT_ADVANCE", amount=118707.75, currency="INR", exchange_rate=1.0, amount_inr=118707.75, payment_date=today-timedelta(days=38), reference="NEFT/2025/001234", status="COMPLETED"),
        Payment(id="pay2", order_id="o1", payment_type="FACTORY_ADVANCE", amount=5700, currency="CNY", exchange_rate=12.1, amount_inr=68970, payment_date=today-timedelta(days=36), reference="TT/2025/CN001", status="COMPLETED"),
        Payment(id="pay3", order_id="o2", payment_type="CLIENT_ADVANCE", amount=648378.00, currency="INR", exchange_rate=1.0, amount_inr=648378.00, payment_date=today-timedelta(days=52), reference="NEFT/2025/002345", status="COMPLETED"),
        Payment(id="pay4", order_id="o2", payment_type="FACTORY_ADVANCE", amount=31200, currency="CNY", exchange_rate=12.05, amount_inr=375960, payment_date=today-timedelta(days=50), reference="TT/2025/CN002", status="COMPLETED"),
        Payment(id="pay5", order_id="o4", payment_type="CLIENT_ADVANCE", amount=185416.88, currency="INR", exchange_rate=1.0, amount_inr=185416.88, payment_date=today-timedelta(days=82), reference="NEFT/2025/003456", status="COMPLETED"),
        Payment(id="pay6", order_id="o4", payment_type="BALANCE", amount=432639.37, currency="INR", exchange_rate=1.0, amount_inr=432639.37, payment_date=today-timedelta(days=20), reference="NEFT/2025/004567", status="COMPLETED"),
    ]
    db.add_all(payments)

    # ──────────── CUSTOMS CLEARANCE ──
    clearances = [
        CustomsClearance(
            id="cc1", shipment_id="s2", be_number="2025/MUN/123456",
            be_date=today - timedelta(days=22),
            assessable_value_inr=556200,
            bcd_rate=7.5, bcd_amount=41715, sws_amount=4171.50,
            igst_rate=18, igst_amount=108375.57,
            total_duty=154262.07,
            ooc_date=today - timedelta(days=18),
            igst_credit_claimed=True,
            status="CLEARED",
            cha_name="Ocean Logistics CHA", cha_fees=15000,
            cfs_charges=8500, thc_charges=12000, transport_charges=22000,
        ),
    ]
    db.add_all(clearances)

    # ──────────── DOCUMENTS ──────────
    docs = [
        Document(id="d1", order_id="o1", doc_type="PO", filename="PO_API_2025_001.pdf"),
        Document(id="d2", order_id="o1", doc_type="PI", filename="PI-2025-0001.pdf"),
        Document(id="d3", order_id="o2", doc_type="PO", filename="PO_PHS_2025_034.pdf"),
        Document(id="d4", order_id="o2", doc_type="PI", filename="PI-2025-0002.pdf"),
        Document(id="d5", order_id="o2", shipment_id="s1", doc_type="BOL", filename="BOL_COSU625031452.pdf"),
        Document(id="d6", order_id="o2", shipment_id="s1", doc_type="CI", filename="CI_2025_002.pdf"),
        Document(id="d7", order_id="o2", shipment_id="s1", doc_type="PL", filename="PL_2025_002.pdf"),
        Document(id="d8", order_id="o4", doc_type="PO", filename="PO_GFE_2025_007.pdf"),
        Document(id="d9", order_id="o4", shipment_id="s2", doc_type="BOL", filename="BOL_MSCU738802941.pdf"),
        Document(id="d10", order_id="o4", shipment_id="s2", doc_type="COO", filename="COO_2025_004.pdf"),
        Document(id="d11", order_id="o4", shipment_id="s2", doc_type="INSURANCE", filename="Insurance_2025_004.pdf"),
    ]
    db.add_all(docs)

    # ──────────── DELIVERY ───────────
    deliveries = [
        DeliveryRecord(
            id="del1", order_id="o4", delivery_date=today - timedelta(days=15),
            delivered_quantity=70, gps_lat=21.1458, gps_lng=79.0882,
            delivery_notes="Delivered at warehouse, 2 boxes minor dent",
            condition="MINOR_DAMAGE",
        ),
    ]
    db.add_all(deliveries)

    # ──────────── CLAIMS ─────────────
    claims = [
        DamageClaim(
            id="clm1", order_id="o4", delivery_id="del1",
            claim_type="DAMAGE", quantity=3,
            description="3 hydraulic cylinders with dented rods — packaging damage",
            claim_value=23400, currency="INR",
            status="ACKNOWLEDGED", factory_acknowledged=True,
        ),
    ]
    db.add_all(claims)

    db.commit()
    print("✅ Seed data loaded: 3 clients, 20 products, 5 orders, 2 shipments, 6 payments, 1 customs, 11 docs, 1 delivery, 1 claim")
