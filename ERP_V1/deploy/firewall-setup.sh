#!/usr/bin/env bash
# Configure ufw firewall for HarvestERP production VPS.
# Run once on a freshly provisioned box.
set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
    apt-get update && apt-get install -y ufw
fi

# Reset to known state
ufw --force reset

# Default deny everything incoming, allow outgoing
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (consider changing port in /etc/ssh/sshd_config and updating this)
ufw allow 22/tcp

# Allow HTTP(S) for nginx / certbot renewal
ufw allow 80/tcp
ufw allow 443/tcp

# Explicitly block the bare API + DB ports from the outside (docker exposes them internally)
ufw deny  5432/tcp
ufw deny  8001/tcp

ufw --force enable
ufw status verbose
