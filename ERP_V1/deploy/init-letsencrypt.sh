#!/usr/bin/env bash
# Bootstrap Let's Encrypt certificates for HarvestERP on first deploy.
#
# Run once on the production VPS AFTER:
#   1. DNS A/AAAA records point to the VPS for every domain listed below
#   2. Docker + docker compose plugin are installed
#   3. `.env` contains DB_PASSWORD and JWT_SECRET
#
# Usage:  sudo bash deploy/init-letsencrypt.sh
#
# This is safe to re-run: it refuses to touch existing certs unless --force is passed.
set -euo pipefail

DOMAINS=(
    "admin.absodok.com"
    "client.absodok.com"
    "factory.absodok.com"
    "api.absodok.com"
)
ROOT_DOMAIN="absodok.com"
EMAIL="admin@absodok.com"        # CHANGE to your ops contact
STAGING=0                         # set to 1 for dry-run against Let's Encrypt staging
COMPOSE_FILE="docker-compose.prod.yml"
WEBROOT="./nginx/webroot"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

if [[ -d "/etc/letsencrypt/live/${ROOT_DOMAIN}" && $FORCE -eq 0 ]]; then
    echo "Certificates already exist for ${ROOT_DOMAIN}."
    echo "Pass --force to re-issue, or just run 'docker compose -f ${COMPOSE_FILE} exec certbot certbot renew'."
    exit 0
fi

echo "==> Preparing webroot at ${WEBROOT}"
mkdir -p "${WEBROOT}/.well-known/acme-challenge"

# 1. Generate a self-signed placeholder so nginx can start before real certs exist
echo "==> Generating placeholder self-signed cert (so nginx can boot)"
docker run --rm -v certbot-etc:/etc/letsencrypt alpine/openssl \
    req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "/etc/letsencrypt/live/${ROOT_DOMAIN}/privkey.pem" \
    -out    "/etc/letsencrypt/live/${ROOT_DOMAIN}/fullchain.pem" \
    -subj "/CN=localhost"
docker run --rm -v certbot-etc:/etc/letsencrypt alpine sh -c \
    "cp /etc/letsencrypt/live/${ROOT_DOMAIN}/fullchain.pem /etc/letsencrypt/live/${ROOT_DOMAIN}/chain.pem"

# 2. Start nginx so it serves /.well-known/acme-challenge/
echo "==> Starting nginx (placeholder cert)"
docker compose -f "${COMPOSE_FILE}" up -d nginx

# 3. Request real certs via HTTP-01
echo "==> Requesting certs for: ${DOMAINS[*]}"
DOMAIN_ARGS=""
for d in "${DOMAINS[@]}"; do DOMAIN_ARGS+=" -d ${d}"; done

STAGING_FLAG=""
[[ $STAGING -eq 1 ]] && STAGING_FLAG="--staging"

docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
    --email ${EMAIL} --agree-tos --no-eff-email \
    --cert-name ${ROOT_DOMAIN} \
    ${STAGING_FLAG} \
    ${DOMAIN_ARGS}" certbot

# 4. Reload nginx to pick up real certs
echo "==> Reloading nginx"
docker compose -f "${COMPOSE_FILE}" exec nginx nginx -s reload

echo ""
echo "SSL bootstrap complete. Verify:  https://admin.absodok.com"
echo "Renewal is automatic (certbot container runs 'certbot renew' every 12 h)."
