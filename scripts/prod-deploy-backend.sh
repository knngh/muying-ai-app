#!/usr/bin/env bash

set -euo pipefail

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
APP_DIR="${APP_DIR:-/www/wwwroot/muying-ai-app}"
PM2_APP_NAME="${PM2_APP_NAME:-muying-api}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
WITH_INSTALL="${WITH_INSTALL:-false}"
WITH_DB_PUSH="${WITH_DB_PUSH:-false}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-deploy-backend.sh [--with-install] [--with-db-push]

Env:
  SSH_USER       default: ubuntu
  SSH_HOST       default: 212.64.29.211
  APP_DIR        default: /www/wwwroot/muying-ai-app
  PM2_APP_NAME   default: muying-api
  SSH_PASSWORD   optional; when set and sshpass exists, use password auth
  WITH_INSTALL   default: false
  WITH_DB_PUSH   default: false
EOF
}

run_ssh() {
  if [[ -n "${SSH_PASSWORD}" ]]; then
    sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" "$@"
  else
    ssh "${SSH_USER}@${SSH_HOST}" "$@"
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
  "pm2 restart ${PM2_APP_NAME}"
  "pm2 show ${PM2_APP_NAME} | sed -n '1,40p'"
)

REMOTE_SCRIPT=$(printf '%s\n' "${REMOTE_COMMANDS[@]}")

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"
