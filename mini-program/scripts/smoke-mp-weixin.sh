#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEVTOOLS_CLI="${WECHAT_DEVTOOLS_CLI:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
OUTPUT_DIR="${MP_WEIXIN_SMOKE_OUTPUT_DIR:-/tmp/muying-mini-preview}"
INFO_OUTPUT="${OUTPUT_DIR}/info.json"

if [[ ! -x "${DEVTOOLS_CLI}" ]]; then
  echo "Missing WeChat DevTools CLI: ${DEVTOOLS_CLI}" >&2
  echo "Set WECHAT_DEVTOOLS_CLI=/path/to/cli if your installation path differs." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "[1/4] type-check"
npm --prefix "${PROJECT_DIR}" run type-check

echo "[2/4] build mp-weixin"
npm --prefix "${PROJECT_DIR}" run build:mp-weixin

echo "[3/4] open project in WeChat DevTools"
"${DEVTOOLS_CLI}" open --project "${PROJECT_DIR}"

echo "[4/4] preview"
"${DEVTOOLS_CLI}" preview \
  --project "${PROJECT_DIR}" \
  --info-output "${INFO_OUTPUT}" \
  --qr-format terminal

echo "Preview info:"
cat "${INFO_OUTPUT}"

echo "Mini-program mp-weixin smoke completed."
