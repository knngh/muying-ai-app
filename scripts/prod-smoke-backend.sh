#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
FREE_USERNAME="${FREE_USERNAME:-demo_free_user}"
VIP_USERNAME="${VIP_USERNAME:-demo_vip_user}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-Test123456!}"
FREE_PASSWORD="${FREE_PASSWORD:-${DEFAULT_PASSWORD}}"
VIP_PASSWORD="${VIP_PASSWORD:-${DEFAULT_PASSWORD}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${DEFAULT_PASSWORD}}"
RUN_ADMIN_FUNNEL="${RUN_ADMIN_FUNNEL:-true}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin jq

print_json_with_status() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  shift 3 || true

  local response
  if [[ -n "${body}" ]]; then
    response="$(curl -sS -X "${method}" "${url}" "$@" -d "${body}" -w $'\n%{http_code}')"
  else
    response="$(curl -sS -X "${method}" "${url}" "$@" -w $'\n%{http_code}')"
  fi

  local status
  status="$(printf '%s\n' "${response}" | tail -n 1)"
  local json
  json="$(printf '%s\n' "${response}" | sed '$d')"

  printf '%s\n' "${json}" | jq --arg status "${status}" '. + {httpStatus: ($status | tonumber)}'
}

login() {
  local username="$1"
  local password="$2"

  curl -fsS "${API_BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${username}\",\"password\":\"${password}\"}" |
    jq -r '.data.token'
}

echo "[1/6] health"
curl -fsS "${BASE_URL}/health" | jq '{status,database}'

echo "[2/6] free user"
FREE_TOKEN="$(login "${FREE_USERNAME}" "${FREE_PASSWORD}")"
curl -fsS "${API_BASE}/subscription/status" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{status:.data.status,isVip:.data.isVip,aiLimit:.data.aiLimit,remainingToday:.data.remainingToday}'
curl -fsS "${API_BASE}/quota/today" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{aiLimit:.data.aiLimit,remainingToday:.data.remainingToday,isUnlimited:.data.isUnlimited}'
print_json_with_status "GET" "${API_BASE}/report/weekly/latest" "" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{httpStatus,code,message,data}'

echo "[3/6] vip user"
VIP_TOKEN="$(login "${VIP_USERNAME}" "${VIP_PASSWORD}")"
curl -fsS "${API_BASE}/subscription/status" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{status:.data.status,plan:.data.currentPlanCode,aiLimit:.data.aiLimit,remainingToday:.data.remainingToday}'
curl -fsS "${API_BASE}/quota/today" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{aiLimit:.data.aiLimit,remainingToday:.data.remainingToday,isUnlimited:.data.isUnlimited}'
curl -fsS "${API_BASE}/report/weekly/latest" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{title:.data.title,stageLabel:.data.stageLabel,createdAt:.data.createdAt}'

echo "[4/6] payment create-order"
curl -fsS "${API_BASE}/payment/create-order" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${FREE_TOKEN}" \
  -d '{"planCode":"monthly","payChannel":"wechat"}' |
  jq '{code,message,data:{orderNo:.data.orderNo,status:.data.status,amount:.data.amount}}'

echo "[5/6] community"
curl -fsS "${API_BASE}/community/posts?page=1&pageSize=3&sort=latest" | jq '{count:(.data.list|length),items:(.data.list|map({id,title,author:.author.username,isVerifiedMember:.author.isVerifiedMember}))}'
curl -fsS "${API_BASE}/community/posts/98/comments?page=1&pageSize=2" | jq '{items:(.data.list|map({id,author:.author.username,verified:.author.isVerifiedMember,replyVerified:(.replies|map(.author.isVerifiedMember))}))}'

echo "[6/6] analytics"
curl -fsS "${API_BASE}/analytics/events" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${VIP_TOKEN}" \
  -d '{"eventName":"app_weekly_report_open","source":"app","page":"WeeklyReportScreen","clientId":"smoke-client","sessionId":"smoke-session","properties":{"from":"script-smoke"}}' |
  jq '{code,message,data}'

if [[ "${RUN_ADMIN_FUNNEL}" == "true" ]]; then
  ADMIN_TOKEN="$(login "${ADMIN_USERNAME}" "${ADMIN_PASSWORD}")"
  curl -fsS "${API_BASE}/analytics/funnel?rangeDays=7" -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '{rangeDays:.data.rangeDays,steps:.data.steps}'
fi

echo "Smoke completed."
