#!/usr/bin/env bash
# Refactoring analysis for impact-first Bulletproof React cleanup.
# Usage: ./scripts/analyze-refactoring.sh [path]
#   path: apps/admin-web | apps/student-web | apps/tutor-web | apps/ucat-web | .
# Output: Candidate findings — agent must apply Impact Gate before ranking P0/P1.
# Does NOT mean "fix everything listed."

set -euo pipefail

SCOPE="${1:-apps/admin-web}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# Extract feature name from .../features/<name>/...
feature_from_path() {
  local path="$1"
  local rest="${path#*/features/}"
  echo "${rest%%/*}"
}

run_analysis() {
  local FEATURES="$1"
  local LABEL="$2"

  echo "# Refactoring Analysis: $LABEL"
  echo "# Generated: $(date -Iseconds)"
  echo "# NOTE: Candidates only. Apply Impact Gate. Demote purity-only hits."
  echo ""

  # Large components — triage aid only (not auto P1)
  echo "## LARGE_COMPONENTS_TRIAGE (>350 lines; promote only if god-module)"
  find "$FEATURES" -name "*.tsx" -path "*/components/*" ! -path "*/__tests__/*" ! -name "*.test.tsx" 2>/dev/null | while read -r f; do
    lines=$(wc -l < "$f" 2>/dev/null | tr -d ' ' || echo 0)
    if [[ "$lines" -gt 350 ]]; then
      echo "$lines $f"
    fi
  done | sort -rn || true
  echo ""

  # Cross-feature imports: importer feature != imported feature only
  echo "## CROSS_FEATURE_IMPORTS (different features only; demote intentional CRM coupling)"
  grep -r "from '@/features/\|from \"@/features/" "$FEATURES" --include="*.ts" --include="*.tsx" 2>/dev/null | while IFS= read -r line; do
    file="${line%%:*}"
    rest="${line#*:}"
    from_feature="$(feature_from_path "$file")"
    # Match @/features/<name>
    if [[ "$rest" =~ @/features/([A-Za-z0-9_-]+) ]]; then
      to_feature="${BASH_REMATCH[1]}"
      if [[ -n "$from_feature" && -n "$to_feature" && "$from_feature" != "$to_feature" ]]; then
        echo "$file -> $to_feature | $rest"
      fi
    fi
  done || true
  echo ""

  # useEffect near fetch-like calls (verify manually)
  echo "## USEEFFECT_FETCH_CANDIDATES (verify: server data into useState?)"
  grep -rn "useEffect" "$FEATURES" --include="*.tsx" --include="*.ts" 2>/dev/null | while IFS= read -r line; do
    file="${line%%:*}"
    after="${line#*:}"
    num="${after%%:*}"
    if [[ "$num" =~ ^[0-9]+$ ]]; then
      if sed -n "${num},$((num + 25))p" "$file" 2>/dev/null | grep -qE "fetch\(|axios|supabase|createClient|\.rpc\(|queryFn"; then
        echo "$file:$num"
      fi
    fi
  done || true
  echo ""

  # Any types (cap)
  echo "## ANY_TYPES (prioritize API/shared boundaries)"
  grep -rn ": any\|as any" "$FEATURES" --include="*.ts" --include="*.tsx" 2>/dev/null | head -40 || true
  echo ""

  # Barrel imports — informational only
  echo "## BARREL_IMPORTS_INTERNAL (informational / usually skip)"
  grep -rn "from '\./index'\|from '\.\./index'\|from \"\./index\"\|from \"\.\./index\"" "$FEATURES" 2>/dev/null | head -20 || true
  echo ""

  # Missing tests — informational, hard-capped (do not plan from this alone)
  echo "## MISSING_TESTS_INFORMATIONAL (capped; not a refactor backlog)"
  find "$FEATURES" -name "*.tsx" -path "*/components/*" ! -path "*/__tests__/*" ! -name "*.test.tsx" 2>/dev/null | while read -r f; do
    base="${f%.tsx}"
    dir=$(dirname "$f")
    basename=$(basename "$f" .tsx)
    if [[ ! -f "${base}.test.tsx" && ! -f "${dir}/__tests__/${basename}.test.tsx" ]]; then
      echo "NO_TEST: $f"
    fi
  done | head -15 || true
  echo "# ... truncated; do not inventory-fix missing tests"
  echo ""

  # API files with React state hooks
  echo "## API_WITH_UI_LOGIC (verify type-only / false positives)"
  grep -rl "useState\|useEffect" "$FEATURES" --include="*.ts" 2>/dev/null | grep -E "/api/" || true
  echo ""

  # Circular dependencies
  echo "## CIRCULAR_DEPENDENCIES"
  APP_DIR=$(echo "$FEATURES" | sed 's|/src/features.*||')
  if [[ -d "$APP_DIR" ]]; then
    (cd "$APP_DIR" && npx --yes madge --circular src 2>/dev/null | head -30) || echo "# Install/run: cd $APP_DIR && npx madge --circular src"
  fi
  echo ""
}

if [[ "$SCOPE" == "." ]]; then
  FOUND=0
  for app_dir in "$ROOT"/apps/*/; do
    app_name=$(basename "$app_dir")
    FEATURES="${app_dir}src/features"
    if [[ -d "$FEATURES" ]]; then
      FOUND=1
      run_analysis "$FEATURES" "apps/$app_name"
      echo "---"
    fi
  done
  if [[ "$FOUND" -eq 0 ]]; then
    echo "Error: No apps with src/features found under $ROOT/apps/"
    echo "Usage: $0 <apps/admin-web|apps/student-web|apps/tutor-web|apps/ucat-web|.>"
    exit 1
  fi
else
  FEATURES="$ROOT/$SCOPE/src/features"
  if [[ ! -d "$FEATURES" ]]; then
    echo "Error: Features directory not found: $FEATURES"
    echo "Usage: $0 <apps/admin-web|apps/student-web|apps/tutor-web|apps/ucat-web|.>"
    exit 1
  fi
  run_analysis "$FEATURES" "$SCOPE"
fi

echo "# End of analysis"
echo "# Reminder: Impact Gate before P0/P1. Skip purity theater."
