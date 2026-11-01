#!/usr/bin/env bash
set -euo pipefail

task="${1:-}"
case "$task" in
  lint|lint:fix) ;;
  *) echo "Usage: bash scripts/run-lint.sh lint|lint:fix [Turbo options]" >&2; exit 2 ;;
esac
shift

# Keep Turbo filters/dry-runs before its separator, and ESLint options after it.
exec pnpm exec turbo run "$task" "$@" -- --max-warnings=0
