#!/usr/bin/env bash
# Local equivalent of CI: lint, types, unit tests, coverage, Edge contracts,
# build, database contracts, and UCAT critical browser journeys.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

section() {
  printf '\n==> %s\n' "$1"
}

section "Release-gate contracts"
node --test \
  scripts/production-release-gate.test.mjs \
  scripts/ucat-system-test-paths.test.mjs \
  scripts/ucat-production-smoke.test.mjs

section "Generated email artifacts"
pnpm email:check

section "Lint"
pnpm turbo run lint

section "Typecheck"
pnpm turbo run typecheck

section "Unit tests"
pnpm turbo run test

section "UCAT coverage baseline"
pnpm --filter ucat-web test:coverage

section "Supabase Edge Function contracts"
if ! command -v deno >/dev/null 2>&1; then
  echo "deno is required for Edge Function contract tests." >&2
  echo "Install it from https://deno.land and re-run pnpm checkall." >&2
  exit 1
fi
deno test --config supabase/functions/deno.json --allow-env supabase/functions

section "Build"
pnpm turbo run build

section "Local Supabase (migrations + seed)"
bash supabase/scripts/render-email-templates.sh
if supabase status >/dev/null 2>&1; then
  echo "Local stack is already running; resetting so schema and seed match a fresh CI start."
  supabase db reset
else
  echo "Starting a fresh local stack (applies all migrations and seed)."
  supabase start
fi

section "Database contracts"
supabase test db

section "UCAT critical browser journeys"
pnpm --filter ucat-web exec playwright install chromium
pnpm --filter ucat-web test:e2e:critical

printf '\nAll local CI checks passed.\n'
