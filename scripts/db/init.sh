#!/usr/bin/env bash
# Idempotent PostgreSQL database + role creation (native install).
# Reads DATABASE_URL from .env if present and reconciles the role password to it.
set -euo pipefail

cd "$(dirname "$0")/../.."

DB_NAME="${OPENTELECRM_DB_NAME:-opentelecrm}"
DB_USER="${OPENTELECRM_DB_USER:-opentelecrm}"

# If .env exists, source it — DATABASE_URL may carry the credentials
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

# Resolve password: explicit override > DATABASE_URL (from .env) > placeholder.
# This keeps the provisioner in sync with the app's actual connection string —
# previously the script sourced .env but never extracted the password, so a
# fresh `make db-init` created the role with a password the app couldn't use.
DB_PASSWORD="${OPENTELECRM_DB_PASSWORD:-}"
if [ -z "${DB_PASSWORD}" ] && [ -n "${DATABASE_URL:-}" ]; then
  if [[ "${DATABASE_URL}" =~ postgres://([^:]+):([^@]+)@ ]]; then
    DB_USER="${OPENTELECRM_DB_USER:-${BASH_REMATCH[1]}}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
  fi
fi
DB_PASSWORD="${DB_PASSWORD:-CHANGE_ME_DB_PASSWORD}"

echo "==> Ensuring Postgres role + database (idempotent)"

# ALTER on re-run so `make db-init` reconciles drift (role password changed
# out-of-band, .env regenerated, etc.) instead of silently leaving a stale role.
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$body\$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$body\$;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

# Extensions the schema needs
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
SQL

echo "==> DB ready: ${DB_NAME} owner ${DB_USER}"
echo "    DATABASE_URL=postgres://${DB_USER}:***@127.0.0.1:5432/${DB_NAME}"
