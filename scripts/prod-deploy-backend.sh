#!/usr/bin/env bash

set -euo pipefail

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
SSH_PORT="${SSH_PORT:-22}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"
APP_DIR="${APP_DIR:-/www/wwwroot/muying-ai-app}"
PM2_APP_NAME="${PM2_APP_NAME:-muying-api}"
AUTHORITY_PM2_APP_NAME="${AUTHORITY_PM2_APP_NAME:-muying-authority-worker}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
WITH_INSTALL="${WITH_INSTALL:-false}"
WITH_DB_PUSH="${WITH_DB_PUSH:-false}"
WITH_AUTHORITY_WORKER="${WITH_AUTHORITY_WORKER:-false}"
AUTHORITY_SYNC_INTERVAL_MINUTES="${AUTHORITY_SYNC_INTERVAL_MINUTES:-360}"
AUTHORITY_SYNC_MODE="${AUTHORITY_SYNC_MODE:-incremental}"
LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:3000/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-deploy-backend.sh [--with-install] [--with-db-push] [--with-authority-worker]

Env:
  SSH_USER       default: ubuntu
  SSH_HOST       default: 212.64.29.211
  SSH_PORT       default: 22
  SSH_IDENTITY_FILE optional; local private key path
  APP_DIR        default: /www/wwwroot/muying-ai-app
  PM2_APP_NAME   default: muying-api
  AUTHORITY_PM2_APP_NAME default: muying-authority-worker
  SSH_PASSWORD   optional; when set and sshpass exists, use password auth
  WITH_INSTALL   default: false
  WITH_DB_PUSH   default: false
  WITH_AUTHORITY_WORKER default: false
  AUTHORITY_SYNC_INTERVAL_MINUTES default: 360
  AUTHORITY_SYNC_MODE default: incremental
  LOCAL_HEALTH_URL default: http://127.0.0.1:3000/health
  HEALTH_TIMEOUT_SECONDS default: 30
EOF
}

run_ssh() {
  local ssh_opts=(-p "${SSH_PORT}" -o StrictHostKeyChecking=no -o BatchMode=yes)
  if [[ -n "${SSH_IDENTITY_FILE}" ]]; then
    ssh_opts+=(-i "${SSH_IDENTITY_FILE}")
  fi
  if [[ -n "${SSH_PASSWORD}" ]]; then
    sshpass -p "${SSH_PASSWORD}" ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
  else
    ssh "${ssh_opts[@]}" "${SSH_USER}@${SSH_HOST}" "$@"
  fi
}

if [[ -n "${SSH_PASSWORD}" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "SSH_PASSWORD is set but sshpass is not installed." >&2
  exit 1
fi

while (($# > 0)); do
  case "$1" in
    --with-install)
      WITH_INSTALL="true"
      ;;
    --with-db-push)
      WITH_DB_PUSH="true"
      ;;
    --with-authority-worker)
      WITH_AUTHORITY_WORKER="true"
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

REMOTE_COMMANDS=(
  "cd ${APP_DIR}"
  "pwd"
)

if [[ "${WITH_INSTALL}" == "true" ]]; then
  REMOTE_COMMANDS+=("npm install")
fi

if [[ "${WITH_DB_PUSH}" == "true" ]]; then
  REMOTE_COMMANDS+=("npm run db:push")
fi

REMOTE_COMMANDS+=(
  "npm run build"
  "pm2 restart ${PM2_APP_NAME} --update-env"
  "echo '[health] waiting for ${PM2_APP_NAME} at ${LOCAL_HEALTH_URL} (timeout ${HEALTH_TIMEOUT_SECONDS}s)'"
  "for i in \$(seq 1 ${HEALTH_TIMEOUT_SECONDS}); do if curl -fsS --max-time 2 ${LOCAL_HEALTH_URL} >/dev/null 2>&1; then echo \"[health] ${PM2_APP_NAME} healthy after \${i}s\"; break; fi; if [ \$i -eq ${HEALTH_TIMEOUT_SECONDS} ]; then echo '[health] ${PM2_APP_NAME} did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s' >&2; pm2 logs ${PM2_APP_NAME} --lines 40 --nostream || true; exit 1; fi; sleep 1; done"
  "pm2 show ${PM2_APP_NAME} | sed -n '1,40p'"
)

if [[ "${WITH_AUTHORITY_WORKER}" == "true" ]]; then
  REMOTE_COMMANDS+=(
    "if pm2 describe ${AUTHORITY_PM2_APP_NAME} >/dev/null 2>&1; then AUTHORITY_SYNC_INTERVAL_MINUTES=${AUTHORITY_SYNC_INTERVAL_MINUTES} AUTHORITY_SYNC_MODE=${AUTHORITY_SYNC_MODE} AUTHORITY_SYNC_RUN_ONCE=false pm2 restart ${AUTHORITY_PM2_APP_NAME} --update-env; else AUTHORITY_SYNC_INTERVAL_MINUTES=${AUTHORITY_SYNC_INTERVAL_MINUTES} AUTHORITY_SYNC_MODE=${AUTHORITY_SYNC_MODE} AUTHORITY_SYNC_RUN_ONCE=false pm2 start dist/workers/authority-sync.worker.js --name ${AUTHORITY_PM2_APP_NAME} --time; fi"
    "pm2 show ${AUTHORITY_PM2_APP_NAME} | sed -n '1,60p'"
  )
fi

REMOTE_COMMANDS+=("pm2 save")

REMOTE_SCRIPT=$(printf '%s\n' "set -euo pipefail" "${REMOTE_COMMANDS[@]}")

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"
