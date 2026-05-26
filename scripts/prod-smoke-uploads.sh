#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
POSTPARTUM_USERNAME="${POSTPARTUM_USERNAME:-demo_postpartum_user}"
DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-Test123456!}"
POSTPARTUM_PASSWORD="${POSTPARTUM_PASSWORD:-${DEFAULT_PASSWORD}}"

TOKEN=""
SMOKE_KEY=""
DIARY_CREATED="false"
TMP_IMAGE=""
UPLOAD_URL=""

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${TOKEN}" && -n "${SMOKE_KEY}" && ( "${DIARY_CREATED}" == "true" || -n "${UPLOAD_URL}" ) ]]; then
    local encoded_key
    encoded_key="$(jq -nr --arg value "${SMOKE_KEY}" '$value | @uri')"

    if [[ "${DIARY_CREATED}" != "true" && -n "${UPLOAD_URL}" ]]; then
      local cleanup_payload
      cleanup_payload="$(jq -nc \
        --arg timelineKey "${SMOKE_KEY}" \
        --arg imageUrl "${UPLOAD_URL}" \
        '{timelineKey:$timelineKey,content:"codex upload smoke cleanup",imageUrls:[$imageUrl]}')"
      curl -fsS -X PUT "${API_BASE}/calendar/diaries" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "${cleanup_payload}" >/dev/null || true
    fi

    curl -fsS -X DELETE "${API_BASE}/calendar/diaries?timelineKey=${encoded_key}" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null || true
  fi

  if [[ -n "${TMP_IMAGE}" ]]; then
    rm -f "${TMP_IMAGE}"
  fi
}

trap cleanup EXIT

require_bin curl
require_bin jq
require_bin node

echo "[1/7] login"
LOGIN_PAYLOAD="$(jq -nc \
  --arg username "${POSTPARTUM_USERNAME}" \
  --arg password "${POSTPARTUM_PASSWORD}" \
  '{username:$username,password:$password}')"
TOKEN="$(curl -fsS "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "${LOGIN_PAYLOAD}" |
  jq -r '.data.token')"

if [[ -z "${TOKEN}" || "${TOKEN}" == "null" ]]; then
  echo "Login did not return a token" >&2
  exit 1
fi
echo "login ok"

echo "[2/7] choose smoke diary slot"
DIARIES_RESPONSE="$(curl -fsS "${API_BASE}/calendar/diaries" \
  -H "Authorization: Bearer ${TOKEN}")"
OCCUPIED_KEYS="$(printf '%s\n' "${DIARIES_RESPONSE}" | jq -r '.data.list[]?.timelineKey // empty')"

for week in $(seq 140 156); do
  candidate="postpartum:w${week}"
  if ! printf '%s\n' "${OCCUPIED_KEYS}" | grep -Fxq "${candidate}"; then
    SMOKE_KEY="${candidate}"
    break
  fi
done

if [[ -z "${SMOKE_KEY}" ]]; then
  echo "No free postpartum smoke diary slot found in postpartum:w140..postpartum:w156" >&2
  exit 1
fi
echo "${SMOKE_KEY}"

echo "[3/7] create smoke image"
TMP_BASE="$(mktemp "${TMPDIR:-/tmp}/muying-upload-smoke.XXXXXX")"
TMP_IMAGE="${TMP_BASE}.jpg"
rm -f "${TMP_BASE}"
OUT_PATH="${TMP_IMAGE}" node -e "const sharp = require('sharp'); sharp({ create: { width: 96, height: 64, channels: 3, background: '#7cc7ff' } }).jpeg({ quality: 90 }).toFile(process.env.OUT_PATH)"
echo "${TMP_IMAGE}"

echo "[4/7] upload image"
UPLOAD_RESPONSE="$(curl -fsS "${API_BASE}/calendar/diaries/images" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${TMP_IMAGE};type=image/jpeg")"
UPLOAD_URL="$(printf '%s\n' "${UPLOAD_RESPONSE}" | jq -r '.data.url')"
printf '%s\n' "${UPLOAD_RESPONSE}" | jq '{code,message,data}'

if [[ ! "${UPLOAD_URL}" =~ ^/uploads/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|gif|webp)$ ]]; then
  echo "Upload returned an invalid URL: ${UPLOAD_URL}" >&2
  exit 1
fi

echo "[5/7] assert uploaded image headers"
HEADERS_FILE="$(mktemp "${TMPDIR:-/tmp}/muying-upload-headers.XXXXXX")"
curl -fsS -o /dev/null -D "${HEADERS_FILE}" "${BASE_URL}${UPLOAD_URL}"
HEADERS_LOWER="$(tr -d '\r' < "${HEADERS_FILE}" | tr '[:upper:]' '[:lower:]')"
rm -f "${HEADERS_FILE}"

printf '%s\n' "${HEADERS_LOWER}" | grep -q '^cross-origin-resource-policy: cross-origin$'
printf '%s\n' "${HEADERS_LOWER}" | grep -q '^cache-control: no-store, max-age=0$'
if printf '%s\n' "${HEADERS_LOWER}" | grep -q 'immutable'; then
  echo "Uploaded image response still contains immutable cache headers" >&2
  exit 1
fi
echo "headers ok"

echo "[6/7] save and read diary"
SAVE_PAYLOAD="$(jq -nc \
  --arg timelineKey "${SMOKE_KEY}" \
  --arg imageUrl "${UPLOAD_URL}" \
  '{timelineKey:$timelineKey,content:"codex upload smoke",imageUrls:[$imageUrl]}')"
SAVE_RESPONSE="$(curl -fsS -X PUT "${API_BASE}/calendar/diaries" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "${SAVE_PAYLOAD}")"
printf '%s\n' "${SAVE_RESPONSE}" | jq '{code,message,data:{timelineKey:.data.timelineKey,imageUrls:.data.imageUrls}}'
printf '%s\n' "${SAVE_RESPONSE}" | jq -e --arg key "${SMOKE_KEY}" --arg url "${UPLOAD_URL}" \
  '.code == 0 and .data.timelineKey == $key and (.data.imageUrls | index($url)) != null' >/dev/null
DIARY_CREATED="true"

ENCODED_KEY="$(jq -nr --arg value "${SMOKE_KEY}" '$value | @uri')"
READ_RESPONSE="$(curl -fsS "${API_BASE}/calendar/diaries?timelineKey=${ENCODED_KEY}" \
  -H "Authorization: Bearer ${TOKEN}")"
printf '%s\n' "${READ_RESPONSE}" | jq '{code,message,list:.data.list}'
printf '%s\n' "${READ_RESPONSE}" | jq -e --arg key "${SMOKE_KEY}" --arg url "${UPLOAD_URL}" \
  '.code == 0 and (.data.list | length) == 1 and .data.list[0].timelineKey == $key and (.data.list[0].imageUrls | index($url)) != null' >/dev/null

echo "[7/7] delete diary and assert image cleanup"
DELETE_RESPONSE="$(curl -fsS -X DELETE "${API_BASE}/calendar/diaries?timelineKey=${ENCODED_KEY}" \
  -H "Authorization: Bearer ${TOKEN}")"
printf '%s\n' "${DELETE_RESPONSE}" | jq '{code,message,data}'
printf '%s\n' "${DELETE_RESPONSE}" | jq -e '.code == 0' >/dev/null
DIARY_CREATED="false"

sleep 1
DELETED_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${UPLOAD_URL}")"
if [[ "${DELETED_STATUS}" != "404" ]]; then
  echo "Expected deleted uploaded image to return 404, got ${DELETED_STATUS}" >&2
  exit 1
fi

SUMMARY_UPLOAD_URL="${UPLOAD_URL}"
SUMMARY_SMOKE_KEY="${SMOKE_KEY}"
UPLOAD_URL=""
SMOKE_KEY=""
echo "Upload smoke completed: ${SUMMARY_UPLOAD_URL} cleaned up from ${SUMMARY_SMOKE_KEY}"
