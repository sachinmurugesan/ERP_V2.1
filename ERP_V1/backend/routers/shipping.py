"""
HarvestERP - Shipping & Logistics Router (Level 6)
Service Provider CRUD, Container Booking, Sailing Phases, Shipping Documents.
"""
import json
from math import ceil
from datetime import date
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
import mimetypes

from database import get_db
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE
from core.file_upload import sanitize_filename, stream_upload_to_disk
from core.security import get_current_user, CurrentUser
from enums import ServiceProviderType, ShippingDocType, SailingPhase
from models import (
    ServiceProvider, Shipment, ShipmentItem, ShippingDocument,
    Order, OrderItem, PackingListItem, Factory, Client,
)

router = APIRouter()


# ========================================
# Pydantic Schemas — Service Provider
# ========================================

class ServiceProviderCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    roles: List[str] = []
    operating_ports: List[str] = Field(default=[], max_length=100)
    notes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: List[str]) -> List[str]:
        valid = {e.value for e in ServiceProviderType}
        for role in v:
            if role not in valid:
                raise ValueError(f"Invalid role '{role}'. Must be one of {sorted(valid)}")
        return v


class ServiceProviderUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    roles: Optional[List[str]] = None
    operating_ports: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        valid = {e.value for e in ServiceProviderType}
        for role in v:
            if role not in valid:
                raise ValueError(f"Invalid role '{role}'. Must be one of {sorted(valid)}")
        return v


def _serialize_provider(p: ServiceProvider) -> dict:
    """Serialize a ServiceProvider to dict, parsing JSON fields."""
    return {
        "id": p.id,
        "name": p.name,
        "contact_person": p.contact_person,
        "phone": p.phone,
        "email": p.email,
        "address": p.address,
        "city": p.city,
        "state": p.state,
        "country": p.country,
        "bank_name": p.bank_name,
        "bank_account": p.bank_account,
        "ifsc_code": p.ifsc_code,
        "gst_number": p.gst_number,
        "pan_number": p.pan_number,
        "roles": json.loads(p.roles) if p.roles else [],
        "operating_ports": json.loads(p.operating_ports) if p.operating_ports else [],
        "notes": p.notes,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ========================================
# Service Provider CRUD Endpoints
# ========================================

@router.get("/transport/")
def list_service_providers(
    role: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List service providers, optionally filtered by role or search text."""
    query = db.query(ServiceProvider)

    if active_only:
        query = query.filter(ServiceProvider.is_active == True)

    if role:
        # Validate role
        valid = {e.value for e in ServiceProviderType}
        if role not in valid:
            raise HTTPException(400, f"Invalid role '{role}'. Must be one of {sorted(valid)}")
        # JSON text search — roles is stored as '["FREIGHT_FORWARDER","CHA"]'
        query = query.filter(ServiceProvider.roles.contains(f'"{role}"'))

    if search:
        term = f"%{search}%"
        query = query.filter(
            ServiceProvider.name.ilike(term)
            | ServiceProvider.contact_person.ilike(term)
            | ServiceProvider.city.ilike(term)
        )

    total = query.count()
    providers = query.order_by(ServiceProvider.name).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [_serialize_provider(p) for p in providers],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.post("/transport/")
def create_service_provider(
    data: ServiceProviderCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new service provider."""
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    sp = ServiceProvider(
        name=data.name,
        contact_person=data.contact_person,
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        state=data.state,
        country=data.country,
        bank_name=data.bank_name,
        bank_account=data.bank_account,
        ifsc_code=data.ifsc_code,
        gst_number=data.gst_number,
        pan_number=data.pan_number,
        roles=json.dumps(data.roles) if data.roles else None,
        operating_ports=json.dumps(data.operating_ports) if data.operating_ports else None,
        notes=data.notes,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return _serialize_provider(sp)


@router.get("/transport/{provider_id}")
def get_service_provider(provider_id: str, db: Session = Depends(get_db)):
    """Get a single service provider by ID."""
    sp = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not sp:
        raise HTTPException(404, "Service provider not found")
    return _serialize_provider(sp)


@router.put("/transport/{provider_id}")
def update_service_provider(
    provider_id: str,
    data: ServiceProviderUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a service provider."""
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    sp = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not sp:
        raise HTTPException(404, "Service provider not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "roles":
            setattr(sp, key, json.dumps(value) if value is not None else None)
        elif key == "operating_ports":
            setattr(sp, key, json.dumps(value) if value is not None else None)
        else:
            setattr(sp, key, value)

    db.commit()
    db.refresh(sp)
    return _serialize_provider(sp)


@router.delete("/transport/{provider_id}")
def delete_service_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Soft-delete a service provider (set is_active=False)."""
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    sp = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not sp:
        raise HTTPException(404, "Service provider not found")
    sp.is_active = False
    db.commit()
    return {"detail": "Service provider deactivated"}


# ========================================
# Pydantic Schemas — Shipment / Container Booking
# ========================================

class ShipmentCreate(BaseModel):
    container_type: Optional[str] = None
    container_number: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    freight_forwarder_id: Optional[str] = None
    cha_id: Optional[str] = None
    cfs_id: Optional[str] = None
    transport_id: Optional[str] = None
    freight_cost_inr: float = 0
    thc_inr: float = 0
    doc_fees_inr: float = 0
    notes: Optional[str] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    description_of_goods: Optional[str] = None
    freight_terms: Optional[str] = None


class ShipmentUpdate(BaseModel):
    container_type: Optional[str] = None
    container_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    bl_number: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    etd: Optional[date] = None
    eta: Optional[date] = None
    freight_forwarder_id: Optional[str] = None
    cha_id: Optional[str] = None
    cfs_id: Optional[str] = None
    transport_id: Optional[str] = None
    freight_cost_inr: Optional[float] = None
    thc_inr: Optional[float] = None
    doc_fees_inr: Optional[float] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    description_of_goods: Optional[str] = None
    freight_terms: Optional[str] = None


class ItemAllocation(BaseModel):
    packing_list_item_id: str
    allocated_qty: int
    pallet_number: Optional[str] = None


def _provider_name(db: Session, provider_id: Optional[str]) -> Optional[str]:
    """Look up a provider name by ID, returning None if not found."""
    if not provider_id:
        return None
    sp = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    return sp.name if sp else None


def _serialize_shipment(s: Shipment, db: Session) -> dict:
    """Serialize a Shipment with provider name lookups and item list."""
    items = []
    for si in s.items:
        item_data = {
            "id": si.id,
            "shipment_id": si.shipment_id,
            "packing_list_item_id": si.packing_list_item_id,
            "allocated_qty": si.allocated_qty,
            "pallet_number": si.pallet_number,
        }
        # Attach packing list item detail
        pli = db.query(PackingListItem).filter(PackingListItem.id == si.packing_list_item_id).first()
        if pli:
            oi = db.query(OrderItem).filter(OrderItem.id == pli.order_item_id).first()
            item_data["product_name"] = oi.product_name_snapshot if oi else None
            item_data["product_code"] = oi.product_code_snapshot if oi else None
            item_data["ordered_qty"] = pli.ordered_qty
            item_data["factory_ready_qty"] = pli.factory_ready_qty
        items.append(item_data)

    return {
        "id": s.id,
        "order_id": s.order_id,
        "container_type": s.container_type,
        "container_number": s.container_number,
        "vessel_name": s.vessel_name,
        "voyage_number": s.voyage_number,
        "bl_number": s.bl_number,
        "port_of_loading": s.port_of_loading,
        "port_of_discharge": s.port_of_discharge,
        "etd": s.etd.isoformat() if s.etd else None,
        "eta": s.eta.isoformat() if s.eta else None,
        "atd": s.atd.isoformat() if s.atd else None,
        "ata": s.ata.isoformat() if s.ata else None,
        # Frontend aliases
        "actual_departure_date": s.atd.isoformat() if s.atd else None,
        "actual_arrival_date": s.ata.isoformat() if s.ata else None,
        "phase": s.sailing_phase,
        "freight_cost_inr": s.freight_cost_inr,
        "thc_inr": s.thc_inr,
        "doc_fees_inr": s.doc_fees_inr,
        "sailing_phase": s.sailing_phase,
        # HBL
        "shipper": s.shipper,
        "consignee": s.consignee,
        "notify_party": s.notify_party,
        "description_of_goods": s.description_of_goods,
        "freight_terms": s.freight_terms,
        "seal_number": s.seal_number,
        "loading_date": s.loading_date.isoformat() if s.loading_date else None,
        "loading_notes": s.loading_notes,
        "cfs_receipt_number": s.cfs_receipt_number,
        "arrival_notes": s.arrival_notes,
        # Providers
        "freight_forwarder_id": s.freight_forwarder_id,
        "freight_forwarder_name": _provider_name(db, s.freight_forwarder_id),
        "cha_id": s.cha_id,
        "cha_name": _provider_name(db, s.cha_id),
        "cfs_id": s.cfs_id,
        "cfs_name": _provider_name(db, s.cfs_id),
        "transport_id": s.transport_id,
        "transport_name": _provider_name(db, s.transport_id),
        # Items
        "items": items,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ========================================
# Container Booking Endpoints
# ========================================

@router.get("/orders/{order_id}/shipments/")
def list_shipments(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all shipments for an order."""
    if current_user.user_type == "CLIENT":
        client = db.query(Client).filter(Client.id == current_user.client_id).first()
        if not client:
            raise HTTPException(status_code=403, detail="Access denied")
        perms = client.portal_permissions or {}
        if not perms.get("show_shipping", False):
            raise HTTPException(status_code=403, detail="Shipping access not enabled for your account")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    shipments = db.query(Shipment).filter(Shipment.order_id == order_id).all()
    return [_serialize_shipment(s, db) for s in shipments]


@router.post("/orders/{order_id}/shipments/")
def create_shipment(order_id: str, data: ShipmentCreate, db: Session = Depends(get_db)):
    """Create a new shipment (container booking) for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    # Auto-fill shipper from factory, consignee from client
    shipper_text = None
    consignee_text = None
    if order.factory_id:
        factory = db.query(Factory).filter(Factory.id == order.factory_id).first()
        if factory:
            parts = [factory.company_name]
            if factory.address:
                parts.append(factory.address)
            if factory.city:
                parts.append(factory.city)
            if factory.province:
                parts.append(factory.province)
            if factory.country:
                parts.append(factory.country)
            shipper_text = "\n".join(parts)

    if order.client_id:
        client = db.query(Client).filter(Client.id == order.client_id).first()
        if client:
            parts = [client.company_name]
            if client.address:
                parts.append(client.address)
            if client.city:
                parts.append(client.city)
            if client.state:
                parts.append(client.state)
            if client.pincode:
                parts.append(client.pincode)
            consignee_text = "\n".join(parts)

    shipment = Shipment(
        order_id=order_id,
        container_type=data.container_type,
        container_number=data.container_number,
        port_of_loading=data.port_of_loading or (
            (lambda f: f.port_of_loading if f else None)(
                db.query(Factory).filter(Factory.id == order.factory_id).first()
            ) if order.factory_id else None
        ),
        port_of_discharge=data.port_of_discharge,
        etd=data.etd,
        eta=data.eta,
        freight_forwarder_id=data.freight_forwarder_id,
        cha_id=data.cha_id,
        cfs_id=data.cfs_id,
        transport_id=data.transport_id,
        freight_cost_inr=data.freight_cost_inr,
        thc_inr=data.thc_inr,
        doc_fees_inr=data.doc_fees_inr,
        shipper=data.shipper or shipper_text,
        consignee=data.consignee or consignee_text,
        notify_party=data.notify_party or consignee_text,
        description_of_goods=data.description_of_goods,
        freight_terms=data.freight_terms,
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment, db)


@router.put("/shipments/{shipment_id}/")
def update_shipment(shipment_id: str, data: ShipmentUpdate, db: Session = Depends(get_db)):
    """Update shipment details."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(shipment, key, value)

    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment, db)


@router.delete("/shipments/{shipment_id}/")
def delete_shipment(shipment_id: str, db: Session = Depends(get_db)):
    """Delete a shipment and its item allocations."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    if shipment.sailing_phase:
        raise HTTPException(400, "Cannot delete a shipment that has entered a sailing phase")

    # Delete item allocations first
    db.query(ShipmentItem).filter(ShipmentItem.shipment_id == shipment_id).delete()
    db.delete(shipment)
    db.commit()
    return {"detail": "Shipment deleted"}


# ========================================
# Item Allocation Endpoints
# ========================================

@router.post("/shipments/{shipment_id}/items/")
def allocate_items(
    shipment_id: str,
    items: List[ItemAllocation],
    db: Session = Depends(get_db),
):
    """Allocate packing list items to a shipment container."""
    if len(items) > 500:
        raise HTTPException(status_code=400, detail="Too many items (max 500)")
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    created = []
    for item in items:
        pli = db.query(PackingListItem).filter(PackingListItem.id == item.packing_list_item_id).first()
        if not pli:
            raise HTTPException(404, f"Packing list item {item.packing_list_item_id} not found")

        # Check total allocated across all shipments does not exceed factory_ready_qty
        already_allocated = (
            db.query(ShipmentItem)
            .filter(ShipmentItem.packing_list_item_id == item.packing_list_item_id)
            .all()
        )
        total_existing = sum(si.allocated_qty for si in already_allocated)
        if total_existing + item.allocated_qty > pli.factory_ready_qty:
            raise HTTPException(
                400,
                f"Cannot allocate {item.allocated_qty} — only {pli.factory_ready_qty - total_existing} remaining"
            )

        si = ShipmentItem(
            shipment_id=shipment_id,
            packing_list_item_id=item.packing_list_item_id,
            allocated_qty=item.allocated_qty,
            pallet_number=item.pallet_number,
        )
        db.add(si)
        created.append(si)

    db.commit()
    for si in created:
        db.refresh(si)

    return {"detail": f"Allocated {len(created)} items", "count": len(created)}


@router.put("/shipments/{shipment_id}/items/{item_id}")
def update_shipment_item(
    shipment_id: str,
    item_id: str,
    data: ItemAllocation,
    db: Session = Depends(get_db),
):
    """Update an item allocation (qty or pallet number)."""
    si = db.query(ShipmentItem).filter(
        ShipmentItem.id == item_id,
        ShipmentItem.shipment_id == shipment_id,
    ).first()
    if not si:
        raise HTTPException(404, "Shipment item not found")

    pli = db.query(PackingListItem).filter(PackingListItem.id == data.packing_list_item_id).first()
    if not pli:
        raise HTTPException(404, "Packing list item not found")

    # Check allocation does not exceed ready qty (excluding current)
    already_allocated = (
        db.query(ShipmentItem)
        .filter(
            ShipmentItem.packing_list_item_id == data.packing_list_item_id,
            ShipmentItem.id != item_id,
        )
        .all()
    )
    total_other = sum(s.allocated_qty for s in already_allocated)
    if total_other + data.allocated_qty > pli.factory_ready_qty:
        raise HTTPException(
            400,
            f"Cannot allocate {data.allocated_qty} — only {pli.factory_ready_qty - total_other} remaining"
        )

    si.packing_list_item_id = data.packing_list_item_id
    si.allocated_qty = data.allocated_qty
    si.pallet_number = data.pallet_number
    db.commit()
    db.refresh(si)
    return {"detail": "Item updated"}


@router.delete("/shipments/{shipment_id}/items/{item_id}")
def delete_shipment_item(shipment_id: str, item_id: str, db: Session = Depends(get_db)):
    """Remove an item from a shipment."""
    si = db.query(ShipmentItem).filter(
        ShipmentItem.id == item_id,
        ShipmentItem.shipment_id == shipment_id,
    ).first()
    if not si:
        raise HTTPException(404, "Shipment item not found")
    db.delete(si)
    db.commit()
    return {"detail": "Item removed from shipment"}


# ========================================
# Sailing Phase Schemas
# ========================================

class LoadedData(BaseModel):
    seal_number: Optional[str] = None
    loading_date: Optional[date] = None
    loading_notes: Optional[str] = None


class SailedData(BaseModel):
    container_number: Optional[str] = None
    seal_number: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    bl_number: Optional[str] = None
    atd: Optional[date] = None
    eta: Optional[date] = None
    # Frontend aliases
    actual_departure_date: Optional[date] = None
    revised_eta: Optional[date] = None


class ArrivedData(BaseModel):
    ata: Optional[date] = None
    actual_arrival_date: Optional[date] = None  # Frontend alias
    cfs_receipt_number: Optional[str] = None
    arrival_notes: Optional[str] = None


# ========================================
# Sailing Phase Endpoints
# ========================================

@router.put("/shipments/{shipment_id}/phase/loaded/")
def mark_loaded(shipment_id: str, data: LoadedData, db: Session = Depends(get_db)):
    """Transition shipment to LOADED phase."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    if shipment.sailing_phase and shipment.sailing_phase != SailingPhase.LOADED.value:
        raise HTTPException(400, f"Cannot revert to LOADED from {shipment.sailing_phase}")

    shipment.sailing_phase = SailingPhase.LOADED.value
    if data.seal_number is not None:
        shipment.seal_number = data.seal_number
    if data.loading_date is not None:
        shipment.loading_date = data.loading_date
    if data.loading_notes is not None:
        shipment.loading_notes = data.loading_notes

    # Update packing list loaded_qty from shipment items
    for si in shipment.items:
        pli = db.query(PackingListItem).filter(PackingListItem.id == si.packing_list_item_id).first()
        if pli:
            pli.loaded_qty = si.allocated_qty

    # Auto-create 4 PENDING shipping docs if none exist
    existing_docs = db.query(ShippingDocument).filter(
        ShippingDocument.shipment_id == shipment_id,
    ).count()
    if existing_docs == 0:
        for doc_type in [ShippingDocType.BOL, ShippingDocType.COO, ShippingDocType.CI, ShippingDocType.PL]:
            doc = ShippingDocument(
                order_id=shipment.order_id,
                shipment_id=shipment_id,
                document_type=doc_type.value,
                status="PENDING",
            )
            db.add(doc)

    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment, db)


@router.put("/shipments/{shipment_id}/phase/sailed/")
def mark_sailed(shipment_id: str, data: SailedData, db: Session = Depends(get_db)):
    """Transition shipment to SAILED phase."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    if shipment.sailing_phase not in (SailingPhase.LOADED.value, SailingPhase.SAILED.value):
        raise HTTPException(400, "Shipment must be LOADED before marking SAILED")

    shipment.sailing_phase = SailingPhase.SAILED.value
    if data.container_number is not None:
        shipment.container_number = data.container_number
    if data.seal_number is not None:
        shipment.seal_number = data.seal_number
    if data.vessel_name is not None:
        shipment.vessel_name = data.vessel_name
    if data.voyage_number is not None:
        shipment.voyage_number = data.voyage_number
    if data.bl_number is not None:
        shipment.bl_number = data.bl_number
    # Accept both atd and actual_departure_date (frontend alias)
    _atd = data.atd or data.actual_departure_date
    if _atd is not None:
        shipment.atd = _atd
    _eta = data.eta or data.revised_eta
    if _eta is not None:
        shipment.eta = _eta

    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment, db)


@router.put("/shipments/{shipment_id}/phase/arrived/")
def mark_arrived(shipment_id: str, data: ArrivedData, db: Session = Depends(get_db)):
    """Transition shipment to ARRIVED phase."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    if shipment.sailing_phase not in (SailingPhase.SAILED.value, SailingPhase.ARRIVED.value):
        raise HTTPException(400, "Shipment must be SAILED before marking ARRIVED")

    shipment.sailing_phase = SailingPhase.ARRIVED.value
    # Accept both ata and actual_arrival_date (frontend alias)
    _ata = data.ata or data.actual_arrival_date
    if _ata is not None:
        shipment.ata = _ata
    if data.cfs_receipt_number is not None:
        shipment.cfs_receipt_number = data.cfs_receipt_number
    if data.arrival_notes is not None:
        shipment.arrival_notes = data.arrival_notes

    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment, db)


# ========================================
# Sailing Progress Endpoint
# ========================================

@router.get("/shipments/{shipment_id}/progress/")
def get_shipment_progress(shipment_id: str, db: Session = Depends(get_db)):
    """Get time-based shipping progress (0-100%) and phase info."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    progress = 0
    days_total = None
    days_elapsed = None
    days_remaining = None

    if shipment.sailing_phase == SailingPhase.ARRIVED.value:
        progress = 100
    elif shipment.atd and shipment.eta:
        total = (shipment.eta - shipment.atd).days
        elapsed = (date.today() - shipment.atd).days
        if total > 0:
            progress = min(round((elapsed / total) * 100), 99)  # Cap at 99 until ARRIVED
        else:
            progress = 99
        days_total = total
        days_elapsed = max(elapsed, 0)
        days_remaining = max(total - elapsed, 0)
    elif shipment.sailing_phase == SailingPhase.SAILED.value:
        progress = 50  # Sailed but no dates — default 50%
    elif shipment.sailing_phase == SailingPhase.LOADED.value:
        progress = 25  # Loaded but not yet sailed

    return {
        "shipment_id": shipment.id,
        "sailing_phase": shipment.sailing_phase,
        "percent": progress,
        "atd": shipment.atd.isoformat() if shipment.atd else None,
        "eta": shipment.eta.isoformat() if shipment.eta else None,
        "ata": shipment.ata.isoformat() if shipment.ata else None,
        "days_total": days_total,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
    }


# ========================================
# Shipping Documents Endpoints
# ========================================

@router.get("/orders/{order_id}/shipping-documents/")
def list_shipping_documents(order_id: str, db: Session = Depends(get_db)):
    """List all shipping documents for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    docs = db.query(ShippingDocument).filter(ShippingDocument.order_id == order_id).all()
    return [
        {
            "id": d.id,
            "order_id": d.order_id,
            "shipment_id": d.shipment_id,
            "document_type": d.document_type,
            "file_path": d.file_path,
            "status": d.status,
            "received_date": d.received_date.isoformat() if d.received_date else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.put("/shipping-documents/{doc_id}/upload/")
async def upload_shipping_document(
    doc_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a file for a shipping document."""
    doc = db.query(ShippingDocument).filter(ShippingDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Shipping document not found")

    # Build safe destination path
    safe_name = f"{doc.document_type}_{sanitize_filename(file.filename)}"
    file_path = UPLOAD_DIR / "shipping" / doc.order_id / safe_name

    # Stream to disk (shared utility handles chunking + size validation + cleanup)
    await stream_upload_to_disk(file, file_path, MAX_UPLOAD_SIZE)

    doc.file_path = f"shipping/{doc.order_id}/{safe_name}"
    doc.status = "RECEIVED"
    doc.received_date = date.today()
    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "file_path": doc.file_path,
        "status": doc.status,
        "received_date": doc.received_date.isoformat() if doc.received_date else None,
    }


@router.put("/shipping-documents/{doc_id}/status/")
def update_shipping_document_status(
    doc_id: str,
    status: str = Query(..., description="PENDING or RECEIVED"),
    received_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Update a shipping document status (e.g. mark as RECEIVED without upload)."""
    doc = db.query(ShippingDocument).filter(ShippingDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Shipping document not found")

    if status not in ("PENDING", "RECEIVED"):
        raise HTTPException(400, "Status must be PENDING or RECEIVED")

    doc.status = status
    if status == "RECEIVED":
        doc.received_date = received_date or date.today()
    elif status == "PENDING":
        doc.received_date = None

    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "status": doc.status,
        "received_date": doc.received_date.isoformat() if doc.received_date else None,
    }


@router.get("/shipping-documents/{doc_id}/download/")
def download_shipping_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Authenticated download of a shipping document file (BOL, COO, CI, PL).
    CLIENT users require the show_shipping portal permission on their own orders.
    FACTORY users are blocked. INTERNAL users pass through.
    """
    doc = db.query(ShippingDocument).filter(ShippingDocument.id == doc_id).first()
    if not doc or not doc.file_path:
        raise HTTPException(status_code=404, detail="Document not found")

    order = db.query(Order).filter(Order.id == doc.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.user_type == "FACTORY":
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.user_type == "CLIENT":
        if order.client_id != current_user.client_id:
            raise HTTPException(status_code=403, detail="Access denied")
        client = db.query(Client).filter(Client.id == current_user.client_id).first()
        perms = (client.portal_permissions or {}) if client else {}
        if not perms.get("show_shipping", False):
            raise HTTPException(status_code=403, detail="Shipping access not enabled for your account")

    full_path = UPLOAD_DIR / doc.file_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    filename = Path(doc.file_path).name
    mime_type = mimetypes.guess_type(str(full_path))[0] or "application/octet-stream"
    return FileResponse(path=str(full_path), filename=filename, media_type=mime_type)
