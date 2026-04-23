"""
HarvestERP — Customs / Bill of Entry Router
HSN tariff management, per-shipment BOE CRUD, per-part duty calculation.
Full formula: FOB → CIF (+ Freight + Insurance) → Landing → AV → proportional per-part duty.
"""
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import (
    HsnTariff, BillOfEntry, BoeLineItem,
    Shipment, ShipmentItem, PackingListItem, OrderItem, Product,
    CustomsMilestone, ClearanceCharges, ServiceProvider,
)
from core.security import get_current_user, CurrentUser


router = APIRouter()


def _require_internal(current_user: CurrentUser):
    """Only internal staff (ADMIN, OPERATIONS, FINANCE) can access customs data."""
    if current_user.user_type in ("CLIENT", "FACTORY"):
        raise HTTPException(status_code=403, detail="Customs data is internal only")


# ========================================
# Pydantic Schemas
# ========================================

class HsnTariffCreate(BaseModel):
    hsn_code: str
    description: str
    bcd_rate: float = 0
    igst_rate: float = 18.0
    swc_rate: float = 10.0
    effective_date: Optional[date] = None


class HsnTariffUpdate(BaseModel):
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    bcd_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    swc_rate: Optional[float] = None
    effective_date: Optional[date] = None
    is_active: Optional[bool] = None


class BoeLineItemInput(BaseModel):
    shipment_item_id: Optional[str] = None
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    hsn_code: str
    description: Optional[str] = None
    quantity: int = 0
    unit_price: float = 0          # factory purchase price (order currency)
    assessable_value_inr: float = 0 # auto-calculated proportional AV share
    bcd_rate: float = 0
    igst_rate: float = 18.0
    swc_rate: float = 10.0


class BoeCreateUpdate(BaseModel):
    be_number: Optional[str] = None
    be_date: Optional[date] = None
    port_of_import: Optional[str] = None
    cha_id: Optional[str] = None
    exchange_rate: Optional[float] = None   # order currency → INR
    freight_inr: Optional[float] = None     # shipping freight in INR
    insurance_inr: Optional[float] = None   # insurance in INR (None = auto 1.125% of FOB)
    status: Optional[str] = None
    notes: Optional[str] = None
    line_items: List[BoeLineItemInput] = []

    @model_validator(mode="before")
    @classmethod
    def coerce_blanks(cls, data):
        """Convert empty strings to None for Optional fields (especially dates)."""
        if isinstance(data, dict):
            for key in ("be_date",):
                if data.get(key) == "":
                    data[key] = None
            for key in ("be_number", "port_of_import", "cha_id", "notes"):
                if isinstance(data.get(key), str) and data[key].strip() == "":
                    data[key] = None
        return data


class MilestoneCreate(BaseModel):
    milestone: str
    milestone_date: date
    notes: Optional[str] = None


class ChargesSave(BaseModel):
    bcd_amount: float = 0
    sws_amount: float = 0
    igst_amount: float = 0
    cha_fees: float = 0
    cfs_charges: float = 0
    thc_charges: float = 0
    insurance_inr: float = 0
    transport_cost: float = 0
    other_charges: float = 0
    notes: Optional[str] = None


# ========================================
# Calculation Helper — full BOE formula
# ========================================

def calculate_boe(
    exchange_rate: float,
    freight_inr: float,
    insurance_inr: Optional[float],
    line_items: List[dict],
) -> dict:
    """
    Full Indian customs BOE calculation.

    FOB = Σ (unit_price × exchange_rate × qty)
    Insurance = FOB × 1.125% if not explicitly provided
    CIF = FOB + Freight + Insurance
    Landing = CIF × 1%
    AV = CIF + Landing

    Per-part (proportional share of AV):
      part_fob = unit_price × exchange_rate × qty
      part_av  = (part_fob / total_fob) × AV
      BCD  = part_av × bcd_rate%
      SWC  = BCD × swc_rate%
      IGST = (part_av + BCD + SWC) × igst_rate%
    """
    # 1. Calculate total FOB from all parts
    total_fob = 0.0
    for item in line_items:
        up = item.get("unit_price", 0) or 0
        qty = item.get("quantity", 0) or 0
        total_fob += up * exchange_rate * qty
    total_fob = round(total_fob, 2)

    # 2. Insurance: use provided value, or default 1.125% of FOB
    if insurance_inr is not None:
        ins = round(insurance_inr, 2)
    else:
        ins = round(total_fob * 0.01125, 2)

    frt = round(freight_inr or 0, 2)

    # 3. CIF, Landing, Assessment Value
    cif = round(total_fob + frt + ins, 2)
    landing = round(cif * 0.01, 2)
    av = round(cif + landing, 2)

    # 4. Per-part: proportional AV share → BCD → SWC → IGST
    total_bcd = total_swc = total_igst = total_duty = 0.0
    calc_items = []

    for item in line_items:
        up = item.get("unit_price", 0) or 0
        qty = item.get("quantity", 0) or 0
        bcd_rate = item.get("bcd_rate", 0) or 0
        swc_rate = item.get("swc_rate", 10.0) or 10.0
        igst_rate = item.get("igst_rate", 18.0) or 18.0

        # Part's FOB and proportional AV share
        part_fob = round(up * exchange_rate * qty, 2)
        part_av = round((part_fob / total_fob) * av, 2) if total_fob > 0 else 0

        bcd = round(part_av * (bcd_rate / 100), 2)
        swc = round(bcd * (swc_rate / 100), 2)
        igst = round((part_av + bcd + swc) * (igst_rate / 100), 2)
        duty = round(bcd + swc + igst, 2)

        total_bcd += bcd
        total_swc += swc
        total_igst += igst
        total_duty += duty

        calc_items.append({
            **item,
            "assessable_value_inr": part_av,
            "bcd_amount": bcd,
            "swc_amount": swc,
            "igst_amount": igst,
            "total_duty": duty,
        })

    return {
        "fob_inr": total_fob,
        "freight_inr": frt,
        "insurance_inr": ins,
        "cif_inr": cif,
        "landing_charges_inr": landing,
        "assessment_value_inr": av,
        "total_bcd": round(total_bcd, 2),
        "total_swc": round(total_swc, 2),
        "total_igst": round(total_igst, 2),
        "total_duty": round(total_duty),  # Rounded to nearest ₹
        "line_items": calc_items,
    }


def _is_compensation_line(li: BoeLineItem, db: Session) -> bool:
    """Check if a BOE line item is a compensation/balance adjustment."""
    if not li.shipment_item_id:
        return False
    si = db.query(ShipmentItem).filter(ShipmentItem.id == li.shipment_item_id).first()
    if not si or not si.packing_list_item_id:
        return False
    pli = db.query(PackingListItem).filter(PackingListItem.id == si.packing_list_item_id).first()
    if not pli:
        return False
    oi = db.query(OrderItem).filter(OrderItem.id == pli.order_item_id).first()
    return bool(oi and (oi.selling_price_inr or 0) < 0)


def _count_physical_shipment_items(shipment_id: str, db: Session) -> int:
    """Count shipment items excluding compensation (negative selling_price) items."""
    si_list = db.query(ShipmentItem).filter(ShipmentItem.shipment_id == shipment_id).all()
    count = 0
    for si in si_list:
        pli = db.query(PackingListItem).filter(PackingListItem.id == si.packing_list_item_id).first()
        if not pli:
            count += 1
            continue
        oi = db.query(OrderItem).filter(OrderItem.id == pli.order_item_id).first()
        if oi and (oi.selling_price_inr or 0) < 0:
            continue  # skip compensation items
        count += 1
    return count


def _serialize_boe(boe: BillOfEntry, db: Session) -> dict:
    cha_name = None
    if boe.cha_id:
        sp = db.query(ServiceProvider).filter(ServiceProvider.id == boe.cha_id).first()
        if sp:
            cha_name = sp.name

    return {
        "id": boe.id,
        "shipment_id": boe.shipment_id,
        "order_id": boe.order_id,
        "be_number": boe.be_number,
        "be_date": boe.be_date.isoformat() if boe.be_date else None,
        "port_of_import": boe.port_of_import,
        "cha_id": boe.cha_id,
        "cha_name": cha_name,
        "exchange_rate": boe.exchange_rate_usd_inr,
        "fob_inr": boe.fob_inr,
        "freight_inr": boe.freight_inr,
        "insurance_inr": boe.insurance_inr,
        "cif_inr": boe.cif_inr,
        "landing_charges_inr": boe.landing_charges_inr,
        "assessment_value_inr": boe.assessment_value_inr,
        "total_bcd": boe.total_bcd,
        "total_swc": boe.total_swc,
        "total_igst": boe.total_igst,
        "total_duty": boe.total_duty,
        "status": boe.status,
        "notes": boe.notes,
        "created_at": boe.created_at.isoformat() if boe.created_at else None,
        "line_items": [
            {
                "id": li.id,
                "shipment_item_id": li.shipment_item_id,
                "product_name": li.product_name,
                "product_code": li.product_code,
                "hsn_code": li.hsn_code,
                "description": li.description,
                "quantity": li.quantity,
                "unit_price": li.unit_price,
                "assessable_value_inr": li.assessable_value_inr,
                "bcd_rate": li.bcd_rate,
                "bcd_amount": li.bcd_amount,
                "swc_rate": li.swc_rate,
                "swc_amount": li.swc_amount,
                "igst_rate": li.igst_rate,
                "igst_amount": li.igst_amount,
                "total_duty": li.total_duty,
                "is_compensation": _is_compensation_line(li, db),
            }
            for li in boe.line_items
        ],
    }


def _build_boe_line_items(boe_id: str, calc: dict) -> list:
    """Create BoeLineItem ORM objects from calc results."""
    items = []
    for li_data in calc["line_items"]:
        items.append(BoeLineItem(
            boe_id=boe_id,
            shipment_item_id=li_data.get("shipment_item_id"),
            product_name=li_data.get("product_name"),
            product_code=li_data.get("product_code"),
            hsn_code=li_data["hsn_code"],
            description=li_data.get("description"),
            quantity=li_data.get("quantity", 0),
            unit_price=li_data.get("unit_price", 0),
            assessable_value_inr=li_data.get("assessable_value_inr", 0),
            bcd_rate=li_data.get("bcd_rate", 0),
            bcd_amount=li_data["bcd_amount"],
            swc_rate=li_data.get("swc_rate", 10.0),
            swc_amount=li_data["swc_amount"],
            igst_rate=li_data.get("igst_rate", 18.0),
            igst_amount=li_data["igst_amount"],
            total_duty=li_data["total_duty"],
        ))
    return items


# ========================================
# HSN Tariff Endpoints
# ========================================

@router.get("/tariffs/")
def list_tariffs(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    return [
        {
            "id": t.id, "hsn_code": t.hsn_code, "description": t.description,
            "bcd_rate": t.bcd_rate, "igst_rate": t.igst_rate, "swc_rate": t.swc_rate,
            "effective_date": t.effective_date.isoformat() if t.effective_date else None,
            "is_active": t.is_active,
        }
        for t in db.query(HsnTariff).filter(HsnTariff.is_active == True).order_by(HsnTariff.hsn_code).all()
    ]


@router.post("/tariffs/", status_code=201)
def create_tariff(data: HsnTariffCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    existing = db.query(HsnTariff).filter(HsnTariff.hsn_code == data.hsn_code).first()
    if existing:
        if not existing.is_active:
            for k, v in data.model_dump(exclude_unset=True).items():
                setattr(existing, k, v)
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return {"id": existing.id, "hsn_code": existing.hsn_code}
        raise HTTPException(409, f"HSN {data.hsn_code} already exists")
    t = HsnTariff(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "hsn_code": t.hsn_code}


@router.put("/tariffs/{tariff_id}")
def update_tariff(tariff_id: str, data: HsnTariffUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    t = db.query(HsnTariff).filter(HsnTariff.id == tariff_id).first()
    if not t:
        raise HTTPException(404, "Tariff not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "hsn_code": t.hsn_code}


# ========================================
# HSN Items Grouped (per shipment)
# ========================================

@router.get("/shipments/{shipment_id}/hsn-items/")
def get_hsn_items(shipment_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    """
    Get shipment items grouped by HSN code.
    Returns groups with individual part details for the picker.
    Also returns shipment freight_cost_inr for pre-filling the BOE form.
    """
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    si_list = db.query(ShipmentItem).filter(ShipmentItem.shipment_id == shipment_id).all()
    hsn_map = {}  # hsn_code → { items, total_qty, ... }

    for si in si_list:
        pli = db.query(PackingListItem).filter(PackingListItem.id == si.packing_list_item_id).first()
        if not pli:
            continue
        oi = db.query(OrderItem).filter(OrderItem.id == pli.order_item_id).first()
        product = db.query(Product).filter(Product.id == pli.product_id).first() if pli.product_id else None

        hsn = product.hs_code if product and product.hs_code else "UNKNOWN"
        hsn_desc = product.hs_code_description if product and product.hs_code_description else ""

        if hsn not in hsn_map:
            tariff = db.query(HsnTariff).filter(
                HsnTariff.hsn_code == hsn, HsnTariff.is_active == True
            ).first()
            hsn_map[hsn] = {
                "hsn_code": hsn,
                "description": hsn_desc,
                "item_count": 0,
                "total_quantity": 0,
                "tariff": {
                    "bcd_rate": tariff.bcd_rate if tariff else 0,
                    "igst_rate": tariff.igst_rate if tariff else 18.0,
                    "swc_rate": tariff.swc_rate if tariff else 10.0,
                } if tariff else None,
                "items": [],
            }

        hsn_map[hsn]["item_count"] += 1
        hsn_map[hsn]["total_quantity"] += si.allocated_qty
        hsn_map[hsn]["items"].append({
            "shipment_item_id": si.id,
            "packing_list_item_id": si.packing_list_item_id,
            "product_name": oi.product_name_snapshot if oi else (product.product_name if product else None),
            "product_code": oi.product_code_snapshot if oi else (product.product_code if product else None),
            "quantity": si.allocated_qty,
            "unit_price_cny": oi.factory_price if oi else 0,  # purchase price for customs
            "is_compensation": bool((oi.selling_price_inr or 0) < 0) if oi else False,
        })

    return {
        "freight_cost_inr": shipment.freight_cost_inr or 0,
        "groups": list(hsn_map.values()),
    }


# ========================================
# Total packing items count for validation
# ========================================

@router.get("/shipments/{shipment_id}/total-items-count/")
def get_total_items_count(shipment_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    """Returns total number of shipment items for save validation."""
    count = db.query(ShipmentItem).filter(ShipmentItem.shipment_id == shipment_id).count()
    return {"total": count}


# ========================================
# BOE CRUD
# ========================================

@router.get("/shipments/{shipment_id}/boe/")
def get_boe(shipment_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    """Get BOE for a shipment, or null if none exists."""
    boe = db.query(BillOfEntry).filter(BillOfEntry.shipment_id == shipment_id).first()
    if not boe:
        return None
    return _serialize_boe(boe, db)


@router.post("/shipments/{shipment_id}/boe/", status_code=201)
def create_boe(shipment_id: str, data: BoeCreateUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    """Create a new BOE for a shipment with per-part line items."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    existing = db.query(BillOfEntry).filter(BillOfEntry.shipment_id == shipment_id).first()
    if existing:
        raise HTTPException(409, "BOE already exists for this shipment. Use PUT to update.")

    exchange_rate = data.exchange_rate or 0

    # Validate: all physical (non-compensation) packing list items must be included
    total_si = _count_physical_shipment_items(shipment_id, db)
    included_si_ids = set(li.shipment_item_id for li in data.line_items if li.shipment_item_id)
    if len(included_si_ids) < total_si:
        raise HTTPException(
            400,
            f"All packing list items must be included. "
            f"Got {len(included_si_ids)} of {total_si} items. "
            f"Add remaining items before saving."
        )

    # Freight: use provided value, or pre-fill from shipment
    freight = data.freight_inr if data.freight_inr is not None else (shipment.freight_cost_inr or 0)

    # Calculate full BOE (FOB → CIF → AV → per-part duty)
    items_data = [li.model_dump() for li in data.line_items]
    calc = calculate_boe(
        exchange_rate=exchange_rate,
        freight_inr=freight,
        insurance_inr=data.insurance_inr,  # None = auto 1.125%
        line_items=items_data,
    )

    boe = BillOfEntry(
        shipment_id=shipment_id,
        order_id=shipment.order_id,
        be_number=data.be_number,
        be_date=data.be_date,
        port_of_import=data.port_of_import or shipment.port_of_discharge,
        cha_id=data.cha_id or shipment.cha_id,
        exchange_rate_usd_inr=exchange_rate,
        fob_usd=0,  # not used in current flow
        fob_inr=calc["fob_inr"],
        freight_inr=calc["freight_inr"],
        insurance_inr=calc["insurance_inr"],
        cif_inr=calc["cif_inr"],
        landing_charges_inr=calc["landing_charges_inr"],
        assessment_value_inr=calc["assessment_value_inr"],
        total_bcd=calc["total_bcd"],
        total_swc=calc["total_swc"],
        total_igst=calc["total_igst"],
        total_duty=calc["total_duty"],
        status=data.status or "DRAFT",
        notes=data.notes,
    )
    db.add(boe)
    db.flush()

    for li_obj in _build_boe_line_items(boe.id, calc):
        db.add(li_obj)

    db.commit()
    db.refresh(boe)
    return _serialize_boe(boe, db)


@router.put("/boe/{boe_id}/")
def update_boe(boe_id: str, data: BoeCreateUpdate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    """Update BOE header + recalculate + replace line items."""
    boe = db.query(BillOfEntry).filter(BillOfEntry.id == boe_id).first()
    if not boe:
        raise HTTPException(404, "BOE not found")

    if data.be_number is not None:
        boe.be_number = data.be_number
    if data.be_date is not None:
        boe.be_date = data.be_date
    if data.port_of_import is not None:
        boe.port_of_import = data.port_of_import
    if data.cha_id is not None:
        boe.cha_id = data.cha_id
    if data.status is not None:
        boe.status = data.status
    if data.notes is not None:
        boe.notes = data.notes

    exchange_rate = data.exchange_rate if data.exchange_rate is not None else (boe.exchange_rate_usd_inr or 0)
    boe.exchange_rate_usd_inr = exchange_rate

    freight = data.freight_inr if data.freight_inr is not None else boe.freight_inr

    # Validate: all physical (non-compensation) packing list items must be included
    if data.line_items:
        total_si = _count_physical_shipment_items(boe.shipment_id, db)
        included_si_ids = set(li.shipment_item_id for li in data.line_items if li.shipment_item_id)
        if len(included_si_ids) < total_si:
            raise HTTPException(
                400,
                f"All packing list items must be included. "
                f"Got {len(included_si_ids)} of {total_si} items. "
                f"Add remaining items before saving."
            )

    # Build items data for recalculation
    if data.line_items:
        items_data = [li.model_dump() for li in data.line_items]
    else:
        items_data = [
            {
                "shipment_item_id": li.shipment_item_id,
                "product_name": li.product_name,
                "product_code": li.product_code,
                "hsn_code": li.hsn_code, "description": li.description,
                "quantity": li.quantity, "unit_price": li.unit_price,
                "assessable_value_inr": li.assessable_value_inr,
                "bcd_rate": li.bcd_rate, "igst_rate": li.igst_rate, "swc_rate": li.swc_rate,
            }
            for li in boe.line_items
        ]

    calc = calculate_boe(
        exchange_rate=exchange_rate,
        freight_inr=freight,
        insurance_inr=data.insurance_inr if data.insurance_inr is not None else boe.insurance_inr,
        line_items=items_data,
    )

    boe.fob_inr = calc["fob_inr"]
    boe.freight_inr = calc["freight_inr"]
    boe.insurance_inr = calc["insurance_inr"]
    boe.cif_inr = calc["cif_inr"]
    boe.landing_charges_inr = calc["landing_charges_inr"]
    boe.assessment_value_inr = calc["assessment_value_inr"]
    boe.total_bcd = calc["total_bcd"]
    boe.total_swc = calc["total_swc"]
    boe.total_igst = calc["total_igst"]
    boe.total_duty = calc["total_duty"]

    # Replace line items if provided
    if data.line_items:
        db.query(BoeLineItem).filter(BoeLineItem.boe_id == boe.id).delete()
        for li_obj in _build_boe_line_items(boe.id, calc):
            db.add(li_obj)

    db.commit()
    db.refresh(boe)
    return _serialize_boe(boe, db)


@router.delete("/boe/{boe_id}/")
def delete_boe(boe_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    boe = db.query(BillOfEntry).filter(BillOfEntry.id == boe_id).first()
    if not boe:
        raise HTTPException(404, "BOE not found")
    if boe.status != "DRAFT":
        raise HTTPException(400, "Can only delete DRAFT BOEs")
    db.delete(boe)
    db.commit()
    return {"ok": True}


# ========================================
# Milestones (existing contract)
# ========================================

@router.get("/{order_id}/milestones/")
def list_milestones(order_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    milestones = db.query(CustomsMilestone).filter(
        CustomsMilestone.order_id == order_id
    ).order_by(CustomsMilestone.milestone_date).all()
    return [
        {
            "id": m.id, "milestone": m.milestone, "status": m.status,
            "milestone_date": m.milestone_date.isoformat() if m.milestone_date else None,
            "notes": m.notes,
        }
        for m in milestones
    ]


@router.post("/{order_id}/milestones/", status_code=201)
def add_milestone(order_id: str, data: MilestoneCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    m = CustomsMilestone(
        order_id=order_id,
        milestone=data.milestone,
        milestone_date=data.milestone_date,
        notes=data.notes,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "milestone": m.milestone}


# ========================================
# Clearance Charges (existing contract)
# ========================================

@router.get("/{order_id}/charges/")
def get_charges(order_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    c = db.query(ClearanceCharges).filter(ClearanceCharges.order_id == order_id).first()
    if not c:
        return None
    return {
        "id": c.id, "order_id": c.order_id,
        "bcd_amount": c.bcd_amount, "sws_amount": c.sws_amount, "igst_amount": c.igst_amount,
        "cha_fees": c.cha_fees, "cfs_charges": c.cfs_charges, "thc_charges": c.thc_charges,
        "insurance_inr": c.insurance_inr, "transport_cost": c.transport_cost,
        "other_charges": c.other_charges, "notes": c.notes,
    }


@router.post("/{order_id}/charges/")
def save_charges(order_id: str, data: ChargesSave, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    _require_internal(current_user)
    c = db.query(ClearanceCharges).filter(ClearanceCharges.order_id == order_id).first()
    if not c:
        c = ClearanceCharges(order_id=order_id)
        db.add(c)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "order_id": c.order_id}
