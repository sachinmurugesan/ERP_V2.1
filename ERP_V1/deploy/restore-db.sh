#!/usr/bin/env bash
# Restore a HarvestERP PostgreSQL backup produced by backup-db.sh.
#
# Usage:  sudo bash deploy/restore-db.sh <path-to-dump>
#         Dump can be .sql.gz or .sql.gz.gpg (will be decrypted first).
#
# WARNING: This DROPs and RECREATEs the target database. Confirm the dump
# is correct before running. Script requires manual confirmation.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "${DUMP}" || ! -f "${DUMP}" ]]; then
    echo "Usage: $0 <path-to-dump-file>" >&2
    exit 1
fi

if [[ -f /opt/harvesterp/.env ]]; then
    set -a; . /opt/harvesterp/.env; set +a
fi

DB_CONTAINER="${DB_CONTAINER:-harvesterp-db-1}"
DB_USER="${DB_USER:-harvestadmin}"
DB_NAME="${DB_NAME:-harvesterpdata}"

read -r -p "This will DROP DATABASE ${DB_NAME} and restore from ${DUMP}. Type 'RESTORE' to continue: " CONFIRM
[[ "${CONFIRM}" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

INPUT="${DUMP}"
if [[ "${DUMP}" == *.gpg ]]; then
    echo "Decrypting ${DUMP}"
    gpg --output "${WORK}/dump.sql.gz" --decrypt "${DUMP}"
    INPUT="${WORK}/dump.sql.gz"
fi

echo "Stopping API containers (DB stays up)"
docker compose -f docker-compose.prod.yml stop api frontend

echo "Dropping and recreating database"
docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d postgres \
    -c "CREATE DATABASE ${DB_NAME};"

echo "Restoring from ${INPUT}"
gunzip -c "${INPUT}" | docker exec -i "${DB_CONTAINER}" \
    psql -U "${DB_USER}" -d "${DB_NAME}"

echo "Starting API"
docker compose -f docker-compose.prod.yml start api frontend

echo "Restore complete. Verify with: curl https://api.absodok.com/health"
