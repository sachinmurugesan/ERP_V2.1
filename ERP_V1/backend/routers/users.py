"""User Management endpoints (Admin-only)."""
from datetime import datetime, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from core.security import (
    CurrentUser, get_current_user, get_password_hash,
    require_role, UserRole,
)

router = APIRouter()


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str  # ADMIN, FINANCE, OPERATIONS, CLIENT, FACTORY
    user_type: str = "INTERNAL"  # INTERNAL, CLIENT, FACTORY
    client_id: Optional[str] = None
    factory_id: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    user_type: Optional[str] = None
    client_id: Optional[str] = None
    factory_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


def _serialize_user(user) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "user_type": user.user_type,
        "client_id": user.client_id,
        "factory_id": user.factory_id,
        "is_active": user.is_active,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    _: None = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """List all users (Admin only)."""
    from models import User

    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if search:
        q = q.filter(
            (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
        )
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "users": [_serialize_user(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.get("/{user_id}")
def get_user(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    _: None = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Get a single user by ID (Admin only)."""
    from models import User

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user)


@router.post("/")
def create_user(
    body: UserCreate,
    current_user: CurrentUser = Depends(get_current_user),
    _: None = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new user (Admin only)."""
    from models import User

    # Password complexity check
    import re
    pw = body.password
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[A-Z]', pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit")

    # Check duplicate email
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Validate role-type consistency
    if body.role in ("CLIENT",) and not body.client_id:
        raise HTTPException(status_code=400, detail="CLIENT role requires a client_id")
    if body.role in ("FACTORY",) and not body.factory_id:
        raise HTTPException(status_code=400, detail="FACTORY role requires a factory_id")

    user = User(
        email=body.email,
        full_name=body.full_name,
        password_hash=get_password_hash(body.password),
        role=body.role,
        user_type=body.user_type,
        client_id=body.client_id,
        factory_id=body.factory_id,
        is_active=body.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Audit log
    try:
        from core.audit import log_audit_event
        log_audit_event(
            db, current_user, "USER_CREATED", "user", user.id,
            new_values={"email": user.email, "role": user.role, "user_type": user.user_type},
        )
    except Exception:
        pass

    return _serialize_user(user)


@router.put("/{user_id}")
def update_user(
    user_id: str,
    body: UserUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    _: None = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update an existing user (Admin only)."""
    from models import User

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_values = {"role": user.role, "is_active": user.is_active}

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.role is not None:
        user.role = body.role
    if body.user_type is not None:
        user.user_type = body.user_type
    if body.client_id is not None:
        user.client_id = body.client_id
    if body.factory_id is not None:
        user.factory_id = body.factory_id
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.password_hash = get_password_hash(body.password)

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Audit log
    try:
        from core.audit import log_audit_event
        log_audit_event(
            db, current_user, "USER_UPDATED", "user", user.id,
            old_values=old_values,
            new_values={"role": user.role, "is_active": user.is_active},
        )
    except Exception:
        pass

    return _serialize_user(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    _: None = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Deactivate a user (Admin only). Does not hard-delete."""
    from models import User

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"detail": "User deactivated"}
