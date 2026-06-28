#!/usr/bin/env bash
# Deploy prebuilt artifacts to the staging VPS. Builds happen HERE, never on the box.
# Usage: ./deploy/deploy.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@165.22.109.245}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/memoris}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building artifacts locally"
pnpm install --frozen-lockfile
pnpm --filter @memoris/shared build
pnpm --filter @memoris/server build
pnpm --filter @memoris/dashboard build

echo "==> Preparing production server bundle"
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/server"
cp -R "$ROOT/apps/server/dist" "$STAGE/server/dist"
cp -R "$ROOT/apps/server/prisma" "$STAGE/server/prisma"
cp "$ROOT/apps/server/package.json" "$STAGE/server/package.json"
cp "$ROOT/apps/server/.env.example" "$STAGE/server/.env.example"

echo "==> Shipping server (rsync)"
rsync -az --delete \
  --exclude node_modules \
  "$STAGE/server/" "$VPS_HOST:$REMOTE_ROOT/server/"

echo "==> Shipping dashboard static files (rsync)"
rsync -az --delete "$ROOT/apps/dashboard/dist/" "$VPS_HOST:$REMOTE_ROOT/dashboard/"

echo "==> Installing prod deps + migrating + restarting on the box"
ssh "$VPS_HOST" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/memoris/server
npm install --omit=dev --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
pm2 restart memoris-server || pm2 start "node --env-file=.env dist/index.js" --name memoris-server
pm2 save
REMOTE

rm -rf "$STAGE"
echo "==> Done. Verify: curl https://<your-domain>/health"
