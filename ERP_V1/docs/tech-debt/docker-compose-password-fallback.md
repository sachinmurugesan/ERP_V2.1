# Tech debt: hardcoded password fallback in docker-compose.yml

## Problem

`docker-compose.yml` defines:

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:-erp_secure_password}
```

The fallback `erp_secure_password` is hardcoded. If the `DB_PASSWORD` environment variable is unset, the container starts with this known password.

For dev convenience this is fine. For production this is a security risk: a forgotten or unset `DB_PASSWORD` in production deployment would silently use a known weak password.

## Impact

- Dev: zero impact (intended behavior)
- Production: HIGH risk if `DB_PASSWORD` not properly set in deployment environment

## Fix

Remove the fallback. Require `DB_PASSWORD` to be explicitly set:

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set}
```

The `:?` syntax causes docker-compose to fail with an error if `DB_PASSWORD` is unset, instead of silently using a fallback.

Apply same change to `api` service `DATABASE_URL`.

## Priority

HIGH before production deployment.
LOW for current dev work (intentional convenience).

## Discovered during

`feat/migrate-clients-list` pre-merge investigation.
