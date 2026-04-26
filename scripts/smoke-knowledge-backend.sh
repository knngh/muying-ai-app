#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
VIP_USERNAME="${VIP_USERNAME:-demo_vip_user}"
POSTPARTUM_USERNAME="${POSTPARTUM_USERNAME:-demo_postpartum_user}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-Test123456!}"
VIP_PASSWORD="${VIP_PASSWORD:-${DEFAULT_PASSWORD}}"
POSTPARTUM_PASSWORD="${POSTPARTUM_PASSWORD:-${DEFAULT_PASSWORD}}"
ARTICLE_KEYWORD="${ARTICLE_KEYWORD:-孕期}"
LIST_PAGE_SIZE="${LIST_PAGE_SIZE:-8}"
TRANSLATION_WAIT="${TRANSLATION_WAIT:-1}"
RUN_MUTATION_SMOKE="${RUN_MUTATION_SMOKE:-true}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin jq
require_bin python3

login() {
  local username="$1"
  local password="$2"

  curl -fsS "${API_BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${username}\",\"password\":\"${password}\"}" |
    jq -r '.data.token'
}

encode_query() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"
}

extract_article_field() {
  local json="$1"
  local field="$2"
  printf '%s\n' "${json}" | jq -r "${field}"
}

assert_non_empty() {
  local label="$1"
  local value="$2"
  if [[ -z "${value}" || "${value}" == "null" ]]; then
    echo "Expected non-empty value for ${label}" >&2
    exit 1
  fi
}

print_step() {
  echo
  echo "==> $1"
}

print_step "login"
VIP_TOKEN="$(login "${VIP_USERNAME}" "${VIP_PASSWORD}")"
POSTPARTUM_TOKEN="$(login "${POSTPARTUM_USERNAME}" "${POSTPARTUM_PASSWORD}")"
assert_non_empty "VIP token" "${VIP_TOKEN}"
assert_non_empty "postpartum token" "${POSTPARTUM_TOKEN}"
echo "VIP login ok"
echo "Postpartum login ok"

print_step "knowledge list"
ENCODED_KEYWORD="$(encode_query "${ARTICLE_KEYWORD}")"
ARTICLE_LIST_RESPONSE="$(curl -fsS "${API_BASE}/articles?page=1&pageSize=${LIST_PAGE_SIZE}&contentType=authority&keyword=${ENCODED_KEYWORD}" -H "Authorization: Bearer ${VIP_TOKEN}")"
printf '%s\n' "${ARTICLE_LIST_RESPONSE}" | jq '{count:(.data.list|length),first:(.data.list[0]|{id,slug,title,sourceLanguage,sourceOrg,topic,stage})}'
printf '%s\n' "${ARTICLE_LIST_RESPONSE}" | jq -e '(.data.list | length) > 0' >/dev/null

ARTICLE_ID="$(extract_article_field "${ARTICLE_LIST_RESPONSE}" '.data.list[0].id')"
ARTICLE_SLUG="$(extract_article_field "${ARTICLE_LIST_RESPONSE}" '.data.list[0].slug')"
assert_non_empty "article id" "${ARTICLE_ID}"
assert_non_empty "article slug" "${ARTICLE_SLUG}"

print_step "knowledge detail"
ARTICLE_DETAIL_RESPONSE="$(curl -fsS "${API_BASE}/articles/${ARTICLE_SLUG}" -H "Authorization: Bearer ${VIP_TOKEN}")"
printf '%s\n' "${ARTICLE_DETAIL_RESPONSE}" | jq '{slug:.data.slug,title:.data.title,sourceLanguage:.data.sourceLanguage,hasSummary:(.data.summary|length > 0),hasContent:(.data.content|length > 0)}'
printf '%s\n' "${ARTICLE_DETAIL_RESPONSE}" | jq -e '.code == 0 and .data.slug != null and .data.title != null' >/dev/null

print_step "translation endpoint"
TRANSLATION_RESPONSE="$(curl -fsS "${API_BASE}/articles/${ARTICLE_SLUG}/translation?wait=${TRANSLATION_WAIT}" -H "Authorization: Bearer ${VIP_TOKEN}")"
printf '%s\n' "${TRANSLATION_RESPONSE}" | jq '{status:.data.status,retryAfterMs:.data.retryAfterMs,hasTranslation:(.data.translation != null),translatedTitle:.data.translation.translatedTitle}'
printf '%s\n' "${TRANSLATION_RESPONSE}" | jq -e '.code == 0 and (.data.status == "ready" or .data.status == "processing")' >/dev/null

if [[ "${RUN_MUTATION_SMOKE}" == "true" ]]; then
  print_step "favorites"
  curl -fsS -X DELETE "${API_BASE}/user/favorites/${ARTICLE_ID}" -H "Authorization: Bearer ${VIP_TOKEN}" >/dev/null || true

  curl -fsS "${API_BASE}/user/favorites" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${VIP_TOKEN}" \
    -d "{\"articleId\":${ARTICLE_ID}}" |
    jq '{code,message}'

  FAVORITES_RESPONSE="$(curl -fsS "${API_BASE}/user/favorites?page=1&pageSize=5" -H "Authorization: Bearer ${VIP_TOKEN}")"
  printf '%s\n' "${FAVORITES_RESPONSE}" | jq '{count:(.data.list|length),first:(.data.list[0]|{id,article:{id:.article.id,slug:.article.slug,title:.article.title},createdAt})}'
  printf '%s\n' "${FAVORITES_RESPONSE}" | jq -e --argjson articleId "${ARTICLE_ID}" '.code == 0 and ((.data.list // []) | map(.article.id) | index($articleId)) != null' >/dev/null

  curl -fsS -X DELETE "${API_BASE}/user/favorites/${ARTICLE_ID}" -H "Authorization: Bearer ${VIP_TOKEN}" | jq '{code,message}'

  print_step "read history"
  curl -fsS "${API_BASE}/user/read-history" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${VIP_TOKEN}" \
    -d "{\"articleId\":${ARTICLE_ID},\"readDuration\":75,\"progress\":60}" |
    jq '{code,message}'

  READ_HISTORY_RESPONSE="$(curl -fsS "${API_BASE}/user/read-history?page=1&pageSize=5" -H "Authorization: Bearer ${VIP_TOKEN}")"
  printf '%s\n' "${READ_HISTORY_RESPONSE}" | jq '{count:(.data.list|length),first:(.data.list[0]|{id,article:{id:.article.id,slug:.article.slug,title:.article.title},progress,updatedAt})}'
  printf '%s\n' "${READ_HISTORY_RESPONSE}" | jq -e --argjson articleId "${ARTICLE_ID}" '.code == 0 and ((.data.list // []) | map(.article.id) | index($articleId)) != null' >/dev/null
fi

print_step "standard schedule"
STANDARD_SCHEDULE_RESPONSE="$(curl -fsS "${API_BASE}/calendar/standard-schedule" -H "Authorization: Bearer ${POSTPARTUM_TOKEN}")"
printf '%s\n' "${STANDARD_SCHEDULE_RESPONSE}" | jq '{available:.data.available,lifecycleKey:.data.lifecycleKey,count:(.data.items|length),first:(.data.items[0] // null)}'
printf '%s\n' "${STANDARD_SCHEDULE_RESPONSE}" | jq -e '.code == 0 and .data.available == true and (.data.items | length) > 0' >/dev/null

echo
echo "Knowledge smoke completed."
