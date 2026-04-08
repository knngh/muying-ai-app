#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[authority-rollout] root: $ROOT_DIR"

if [ -f ".env.production" ]; then
  echo "[authority-rollout] detected .env.production"
else
  echo "[authority-rollout] warning: .env.production not found"
fi

echo "[authority-rollout] 1/6 validate prisma"
npx prisma validate

echo "[authority-rollout] 2/6 build backend"
npm run build

if [ "${DB_PUSH:-false}" = "true" ]; then
  echo "[authority-rollout] 3/6 db push"
  npm run db:push
else
  echo "[authority-rollout] 3/6 skip db push (set DB_PUSH=true to enable)"
fi

echo "[authority-rollout] 4/6 sync authority sources"
if [ -n "${AUTHORITY_SOURCE_ID:-}" ]; then
  AUTHORITY_SOURCE_ID="$AUTHORITY_SOURCE_ID" AUTHORITY_SYNC_MODE="${AUTHORITY_SYNC_MODE:-incremental}" npm run sync:authority
else
  AUTHORITY_SYNC_MODE="${AUTHORITY_SYNC_MODE:-incremental}" npm run sync:authority
fi

echo "[authority-rollout] 5/6 list review queue"
AUTHORITY_PUBLISH_STATUS="${AUTHORITY_PUBLISH_STATUS:-review}" AUTHORITY_REVIEW_LIMIT="${AUTHORITY_REVIEW_LIMIT:-20}" npm run review:authority -- list

if [ -n "${AUTHORITY_PUBLISH_IDS:-}" ]; then
  echo "[authority-rollout] 6/6 publish reviewed documents: $AUTHORITY_PUBLISH_IDS"
  AUTHORITY_DOCUMENT_IDS="$AUTHORITY_PUBLISH_IDS" npm run review:authority -- publish
else
  echo "[authority-rollout] 6/6 skip publish (set AUTHORITY_PUBLISH_IDS=12,18,23 to enable)"
fi

echo "[authority-rollout] done"
