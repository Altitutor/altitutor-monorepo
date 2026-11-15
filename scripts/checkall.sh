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

mode="${1:---profile}"
if [ "$mode" = "--profile" ]; then
  profile="${2:-full}"
  case "$profile" in check|full) ;; *) echo "Unknown validation profile: $profile" >&2; exit 2 ;; esac
elif [ "$mode" = "--database-only" ]; then
  profile=database
elif [ "$mode" = "--owned-only" ] && [ "${ALTITUTOR_OWNED_DB_INNER:-}" = "1" ]; then
  profile="${ALTITUTOR_VALIDATION_PROFILE:-full}"
else
  echo "Usage: pnpm checkall [--profile full|check]" >&2
  exit 2
fi

section() {
  if [ -n "${ALTITUTOR_VALIDATION_RECEIPT:-}" ]; then
    node scripts/validation-receipt.mjs stage --file "$ALTITUTOR_VALIDATION_RECEIPT" \
      --name "$1" --expected-revision "$ALTITUTOR_VALIDATION_REVISION"
  fi
  printf '\n==> %s\n' "$1"
}

if [ "${ALTITUTOR_OWNED_DB_INNER:-}" != "1" ]; then
  export ALTITUTOR_VALIDATION_PROFILE="$profile"
  export ALTITUTOR_VALIDATION_REVISION="${ALTITUTOR_VALIDATION_REVISION:-1}"
  export ALTITUTOR_VALIDATION_RECEIPT="${ALTITUTOR_VALIDATION_RECEIPT:-$(mktemp -t altitutor-validation.XXXXXXXX)}"
  node scripts/validation-receipt.mjs init --file "$ALTITUTOR_VALIDATION_RECEIPT" \
    --profile "$profile" --owner "${ALTITUTOR_VALIDATION_OWNER:-local}" --revision "$ALTITUTOR_VALIDATION_REVISION" \
    --head "$(git rev-parse HEAD)" --base "${ALTITUTOR_VALIDATION_BASE:-$(git merge-base HEAD origin/develop)}" \
    --dirty "$([ -n "$(git status --porcelain)" ] && echo true || echo false)"
  finish() {
    result=$?
    trap - EXIT
    node scripts/validation-receipt.mjs finish --file "$ALTITUTOR_VALIDATION_RECEIPT" \
      --exit "$result" --expected-revision "$ALTITUTOR_VALIDATION_REVISION" || result=1
    node scripts/validation-receipt.mjs status --file "$ALTITUTOR_VALIDATION_RECEIPT" \
      --expected-revision "$ALTITUTOR_VALIDATION_REVISION" || result=1
    printf '\nValidation receipt: %s\n' "$ALTITUTOR_VALIDATION_RECEIPT"
    exit "$result"
  }
  trap finish EXIT
  section preflight
  node scripts/validation-preflight.mjs "$profile"
fi

if [ "${ALTITUTOR_OWNED_DB_INNER:-}" != "1" ] && [ "$profile" != "database" ]; then
if [ "$profile" = "full" ]; then
section release-contracts
node --test \
  scripts/teaching-release.test.mjs \
  scripts/production-release-gate.test.mjs \
  scripts/production-web-smoke.test.mjs \
  scripts/start-local-supabase.test.mjs \
  scripts/ucat-system-test-paths.test.mjs \
  scripts/ucat-production-smoke.test.mjs \
  scripts/web-system-test-paths.test.mjs \
  scripts/validation-preflight.test.mjs \
  scripts/verify-ucat-test-inventory.test.mjs \
  scripts/checkall-profiles.test.mjs \
  scripts/validation-plan.test.mjs \
  scripts/validation-receipt.test.mjs

python3 scripts/owned_database.test.py
python3 scripts/worktree_dev.test.py

section mailbox-contracts
node --test secrets/scripts/deploy-runtime.test.mjs

section email-artifacts
pnpm email:check

fi

section lint
pnpm lint

section typecheck
pnpm typecheck

section unit
if [ "$profile" = "check" ]; then
  pnpm test
  exit 0
fi
# Coverage uses the same complete UCAT test inventory; do not execute it twice.
pnpm test --filter='!ucat-web'

section coverage
node scripts/verify-ucat-test-inventory.mjs
pnpm --filter ucat-web test:coverage

section edge-contracts
deno test --config supabase/functions/deno.json --allow-env supabase/functions --frozen-lockfile

fi

# Each DB invocation gets its own owned stack and ports, including the browser
# server lifetime. Only consumers of the same runtime share a lease.
if [ "${ALTITUTOR_OWNED_DB_INNER:-}" != "1" ]; then
  section owned-startup
  if [ "$profile" = "database" ]; then
    python3 scripts/owned_database.py gate
  else
    python3 scripts/owned_database.py run -- bash scripts/checkall.sh --owned-only
  fi
  exit 0
fi
python3 scripts/owned_database.py verify-inner

# Expo exports and app builds need local connection settings. Bind only these
# stages to the verified stack; unit tests above also cover unconfigured previews.
if [ "${1:-}" = "--owned-only" ]; then
  section build
  pnpm build --concurrency=1
fi

section database-setup
supabase db reset --local
python3 scripts/owned_database.py verify-inner
bash supabase/scripts/apply-ucat-test-seed.sh

section database-contracts
supabase test db

section generation-replacement
pnpm --filter ucat-web exec jest --runInBand --testMatch '**/generation-replacement.integration.ts'

section registration-auth
python3 supabase/scripts/test-student-registration.py

section imessage-contracts
python3 scripts/test-imessage-inbound.py

section interview-migration
python3 supabase/scripts/test-interview-station-upgrade.py

section interview-concurrency
python3 supabase/scripts/test-interview-concurrency.py

section browser-critical
pnpm --filter ucat-web exec playwright install chromium
if [ -z "${UCAT_E2E_BASE_URL:-}" ]; then
  ucat_e2e_port="$(node -e 'const net = require("node:net"); const server = net.createServer().listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
  export UCAT_E2E_BASE_URL="http://localhost:${ucat_e2e_port}"
fi
# Always start this checkout's UCAT server. A different local web app may be
# listening on the default port, which Playwright would otherwise reuse.
CI=1 pnpm --filter ucat-web test:e2e:critical

section owned-cleanup
printf '\nOwned database stages completed; outer receipt includes cleanup outcome.\n'
