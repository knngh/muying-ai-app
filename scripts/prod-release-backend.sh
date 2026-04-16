#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WITH_INSTALL="${WITH_INSTALL:-false}"
WITH_DB_PUSH="${WITH_DB_PUSH:-false}"
WITH_AUTHORITY_WORKER="${WITH_AUTHORITY_WORKER:-false}"
SKIP_SMOKE="${SKIP_SMOKE:-false}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-release-backend.sh [--with-install] [--with-db-push] [--with-authority-worker] [--skip-smoke]

This script runs:
  1. prod-sync-backend.sh
  2. prod-deploy-backend.sh
  3. prod-runtime-guard.sh
  4. prod-smoke-backend.sh
EOF
}

DEPLOY_ARGS=()

while (($# > 0)); do
  case "$1" in
    --with-install)
      WITH_INSTALL="true"
      DEPLOY_ARGS+=("--with-install")
      ;;
    --with-db-push)
      WITH_DB_PUSH="true"
      DEPLOY_ARGS+=("--with-db-push")
      ;;
    --with-authority-worker)
      WITH_AUTHORITY_WORKER="true"
      DEPLOY_ARGS+=("--with-authority-worker")
      ;;
    --skip-smoke)
      SKIP_SMOKE="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

echo "[1/4] sync"
bash "${SCRIPT_DIR}/prod-sync-backend.sh"

echo "[2/4] deploy"
if ((${#DEPLOY_ARGS[@]} > 0)); then
  bash "${SCRIPT_DIR}/prod-deploy-backend.sh" "${DEPLOY_ARGS[@]}"
else
  bash "${SCRIPT_DIR}/prod-deploy-backend.sh"
fi

echo "[3/4] runtime"
bash "${SCRIPT_DIR}/prod-runtime-guard.sh"

if [[ "${SKIP_SMOKE}" == "true" ]]; then
  echo "[4/4] smoke skipped"
  exit 0
fi

echo "[4/4] smoke"
bash "${SCRIPT_DIR}/prod-smoke-backend.sh"
