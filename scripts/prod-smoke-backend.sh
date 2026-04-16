#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
LEGACY_API_BASE="${LEGACY_API_BASE:-${BASE_URL}/api}"
LEGACY_HEALTH_URL="${LEGACY_HEALTH_URL:-${BASE_URL}/api/health}"
FREE_USERNAME="${FREE_USERNAME:-demo_free_user}"
VIP_USERNAME="${VIP_USERNAME:-demo_vip_user}"
POSTPARTUM_USERNAME="${POSTPARTUM_USERNAME:-demo_postpartum_user}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-Test123456!}"
FREE_PASSWORD="${FREE_PASSWORD:-${DEFAULT_PASSWORD}}"
VIP_PASSWORD="${VIP_PASSWORD:-${DEFAULT_PASSWORD}}"
POSTPARTUM_PASSWORD="${POSTPARTUM_PASSWORD:-${DEFAULT_PASSWORD}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${DEFAULT_PASSWORD}}"
RUN_ADMIN_FUNNEL="${RUN_ADMIN_FUNNEL:-true}"
RUN_STANDARD_SCHEDULE_SMOKE="${RUN_STANDARD_SCHEDULE_SMOKE:-true}"
RUN_KNOWLEDGE_SMOKE="${RUN_KNOWLEDGE_SMOKE:-true}"
KNOWLEDGE_SMOKE_MAX_MS="${KNOWLEDGE_SMOKE_MAX_MS:-4000}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin jq
require_bin python3

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

assert_knowledge_search() {
  local token="$1"
  local query="$2"
  local must_match_regex="$3"
  local forbid_regex="${4:-}"

  local encoded_query
  encoded_query="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "${query}")"

  local raw_response
  raw_response="$(curl -fsS "${API_BASE}/ai/knowledge/search?q=${encoded_query}&limit=5" -H "Authorization: Bearer ${token}" -w $'\n%{time_total}')"
  local response
  response="$(printf '%s\n' "${raw_response}" | sed '$d')"
  local elapsed_seconds
  elapsed_seconds="$(printf '%s\n' "${raw_response}" | tail -n 1)"
  local elapsed_ms
  elapsed_ms="$(python3 -c 'import sys; print(round(float(sys.argv[1]) * 1000))' "${elapsed_seconds}")"

  printf '%s\n' "${response}" | jq --arg q "${query}" --argjson elapsedMs "${elapsed_ms}" '{query:$q,elapsedMs:$elapsedMs,total:.data.total,top:(.data.results|map({question,category,score,source})|.[0:3])}'

  if (( elapsed_ms > KNOWLEDGE_SMOKE_MAX_MS )); then
    echo "Knowledge smoke timeout: query=${query}, elapsedMs=${elapsed_ms}, maxMs=${KNOWLEDGE_SMOKE_MAX_MS}" >&2
    exit 1
  fi

  printf '%s\n' "${response}" | jq -e --arg pattern "${must_match_regex}" '
    (.data.results | length) > 0
    and ((.data.results | .[0:3] | map(.question + " " + .category) | join("\n")) | test($pattern; "i"))
  ' >/dev/null

  if [[ -n "${forbid_regex}" ]]; then
    printf '%s\n' "${response}" | jq -e --arg forbidden "${forbid_regex}" '
      ((.data.results | .[0:3] | map(.question + " " + .source) | join("\n")) | test($forbidden; "i")) | not
    ' >/dev/null
  fi
}

assert_standard_schedule() {
  local token="$1"

  local get_response
  get_response="$(curl -fsS "${API_BASE}/calendar/standard-schedule" -H "Authorization: Bearer ${token}")"
  printf '%s\n' "${get_response}" | jq '{code,message,data:{available:.data.available,lifecycleKey:.data.lifecycleKey,generatedCount:.data.generatedCount,pendingCount:.data.pendingCount,totalItems:(.data.items|length),firstItem:(.data.items[0] // null)}}'
  printf '%s\n' "${get_response}" | jq -e '.code == 0 and .data.available == true and (.data.items | length) > 0' >/dev/null

  local post_response
  post_response="$(print_json_with_status "POST" "${API_BASE}/calendar/standard-schedule/generate" "" -H "Authorization: Bearer ${token}")"
  printf '%s\n' "${post_response}" | jq '{httpStatus,code,message,data:{createdCount:.data.createdCount,generatedCount:.data.plan.generatedCount,pendingCount:.data.plan.pendingCount,totalItems:(.data.plan.items|length)}}'
  printf '%s\n' "${post_response}" | jq -e '.httpStatus == 201 and .code == 0 and .data.plan.available == true and (.data.plan.items | length) > 0' >/dev/null
}

echo "[1/7] health"
curl -fsS "${BASE_URL}/health" | jq '{status,database}'
curl -fsS "${LEGACY_HEALTH_URL}" | jq '{status,database}'
print_json_with_status "GET" "${LEGACY_API_BASE}/auth/check/username?username=legacy_route_probe" "" |
  jq '{httpStatus,code,message,available:.data.available}'

echo "[2/7] free user"
FREE_TOKEN="$(login "${FREE_USERNAME}" "${FREE_PASSWORD}")"
curl -fsS "${API_BASE}/subscription/status" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{status:.data.status,isVip:.data.isVip,aiLimit:.data.aiLimit,remainingToday:.data.remainingToday}'
curl -fsS "${API_BASE}/quota/today" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{aiLimit:.data.aiLimit,remainingToday:.data.remainingToday,isUnlimited:.data.isUnlimited}'
print_json_with_status "GET" "${API_BASE}/report/weekly/latest" "" -H "Authorization: Bearer ${FREE_TOKEN}" | jq '{httpStatus,code,message,data}'

echo "[3/7] vip user"
VIP_TOKEN="$(login "${VIP_USERNAME}" "${VIP_PASSWORD}")"
curl -fsS "${API_BASE}/subscription/status" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{status:.data.status,plan:.data.currentPlanCode,aiLimit:.data.aiLimit,remainingToday:.data.remainingToday}'
curl -fsS "${API_BASE}/quota/today" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{aiLimit:.data.aiLimit,remainingToday:.data.remainingToday,isUnlimited:.data.isUnlimited}'
curl -fsS "${API_BASE}/report/weekly/latest" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{title:.data.title,stageLabel:.data.stageLabel,createdAt:.data.createdAt}'

echo "[4/7] payment create-order"
curl -fsS "${API_BASE}/payment/create-order" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${FREE_TOKEN}" \
  -d '{"planCode":"monthly","payChannel":"wechat"}' |
  jq '{code,message,data:{orderNo:.data.orderNo,status:.data.status,amount:.data.amount}}'

echo "[5/7] community"
curl -fsS "${API_BASE}/community/posts?page=1&pageSize=3&sort=latest" | jq '{count:(.data.list|length),items:(.data.list|map({id,title,author:.author.username,isVerifiedMember:.author.isVerifiedMember}))}'
curl -fsS "${API_BASE}/community/posts/98/comments?page=1&pageSize=2" | jq '{items:(.data.list|map({id,author:.author.username,verified:.author.isVerifiedMember,replyVerified:(.replies|map(.author.isVerifiedMember))}))}'

echo "[6/7] analytics"
curl -fsS "${API_BASE}/analytics/events" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${VIP_TOKEN}" \
  -d '{"eventName":"app_weekly_report_open","source":"app","page":"WeeklyReportScreen","clientId":"smoke-client","sessionId":"smoke-session","properties":{"from":"script-smoke"}}' |
  jq '{code,message,data}'

if [[ "${RUN_STANDARD_SCHEDULE_SMOKE}" == "true" ]]; then
  echo "[7/8] standard schedule"
  POSTPARTUM_TOKEN="$(login "${POSTPARTUM_USERNAME}" "${POSTPARTUM_PASSWORD}")"
  assert_standard_schedule "${POSTPARTUM_TOKEN}"
fi

if [[ "${RUN_KNOWLEDGE_SMOKE}" == "true" ]]; then
  echo "[8/8] knowledge"
  assert_knowledge_search "${VIP_TOKEN}" "孕早期见红怎么办" "见红|出血|pregnancy-early" "政策解读|孕期全指导|Permanent Contraception|sterilisation|sterilization|Committee Opinion|Practice Update|Appendix"
  assert_knowledge_search "${VIP_TOKEN}" "宝宝发烧怎么办" "发烧|发热|高烧|common-symptoms|parenting" "政策解读|孕期全指导|Permanent Contraception|sterilisation|sterilization|Committee Opinion|Practice Update|Appendix"
  assert_knowledge_search "${VIP_TOKEN}" "孕晚期脚肿怎么办" "脚肿|浮肿|水肿|pregnancy-late" "政策解读|孕期全指导|Permanent Contraception|sterilisation|sterilization|Committee Opinion|Practice Update|Appendix"
  assert_knowledge_search "${VIP_TOKEN}" "胎动减少怎么办" "胎动|pregnancy-mid|pregnancy-late|pregnancy-birth" "政策解读|孕期全指导|Permanent Contraception|sterilisation|sterilization|Committee Opinion|Practice Update|Appendix"
  assert_knowledge_search "${VIP_TOKEN}" "宫缩频繁要去医院吗" "宫缩|阵痛|pregnancy-mid|pregnancy-late|pregnancy-birth" "政策解读|孕期全指导|Permanent Contraception|sterilisation|sterilization|Committee Opinion|Practice Update|Appendix"
fi

if [[ "${RUN_ADMIN_FUNNEL}" == "true" ]]; then
  ADMIN_TOKEN="$(login "${ADMIN_USERNAME}" "${ADMIN_PASSWORD}")"
  echo "[admin] funnel"
  curl -fsS "${API_BASE}/analytics/funnel?rangeDays=7" -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '{rangeDays:.data.rangeDays,steps:.data.steps}'
fi

echo "Smoke completed."
