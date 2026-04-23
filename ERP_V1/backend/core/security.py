"""
Role-Based Access Control (RBAC) with real JWT authentication for HarvestERP.

Roles:
  ADMIN       - Full system access, user management, settings
  FINANCE     - Payments, ledgers, invoices, exchange rates
  OPERATIONS  - Orders, products, factories, shipping, customs
  CLIENT      - External: view own orders, payments, shipments
  FACTORY     - External: view assigned orders, production updates
"""
import enum
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS, DEBUG


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    FINANCE = "FINANCE"
    OPERATIONS = "OPERATIONS"
    CLIENT = "CLIENT"
    FACTORY = "FACTORY"


class CurrentUser:
    """Represents the authenticated user extracted from JWT."""
    __slots__ = ("id", "email", "roles", "role", "user_type", "client_id", "factory_id", "tenant_id")

    def __init__(
        self,
        id: str,
        email: str,
        roles: List[str],
        tenant_id: Optional[str] = None,
        role: Optional[str] = None,
        user_type: Optional[str] = "INTERNAL",
        client_id: Optional[str] = None,
        factory_id: Optional[str] = None,
    ):
        self.id = id
        self.email = email
        self.roles = roles
        self.role = role or (roles[0] if roles else "")
        self.user_type = user_type or "INTERNAL"
        self.client_id = client_id
        self.factory_id = factory_id
        self.tenant_id = tenant_id

    def has_role(self, role: str) -> bool:
        return (role in self.roles
                or UserRole.SUPER_ADMIN in self.roles)

    def has_any_role(self, roles: List[str]) -> bool:
        return (bool(set(self.roles) & set(roles))
                or UserRole.SUPER_ADMIN in self.roles)


# ---------------------------------------------------------------------------
# Password hashing — Argon2id (OWASP recommended)
# ---------------------------------------------------------------------------
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(
        schemes=["argon2"],
        deprecated="auto",
        argon2__memory_cost=65536,   # 64 MiB
        argon2__time_cost=3,         # 3 iterations
        argon2__parallelism=4,       # 4 threads
        argon2__type="ID",           # Argon2id variant
    )

    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)
except ImportError:
    # Fallback: direct argon2-cffi (no passlib)
    try:
        from argon2 import PasswordHasher
        _ph = PasswordHasher(
            memory_cost=65536, time_cost=3, parallelism=4, type=2,  # type=2 = Argon2id
        )

        def verify_password(plain_password: str, hashed_password: str) -> bool:
            try:
                return _ph.verify(hashed_password, plain_password)
            except Exception:
                return False

        def get_password_hash(password: str) -> str:
            return _ph.hash(password)
    except ImportError:
        raise ImportError(
            "FATAL: Neither passlib[argon2] nor argon2-cffi is installed. "
            "Install one of them: pip install passlib[argon2] argon2-cffi"
        )


# ---------------------------------------------------------------------------
# JWT Token Creation & Verification
# ---------------------------------------------------------------------------
try:
    from jose import JWTError, jwt
except ImportError:
    # Fallback: use PyJWT
    import jwt as pyjwt
    JWTError = Exception

    class jwt:
        @staticmethod
        def encode(payload, key, algorithm):
            return pyjwt.encode(payload, key, algorithm=algorithm)

        @staticmethod
        def decode(token, key, algorithms):
            return pyjwt.decode(token, key, algorithms=algorithms)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = {**data}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    to_encode["type"] = "access"
    to_encode.setdefault("jti", str(uuid.uuid4()))
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = {**data}
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode["exp"] = expire
    to_encode["type"] = "refresh"
    to_encode.setdefault("jti", str(uuid.uuid4()))
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _is_token_revoked(jti: str) -> bool:
    """Check if a JTI is in the revocation list. Fail-closed on DB errors."""
    if not jti:
        return False
    try:
        from database import SessionLocal
        from models import RevokedToken
        with SessionLocal() as db:
            return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None
    except Exception:
        # Fail-closed: if we can't verify, treat as revoked so attacker can't bypass by DoS
        return True


def decode_token(token: str, check_revocation: bool = True) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if check_revocation and _is_token_revoked(payload.get("jti", "")):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return payload


def revoke_token(payload: dict, reason: str = "logout") -> None:
    """Insert a token's JTI into the revocation list. Safe if DB is missing the table."""
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return
    try:
        from database import SessionLocal
        from models import RevokedToken
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None) \
            if isinstance(exp, (int, float)) else exp
        with SessionLocal() as db:
            # Idempotent — ignore if already revoked
            existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
            if existing:
                return
            db.add(RevokedToken(
                jti=jti,
                user_id=payload.get("sub"),
                token_type=payload.get("type", "access"),
                expires_at=expires_at,
                reason=reason,
            ))
            db.commit()
    except Exception:
        # Best-effort revocation; short access-token TTL limits damage if this fails
        pass


# ---------------------------------------------------------------------------
# FastAPI Dependency: get_current_user
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> CurrentUser:
    """Extract and validate the current user from the Authorization header.

    Requires a valid JWT Bearer token. In local development only,
    set DEBUG=true AND ALLOW_DEV_AUTH=true to bypass authentication.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing",
        )

    token = auth_header.removeprefix("Bearer ").strip()
    payload = decode_token(token)

    role = payload.get("role", "")
    return CurrentUser(
        id=payload.get("sub", ""),
        email=payload.get("email", ""),
        roles=[role],
        role=role,
        user_type=payload.get("user_type", "INTERNAL"),
        client_id=payload.get("client_id"),
        factory_id=payload.get("factory_id"),
        tenant_id=payload.get("tenant_id", "default"),
    )


# ---------------------------------------------------------------------------
# RBAC Dependencies
# ---------------------------------------------------------------------------
def require_role(allowed_roles: List[str]):
    """FastAPI dependency that enforces role-based access."""
    async def _check_role(current_user: CurrentUser = Depends(get_current_user)):
        if not current_user.has_any_role(allowed_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {allowed_roles}",
            )
        return None
    return _check_role


# Convenience pre-built dependencies
require_super_admin = require_role([UserRole.SUPER_ADMIN])
require_admin = require_role([UserRole.ADMIN])
require_finance = require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE])  # D-009: SUPER_ADMIN explicit (was implicit via has_any_role bypass)
require_factory_financial = require_role([UserRole.SUPER_ADMIN, UserRole.FINANCE])
require_operations = require_role([UserRole.ADMIN, UserRole.OPERATIONS])
require_read = require_role([UserRole.ADMIN, UserRole.FINANCE, UserRole.OPERATIONS, UserRole.CLIENT, UserRole.FACTORY])


# ---------------------------------------------------------------------------
# Order PI access guard
# ---------------------------------------------------------------------------
def check_pi_order_access(order: Any, current_user: CurrentUser) -> None:
    """Raise 403 unless current_user is authorised to access this order's PI.

    Always allowed: SUPER_ADMIN, ADMIN, FINANCE (internal oversight roles).
    Ownership required for everyone else:
      CLIENT  — current_user.client_id  must equal order.client_id
      FACTORY — current_user.factory_id must equal order.factory_id
    OPERATIONS without a matching client/factory scope is denied; OPERATIONS
    users who need PI access should hold FINANCE or ADMIN role.
    """
    if current_user.has_any_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE]):
        return
    if current_user.user_type == "CLIENT" and current_user.client_id == order.client_id:
        return
    if current_user.user_type == "FACTORY" and current_user.factory_id == order.factory_id:
        return
    raise HTTPException(
        status_code=403,
        detail="Access denied: you are not authorized to access this order's PI",
    )


# ---------------------------------------------------------------------------
# Row-Level Security: Tenant-Scoped Queries
# ---------------------------------------------------------------------------
def get_scoped_query(model, db, user: CurrentUser):
    """Apply row-level security to any query based on user role.

    - INTERNAL users: no filter (see all data)
    - CLIENT users: filter to rows matching user.client_id
    - FACTORY users: filter to rows matching user.factory_id
    """
    from sqlalchemy.orm import Session
    q = db.query(model)

    if user.user_type == "INTERNAL" or user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return q

    if user.role == "CLIENT" and user.client_id:
        if hasattr(model, 'client_id'):
            q = q.filter(model.client_id == user.client_id)
        elif hasattr(model, 'order_id'):
            # Subquery: only items belonging to client's orders
            from models import Order
            client_order_ids = db.query(Order.id).filter(
                Order.client_id == user.client_id,
                Order.deleted_at.is_(None),
            ).subquery()
            q = q.filter(model.order_id.in_(client_order_ids))

    elif user.role == "FACTORY" and user.factory_id:
        if hasattr(model, 'factory_id'):
            q = q.filter(model.factory_id == user.factory_id)
        elif hasattr(model, 'order_id'):
            from models import Order
            factory_order_ids = db.query(Order.id).filter(
                Order.factory_id == user.factory_id,
                Order.deleted_at.is_(None),
            ).subquery()
            q = q.filter(model.order_id.in_(factory_order_ids))

    return q


def verify_resource_access(model, resource_id: str, db, user: CurrentUser):
    """Verify the user has access to a specific resource. Returns the resource or None.

    Use this before any UPDATE/DELETE to enforce ownership.
    Returns None if the resource doesn't exist or the user doesn't have access.
    """
    q = get_scoped_query(model, db, user)
    return q.filter(model.id == resource_id).first()
