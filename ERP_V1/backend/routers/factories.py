"""Factory/Supplier Master API endpoints"""
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import Factory
from schemas.factories import (
    FactoryCreate, FactoryOut, FactoryResponse,
    FactoryListResponse,
)
from core.security import CurrentUser, get_current_user

router = APIRouter()


# ========================================
# Endpoints
# ========================================
@router.get("/", response_model=FactoryListResponse)
def list_factories(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """List factories with search and pagination"""
    query = db.query(Factory).filter(
        Factory.is_active == True,
        Factory.deleted_at.is_(None)
    )

    if search:
        query = query.filter(
            or_(
                Factory.factory_code.ilike(f"%{search}%"),
                Factory.company_name.ilike(f"%{search}%"),
                Factory.city.ilike(f"%{search}%"),
                Factory.port_of_loading.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    factories = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [FactoryOut.model_validate(f) for f in factories],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.get("/search/")
def search_factories(q: str, db: Session = Depends(get_db)):
    """Quick search for factory selector (used in order creation)"""
    factories = db.query(Factory).filter(
        Factory.is_active == True,
        Factory.deleted_at.is_(None),
        or_(
            Factory.factory_code.ilike(f"%{q}%"),
            Factory.company_name.ilike(f"%{q}%"),
        )
    ).limit(20).all()

    return [FactoryOut.model_validate(f) for f in factories]


@router.get("/{factory_id}/", response_model=FactoryResponse)
def get_factory(factory_id: str, db: Session = Depends(get_db)):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")
    return FactoryOut.model_validate(factory)


@router.post("/", response_model=FactoryResponse)
def create_factory(
    data: FactoryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin access required")
    # Unique factory code check
    existing = db.query(Factory).filter(
        Factory.factory_code == data.factory_code,
        Factory.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Factory code already exists")

    factory = Factory(**data.model_dump())
    db.add(factory)
    db.commit()
    db.refresh(factory)
    return FactoryOut.model_validate(factory)


@router.put("/{factory_id}/", response_model=FactoryResponse)
def update_factory(
    factory_id: str,
    data: FactoryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or Operations access required")
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    # Check code uniqueness (exclude self)
    existing = db.query(Factory).filter(
        Factory.factory_code == data.factory_code,
        Factory.id != factory_id,
        Factory.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Factory code already exists")

    for key, value in data.model_dump().items():
        setattr(factory, key, value)

    db.commit()
    db.refresh(factory)
    return FactoryOut.model_validate(factory)


@router.delete("/{factory_id}/")
def delete_factory(
    factory_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.user_type != "INTERNAL":
        raise HTTPException(status_code=403, detail="Internal access only")
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super admin access required")
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    from datetime import datetime
    factory.deleted_at = datetime.utcnow()
    factory.is_active = False
    db.commit()
    return {"message": "Factory deleted"}
