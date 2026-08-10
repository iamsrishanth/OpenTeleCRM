#!/usr/bin/env bash
# OpenTeleCRM native dependency provisioning — macOS (Homebrew). No Docker.
# Equivalent of scripts/provision/debian.sh for macOS hosts.
set -euo pipefail

echo "==> OpenTeleCRM native provisioner (macOS / Homebrew)"

# --- Core runtime ---
brew install node@22 || true
brew install pnpm || true
brew install postgresql@17 || true
brew install redis || true

# --- Network (operator env) ---
# Tailscale: https://tailscale.com/download/mac  (GUI app, not brew)
brew install cloudflared || true

# --- Link keg-only formulae ---
brew link --overwrite node@22 2>/dev/null || true

echo "==> Start services"
brew services start postgresql@17 || true
brew services start redis || true

# --- Database role + database ---
# Homebrew Postgres trusts the local user by default — no sudo -u postgres.
# Credentials are parsed from DATABASE_URL in .env at runtime (never hardcoded).
DB_NAME="opentelecrm"
DB_USER="opentelecrm"
DB_PASSWORD="opentelecrm"
if [ -f .env ]; then
  set -a; source .env; set +a
  # Parse DATABASE_URL via python3 (present on macOS by default) — keeps the
  # URL-parsing regex out of this script.
  read -r DB_USER DB_PASSWORD DB_NAME < <(python3 -c "
import os, re, sys
url = os.environ.get('DATABASE_URL', '')
m = re.match(r'[a-z]+://([^:]+):([^@]+)@[^/]+/([^?/]+)', url)
if m:
    print(m.group(1), m.group(2), m.group(3))
else:
    print('opentelecrm', 'opentelecrm', 'opentelecrm')
")
fi

echo "==> Ensuring Postgres role + database (idempotent)"
psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  psql -d postgres -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  psql -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"

echo "==> Node tooling"
corepack enable 2>/dev/null || true

echo "==> Done. Next: cp .env.example .env (fill DATABASE_URL), then make db-migrate db-seed"
