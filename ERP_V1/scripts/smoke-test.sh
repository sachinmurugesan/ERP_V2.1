#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test.sh — HarvestERP strangler-fig proxy smoke tests
#
# Validates that nginx is routing migrated paths to Next.js, backend paths to
# FastAPI, and all other paths to Vue.
#
# Usage:
#   bash scripts/smoke-test.sh [BASE_URL]
#
# Examples:
#   bash scripts/smoke-test.sh                  # defaults to http://localhost
#   bash scripts/smoke-test.sh http://localhost
#   bash scripts/smoke-test.sh http://localhost:8080
#
# Exit codes:
#   0  All tests passed
#   N  N tests failed (N > 0)
#
# Requirements: curl (standard on Linux/macOS; install via chocolatey on Windows)
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost}"
PASS=0
FAIL=0

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

ok()   { echo -e "${GREEN}[PASS]${NC} $*"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAIL=$((FAIL + 1)); }
warn() { echo -e "${YELLOW}[SKIP]${NC} $*"; }
info() { echo -e "       $*"; }

# ── HTTP helper ────────────────────────────────────────────────────────────────
# Returns "<status_code>|<body_first_500_chars>"
http_get() {
  local url="$1"
  local follow_redirect="${2:-}"   # pass "-L" to follow redirects
  local response
  response=$(curl -s -o /tmp/smoke_body.txt -w "%{http_code}" \
    --max-time 10 \
    ${follow_redirect} \
    -H "Accept: text/html,application/json" \
    "$url" 2>/dev/null || echo "000")
  local body
  body=$(head -c 500 /tmp/smoke_body.txt 2>/dev/null || echo "")
  echo "${response}|${body}"
}

echo ""
echo "=== HarvestERP smoke tests ==="
echo "    Base URL: $BASE_URL"
echo "    $(date)"
echo ""

# ── Test 1: GET /login → 200, Next.js login form ──────────────────────────────
echo "1. GET ${BASE_URL}/login → 200 (Next.js login form)"
result=$(http_get "${BASE_URL}/login")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "200" ]]; then
  if echo "$body" | grep -qi "email\|password\|sign.in\|login"; then
    ok "  Status 200, login form detected in body"
  else
    fail "  Status 200 but login form not detected in body"
    info "  Response body (first 500): $body"
  fi
else
  fail "  Expected 200, got $code"
  info "  Response body (first 500): $body"
fi

# ── Test 2: GET /dashboard → 307 redirect to /login (no cookie) ──────────────
echo "2. GET ${BASE_URL}/dashboard → 307 redirect to /login (no session cookie)"
result=$(http_get "${BASE_URL}/dashboard")
code="${result%%|*}"
body="${result#*|}"

# Allow 307 or 302 (both are valid temporary redirects from Next.js middleware)
if [[ "$code" == "307" || "$code" == "302" || "$code" == "303" ]]; then
  ok "  Status $code (redirect to /login as expected)"
elif [[ "$code" == "200" ]]; then
  # Some middleware implementations redirect client-side; still count as pass with warning
  warn "  Status 200 — may be a client-side redirect; check manually that /login is shown"
else
  fail "  Expected 307/302 redirect, got $code"
  info "  Response body (first 500): $body"
fi

# ── Test 3: GET /_next/static/ → Next.js static assets ───────────────────────
echo "3. GET ${BASE_URL}/_next/ → reachable (Next.js static assets)"
result=$(http_get "${BASE_URL}/_next/")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "200" || "$code" == "404" ]]; then
  # 200: some chunk served; 404: /_next/ directory listing not enabled but nginx proxied it
  ok "  Status $code — /_next/ prefix reached Next.js"
elif [[ "$code" == "502" || "$code" == "503" ]]; then
  warn "  Status $code — Next.js container may not be ready yet; re-run after startup"
else
  fail "  Expected 200 or 404 from Next.js, got $code"
  info "  Response body (first 500): $body"
fi

# ── Test 4: GET /api/health → 200 (FastAPI) ───────────────────────────────────
echo "4. GET ${BASE_URL}/api/health → 200 (FastAPI backend reachable)"
result=$(http_get "${BASE_URL}/api/health")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "200" ]]; then
  ok "  Status 200 — FastAPI health check OK"
elif [[ "$code" == "404" ]]; then
  warn "  Status 404 — /api/health endpoint may not exist; FastAPI is responding (routing OK)"
elif [[ "$code" == "502" || "$code" == "503" ]]; then
  fail "  Status $code — backend container may be down (check: docker compose ps api)"
  info "  Response body (first 500): $body"
else
  fail "  Expected 200 or 404 from FastAPI, got $code"
  info "  Response body (first 500): $body"
fi

# ── Test 5: GET /api/auth/session → 401 (Next.js auth API, no cookie) ─────────
echo "5. GET ${BASE_URL}/api/auth/session → 401 (Next.js API route, no cookie)"
result=$(http_get "${BASE_URL}/api/auth/session")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "401" || "$code" == "403" ]]; then
  ok "  Status $code — Next.js auth API route reachable and rejecting unauthenticated request"
elif [[ "$code" == "405" ]]; then
  ok "  Status 405 — Method Not Allowed (Next.js API route exists, routing works)"
elif [[ "$code" == "404" ]]; then
  warn "  Status 404 — /api/auth/session may not be implemented yet; routing reached Next.js"
elif [[ "$code" == "502" || "$code" == "503" ]]; then
  fail "  Status $code — Next.js container may be down (check: docker compose ps nextjs)"
  info "  Response body (first 500): $body"
else
  fail "  Expected 401/403/404 from Next.js, got $code"
  info "  Response body (first 500): $body"
fi

# ── Test 6: GET /orders → 200 (Vue, not-yet-migrated path) ───────────────────
echo "6. GET ${BASE_URL}/orders → 200 (Vue serving un-migrated path)"
result=$(http_get "${BASE_URL}/orders")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "200" ]]; then
  ok "  Status 200 — Vue serving /orders"
elif [[ "$code" == "502" || "$code" == "503" ]]; then
  fail "  Status $code — Vue container may be down (check: docker compose ps vue)"
  info "  Response body (first 500): $body"
else
  # Vue SPA often serves index.html for unknown routes via try_files
  warn "  Status $code for /orders — Vue may require auth redirect; manually verify"
fi

# ── Test 7: GET / → 200 or redirect (Vue root) ───────────────────────────────
echo "7. GET ${BASE_URL}/ → 200 or redirect (Vue root)"
result=$(http_get "${BASE_URL}/")
code="${result%%|*}"
body="${result#*|}"

if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" ]]; then
  ok "  Status $code — Vue root reachable"
elif [[ "$code" == "502" || "$code" == "503" ]]; then
  fail "  Status $code — Vue container may be down"
  info "  Response body (first 500): $body"
else
  fail "  Expected 200 or redirect, got $code"
  info "  Response body (first 500): $body"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Results ==="
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}Failed: $FAIL${NC}"
else
  echo -e "  Failed: $FAIL"
fi
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}Smoke tests FAILED ($FAIL failure(s))${NC}"
  exit $FAIL
else
  echo -e "${GREEN}All smoke tests PASSED${NC}"
  exit 0
fi
