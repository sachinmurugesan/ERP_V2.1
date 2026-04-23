# Deployment Runbook — HarvestERP

> Target environment: single Hostinger VPS (Ubuntu 22.04 LTS, 4 vCPU / 8 GB RAM
> minimum), Docker Compose, nginx + certbot + Postgres 16 + Python API + Vue SPA.

## 0. Prerequisites

Before doing any of this:
- DNS A records point to the VPS for each of: `admin`, `client`, `factory`,
  `api` subdomains of `absodok.com`. Verify with `dig +short admin.absodok.com`.
- You have SSH root access to the VPS.
- You have the production `.env` values (DB password, JWT secret, SENTRY_DSN, etc.)
  stored in a password manager. **Never** commit `.env`.

## 1. First-time deploy

```bash
# 1. SSH in and clone
ssh root@<vps-ip>
git clone https://github.com/sachinmurugesan/SAAS-ERP.git /opt/harvesterp
cd /opt/harvesterp

# 2. Secure the box
bash deploy/firewall-setup.sh

# 3. Create .env (or copy from password manager)
cp .env.example .env
# ... edit .env with real values
chmod 600 .env

# 4. Pull production images + build
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml build

# 5. Start DB first, run migrations
docker compose -f docker-compose.prod.yml up -d db
sleep 10
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head

# 6. Bring up the rest of the stack (nginx will serve with a placeholder cert)
docker compose -f docker-compose.prod.yml up -d api frontend nginx certbot

# 7. Issue real SSL certs
bash deploy/init-letsencrypt.sh

# 8. Smoke-test
curl -I https://admin.absodok.com/          # expect 200 + HSTS header
curl    https://api.absodok.com/health      # expect {"status":"ok"}

# 9. Create the first admin user
docker compose -f docker-compose.prod.yml exec api python -m scripts.create_admin \
    --email admin@absodok.com --full-name "Ops Admin" --role SUPER_ADMIN

# 10. Install cron jobs
crontab -e     # paste the two lines below
```

Crontab:
```
0 3 * * *   cd /opt/harvesterp && /opt/harvesterp/deploy/backup-db.sh    >> /var/log/harvesterp-backup.log 2>&1
5 3 * * 0   cd /opt/harvesterp && docker compose -f docker-compose.prod.yml exec -T api python -m scripts.purge_revoked_tokens >> /var/log/harvesterp-housekeeping.log 2>&1
```

## 2. Routine deploy (new release)

```bash
ssh root@<vps-ip>
cd /opt/harvesterp

# 1. Fetch the new code
git fetch --tags
git checkout v<version>              # always deploy a tagged release, never 'main'

# 2. Build the new images
docker compose -f docker-compose.prod.yml build api frontend

# 3. Database migrations (forward-compatible: run BEFORE rolling the API)
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head

# 4. Rolling restart
docker compose -f docker-compose.prod.yml up -d api frontend

# 5. Verify
curl https://api.absodok.com/health
docker compose -f docker-compose.prod.yml logs --tail=100 api | grep -i error
```

Tag every deploy in git and in the runbook log.

## 3. Rollback

A rollback is just a redeploy of the previous tag — unless a migration was
run. If the previous release required a non-reversible migration, restore from
backup first (see §5), then redeploy the old tag.

```bash
git checkout v<previous>
docker compose -f docker-compose.prod.yml build api frontend
docker compose -f docker-compose.prod.yml up -d api frontend
```

## 4. Scheduled maintenance

Announce ≥48 h ahead via email + in-app banner. Execute during a low-usage
window (Sunday 02:00–04:00 IST is our default).

```bash
# put up a maintenance page
docker compose -f docker-compose.prod.yml stop api frontend
# nginx continues to serve /maintenance.html via the static mount

# ... do the thing ...

docker compose -f docker-compose.prod.yml start api frontend
```

## 5. Restoring from backup

See `docs/ops/INCIDENT_RESPONSE.md` §5 and `deploy/restore-db.sh`.

## 6. Secret rotation

Do this every 90 days or immediately on any suspected compromise.

```bash
cd /opt/harvesterp
cp .env .env.bak
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)

sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env

# For DB, update the password in the DB AND .env in lockstep:
docker compose -f docker-compose.prod.yml exec db \
    psql -U harvestadmin -d harvesterpdata \
    -c "ALTER USER harvestadmin WITH PASSWORD '${DB_PASSWORD}';"
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env

docker compose -f docker-compose.prod.yml restart api
# rotating JWT_SECRET invalidates every outstanding token — expect users to re-login
```

## 7. Certificate renewal

Automatic. `certbot` container runs `certbot renew` every 12 h. Verify:
```bash
docker compose -f docker-compose.prod.yml exec certbot certbot certificates
```

## 8. Health-check dashboard

Bookmark these:
- https://admin.absodok.com/health
- https://api.absodok.com/health
- https://uptimerobot.com/dashboard
- https://sentry.io/organizations/absodok/issues/
- https://<grafana-host>/d/harvesterp-overview
