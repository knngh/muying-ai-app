#!/usr/bin/env bash

set -euo pipefail

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
APP_DIR="${APP_DIR:-/www/wwwroot/muying-ai-app}"
PM2_APP_NAME="${PM2_APP_NAME:-muying-api}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
BACKUP_FILE=""
TARGET_FILE=""
WITH_BUILD="${WITH_BUILD:-true}"
WITH_RESTART="${WITH_RESTART:-true}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-rollback-backend.sh --backup-file <remote-backup-file> --target-file <remote-target-file> [--skip-build] [--skip-restart]

Env:
  SSH_USER       default: ubuntu
  SSH_HOST       default: 212.64.29.211
  APP_DIR        default: /www/wwwroot/muying-ai-app
  PM2_APP_NAME   default: muying-api
  SSH_PASSWORD   optional; when set and sshpass exists, use password auth
  WITH_BUILD     default: true
  WITH_RESTART   default: true

Example:
  scripts/prod-rollback-backend.sh \
    --backup-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts.bak-20260406-p3 \
    --target-file /www/wwwroot/muying-ai-app/src/controllers/community.controller.ts
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
    --backup-file)
      BACKUP_FILE="${2:-}"
      shift
      ;;
    --target-file)
      TARGET_FILE="${2:-}"
      shift
      ;;
    --skip-build)
      WITH_BUILD="false"
      ;;
    --skip-restart)
      WITH_RESTART="false"
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

if [[ -z "${BACKUP_FILE}" || -z "${TARGET_FILE}" ]]; then
  echo "--backup-file and --target-file are required." >&2
  usage >&2
  exit 1
fi

case "${TARGET_FILE}" in
  "${APP_DIR}"/*) ;;
  *)
    echo "target file must be inside APP_DIR: ${APP_DIR}" >&2
    exit 1
    ;;
esac

case "${BACKUP_FILE}" in
  "${APP_DIR}"/*) ;;
  *)
    echo "backup file must be inside APP_DIR: ${APP_DIR}" >&2
    exit 1
    ;;
esac

REMOTE_COMMANDS=(
  "set -euo pipefail"
  "test -f ${BACKUP_FILE@Q}"
  "mkdir -p \$(dirname ${TARGET_FILE@Q})"
  "cp ${BACKUP_FILE@Q} ${TARGET_FILE@Q}"
  "ls -l ${BACKUP_FILE@Q} ${TARGET_FILE@Q}"
  "cd ${APP_DIR}"
)

if [[ "${WITH_BUILD}" == "true" ]]; then
  REMOTE_COMMANDS+=("npm run build")
fi

if [[ "${WITH_RESTART}" == "true" ]]; then
  REMOTE_COMMANDS+=("pm2 restart ${PM2_APP_NAME}")
  REMOTE_COMMANDS+=("pm2 show ${PM2_APP_NAME} | sed -n '1,40p'")
fi

REMOTE_SCRIPT=$(printf '%s\n' "${REMOTE_COMMANDS[@]}")

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"
