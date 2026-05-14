#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
VIP_USERNAME="${VIP_USERNAME:-demo_vip_user}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-Test123456!}"
VIP_PASSWORD="${VIP_PASSWORD:-${DEFAULT_PASSWORD}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${DEFAULT_PASSWORD}}"
AI_SMOKE_STAGE="${AI_SMOKE_STAGE:-newborn}"
AI_SMOKE_QUESTION="${AI_SMOKE_QUESTION:-宝宝37.8度低热，精神还可以，需要马上去医院吗？请用三点说明。}"
AI_SMOKE_MAX_TIME_SECONDS="${AI_SMOKE_MAX_TIME_SECONDS:-45}"
AI_SMOKE_ANALYTICS_WAIT_SECONDS="${AI_SMOKE_ANALYTICS_WAIT_SECONDS:-16}"
AI_SMOKE_RECOMMENDATION_LIMIT="${AI_SMOKE_RECOMMENDATION_LIMIT:-3}"
AI_OVERVIEW_RANGE_DAYS="${AI_OVERVIEW_RANGE_DAYS:-7}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

login() {
  local username="$1"
  local password="$2"

  curl -fsS "${API_BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${username}\",\"password\":\"${password}\"}" |
    jq -r '.data.token'
}

get_ai_overview() {
  local token="$1"

  curl -fsS "${API_BASE}/analytics/ai-overview?rangeDays=${AI_OVERVIEW_RANGE_DAYS}" \
    -H "Authorization: Bearer ${token}"
}

get_number() {
  local json="$1"
  local path="$2"

  printf '%s\n' "${json}" | jq -r "${path} // 0"
}

print_ai_overview_delta() {
  local before_json="$1"
  local after_json="$2"

  jq -n \
    --argjson before "${before_json}" \
    --argjson after "${after_json}" \
    '{
      before: {
        requestsStarted: ($before.data.serverAi.requestsStarted // 0),
        responsesCompleted: ($before.data.serverAi.responsesCompleted // 0),
        requestErrors: ($before.data.serverAi.requestErrors // 0),
        recommendedQuestionsServed: ($before.data.serverAi.recommendedQuestionsServed // 0)
      },
      after: {
        requestsStarted: ($after.data.serverAi.requestsStarted // 0),
        responsesCompleted: ($after.data.serverAi.responsesCompleted // 0),
        requestErrors: ($after.data.serverAi.requestErrors // 0),
        recommendedQuestionsServed: ($after.data.serverAi.recommendedQuestionsServed // 0),
        topEndpoints: (($after.data.serverAi.endpointBreakdown // [])[0:5]),
        topProviders: (($after.data.serverAi.providerBreakdown // [])[0:5]),
        topErrors: (($after.data.serverAi.errorCodeBreakdown // [])[0:5])
      },
      delta: {
        requestsStarted: (($after.data.serverAi.requestsStarted // 0) - ($before.data.serverAi.requestsStarted // 0)),
        responsesCompleted: (($after.data.serverAi.responsesCompleted // 0) - ($before.data.serverAi.responsesCompleted // 0)),
        requestErrors: (($after.data.serverAi.requestErrors // 0) - ($before.data.serverAi.requestErrors // 0)),
        recommendedQuestionsServed: (($after.data.serverAi.recommendedQuestionsServed // 0) - ($before.data.serverAi.recommendedQuestionsServed // 0))
      }
    }'
}

require_bin curl
require_bin jq

echo "[1/5] login"
VIP_TOKEN="$(login "${VIP_USERNAME}" "${VIP_PASSWORD}")"
ADMIN_TOKEN="$(login "${ADMIN_USERNAME}" "${ADMIN_PASSWORD}")"

echo "[2/5] ai overview before"
BEFORE_OVERVIEW="$(get_ai_overview "${ADMIN_TOKEN}")"
BEFORE_STARTED="$(get_number "${BEFORE_OVERVIEW}" '.data.serverAi.requestsStarted')"
BEFORE_COMPLETED="$(get_number "${BEFORE_OVERVIEW}" '.data.serverAi.responsesCompleted')"
BEFORE_ERRORS="$(get_number "${BEFORE_OVERVIEW}" '.data.serverAi.requestErrors')"
BEFORE_TERMINAL=$((BEFORE_COMPLETED + BEFORE_ERRORS))
printf '%s\n' "${BEFORE_OVERVIEW}" |
  jq '{rangeDays:.data.rangeDays,serverAi:{requestsStarted:.data.serverAi.requestsStarted,responsesCompleted:.data.serverAi.responsesCompleted,requestErrors:.data.serverAi.requestErrors,recommendedQuestionsServed:.data.serverAi.recommendedQuestionsServed}}'

echo "[3/5] recommendation exposure"
curl -fsS "${API_BASE}/ai/knowledge/recommended-questions?stage=${AI_SMOKE_STAGE}&limit=${AI_SMOKE_RECOMMENDATION_LIMIT}" |
  jq '{total:.data.total,stage:.data.stage,source:.data.source,questions:(.data.questions|map({question,category})|.[0:3])}'

echo "[4/5] authenticated ai ask"
CLIENT_REQUEST_ID="ops-ai-smoke-$(date +%s)"
AI_REQUEST_BODY="$(jq -n \
  --arg question "${AI_SMOKE_QUESTION}" \
  --arg clientRequestId "${CLIENT_REQUEST_ID}" \
  --arg stage "${AI_SMOKE_STAGE}" \
  --arg reportId "ops-ai-smoke" \
  '{
    question: $question,
    clientRequestId: $clientRequestId,
    context: {
      entrySource: "ops_ai_smoke",
      stage: $stage,
      reportId: $reportId
    }
  }')"

set +e
AI_RAW_RESPONSE="$(curl -sS --max-time "${AI_SMOKE_MAX_TIME_SECONDS}" \
  -X POST "${API_BASE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${VIP_TOKEN}" \
  -d "${AI_REQUEST_BODY}" \
  -w $'\n%{http_code}')"
AI_CURL_EXIT=$?
set -e

AI_HTTP_STATUS="000"
AI_RESPONSE_BODY=""
if [[ -n "${AI_RAW_RESPONSE}" ]]; then
  AI_HTTP_STATUS="$(printf '%s\n' "${AI_RAW_RESPONSE}" | tail -n 1)"
  AI_RESPONSE_BODY="$(printf '%s\n' "${AI_RAW_RESPONSE}" | sed '$d')"
fi

if printf '%s\n' "${AI_RESPONSE_BODY}" | jq -e . >/dev/null 2>&1; then
  printf '%s\n' "${AI_RESPONSE_BODY}" |
    jq --arg status "${AI_HTTP_STATUS}" --argjson curlExit "${AI_CURL_EXIT}" '{
      httpStatus: ($status | tonumber),
      curlExit: $curlExit,
      code,
      message,
      data: (
        if .data then {
          answerLength: (.data.answer // "" | length),
          isEmergency: .data.isEmergency,
          degraded: .data.degraded,
          provider: .data.provider,
          model: .data.model,
          route: .data.route,
          sourcesCount: (.data.sources // [] | length),
          conversationId: .data.conversationId
        } else null end
      )
    }'
else
  jq -n \
    --arg httpStatus "${AI_HTTP_STATUS}" \
    --argjson curlExit "${AI_CURL_EXIT}" \
    --arg bodyPreview "$(printf '%s' "${AI_RESPONSE_BODY}" | head -c 500)" \
    '{httpStatus:$httpStatus,curlExit:$curlExit,bodyPreview:$bodyPreview}'
fi

if [[ "${AI_HTTP_STATUS}" =~ ^[0-9]+$ ]] && ((AI_HTTP_STATUS >= 400 && AI_HTTP_STATUS < 500)); then
  echo "AI smoke request was rejected by the API with HTTP ${AI_HTTP_STATUS}; not treating this as provider degradation." >&2
  exit 1
fi

echo "[5/5] ai overview after"
EXPECTED_STARTED=$((BEFORE_STARTED + 1))
EXPECTED_TERMINAL=$((BEFORE_TERMINAL + 1))
REQUIRE_TERMINAL_EVENT=false
if [[ "${AI_HTTP_STATUS}" =~ ^[0-9]+$ ]] && ((AI_CURL_EXIT == 0 && AI_HTTP_STATUS >= 200 && AI_HTTP_STATUS < 600)); then
  REQUIRE_TERMINAL_EVENT=true
fi

AFTER_OVERVIEW=""
deadline=$((SECONDS + AI_SMOKE_ANALYTICS_WAIT_SECONDS))
while true; do
  set +e
  AFTER_OVERVIEW="$(get_ai_overview "${ADMIN_TOKEN}")"
  OVERVIEW_EXIT=$?
  set -e

  if ((OVERVIEW_EXIT == 0)); then
    AFTER_STARTED="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.requestsStarted')"
    AFTER_COMPLETED="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.responsesCompleted')"
    AFTER_ERRORS="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.requestErrors')"
    AFTER_TERMINAL=$((AFTER_COMPLETED + AFTER_ERRORS))

    if ((AFTER_STARTED >= EXPECTED_STARTED)); then
      if [[ "${REQUIRE_TERMINAL_EVENT}" != "true" ]] || ((AFTER_TERMINAL >= EXPECTED_TERMINAL)); then
        break
      fi
    fi
  fi

  if ((SECONDS >= deadline)); then
    break
  fi
  sleep 2
done

if [[ -z "${AFTER_OVERVIEW}" ]]; then
  echo "Unable to read AI overview after smoke request." >&2
  exit 1
fi

print_ai_overview_delta "${BEFORE_OVERVIEW}" "${AFTER_OVERVIEW}"

AFTER_STARTED="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.requestsStarted')"
AFTER_COMPLETED="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.responsesCompleted')"
AFTER_ERRORS="$(get_number "${AFTER_OVERVIEW}" '.data.serverAi.requestErrors')"
AFTER_TERMINAL=$((AFTER_COMPLETED + AFTER_ERRORS))

if ((AFTER_STARTED < EXPECTED_STARTED)); then
  echo "AI request start analytics did not increase; expected at least ${EXPECTED_STARTED}, got ${AFTER_STARTED}." >&2
  exit 1
fi

if [[ "${REQUIRE_TERMINAL_EVENT}" == "true" ]] && ((AFTER_TERMINAL < EXPECTED_TERMINAL)); then
  echo "AI terminal analytics did not increase; expected completed+errors at least ${EXPECTED_TERMINAL}, got ${AFTER_TERMINAL}." >&2
  exit 1
fi

echo "AI smoke completed."
