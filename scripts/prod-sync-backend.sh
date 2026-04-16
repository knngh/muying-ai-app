#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
SSH_PORT="${SSH_PORT:-22}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"
APP_DIR="${APP_DIR:-/www/wwwroot/muying-ai-app}"
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-/tmp}"
SSH_PASSWORD="${SSH_PASSWORD:-}"

SYNC_PATHS=(
  "src"
  "prisma"
  "shared"
  "data"
  "scripts"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  ".env.example"
  "README.md"
)

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-sync-backend.sh

Env:
  SSH_USER        default: ubuntu
  SSH_HOST        default: 212.64.29.211
  SSH_PORT        default: 22
  SSH_IDENTITY_FILE optional; local private key path
  APP_DIR         default: /www/wwwroot/muying-ai-app
  REMOTE_TMP_DIR  default: /tmp
  SSH_PASSWORD    optional; when set and sshpass exists, use password auth
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

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

run_scp() {
  local scp_opts=(-P "${SSH_PORT}" -o StrictHostKeyChecking=no -o BatchMode=yes)
  if [[ -n "${SSH_IDENTITY_FILE}" ]]; then
    scp_opts+=(-i "${SSH_IDENTITY_FILE}")
  fi
  if [[ -n "${SSH_PASSWORD}" ]]; then
    sshpass -p "${SSH_PASSWORD}" scp "${scp_opts[@]}" "$@"
  else
    scp "${scp_opts[@]}" "$@"
  fi
}

if [[ -n "${SSH_PASSWORD}" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "SSH_PASSWORD is set but sshpass is not installed." >&2
  exit 1
fi

ARCHIVE_PATH="$(mktemp "${TMPDIR:-/tmp}/muying-backend-sync.XXXXXX").tar.gz"
REMOTE_ARCHIVE="${REMOTE_TMP_DIR}/$(basename "${ARCHIVE_PATH}")"

cleanup() {
  rm -f "${ARCHIVE_PATH}"
}
trap cleanup EXIT

echo "[1/3] create archive: ${ARCHIVE_PATH}"
COPYFILE_DISABLE=1 tar \
  --exclude='.DS_Store' \
  --exclude='._*' \
  -czf "${ARCHIVE_PATH}" \
  -C "${REPO_ROOT}" \
  "${SYNC_PATHS[@]}"

echo "[2/3] upload archive to ${SSH_USER}@${SSH_HOST}:${REMOTE_ARCHIVE}"
run_scp "${ARCHIVE_PATH}" "${SSH_USER}@${SSH_HOST}:${REMOTE_ARCHIVE}"

echo "[3/3] extract archive into ${APP_DIR}"
REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
mkdir -p "${APP_DIR}" "${REMOTE_TMP_DIR}"
tar --no-same-owner --no-same-permissions -xzf "${REMOTE_ARCHIVE}" -C "${APP_DIR}"
rm -f "${REMOTE_ARCHIVE}"
cd "${APP_DIR}"
pwd
EOF
)

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"

echo "Sync completed."
