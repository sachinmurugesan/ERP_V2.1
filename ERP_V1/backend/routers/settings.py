"""
Settings API — Exchange rates, category markups, system defaults, transit times.
Level 1A: Foundation module. Everything else fetches defaults from here.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import ExchangeRate, Category, SystemSetting, TransitTime

router = APIRouter()


# ========================================
# EXCHANGE RATES
# ========================================

class ExchangeRateOut(BaseModel):
    id: str
    from_currency: str
    to_currency: str
    rate: float
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class ExchangeRateUpdate(BaseModel):
    from_currency: str
    to_currency: str = "INR"
    rate: float


@router.get("/exchange-rates/")
def get_exchange_rates(db: Session = Depends(get_db)):
    """Get all exchange rates as list (for settings page)"""
    rates = db.query(ExchangeRate).all()
    return [
        ExchangeRateOut(
            id=r.id,
            from_currency=r.from_currency,
            to_currency=r.to_currency,
            rate=r.rate,
            updated_at=r.updated_at.isoformat() if r.updated_at else None,
        )
        for r in rates
    ]


@router.get("/exchange-rates/map/")
def get_exchange_rates_map(db: Session = Depends(get_db)):
    """Get exchange rates as key-value map (for quick lookup in forms)"""
    rates = db.query(ExchangeRate).all()
    return {f"{r.from_currency}_TO_{r.to_currency}": r.rate for r in rates}


@router.put("/exchange-rates/")
def update_exchange_rate(data: ExchangeRateUpdate, db: Session = Depends(get_db)):
    """Create or update an exchange rate"""
    rate = db.query(ExchangeRate).filter(
        ExchangeRate.from_currency == data.from_currency,
        ExchangeRate.to_currency == data.to_currency,
    ).first()

    if rate:
        rate.rate = data.rate
        rate.updated_at = datetime.utcnow()
    else:
        rate = ExchangeRate(
            from_currency=data.from_currency,
            to_currency=data.to_currency,
            rate=data.rate,
        )
        db.add(rate)

    db.commit()
    db.refresh(rate)
    return ExchangeRateOut(
        id=rate.id,
        from_currency=rate.from_currency,
        to_currency=rate.to_currency,
        rate=rate.rate,
        updated_at=rate.updated_at.isoformat() if rate.updated_at else None,
    )


# ========================================
# CATEGORIES & MARKUPS
# ========================================

class CategoryOut(BaseModel):
    id: str
    name: str
    markup_percent: float
    is_active: bool

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str
    markup_percent: float = 15.0


@router.get("/categories/")
def get_categories(db: Session = Depends(get_db)):
    """Get all active categories with markup %"""
    categories = db.query(Category).filter(Category.is_active == True).all()
    return [CategoryOut.model_validate(c) for c in categories]


@router.post("/categories/")
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new product category"""
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    cat = Category(name=data.name, markup_percent=data.markup_percent)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.put("/categories/{category_id}/")
def update_category(category_id: str, data: CategoryCreate, db: Session = Depends(get_db)):
    """Update category name and/or markup"""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check name uniqueness (exclude self)
    existing = db.query(Category).filter(
        Category.name == data.name, Category.id != category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    cat.name = data.name
    cat.markup_percent = data.markup_percent
    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.delete("/categories/{category_id}/")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Soft delete category"""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    db.commit()
    return {"message": "Category deleted"}


# For backward compatibility with settingsStore
@router.get("/markups/")
def get_markups(db: Session = Depends(get_db)):
    """Alias for categories — returns category markups"""
    categories = db.query(Category).filter(Category.is_active == True).all()
    return [{"id": c.id, "name": c.name, "markup_percent": c.markup_percent} for c in categories]


@router.post("/markups/")
def create_markup(data: dict, db: Session = Depends(get_db)):
    """Create a new category with markup"""
    name = data.get("name", "").strip()
    markup = data.get("markup_percent", 15.0)
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = Category(name=name, markup_percent=markup)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "markup_percent": cat.markup_percent}


# ========================================
# SYSTEM DEFAULTS
# ========================================

class SystemDefaultOut(BaseModel):
    key: str
    value: str
    data_type: str
    display_value: object = None


class DefaultUpdate(BaseModel):
    key: str
    value: str


@router.get("/defaults/")
def get_defaults(db: Session = Depends(get_db)):
    """Get all system defaults as typed key-value pairs"""
    settings = db.query(SystemSetting).all()
    result = {}
    for s in settings:
        if s.data_type == "int":
            result[s.key] = int(s.value)
        elif s.data_type == "float":
            result[s.key] = float(s.value)
        elif s.data_type == "bool":
            result[s.key] = s.value.lower() == "true"
        else:
            result[s.key] = s.value
    return result


@router.get("/defaults/list/")
def get_defaults_list(db: Session = Depends(get_db)):
    """Get all system defaults as list (for settings page editing)"""
    settings = db.query(SystemSetting).all()
    return [
        {
            "id": s.id,
            "key": s.key,
            "value": s.value,
            "data_type": s.data_type,
        }
        for s in settings
    ]


@router.put("/defaults/")
def update_default(data: DefaultUpdate, db: Session = Depends(get_db)):
    """Update or create a system default"""
    setting = db.query(SystemSetting).filter(SystemSetting.key == data.key).first()
    if setting:
        setting.value = data.value
    else:
        setting = SystemSetting(key=data.key, value=data.value, data_type="string")
        db.add(setting)
    db.commit()
    return {"message": "Setting updated", "key": data.key, "value": data.value}


# ========================================
# TRANSIT TIMES
# ========================================

class TransitTimeOut(BaseModel):
    id: str
    port_of_loading: str
    port_of_discharge: str
    transit_days: int

    class Config:
        from_attributes = True


class TransitTimeCreate(BaseModel):
    port_of_loading: str
    port_of_discharge: str
    transit_days: int


@router.get("/transit-times/")
def get_transit_times(db: Session = Depends(get_db)):
    """Get all port-to-port transit times"""
    times = db.query(TransitTime).all()
    return [TransitTimeOut.model_validate(t) for t in times]


@router.post("/transit-times/")
def create_transit_time(data: TransitTimeCreate, db: Session = Depends(get_db)):
    """Add a transit time route"""
    existing = db.query(TransitTime).filter(
        TransitTime.port_of_loading == data.port_of_loading,
        TransitTime.port_of_discharge == data.port_of_discharge,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Route already exists")

    tt = TransitTime(**data.model_dump())
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return TransitTimeOut.model_validate(tt)


@router.put("/transit-times/{transit_id}/")
def update_transit_time(transit_id: str, data: TransitTimeCreate, db: Session = Depends(get_db)):
    """Update transit time for a route"""
    tt = db.query(TransitTime).filter(TransitTime.id == transit_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Transit time not found")

    tt.port_of_loading = data.port_of_loading
    tt.port_of_discharge = data.port_of_discharge
    tt.transit_days = data.transit_days
    db.commit()
    db.refresh(tt)
    return TransitTimeOut.model_validate(tt)


@router.delete("/transit-times/{transit_id}/")
def delete_transit_time(transit_id: str, db: Session = Depends(get_db)):
    """Delete a transit time route"""
    tt = db.query(TransitTime).filter(TransitTime.id == transit_id).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Transit time not found")
    db.delete(tt)
    db.commit()
    return {"message": "Transit time deleted"}


# ========================================
# SEED DEFAULT DATA
# ========================================

@router.post("/seed/")
def seed_settings(db: Session = Depends(get_db)):
    """Seed default settings data (run once on first startup)"""
    created = []

    # Exchange rates
    default_rates = [
        ("CNY", "INR", 12.10),
        ("USD", "INR", 83.50),
        ("EUR", "INR", 91.20),
        ("GBP", "INR", 106.50),
        ("JPY", "INR", 0.56),
    ]
    for from_c, to_c, rate in default_rates:
        existing = db.query(ExchangeRate).filter(
            ExchangeRate.from_currency == from_c,
            ExchangeRate.to_currency == to_c,
        ).first()
        if not existing:
            db.add(ExchangeRate(from_currency=from_c, to_currency=to_c, rate=rate))
            created.append(f"Rate: {from_c}/{to_c} = {rate}")

    # Categories with default markups
    default_categories = [
        ("Engine Parts", 18.0),
        ("Hydraulic Parts", 15.0),
        ("Electrical Parts", 20.0),
        ("Body Parts", 12.0),
        ("Transmission Parts", 16.0),
        ("Filters", 22.0),
        ("Bearings & Seals", 15.0),
        ("Belts & Chains", 18.0),
        ("Blades & Cutters", 14.0),
        ("General Parts", 15.0),
    ]
    for name, markup in default_categories:
        existing = db.query(Category).filter(Category.name == name).first()
        if not existing:
            db.add(Category(name=name, markup_percent=markup))
            created.append(f"Category: {name} ({markup}%)")

    # System defaults
    default_settings = [
        ("advance_percent", "30", "int"),
        ("default_currency", "CNY", "string"),
        ("default_container_type", "40HC", "string"),
        ("company_name", "HarvestERP Trading Co.", "string"),
        ("company_gstin", "", "string"),
        ("company_address", "", "string"),
        ("company_phone", "", "string"),
        ("company_email", "", "string"),
        ("production_days", "30", "int"),
        ("excel_cleanup_days", "30", "int"),
    ]
    for key, value, dtype in default_settings:
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not existing:
            db.add(SystemSetting(key=key, value=value, data_type=dtype))
            created.append(f"Setting: {key} = {value}")

    # Transit times
    default_transit = [
        ("Shanghai", "Nhava Sheva (Mumbai)", 18),
        ("Shanghai", "Mundra", 16),
        ("Ningbo", "Nhava Sheva (Mumbai)", 19),
        ("Ningbo", "Mundra", 17),
        ("Guangzhou", "Nhava Sheva (Mumbai)", 15),
        ("Guangzhou", "Chennai", 12),
        ("Qingdao", "Nhava Sheva (Mumbai)", 20),
        ("Tianjin", "Nhava Sheva (Mumbai)", 22),
    ]
    for pol, pod, days in default_transit:
        existing = db.query(TransitTime).filter(
            TransitTime.port_of_loading == pol,
            TransitTime.port_of_discharge == pod,
        ).first()
        if not existing:
            db.add(TransitTime(port_of_loading=pol, port_of_discharge=pod, transit_days=days))
            created.append(f"Transit: {pol} → {pod} ({days} days)")

    db.commit()
    return {"message": f"Seeded {len(created)} items", "created": created}
