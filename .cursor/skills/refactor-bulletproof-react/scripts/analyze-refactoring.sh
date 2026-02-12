#!/usr/bin/env bash
# Refactoring analysis script for Bulletproof React
# Usage: ./scripts/analyze-refactoring.sh [path]
#   path: apps/admin-web | apps/student-web | apps/tutor-web | . (all apps)
# Output: Structured findings by antipattern type

set -euo pipefail

SCOPE="${1:-apps/admin-web}"
# Script lives in .cursor/skills/refactor-bulletproof-react/scripts/; go up to monorepo root
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FEATURES="$ROOT/$SCOPE/src/features"
OUTPUT_FORMAT="${2:-text}"

if [[ ! -d "$FEATURES" ]]; then
  echo "Error: Features directory not found: $FEATURES"
  echo "Usage: $0 <apps/admin-web|apps/student-web|apps/tutor-web|.>"
  exit 1
fi

echo "# Refactoring Analysis: $SCOPE"
echo "# Generated: $(date -Iseconds)"
echo ""

# Large components (> 200 lines)
echo "## LARGE_COMPONENTS"
find "$FEATURES" -name "*.tsx" -path "*/components/*" 2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f" 2>/dev/null || echo 0)
  if [[ $lines -gt 200 ]]; then
    echo "$lines $f"
  fi
done | sort -rn || true
echo ""

# Cross-feature imports
echo "## CROSS_FEATURE_IMPORTS"
grep -r "from '@/features/\|from \"@/features/" "$FEATURES" --include="*.ts" --include="*.tsx" 2>/dev/null | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  match=$(echo "$line" | cut -d: -f2-)
  echo "$file: $match"
done || true
echo ""

# useEffect with fetch/API patterns
echo "## USEEFFECT_FETCH"
grep -rn "useEffect" "$FEATURES" --include="*.tsx" --include="*.ts" 2>/dev/null | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  num=$(echo "$line" | cut -d: -f2)
  # Check next 20 lines for fetch-like patterns
  if sed -n "${num},$((num+20))p" "$file" 2>/dev/null | grep -qE "fetch|axios|supabase\.|\.from\(|\.get\(|\.post\("; then
    echo "$file:$num"
  fi
done || true
echo ""

# Any types
echo "## ANY_TYPES"
grep -rn ": any\|as any" "$FEATURES" --include="*.ts" --include="*.tsx" 2>/dev/null | head -50 || true
echo ""

# Barrel imports (internal)
echo "## BARREL_IMPORTS_INTERNAL"
grep -rn "from '\./index'\|from '\.\./index'\|from \"\./index\"\|from \"\.\./index\"" "$FEATURES" 2>/dev/null || true
echo ""

# Missing tests (components without .test.tsx)
echo "## MISSING_TESTS"
find "$FEATURES" -name "*.tsx" -path "*/components/*" ! -path "*/__tests__/*" ! -name "*.test.tsx" 2>/dev/null | while read -r f; do
  base="${f%.tsx}"
  dir=$(dirname "$f")
  basename=$(basename "$f" .tsx)
  # Check for adjacent .test.tsx or __tests__/ComponentName.test.tsx
  if [[ ! -f "${base}.test.tsx" && ! -f "${dir}/__tests__/${basename}.test.tsx" ]]; then
    echo "NO_TEST: $f"
  fi
done | head -80 || true
echo ""

# Separation of concerns: API files with React/hooks (heuristic)
echo "## API_WITH_UI_LOGIC"
grep -rl "useState\|useEffect\|from 'react'" "$FEATURES" --include="*.ts" 2>/dev/null | grep -E "/api/|/api\.ts$" || true
echo ""

echo "# End of analysis"
