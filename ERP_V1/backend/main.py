"""
HarvestERP - Main Application
FastAPI backend for Combine Harvester Spare Parts Import Management.
"""
import traceback
import logging
import secrets
from datetime import datetime as _dt
from pathlib import Path as _Path

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded

from config import CORS_ORIGINS, APP_NAME, APP_VERSION, UPLOAD_DIR, DEBUG, MAX_UPLOAD_SIZE
from rate_limiter import limiter
from core.exceptions import (
    HarvestERPException, EntityNotFoundError,
    AccessDeniedError, DuplicateEntityError,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("harvestERP")


# ========================================
# App Creation
# ========================================
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Combine Harvester Spare Parts Import Management System",
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)


# ========================================
# Exception Handlers
# ========================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    tb_str = "".join(tb)
    logger.error(
        f"\n{'='*60}\n"
        f"UNHANDLED ERROR: {request.method} {request.url}\n"
        f"{'='*60}\n"
        f"{tb_str}\n"
        f"{'='*60}"
    )
    return JSONResponse(
        status_code=500,
        content=(
            {"detail": f"Internal Server Error: {type(exc).__name__}: {str(exc)}"}
            if DEBUG
            else {"detail": "An internal server error occurred."}
        ),
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Try again in 60 seconds."},
    )


@app.exception_handler(EntityNotFoundError)
async def not_found_handler(request: Request, exc: EntityNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(AccessDeniedError)
async def access_denied_handler(request: Request, exc: AccessDeniedError):
    return JSONResponse(
        status_code=403,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(DuplicateEntityError)
async def duplicate_handler(request: Request, exc: DuplicateEntityError):
    return JSONResponse(
        status_code=409,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(HarvestERPException)
async def harvest_exception_handler(request: Request, exc: HarvestERPException):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "code": exc.code},
    )


# ========================================
# Middleware
# ========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

app.state.limiter = limiter


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_SIZE:
        return JSONResponse(status_code=413, content={"detail": "Request body too large"})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS — enforce HTTPS (1 year, include subdomains)
    if not DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    # CSP — restrict resource loading
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-src 'self'; "
        "frame-ancestors 'none';"
    )
    # Prevent caching of API responses with sensitive data
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
    # Force download on non-image uploaded files (prevent XSS via uploaded HTML)
    if request.url.path.startswith("/uploads/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Allow inline display for images only — force download for everything else
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            response.headers["Content-Disposition"] = "attachment"
    return response


# NOTE: /uploads is intentionally NOT mounted as a StaticFiles route.
# All file downloads go through authenticated API endpoints (G-019 Patch 14).
# See: /api/shipping/shipping-documents/{id}/download/
#      /api/aftersales/orders/{order_id}/photos/{filename}
#      /api/orders/{order_id}/queries/{query_id}/attachments/{filename}
#      /api/finance/payments/{id}/proof/
#      /api/products/file/?path=products/...

# Serve graphify output (knowledge graph visualization) — only in debug mode
import os as _os
_graphify_dir = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "graphify-out")
_graphify_dir = _os.path.abspath(_graphify_dir)
if DEBUG and _os.path.isdir(_graphify_dir):
    app.mount("/graphify", StaticFiles(directory=_graphify_dir, html=True), name="graphify")


# ========================================
# Register Routers (with RBAC dependencies)
# ========================================
from routers import (  # noqa: E402
    auth, audit, dashboard, products, factories, clients,
    settings, orders, documents, excel, finance, unloaded,
    shipping, customs, aftersales, users, notifications,
    landed_cost, queries,
)
from core.security import (  # noqa: E402
    get_current_user, require_admin, require_finance, require_operations,
)

# Auth: no RBAC needed (used to get current user info)
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Read-only: all authenticated users
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"],
                   dependencies=[Depends(get_current_user)])

# Operations: ADMIN + OPERATIONS (read also allowed for FINANCE, VIEWER)
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"],
                   dependencies=[Depends(get_current_user)])
app.include_router(queries.router, prefix="/api/orders", tags=["Queries"],
                   dependencies=[Depends(get_current_user)])
app.include_router(products.router, prefix="/api/products", tags=["Products"],
                   dependencies=[Depends(get_current_user)])
app.include_router(factories.router, prefix="/api/factories", tags=["Factories"],
                   dependencies=[Depends(get_current_user)])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"],
                   dependencies=[Depends(get_current_user)])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"],
                   dependencies=[Depends(get_current_user)])
app.include_router(excel.router, prefix="/api/excel", tags=["Excel Processing"],
                   dependencies=[Depends(require_operations)])
app.include_router(excel.pi_router, prefix="/api/excel", tags=["Excel Processing"],
                   dependencies=[Depends(get_current_user)])
app.include_router(shipping.router, prefix="/api/shipping", tags=["Shipping"],
                   dependencies=[Depends(get_current_user)])
app.include_router(customs.router, prefix="/api/customs", tags=["Customs"],
                   dependencies=[Depends(get_current_user)])
app.include_router(unloaded.router, prefix="/api/unloaded-items", tags=["Unloaded Items"],
                   dependencies=[Depends(get_current_user)])
app.include_router(aftersales.router, prefix="/api/aftersales", tags=["After-Sales"],
                   dependencies=[Depends(get_current_user)])

# Finance: ADMIN + FINANCE only
app.include_router(finance.router, prefix="/api/finance", tags=["Finance"],
                   dependencies=[Depends(require_finance)])
# Finance client-facing: any authenticated user (endpoints do own role checks)
app.include_router(finance.client_router, prefix="/api/finance", tags=["Finance (Client)"],
                   dependencies=[Depends(get_current_user)])

# Landed Cost: authenticated users (endpoint does its own role checks)
app.include_router(landed_cost.router, prefix="/api", tags=["Landed Cost"],
                   dependencies=[Depends(get_current_user)])

# Admin only: settings + audit + users
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"],
                   dependencies=[Depends(require_admin)])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit Trail"],
                   dependencies=[Depends(require_admin)])
app.include_router(users.router, prefix="/api/users", tags=["Users"],
                   dependencies=[Depends(require_admin)])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"],
                   dependencies=[Depends(get_current_user)])


# ========================================
# Seed Super-Admin User
# ========================================
def _seed_admin():
    """Create default admin user on first run only.

    Generates a cryptographically random password, writes it to
    FIRST_RUN_CREDENTIALS.txt (gitignored), and logs a warning.
    Never re-seeds if the admin account already exists.
    """
    from database import SessionLocal
    from models import User
    from core.security import get_password_hash

    _admin_email = "admin@harvesterp.com"
    _creds_file = _Path(__file__).resolve().parent / "FIRST_RUN_CREDENTIALS.txt"

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == _admin_email).first()
        if existing:
            return  # Already seeded — skip entirely, no log noise

        temp_password = secrets.token_urlsafe(16)
        admin = User(
            email=_admin_email,
            full_name="System Administrator",
            password_hash=get_password_hash(temp_password),
            role="ADMIN",
            user_type="INTERNAL",
            is_active=True,
        )
        db.add(admin)
        db.commit()

        _creds_file.write_text(
            "==============================================\n"
            "HARVESTERP FIRST RUN — DELETE THIS FILE AFTER LOGIN\n"
            "==============================================\n"
            f"Admin Email   : {_admin_email}\n"
            f"Temp Password : {temp_password}\n"
            f"Generated At  : {_dt.utcnow().isoformat()}Z\n"
            "\n"
            "ACTION REQUIRED:\n"
            "1. Log in immediately with these credentials\n"
            "2. Change your password in Settings\n"
            "3. Delete this file from the server\n"
            "==============================================\n",
            encoding="utf-8",
        )

        logger.warning(
            "FIRST RUN: Admin account created — credentials written to %s",
            _creds_file,
        )
    except Exception as e:
        logger.error("Admin seed error: %s", e)
        db.rollback()
    finally:
        db.close()


_seed_admin()


# ========================================
# Startup Cleanup (prevent storage bloat)
# ========================================
def _run_startup_cleanup():
    """Clean up stale temp files and old processing jobs on every startup."""
    from database import SessionLocal
    from services.cleanup import run_cleanup

    db = SessionLocal()
    try:
        results = run_cleanup(db)
        temp = results.get("temp_files", {})
        jobs = results.get("stale_jobs", {})
        if temp.get("deleted") or jobs.get("deleted"):
            logger.info(
                "Startup cleanup: %d temp files (%.1f MB freed), %d stale jobs removed",
                temp.get("deleted", 0), temp.get("freed_mb", 0), jobs.get("deleted", 0),
            )
    except Exception as e:
        logger.warning("Startup cleanup failed: %s", e)
    finally:
        db.close()


_run_startup_cleanup()


# ========================================
# Health Check
# ========================================
@app.get("/api/health")
def health_check():
    result = {"status": "healthy"}
    if DEBUG:
        result["app"] = APP_NAME
        result["version"] = APP_VERSION
    return result

