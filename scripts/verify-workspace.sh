#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_step() {
  local label="$1"
  shift

  echo
  echo "==> ${label}"
  (
    cd "${ROOT_DIR}"
    "$@"
  )
}

require_bin npm
require_bin npx
require_bin rg
require_bin git

echo "Workspace: ${ROOT_DIR}"

echo
echo "==> scan frontend UI leftovers"
if (
  cd "${ROOT_DIR}"
  rg -n "antd|@ant-design/icons|vendor-ui|@rc-component|rc-" \
    frontend/src frontend/package.json frontend/vite.config.ts
); then
  echo "Unexpected frontend UI leftovers detected." >&2
  exit 1
fi
echo "Frontend UI cleanup check passed."

echo
echo "==> scan generated tracked artifacts"
tracked_generated="$(git -C "${ROOT_DIR}" ls-files \
  'mobile/android/build/**' \
  'mobile/android/.gradle/**' \
  'shared/**/*.js' \
  'shared/**/*.js.map' \
  'shared/**/*.d.ts' \
  'shared/**/*.d.ts.map')"
if [[ -n "${tracked_generated}" ]]; then
  echo "Generated/cache artifacts are tracked by git:" >&2
  echo "${tracked_generated}" >&2
  exit 1
fi
echo "Generated artifact tracking check passed."

run_step "lint frontend" npm --prefix frontend run lint
run_step "build frontend" npm --prefix frontend run build
run_step "generate prisma client" npm run db:generate
run_step "lint backend" npm run lint
run_step "build backend" npm run build
run_step "test backend" npm test -- --runInBand --watchman=false
run_step "type-check mini-program" npm --prefix mini-program run type-check
run_step "build mini-program h5" npm --prefix mini-program run build:h5
run_step "build mini-program mp-weixin" npm --prefix mini-program run build:mp-weixin
run_step "build mini-program mp-alipay" npm --prefix mini-program run build:mp-alipay
run_step "lint mobile" npm --prefix mobile run lint:ci
run_step "type-check mobile" npx tsc --noEmit -p mobile/tsconfig.json

echo
echo "Workspace verification completed."
