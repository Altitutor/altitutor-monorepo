# Detection Patterns for Antipatterns

How to find each Bulletproof React antipattern in the codebase.

## Cross-Feature Imports (P0)

**What**: Feature A imports from Feature B (e.g., students importing from classes).

**Search**:
```
grep -r "from '@/features/" apps/[app]/src/features/ --include="*.ts" --include="*.tsx"
```
Or use codebase_search: "imports from @/features/ where the importing file is in a different feature"

**Manual check**: For each `@/features/X` import, verify the file doing the import is NOT in `features/X/`. If it's in `features/Y/` importing from `features/X/`, that's a violation.

**Example violation**:
```typescript
// features/students/components/StudentsTable.tsx
import { ViewClassModal } from '@/features/classes/components/ViewClassModal'; // ❌
```

---

## Large Components (P1/P2)

**What**: Component files > 200 lines (P2) or > 300 lines (P1).

**Search**:
```bash
# From repo root
find apps/[app]/src/features -name "*.tsx" -path "*/components/*" -exec wc -l {} \; | awk '$1 > 200 {print $1, $2}'
```

Or list component files and read them to count lines. Components are typically in `**/components/*.tsx` or `**/components/**/*.tsx`.

---

## useEffect + Data Fetching (P0)

**What**: `useEffect` that contains fetch, axios, supabase, or api calls.

**Search**:
```
grep -r "useEffect" apps/[app]/src/features/ -A 15 --include="*.tsx" --include="*.ts" | grep -E "(fetch|axios|supabase|api\.|\.get\(|\.post\(|from\(')"
```

Or codebase_search: "useEffect that fetches data or calls API"

**Manual check**: Look for useEffect with async/await, .then(), or direct HTTP/DB calls inside.

---

## Any Types (P1)

**What**: TypeScript `any` type usage.

**Search**:
```
grep -r ": any\|as any\|\<any\>" apps/[app]/src/features/ --include="*.ts" --include="*.tsx"
```

---

## Server State in Local State (P0)

**What**: `useState` holding server-fetched data, with `useEffect` to fetch.

**Search**: Look for patterns like:
- `useState([])` or `useState(null)` for list/entity data
- Paired with `useEffect` that fetches and calls `setState`

Often overlaps with "useEffect fetch" - if they're fetching into useState, it's server state in local state.

---

## Business Logic in Components (P0)

**What**: Complex calculations, data transforms, or conditional logic in component body (not in useMemo/useCallback/hook). Risks bugs and hurts testability.

**Manual check**: Read component files. Look for:
- `.reduce()`, `.filter()`, `.map()` with non-trivial logic in render
- `data.sort()` or similar mutations/transforms
- Multi-line conditionals that affect displayed data
- API calls or data fetching

---

## Barrel Imports (Internal) (P2)

**What**: Within a feature, importing from `./index` or `../index` instead of direct path.

**Search**:
```
grep -r "from '\./index'\|from '\.\./index'\|from \"\./index\"\|from \"\.\./index\"" apps/[app]/src/features/
```

Barrel files (`index.ts`) should only be used for **external** consumers. Internal imports should use `from '../api/students'` not `from '../index'`.

---

## Missing Feature Structure (P2)

**What**: Feature folder missing standard structure (api/, hooks/, types/ when needed).

**Manual check**: For each feature in `features/`, verify:
- Has `api/` if it fetches data
- Has `hooks/` if it has React Query or custom hooks
- Has `types/` if it has TypeScript types
- Has `index.ts` for public exports (if consumed externally)

---

## Prop Drilling > 3 Levels (P1)

**What**: Props passed through 3+ component layers.

**Manual check**: Trace a prop through the component tree. If A → B → C → D all pass the same prop, consider Context or composition.

---

## Expensive Computation in Render (P2)

**What**: Function calls or object creation in render that could be memoized.

**Manual check**: Look for:
- `something.filter(...).map(...)` in JSX or before return
- `new Date()` or similar in render
- Object/array literals passed as props without useMemo
- Functions passed as props without useCallback

---

## Separation of Concerns (P2)

**What**: Files or functions mixing responsibilities – API with UI logic, hooks with rendering, utils with side effects.

**Detection**:
- **API with UI logic**: Files in `api/` that import React components, use hooks, or return JSX
- **Hooks with rendering**: Files in `hooks/` that return JSX or contain component logic
- **Utils with side effects**: Files in `utils/` that mutate state, call APIs, or have side effects beyond the return value
- **Mixed files**: Single file containing both API calls and component definitions

**Search**:
```bash
# API files importing React or components
grep -r "import.*from 'react'\|import.*Component\|useState\|useEffect" apps/[app]/src/features/*/api/ 2>/dev/null

# Utils with fetch/supabase (side effects)
grep -r "fetch\|supabase\|axios\|\.from\(" apps/[app]/src/features/*/utils/ 2>/dev/null
```

**Manual check**: Read api/, hooks/, utils/ files. API should only fetch/transform data. Hooks should not return JSX. Utils should be pure. Note: API files with only `import type` from React are false positives; verify manually.

---

## Missing Tests (P2)

**What**: Components or hooks without corresponding test files.

**Search**:
```bash
# Components without adjacent test file
for f in $(find apps/[app]/src/features -name "*.tsx" -path "*/components/*" ! -path "*/__tests__/*" ! -name "*.test.tsx"); do
  base="${f%.tsx}"; 
  if [[ ! -f "${base}.test.tsx" && ! -f "$(dirname $f)/__tests__/$(basename $f .tsx).test.tsx" ]]; then 
    echo "NO_TEST: $f"; 
  fi; 
done

# Hooks without adjacent test file
for f in $(find apps/[app]/src/features -name "*.ts" -path "*/hooks/*" ! -path "*/__tests__/*" ! -name "*.test.ts" ! -name "*.test.tsx"); do
  base="${f%.ts}"; 
  if [[ ! -f "${base}.test.ts" && ! -f "${base}.test.tsx" && ! -f "$(dirname $f)/__tests__/$(basename $f .ts).test.ts" ]]; then 
    echo "NO_TEST: $f"; 
  fi; 
done
```

Or: List component/hook files, check if `*.test.tsx` or `*.test.ts` exists alongside.

**Priority**: Focus on critical user flows, forms, and hooks that fetch data.

---

## DRY Violations (P2)

**What**: Duplicated logic, repeated formatters, copy-pasted blocks across components.

**Detection** (manual/semantic):
- **Similar patterns**: Same `.filter().map()` or date/currency formatting logic in multiple components → extract to util
- **Repeated formatters**: `formatDate`, `formatCurrency`, etc. defined in multiple features → move to `shared/utils`
- **Copy-pasted UI**: Similar modal/table structure in multiple places → extract shared component
- **Repeated validation**: Same Zod schema or validation logic duplicated → extract to shared validation

**Search** (heuristic – similar function names):
```bash
# Multiple formatDate/formatCurrency/formatX definitions
grep -r "function format\|const format" apps/[app]/src/features/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq -c | awk '$1 > 1'
```

**Manual check**: When reading components, note similar logic blocks. Use codebase_search for "format date" or "format currency" to find duplication.

---

## Circular Dependencies (P0)

**What**: Import cycles (A → B → C → A) that can cause runtime failures, hard-to-debug issues, or build problems.

**Search** (requires [madge](https://github.com/pahen/madge)):
```bash
# From each app directory (e.g., apps/admin-web)
npx madge --circular src
```

Or: `pnpm add -D madge` then run from app dir. The analysis script includes an optional CIRCULAR_DEPENDENCIES section when madge is available.
