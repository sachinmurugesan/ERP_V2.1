"""Authentication endpoints: login, refresh, me."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from rate_limiter import limiter
from core.security import (
    CurrentUser, get_current_user,
    verify_password, create_access_token, create_refresh_token, decode_token,
    revoke_token,
)
from schemas.auth import (
    LoginRequest, RefreshRequest, TokenResponse,
    RefreshResponse, UserMeResponse,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    from models import User

    user = db.query(User).filter(User.email == body.email.lower().strip()).first()

    # Account lockout check (5 failed attempts = 15 min lockout)
    if user and hasattr(user, 'failed_login_count') and user.failed_login_count >= 5:
        if user.last_failed_login:
            lockout_until = user.last_failed_login + __import__('datetime').timedelta(minutes=15)
            if datetime.now(timezone.utc) < lockout_until.replace(tzinfo=timezone.utc) if lockout_until.tzinfo is None else lockout_until:
                raise HTTPException(status_code=429, detail="Account temporarily locked. Try again in 15 minutes.")
            else:
                # Lockout expired — reset counter
                user.failed_login_count = 0
                db.commit()

    if not user or not verify_password(body.password, user.password_hash):
        # Track failed attempt
        if user and hasattr(user, 'failed_login_count'):
            user.failed_login_count = (user.failed_login_count or 0) + 1
            user.last_failed_login = datetime.now(timezone.utc)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Reset failed count on successful login
    if hasattr(user, 'failed_login_count') and user.failed_login_count:
        user.failed_login_count = 0
        user.last_failed_login = None

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Build JWT payload
    token_data = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "user_type": user.user_type,
        "client_id": user.client_id,
        "factory_id": user.factory_id,
        "tenant_id": "default",
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Determine portal redirect
    portal_map = {
        "INTERNAL": "/dashboard",
        "CLIENT": "/client-portal",
        "FACTORY": "/factory-portal",
    }
    portal = portal_map.get(user.user_type, "/dashboard")

    response = JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "user_type": user.user_type,
            "client_id": user.client_id,
            "factory_id": user.factory_id,
            "portal": portal,
        },
    })
    # Set refresh token as httpOnly cookie (not accessible to JavaScript)
    from config import DEBUG, JWT_REFRESH_TOKEN_EXPIRE_DAYS
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not DEBUG,  # Secure=true in production (HTTPS only)
        samesite="strict",
        max_age=JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",  # Only sent to auth endpoints
    )
    return response


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("20/minute")
def refresh_token(request: Request, body: RefreshRequest = None):
    """Refresh an access token using httpOnly cookie or body."""
    # Try cookie first, then body
    raw_token = request.cookies.get("refresh_token")
    if not raw_token and body and body.refresh_token:
        raw_token = body.refresh_token  # Backward compatibility
    if not raw_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    payload = decode_token(raw_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_data = {
        "sub": payload["sub"],
        "email": payload["email"],
        "role": payload["role"],
        "user_type": payload.get("user_type", "INTERNAL"),
        "client_id": payload.get("client_id"),
        "factory_id": payload.get("factory_id"),
        "tenant_id": payload.get("tenant_id", "default"),
    }

    new_access = create_access_token(token_data)

    return {
        "access_token": new_access,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(request: Request):
    """Revoke the refresh token server-side and clear the cookie."""
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        try:
            payload = decode_token(raw_token, check_revocation=False)
            revoke_token(payload, reason="logout")
        except HTTPException:
            pass  # Already-expired / malformed tokens don't need revocation

    # Also revoke the current access token if present
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        access_raw = auth_header.removeprefix("Bearer ").strip()
        try:
            access_payload = decode_token(access_raw, check_revocation=False)
            revoke_token(access_payload, reason="logout")
        except HTTPException:
            pass

    response = JSONResponse(content={"status": "logged_out"})
    response.delete_cookie("refresh_token", path="/api/auth")
    return response


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current authenticated user's profile and roles."""
    result = {
        "id": current_user.id,
        "email": current_user.email,
        "roles": current_user.roles,
        "role": current_user.role,
        "user_type": current_user.user_type,
        "client_id": current_user.client_id,
        "factory_id": current_user.factory_id,
        "tenant_id": current_user.tenant_id,
    }

    # Include portal permissions for CLIENT users
    if current_user.user_type == "CLIENT" and current_user.client_id:
        from models import Client
        client = db.query(Client).filter(Client.id == current_user.client_id).first()
        default_perms = {
            "show_payments": False, "show_production": False,
            "show_shipping": False, "show_after_sales": False, "show_files": False, "show_packing": False,
            "items_add": False, "items_bulk_add": False, "items_fetch_pending": False,
            "items_upload_excel": False, "items_edit_qty": False, "items_remove": False,
        }
        result["portal_permissions"] = {**default_perms, **(client.portal_permissions or {})} if client else default_perms
        result["client_type"] = client.client_type if client else "REGULAR"
    else:
        result["client_type"] = None

    return result
