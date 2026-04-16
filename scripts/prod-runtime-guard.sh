#!/usr/bin/env bash

set -euo pipefail

SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-212.64.29.211}"
SSH_PORT="${SSH_PORT:-39022}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
PM2_SERVICE_NAME="${PM2_SERVICE_NAME:-pm2-${SSH_USER}}"
PM2_BIN="${PM2_BIN:-/usr/bin/pm2}"

usage() {
  cat <<'EOF'
Usage:
  scripts/prod-runtime-guard.sh

Env:
  SSH_USER         default: ubuntu
  SSH_HOST         default: 212.64.29.211
  SSH_PORT         default: 39022
  SSH_IDENTITY_FILE optional; local private key path
  SSH_PASSWORD     optional; when set and sshpass exists, use password auth
  PM2_SERVICE_NAME default: pm2-${SSH_USER}
  PM2_BIN          default: /usr/bin/pm2
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

if [[ -n "${SSH_PASSWORD}" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "SSH_PASSWORD is set but sshpass is not installed." >&2
  exit 1
fi

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
CURRENT_USER="\$(id -un)"
CURRENT_HOME="\$(getent passwd "\${CURRENT_USER}" | cut -d: -f6)"
PM2_HOME_DIR="\${CURRENT_HOME}/.pm2"

sudo tee "/etc/systemd/system/${PM2_SERVICE_NAME}.service" >/dev/null <<UNIT
[Unit]
Description=PM2 process manager for \${CURRENT_USER}
Documentation=https://pm2.keymetrics.io/
After=network.target
Wants=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=\${CURRENT_USER}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=PM2_HOME=\${PM2_HOME_DIR}
ExecStart=/bin/bash -lc 'if ${PM2_BIN} ping >/dev/null 2>&1; then exit 0; else ${PM2_BIN} resurrect; fi'
ExecReload=/bin/bash -lc '${PM2_BIN} reload all || true'
ExecStop=/bin/bash -lc '${PM2_BIN} kill || true'

[Install]
WantedBy=multi-user.target
UNIT

${PM2_BIN} save
sudo systemctl daemon-reload
sudo systemctl enable --now "${PM2_SERVICE_NAME}"
systemctl is-enabled "${PM2_SERVICE_NAME}"
systemctl status "${PM2_SERVICE_NAME}" --no-pager -l | sed -n '1,12p'
${PM2_BIN} list
EOF
)

run_ssh "bash -lc $(printf '%q' "${REMOTE_SCRIPT}")"
