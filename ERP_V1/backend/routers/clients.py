"""Client Master API endpoints"""
from datetime import datetime
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from core.security import CurrentUser, get_current_user
from database import get_db
from models import Client
from schemas.clients import (
    ClientCreate, ClientOut, ClientResponse,
    ClientListResponse, PortalPermissionsUpdate,
)

router = APIRouter()


# ========================================
# Endpoints
# ========================================
@router.get("/", response_model=ClientListResponse)
def list_clients(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """List clients with search and pagination"""
    query = db.query(Client).filter(
        Client.is_active == True,
        Client.deleted_at.is_(None)
    )

    if search:
        query = query.filter(
            or_(
                Client.company_name.ilike(f"%{search}%"),
                Client.gstin.ilike(f"%{search}%"),
                Client.city.ilike(f"%{search}%"),
                Client.contact_name.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    clients = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [ClientOut.model_validate(c) for c in clients],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.get("/search/")
def search_clients(q: str, db: Session = Depends(get_db)):
    """Quick search for client selector (used in order creation)"""
    clients = db.query(Client).filter(
        Client.is_active == True,
        Client.deleted_at.is_(None),
        or_(
            Client.company_name.ilike(f"%{q}%"),
            Client.gstin.ilike(f"%{q}%"),
        )
    ).limit(20).all()

    return [ClientOut.model_validate(c) for c in clients]


@router.get("/{client_id}/", response_model=ClientResponse)
def get_client(client_id: str, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientOut.model_validate(client)


@router.post("/", response_model=ClientResponse)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    # Company name uniqueness check
    existing = db.query(Client).filter(
        Client.company_name == data.company_name,
        Client.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Client company name already exists")

    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return ClientOut.model_validate(client)


@router.put("/{client_id}/", response_model=ClientResponse)
def update_client(
    client_id: str,
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Check name uniqueness (exclude self)
    existing = db.query(Client).filter(
        Client.company_name == data.company_name,
        Client.id != client_id,
        Client.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Client company name already exists")

    # Markup lock: block changes to factory_markup_percent or client_type
    # when orders are in progress (PENDING_PI through DELIVERED)
    from models import Order
    from enums import OrderStatus
    _locked_stages = {
        OrderStatus.PENDING_PI.value, OrderStatus.PI_SENT.value,
        OrderStatus.ADVANCE_PENDING.value, OrderStatus.ADVANCE_RECEIVED.value,
        OrderStatus.FACTORY_ORDERED.value,
        OrderStatus.PRODUCTION_60.value, OrderStatus.PRODUCTION_80.value,
        OrderStatus.PRODUCTION_90.value, OrderStatus.PLAN_PACKING.value,
        OrderStatus.FINAL_PI.value, OrderStatus.PRODUCTION_100.value,
        OrderStatus.BOOKED.value, OrderStatus.LOADED.value, OrderStatus.SAILED.value,
        OrderStatus.ARRIVED.value, OrderStatus.CUSTOMS_FILED.value, OrderStatus.CLEARED.value,
        OrderStatus.DELIVERED.value,
    }

    _markup_changing = (
        data.factory_markup_percent is not None
        and data.factory_markup_percent != client.factory_markup_percent
    )
    _type_downgrading = (
        client.client_type == "TRANSPARENCY"
        and data.client_type is not None
        and data.client_type == "REGULAR"
    )

    if _markup_changing or _type_downgrading:
        _active = db.query(Order).filter(
            Order.client_id == client_id,
            Order.status.in_(_locked_stages),
            Order.deleted_at.is_(None),
        ).first()
        if _active:
            raise HTTPException(
                status_code=400,
                detail="Cannot change markup or client type while orders are in progress. "
                       "Complete or cancel active orders first."
            )

    for key, value in data.model_dump().items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)
    return ClientOut.model_validate(client)


@router.delete("/{client_id}/")
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.deleted_at = datetime.utcnow()
    client.is_active = False
    db.commit()
    return {"message": "Client deleted"}


@router.get("/{client_id}/categories/")
def get_client_categories(
    client_id: str,
    db: Session = Depends(get_db),
):
    """Get assigned product categories for a client."""
    from models import ClientCategoryAccess
    records = db.query(ClientCategoryAccess).filter(
        ClientCategoryAccess.client_id == client_id
    ).all()
    return {"categories": [r.category for r in records]}


@router.put("/{client_id}/categories/")
def set_client_categories(
    client_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    """Bulk set assigned product categories for a client."""
    from models import ClientCategoryAccess, Client

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    categories = body.get("categories", [])

    # Delete existing
    db.query(ClientCategoryAccess).filter(
        ClientCategoryAccess.client_id == client_id
    ).delete()

    # Insert new
    for cat in categories:
        if cat and isinstance(cat, str):
            db.add(ClientCategoryAccess(
                client_id=client_id,
                category=cat.strip(),
            ))

    db.commit()
    return {"categories": categories, "count": len(categories)}


@router.get("/{client_id}/brands/")
def get_client_brands(
    client_id: str,
    db: Session = Depends(get_db),
):
    """Get assigned product brands for a client."""
    from models import ClientBrandAccess
    records = db.query(ClientBrandAccess).filter(
        ClientBrandAccess.client_id == client_id
    ).all()
    brands = [r.brand for r in records]
    include_no_brand = any(r.include_no_brand for r in records)
    return {"brands": brands, "include_no_brand": include_no_brand}


@router.put("/{client_id}/brands/")
def set_client_brands(
    client_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    """Bulk set assigned product brands for a client."""
    from models import ClientBrandAccess

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    brands = body.get("brands", [])
    include_no_brand = body.get("include_no_brand", False)

    # Delete existing
    db.query(ClientBrandAccess).filter(
        ClientBrandAccess.client_id == client_id
    ).delete()

    # Insert new
    for brand in brands:
        if brand and isinstance(brand, str):
            db.add(ClientBrandAccess(
                client_id=client_id,
                brand=brand.strip(),
                include_no_brand=include_no_brand,
            ))

    # If include_no_brand but no brands selected, add a marker record
    if include_no_brand and not brands:
        db.add(ClientBrandAccess(
            client_id=client_id,
            brand="__NO_BRAND__",
            include_no_brand=True,
        ))

    db.commit()
    return {"brands": brands, "include_no_brand": include_no_brand}


@router.get("/{client_id}/product-access/")
def get_client_product_access(
    client_id: str,
    db: Session = Depends(get_db),
):
    """Get per-product access exceptions for a client."""
    from models import ClientProductAccess, Product
    records = db.query(ClientProductAccess).filter(
        ClientProductAccess.client_id == client_id
    ).all()

    result = []
    for r in records:
        product = db.query(Product).filter(Product.id == r.product_id).first()
        result.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_code": product.product_code if product else None,
            "product_name": product.product_name if product else None,
            "brand": product.brand if product else None,
            "added_via": r.added_via,
            "source_code": r.source_code,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"products": result, "total": len(result)}


# ========================================
# Portal Permissions
# ========================================

_DEFAULT_PORTAL_PERMISSIONS = {
    "show_payments": False,
    "show_production": False,
    "show_shipping": False,
    "show_after_sales": False,
    "show_files": False,
    "show_packing": False,
    "items_add": False,
    "items_bulk_add": False,
    "items_fetch_pending": False,
    "items_upload_excel": False,
    "items_edit_qty": False,
    "items_remove": False,
}


@router.get("/{client_id}/portal-permissions/")
def get_portal_permissions(client_id: str, db: Session = Depends(get_db)):
    """Get client portal tab permissions."""
    client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    perms = client.portal_permissions or _DEFAULT_PORTAL_PERMISSIONS
    # Ensure all keys exist (forward-compatible if new permissions added later)
    merged = {**_DEFAULT_PORTAL_PERMISSIONS, **perms}
    return merged


@router.put("/{client_id}/portal-permissions/")
def update_portal_permissions(
    client_id: str,
    data: PortalPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    """Update client portal tab permissions."""
    client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.portal_permissions = data.model_dump()
    db.commit()
    return client.portal_permissions
