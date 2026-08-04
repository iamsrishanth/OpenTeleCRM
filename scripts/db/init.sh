#!/usr/bin/env bash
# Idempotent PostgreSQL database + role creation (native install).
# Reads DATABASE_URL from .env if present.
set -euo pipefail

cd "$(dirname "$0")/../.."

DB_NAME="${OPENTELECRM_DB_NAME:-opentelecrm}"
DB_USER="${OPENTELECRM_DB_USER:-opentelecrm}"
DB_PASSWORD="${OPENTELECRM_DB_PASSWORD:-CHANGE_ME_DB_PASSWORD}"

# If .env exists, try to parse DATABASE_URL
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

echo "==> Ensuring Postgres role + database (idempotent)"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
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
echo "    DATABASE_URL=postgres://${DB_USER}:<pw>@127.0.0.1:5432/${DB_NAME}"
