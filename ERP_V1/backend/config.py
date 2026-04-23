"""
HarvestERP - Application Configuration
All settings driven by environment variables with sensible defaults.
"""
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# Load .env file if present (for local development)
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                _k, _v = _key.strip(), _val.strip()
                if _v:
                    os.environ[_k] = _v

# ========================================
# Database
# ========================================
# SQLite (dev): sqlite:///path/to/db.sqlite
# PostgreSQL (prod): postgresql://user:pass@host:5432/dbname
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/harvesterpdata.db")

# ========================================
# File Uploads
# ========================================
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "C:/HarvestERP/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "products").mkdir(exist_ok=True)
(UPLOAD_DIR / "orders").mkdir(exist_ok=True)
(UPLOAD_DIR / "temp").mkdir(exist_ok=True)

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", str(600 * 1024 * 1024)))  # 600MB

# Image processing
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "4096"))
IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "95"))
THUMBNAIL_MAX_DIM = int(os.getenv("THUMBNAIL_MAX_DIM", "300"))
UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1MB chunks

# ========================================
# CORS
# ========================================
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]

# ========================================
# Security
# ========================================
_INSECURE_JWT_DEFAULT = "dev-secret-change-in-production"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", _INSECURE_JWT_DEFAULT)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))


# ========================================
# AI / Claude API
# ========================================
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ========================================
# Application
# ========================================
APP_NAME = "HarvestERP"
APP_VERSION = "1.0.0"
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# SECURITY: Block insecure JWT secret in production
if not DEBUG and JWT_SECRET_KEY == _INSECURE_JWT_DEFAULT:
    raise RuntimeError(
        "FATAL: JWT_SECRET_KEY is not set. Set JWT_SECRET_KEY environment variable "
        "to a strong random string (min 32 chars) before running in production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )

# ========================================
# Feature Flags
# ========================================
TRANSPARENCY_ENABLED = os.getenv("TRANSPARENCY_ENABLED", "true").lower() == "true"

# ========================================
# Server (used by gunicorn.conf.py)
# ========================================
WORKERS = int(os.getenv("WORKERS", "4"))
WORKER_TIMEOUT = int(os.getenv("WORKER_TIMEOUT", "60"))
MAX_REQUESTS = int(os.getenv("MAX_REQUESTS", "1000"))


# ========================================
# Startup Security Validation
# ========================================
# Runs at import time — a misconfigured server REFUSES TO START.
def _validate_security_config():
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "FATAL: JWT_SECRET_KEY environment variable is not set. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    if JWT_SECRET_KEY == _INSECURE_JWT_DEFAULT and not DEBUG:
        raise RuntimeError(
            "FATAL: JWT_SECRET_KEY is still the insecure default. "
            "Set a secure random value in your .env file. "
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )


_validate_security_config()
