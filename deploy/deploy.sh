#!/usr/bin/env bash
# Build the Memoris gateway on THIS machine (your laptop) and ship prebuilt artifacts to the VPS.
# The 512 MB box never builds — it only `npm install`s the ~6 runtime deps (linux Prisma engine).
#
# Requirements: laptop -> VPS SSH must already work; the VPS already has node + pm2 (capnhatgia uses it).
#
# Usage (override any of these as env vars):
#   VPS_HOST=root@165.22.109.245 PORT=3000 ./deploy/deploy.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@165.22.109.245}"     # ssh target
REMOTE_DIR="${REMOTE_DIR:-/opt/memoris/server}"  # where it lives on the box
APP_NAME="${APP_NAME:-memoris-server}"           # pm2 process name
PORT="${PORT:-3000}"                             # change if 3000 is taken (check: ss -ltnp)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> 1/5  Build the server (tsc) on this machine"
pnpm install --frozen-lockfile
pnpm --filter @memoris/server build

echo "==> 2/5  Stage a self-contained runtime bundle"
cp -R "$ROOT/apps/server/dist" "$STAGE/dist"
cp -R "$ROOT/apps/server/prisma" "$STAGE/prisma"
# Ship your .env (holds GEMINI_API_KEY etc). Falls back to the example — edit it on the box if so.
cp "$ROOT/apps/server/.env" "$STAGE/.env" 2>/dev/null || cp "$ROOT/apps/server/.env.example" "$STAGE/.env"
# Generate a clean package.json: drop workspace:* deps (@memoris/shared is type-only, erased by
# tsc, so the runtime never needs it) and keep only what `node dist/index.js` actually requires.
node -e '
  const fs = require("fs");
  const src = require(process.argv[1]);
  const deps = {};
  for (const [k, v] of Object.entries(src.dependencies || {})) {
    if (!String(v).startsWith("workspace:")) deps[k] = v;
  }
  deps.prisma = (src.devDependencies || {}).prisma || "^6.3.0"; // CLI for generate/db push
  fs.writeFileSync(process.argv[2], JSON.stringify({
    name: "memoris-server", version: src.version || "0.0.0", private: true, type: "module",
    scripts: { start: "node --env-file=.env dist/index.js" }, dependencies: deps,
  }, null, 2));
' "$ROOT/apps/server/package.json" "$STAGE/package.json"

echo "==> 3/5  Upload to $VPS_HOST:$REMOTE_DIR"
ssh "$VPS_HOST" "mkdir -p '$REMOTE_DIR'"
# --delete keeps code in sync; never wipe the live SQLite db, node_modules, or the .env
# (secrets like OPENROUTER_API_KEY are edited ON the box and must survive redeploys).
rsync -az --delete --exclude node_modules --exclude '*.db' --exclude .env "$STAGE/" "$VPS_HOST:$REMOTE_DIR/"
# Seed .env only if the box doesn't have one yet (first deploy); never overwrite it after.
rsync -az --ignore-existing "$STAGE/.env" "$VPS_HOST:$REMOTE_DIR/.env"

echo "==> 4/5  Ensure swap (512MB box OOMs without it) + install prod deps + Prisma"
ssh "$VPS_HOST" bash -se <<REMOTE
set -euo pipefail
# A 512MB box gets the npm/Prisma install OOM-killed without swap (docs/ARCHITECTURE.md §11).
if ! swapon --show | grep -q .; then
  echo "  creating 2G swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cd "$REMOTE_DIR"
npm install --omit=dev --no-audit --no-fund
# Use the locally-installed Prisma CLI (NOT npx, which would fetch a different major version).
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma db push
REMOTE

echo "==> 5/5  (Re)start under pm2 on 127.0.0.1:$PORT (behind nginx; NOT public)"
ssh "$VPS_HOST" bash -se <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
# Bind to localhost only — nginx (same box) terminates HTTPS and proxies here. Port 3000 stays
# closed to the internet.
PORT="$PORT" HOST="127.0.0.1" pm2 start "node --env-file=.env dist/index.js" --name "$APP_NAME"
pm2 save
REMOTE

echo "==> Done. Public URL is served by nginx over HTTPS, e.g. https://api.flashcard.io.vn/health"
