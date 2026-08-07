#!/usr/bin/env bash
# Generate a dev JWT and inject it into the Bruno env file.
# Usage: bash scripts/bruno-bootstrap-jwt.sh
# Run before `bru run --env local` to ensure a valid auth token.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo '/mnt/data/Projects/ByteCodeCRM')"
ENV_FILE="collections/opentelecrm/environments/local.bru"

DEV_JWT_SECRET="${DEV_JWT_SECRET:?set DEV_JWT_SECRET in .env or the shell}"
ENTERPRISE_ID="a9e8933a-0a29-4e8b-8b2b-7fdfaf1b88d9"

JWT=$(NODE_PATH=services/api/node_modules node -e "
  const jwt = require('jsonwebtoken');
  const t = jwt.sign(
    { enterpriseId: '$ENTERPRISE_ID', sub: 'bruno-runner' },
    '$DEV_JWT_SECRET',
    { expiresIn: '365d' }
  );
  process.stdout.write(t);
")

# Reset authToken line in the bru env file (replace whatever's there)
# macOS/BSD sed and GNU sed both work with -i.bak
sed -i.bak "s/^  authToken:.*/  authToken: Bearer $JWT/" "$ENV_FILE"
rm -f "${ENV_FILE}.bak"

echo "OK — authToken written to $ENV_FILE"