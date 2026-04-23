#!/usr/bin/env bash
# Daily PostgreSQL backup for HarvestERP.
#
# Produces an encrypted, compressed dump with timestamped filename and
# rotates local copies. Optionally ships the dump off-site.
#
# Intended to be run from cron on the VPS:
#   0 3 * * *  root  /opt/harvesterp/deploy/backup-db.sh >> /var/log/harvesterp-backup.log 2>&1
#
# Env vars (via /etc/harvesterp.env):
#   BACKUP_DIR          local directory for dumps            (default: /var/backups/harvesterp)
#   BACKUP_RETAIN_DAYS  how many days of local dumps to keep (default: 14)
#   BACKUP_GPG_RECIPIENT  if set, dump is encrypted with this GPG key-id
#   BACKUP_S3_BUCKET    if set, dump is uploaded with `aws s3 cp`
#   DB_PASSWORD         postgres password (read from .env)
set -euo pipefail

# Load deployment env
if [[ -f /opt/harvesterp/.env ]]; then
    set -a
    . /opt/harvesterp/.env
    set +a
fi
[[ -f /etc/harvesterp.env ]] && . /etc/harvesterp.env

BACKUP_DIR="${BACKUP_DIR:-/var/backups/harvesterp}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-harvesterp-db-1}"
DB_USER="${DB_USER:-harvestadmin}"
DB_NAME="${DB_NAME:-harvesterpdata}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_BASE="${BACKUP_DIR}/harvesterp_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting pg_dump"

# 1. Dump + gzip
docker exec -i "${DB_CONTAINER}" \
    pg_dump -U "${DB_USER}" --no-owner --clean --if-exists "${DB_NAME}" \
    | gzip -9 > "${OUT_BASE}.gz"

OUT_FILE="${OUT_BASE}.gz"

# 2. Optional GPG encryption (at-rest requirement for compliance)
if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
    echo "[$(date -u +%FT%TZ)] Encrypting with GPG key ${BACKUP_GPG_RECIPIENT}"
    gpg --yes --batch --trust-model always \
        --output "${OUT_FILE}.gpg" \
        --encrypt --recipient "${BACKUP_GPG_RECIPIENT}" \
        "${OUT_FILE}"
    shred -u "${OUT_FILE}"
    OUT_FILE="${OUT_FILE}.gpg"
fi

SIZE_BYTES=$(stat -c '%s' "${OUT_FILE}")
echo "[$(date -u +%FT%TZ)] Wrote ${OUT_FILE} (${SIZE_BYTES} bytes)"

# 3. Verify the dump is non-empty and not truncated
if [[ "${SIZE_BYTES}" -lt 1024 ]]; then
    echo "[$(date -u +%FT%TZ)] FATAL: dump is suspiciously small (<1KB)" >&2
    exit 1
fi

# 4. Optional off-site replication
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
    echo "[$(date -u +%FT%TZ)] Uploading to s3://${BACKUP_S3_BUCKET}/"
    aws s3 cp "${OUT_FILE}" "s3://${BACKUP_S3_BUCKET}/$(basename "${OUT_FILE}")" \
        --only-show-errors --sse AES256
fi

# 5. Retention — remove local dumps older than $BACKUP_RETAIN_DAYS
find "${BACKUP_DIR}" -type f -name 'harvesterp_*.sql.gz*' \
    -mtime "+${BACKUP_RETAIN_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] Backup complete."
