#!/usr/bin/env bash
# Local equivalent of CI: lint, types, unit tests, coverage, Edge contracts,
# build, database contracts, and UCAT critical browser journeys.
set -euo pipefail

# Verification must never send telemetry, even when invoked with copied deployment env.
export SENTRY_DISABLED=true NEXT_PUBLIC_SENTRY_DISABLED=true EXPO_PUBLIC_SENTRY_DISABLED=true
export SENTRY_TEST_OPT_IN=false NEXT_PUBLIC_SENTRY_TEST_OPT_IN=false EXPO_PUBLIC_SENTRY_TEST_OPT_IN=false
export SENTRY_DSN= NEXT_PUBLIC_SENTRY_DSN= EXPO_PUBLIC_SENTRY_DSN=

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

section() {
  printf '\n==> %s\n' "$1"
}

if [ "${1:-}" != "--database-only" ] && [ "${1:-}" != "--owned-only" ]; then
section "Release-gate contracts"
node --test \
  scripts/production-release-gate.test.mjs \
  scripts/production-web-smoke.test.mjs \
  scripts/start-local-supabase.test.mjs \
  scripts/ucat-system-test-paths.test.mjs \
  scripts/ucat-production-smoke.test.mjs \
  scripts/web-system-test-paths.test.mjs

python3 scripts/owned_database.test.py
python3 scripts/worktree_dev.test.py

section "Generated email artifacts"
pnpm email:check

section "Lint"
pnpm turbo run lint

section "Typecheck"
pnpm turbo run typecheck

section "Unit tests"
pnpm test

section "UCAT coverage baseline"
pnpm --filter ucat-web test:coverage

section "Supabase Edge Function contracts"
if ! command -v deno >/dev/null 2>&1; then
  echo "deno is required for Edge Function contract tests." >&2
  echo "Install it from https://deno.land and re-run pnpm checkall." >&2
  exit 1
fi
deno test --config supabase/functions/deno.json --allow-env supabase/functions

fi

# Each DB invocation gets its own owned stack and ports, including the browser
# server lifetime. Only consumers of the same runtime share a lease.
if [ "${ALTITUTOR_OWNED_DB_INNER:-}" != "1" ]; then
  if [ "${1:-}" = "--database-only" ]; then
    exec python3 scripts/owned_database.py gate
  fi
  exec python3 scripts/owned_database.py run -- bash scripts/checkall.sh --owned-only
fi
python3 scripts/owned_database.py verify-inner

# Expo exports and app builds need local connection settings. Bind only these
# stages to the verified stack; unit tests above also cover unconfigured previews.
if [ "${1:-}" = "--owned-only" ]; then
  section "Build"
  pnpm turbo run build --concurrency=1
fi

section "Owned disposable Supabase (migrations + seed)"
supabase db reset --local
python3 scripts/owned_database.py verify-inner
bash supabase/scripts/apply-ucat-test-seed.sh

section "Database contracts"
supabase test db

section "Student registration Auth/database contracts"
python3 supabase/scripts/test-student-registration.py

section "Inbound iMessage identity and replay contracts"
python3 scripts/test-imessage-inbound.py

section "Medicine interview station migration preservation"
python3 supabase/scripts/test-interview-station-upgrade.py

section "Concurrent medicine interview participants"
python3 supabase/scripts/test-interview-concurrency.py

section "UCAT critical browser journeys"
pnpm --filter ucat-web exec playwright install chromium
if [ -z "${UCAT_E2E_BASE_URL:-}" ]; then
  ucat_e2e_port="$(node -e 'const net = require("node:net"); const server = net.createServer().listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
  export UCAT_E2E_BASE_URL="http://localhost:${ucat_e2e_port}"
fi
# Always start this checkout's UCAT server. A different local web app may be
# listening on the default port, which Playwright would otherwise reuse.
CI=1 pnpm --filter ucat-web test:e2e:critical

printf '\nAll local CI checks passed.\n'
