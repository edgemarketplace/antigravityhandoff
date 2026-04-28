#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://edge-marketplace-hub.web.app}"

check() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
  echo "$path -> $code"
  case "$code" in
    200|201|202|204|301|302|307|308) ;;
    *)
      echo "Smoke test failed for $path"
      exit 1
      ;;
  esac
}

check "/"
check "/checkout"

# This endpoint requires intake_id; 400 confirms route is alive and validating input.
status_code=$(curl -s -o /tmp/onboarding_status_body.json -w "%{http_code}" "$BASE_URL/api/onboarding/status")
echo "/api/onboarding/status (no intake_id) -> $status_code"
if [ "$status_code" != "400" ]; then
  echo "Smoke test failed for /api/onboarding/status expected 400"
  cat /tmp/onboarding_status_body.json || true
  exit 1
fi

echo "Smoke tests passed for $BASE_URL"
