#!/usr/bin/env bash
# OpenTeleCRM native dependency provisioning — Debian/Ubuntu (no Docker).
# Installs the system packages the self-hosted stack needs on this host.
# Components that are pure binaries (Meilisearch, Temporal, etc.) are
# installed by their own scripts in infra/native/ when enabled.
set -euo pipefail

echo "==> OpenTeleCRM native provisioner (Debian/Ubuntu)"

if [ "$(id -u)" -eq 0 ]; then
  echo "!! Refusing to run as root; use your user + sudo."
  exit 1
fi

sudo apt-get update -qq

# --- Core runtime ---
PACKAGES=(
  postgresql-16 postgresql-client-16
  redis-server          # Valkey drop-in for dev; prod: install valkey-server
  build-essential
  python3 python3-venv python3-pip
  ffmpeg
  ca-certificates curl
)

# --- Optional telephony (Asterisk) ---
if [ "${WITH_TELEPHONY:-0}" = "1" ]; then
  PACKAGES+=(asterisk asterisk-core-sounds-en)
fi

sudo apt-get install -y "${PACKAGES[@]}"

# --- Node toolchain ---
if ! command -v node >/dev/null 2>&1; then
  echo "!! node not found — install via nvm: https://github.com/nvm-sh/nvm"
  exit 1
fi
corepack enable 2>/dev/null || true

echo "==> Native deps installed."
echo "    Next: cp .env.example .env (fill DB password), then make db-init db-migrate db-seed"
