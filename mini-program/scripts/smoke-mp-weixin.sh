#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEVTOOLS_CLI="${WECHAT_DEVTOOLS_CLI:-/Applications/wechatwebdevtools.app/Contents/MacOS/cli}"
OUTPUT_DIR="${MP_WEIXIN_SMOKE_OUTPUT_DIR:-/tmp/muying-mini-preview}"
INFO_OUTPUT="${OUTPUT_DIR}/info.json"
APP_JSON="${PROJECT_DIR}/dist/build/mp-weixin/app.json"

if [[ ! -x "${DEVTOOLS_CLI}" ]]; then
  echo "Missing WeChat DevTools CLI: ${DEVTOOLS_CLI}" >&2
  echo "Set WECHAT_DEVTOOLS_CLI=/path/to/cli if your installation path differs." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

echo "[1/5] type-check"
npm --prefix "${PROJECT_DIR}" run type-check

echo "[2/5] build mp-weixin"
npm --prefix "${PROJECT_DIR}" run build:mp-weixin

echo "[3/5] assert privacy config"
node -e 'const fs = require("fs"); const app = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const allowed = new Set(["chooseAddress", "chooseLocation", "choosePoi", "getFuzzyLocation", "getLocation", "onLocationChange", "startLocationUpdate", "startLocationUpdateBackground"]); const invalid = Array.isArray(app.requiredPrivateInfos) ? app.requiredPrivateInfos.filter((item) => !allowed.has(item)) : []; if (app.__usePrivacyCheck__ !== true || invalid.length > 0) { console.error(`Invalid mp-weixin privacy config: expected __usePrivacyCheck__ and no unsupported requiredPrivateInfos entries. Invalid entries: ${invalid.join(", ") || "none"}`); process.exit(1); }' "${APP_JSON}"

echo "[4/5] open project in WeChat DevTools"
"${DEVTOOLS_CLI}" open --project "${PROJECT_DIR}"

echo "[5/5] preview"
"${DEVTOOLS_CLI}" preview \
  --project "${PROJECT_DIR}" \
  --info-output "${INFO_OUTPUT}" \
  --qr-format terminal

echo "Preview info:"
cat "${INFO_OUTPUT}"

echo "Mini-program mp-weixin smoke completed."
