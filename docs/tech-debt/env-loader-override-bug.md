# Tech debt: backend .env loader overrides shell environment

## Problem

`backend/config.py` loads `backend/.env` AFTER reading shell
environment variables. The .env loader unconditionally overwrites
any value already set, which means shell-level environment
variables are silently ignored if .env has a different value for
the same key.

## Why this is wrong

Standard convention: shell environment is AUTHORITATIVE; .env
files provide DEFAULTS only. Production deployments (Heroku,
Railway, Fly.io, AWS ECS, Kubernetes, etc.) set config via real
environment variables — if .env accidentally gets deployed, it
would silently override production config.

## How to reproduce

1. Set DATABASE_URL in shell:
   `export DATABASE_URL="postgresql://real-prod-db:5432/real"`
2. Have .env with:
   `DATABASE_URL=postgresql://erp:erp_secure_password@localhost:5432/harvestdb`
3. Start backend
4. Backend connects to localhost, not real-prod-db
5. Shell value is silently ignored

## Impact today

Zero. HarvestERP is not deployed yet. Only affects dev where
the same values are used consistently.

## Impact in production

High. Could cause:
- Wrong database connection (silent)
- Wrong API keys
- Wrong feature flags
- Security: if .env gets committed or deployed, could override
  intended production config

## Fix

In `backend/config.py`, change the .env loader to skip keys
that are already set in `os.environ`. Common patterns:

```python
# Option 1: using python-dotenv (recommended)
from dotenv import load_dotenv
load_dotenv(override=False)  # key: override=False

# Option 2: manual check
for key, value in env_values.items():
    if key not in os.environ:
        os.environ[key] = value
```

## Priority

MEDIUM. Fix before first production deployment.

## Discovered during

Task 9 cleanup / PostgreSQL fallback removal.
`fix/always-use-postgresql` branch verification — Test 3 required
editing `.env` directly instead of using a shell env override.
