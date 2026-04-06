#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-https://beihu.me}"
API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
PROVIDER="${PROVIDER:-wechat}"
PAYMENT_USERNAME="${PAYMENT_USERNAME:-demo_free_user}"
PAYMENT_PASSWORD="${PAYMENT_PASSWORD:-Test123456!}"
PAYMENT_PLAN_CODE="${PAYMENT_PLAN_CODE:-monthly}"
PAYMENT_CALLBACK_SECRET="${PAYMENT_CALLBACK_SECRET:-}"
if [[ -z "${PAYMENT_CALLBACK_SECRET}" ]]; then
  if [[ "${PROVIDER}" == "wechat" ]]; then
    PAYMENT_CALLBACK_SECRET="${WECHAT_PAYMENT_CALLBACK_SECRET:-}"
  else
    PAYMENT_CALLBACK_SECRET="${ALIPAY_PAYMENT_CALLBACK_SECRET:-}"
  fi
fi

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

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

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

assert_response() {
  local label="$1"
  local response_json="$2"
  local expected_http="$3"
  local expected_code="$4"
  local expected_message="${5:-}"

  local actual_http
  actual_http="$(printf '%s\n' "${response_json}" | jq -r '.httpStatus')"
  local actual_code
  actual_code="$(printf '%s\n' "${response_json}" | jq -r '.code')"
  local actual_message
  actual_message="$(printf '%s\n' "${response_json}" | jq -r '.message')"

  if [[ "${actual_http}" != "${expected_http}" ]]; then
    printf '%s\n' "${response_json}" >&2
    fail "${label}: expected http ${expected_http}, got ${actual_http}"
  fi

  if [[ "${actual_code}" != "${expected_code}" ]]; then
    printf '%s\n' "${response_json}" >&2
    fail "${label}: expected code ${expected_code}, got ${actual_code}"
  fi

  if [[ -n "${expected_message}" && "${actual_message}" != *"${expected_message}"* ]]; then
    printf '%s\n' "${response_json}" >&2
    fail "${label}: expected message to contain ${expected_message}, got ${actual_message}"
  fi
}

login() {
  curl -fsS "${API_BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${PAYMENT_USERNAME}\",\"password\":\"${PAYMENT_PASSWORD}\"}" |
    jq -r '.data.token'
}

create_order() {
  local token="$1"
  local pay_channel="$2"

  curl -fsS "${API_BASE}/payment/create-order" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${token}" \
    -d "{\"planCode\":\"${PAYMENT_PLAN_CODE}\",\"payChannel\":\"${pay_channel}\"}"
}

build_trade_no() {
  local tag="$1"
  printf 'VERIFY-%s-%s-%s-%s' "${PROVIDER}" "${tag}" "$$" "${RANDOM}"
}

current_timestamp_ms() {
  node -e 'process.stdout.write(String(Date.now()))'
}

build_body() {
  local order_no="$1"
  local trade_no="$2"
  local amount="$3"

  jq -nc \
    --arg orderNo "${order_no}" \
    --arg tradeNo "${trade_no}" \
    --argjson amount "${amount}" \
    '{orderNo:$orderNo,tradeNo:$tradeNo,amount:$amount,paymentStatus:"success"}'
}

generate_signature() {
  local order_no="$1"
  local trade_no="$2"
  local amount="$3"

  npm run -s ops:sign:payment-callback -- \
    --provider "${PROVIDER}" \
    --secret "${PAYMENT_CALLBACK_SECRET}" \
    --order-no "${order_no}" \
    --trade-no "${trade_no}" \
    --amount "${amount}"
}

run_signed_callback() {
  local token="$1"
  local order_no="$2"
  local trade_no="$3"
  local amount="$4"
  local signature="${5:-}"
  local include_auth="${6:-false}"
  local include_signature="${7:-true}"
  local timestamp_override="${8:-}"

  local body
  body="$(build_body "${order_no}" "${trade_no}" "${amount}")"

  local timestamp=""
  local generated_signature=""
  if [[ "${include_signature}" == "true" ]]; then
    if [[ -n "${timestamp_override}" ]]; then
      timestamp="${timestamp_override}"
    else
      local signature_payload
      signature_payload="$(generate_signature "${order_no}" "${trade_no}" "${amount}")"
      timestamp="$(printf '%s\n' "${signature_payload}" | jq -r '.timestamp')"
      generated_signature="$(printf '%s\n' "${signature_payload}" | jq -r '.signature')"
    fi
  fi

  local args=(
    -H 'Content-Type: application/json'
  )

  if [[ "${include_auth}" == "true" ]]; then
    args+=(-H "Authorization: Bearer ${token}")
  fi

  if [[ "${include_signature}" == "true" ]]; then
    if [[ -z "${signature}" ]]; then
      signature="${generated_signature}"
    fi
    args+=(-H "X-Payment-Timestamp: ${timestamp}")
    args+=(-H "X-Payment-Signature: ${signature}")
  fi

  print_json_with_status "POST" "${API_BASE}/payment/callback/${PROVIDER}" "${body}" "${args[@]}"
}

verify_paid_order() {
  local token="$1"
  local order_no="$2"

  local response
  response="$(print_json_with_status "GET" "${API_BASE}/payment/order/${order_no}" "" -H "Authorization: Bearer ${token}")"
  assert_response "order lookup" "${response}" "200" "0"

  local status
  status="$(printf '%s\n' "${response}" | jq -r '.data.status')"
  if [[ "${status}" != "paid" ]]; then
    printf '%s\n' "${response}" >&2
    fail "order lookup: expected paid status, got ${status}"
  fi
}

extract_order_field() {
  local order_json="$1"
  local field="$2"
  printf '%s\n' "${order_json}" | jq -r "${field}"
}

opposite_provider() {
  if [[ "${PROVIDER}" == "wechat" ]]; then
    echo "alipay"
  else
    echo "wechat"
  fi
}

require_bin curl
require_bin jq
require_bin npm
require_bin node

if [[ "${PROVIDER}" != "wechat" && "${PROVIDER}" != "alipay" ]]; then
  fail "PROVIDER must be wechat or alipay"
fi

if [[ -z "${PAYMENT_CALLBACK_SECRET}" ]]; then
  fail "PAYMENT_CALLBACK_SECRET is required"
fi

echo "[1/5] login"
TOKEN="$(login)"

echo "[2/5] valid signed callback"
SUCCESS_ORDER="$(create_order "${TOKEN}" "${PROVIDER}")"
SUCCESS_ORDER_NO="$(extract_order_field "${SUCCESS_ORDER}" '.data.orderNo')"
SUCCESS_AMOUNT="$(extract_order_field "${SUCCESS_ORDER}" '.data.amount')"
SUCCESS_TRADE_NO="$(build_trade_no success)"
SUCCESS_RESPONSE="$(run_signed_callback "${TOKEN}" "${SUCCESS_ORDER_NO}" "${SUCCESS_TRADE_NO}" "${SUCCESS_AMOUNT}")"
assert_response "valid signed callback" "${SUCCESS_RESPONSE}" "200" "0"
verify_paid_order "${TOKEN}" "${SUCCESS_ORDER_NO}"

echo "[3/5] invalid signature must not fall back to auth"
INVALID_ORDER="$(create_order "${TOKEN}" "${PROVIDER}")"
INVALID_ORDER_NO="$(extract_order_field "${INVALID_ORDER}" '.data.orderNo')"
INVALID_AMOUNT="$(extract_order_field "${INVALID_ORDER}" '.data.amount')"
INVALID_TRADE_NO="$(build_trade_no invalid)"
INVALID_RESPONSE="$(run_signed_callback "${TOKEN}" "${INVALID_ORDER_NO}" "${INVALID_TRADE_NO}" "${INVALID_AMOUNT}" "invalid-signature" "true" "true" "$(current_timestamp_ms)")"
assert_response "invalid signature" "${INVALID_RESPONSE}" "403" "4001" "支付回调签名无效"

echo "[4/5] unsigned callback must not fall back to auth"
UNSIGNED_ORDER="$(create_order "${TOKEN}" "${PROVIDER}")"
UNSIGNED_ORDER_NO="$(extract_order_field "${UNSIGNED_ORDER}" '.data.orderNo')"
UNSIGNED_AMOUNT="$(extract_order_field "${UNSIGNED_ORDER}" '.data.amount')"
UNSIGNED_TRADE_NO="$(build_trade_no unsigned)"
UNSIGNED_RESPONSE="$(run_signed_callback "${TOKEN}" "${UNSIGNED_ORDER_NO}" "${UNSIGNED_TRADE_NO}" "${UNSIGNED_AMOUNT}" "" "true" "false")"
assert_response "unsigned callback" "${UNSIGNED_RESPONSE}" "401" "4001" "支付回调签名缺失"

echo "[5/5] signed mismatch checks"
MISMATCH_ORDER="$(create_order "${TOKEN}" "${PROVIDER}")"
MISMATCH_ORDER_NO="$(extract_order_field "${MISMATCH_ORDER}" '.data.orderNo')"
MISMATCH_AMOUNT="$(extract_order_field "${MISMATCH_ORDER}" '.data.amount')"
MISMATCH_TRADE_NO="$(build_trade_no amount)"
WRONG_AMOUNT="$(jq -n --argjson amount "${MISMATCH_AMOUNT}" '$amount + 1')"
MISMATCH_RESPONSE="$(run_signed_callback "${TOKEN}" "${MISMATCH_ORDER_NO}" "${MISMATCH_TRADE_NO}" "${WRONG_AMOUNT}")"
assert_response "amount mismatch" "${MISMATCH_RESPONSE}" "400" "1001" "支付金额不匹配"

CHANNEL_ORDER="$(create_order "${TOKEN}" "$(opposite_provider)")"
CHANNEL_ORDER_NO="$(extract_order_field "${CHANNEL_ORDER}" '.data.orderNo')"
CHANNEL_AMOUNT="$(extract_order_field "${CHANNEL_ORDER}" '.data.amount')"
CHANNEL_TRADE_NO="$(build_trade_no channel)"
CHANNEL_RESPONSE="$(run_signed_callback "${TOKEN}" "${CHANNEL_ORDER_NO}" "${CHANNEL_TRADE_NO}" "${CHANNEL_AMOUNT}")"
assert_response "channel mismatch" "${CHANNEL_RESPONSE}" "400" "1001" "支付渠道不匹配"

echo "Payment callback verification passed."
echo "Verified against ${API_BASE}/payment/callback/${PROVIDER} with user ${PAYMENT_USERNAME}."
echo "If you used a demo account, reseed demo data before the next public smoke."
