# Detection Patterns

Find candidates, then apply the **Impact Gate** (`SKILL.md`). Most greps over-report; demote or drop low-impact hits.

## Circular dependencies (P0)

```bash
# From each app dir, e.g. apps/admin-web
npx madge --circular src
```

Only treat as P0 if madge reports a real cycle (or build fails). Analysis script includes this when madge is available.

---

## useEffect + server fetch (P0)

**Search** (heuristic — verify manually):
```bash
rg -n "useEffect" apps/[app]/src/features -g '*.tsx' -g '*.ts' -A 25 | rg -i "fetch\(|axios|supabase|createClient|\.rpc\(|queryFn"
```

**Confirm**: effect loads remote data into `useState` / store, without TanStack Query (or equivalent).

**False positives**: syncing props→state, DOM measurements, one-shot analytics, subscribing to existing Query cache.

---

## Server state in local/global client state (P0)

Look for:
- `useState([])` / `useState(null)` for lists/entities **plus** fetch in `useEffect`
- Zustand stores that mirror API lists/entities with manual `set` after fetch

Often same fix as useEffect-fetch → React Query.

---

## God modules (P1) — not line count alone

**Weak signal** (script lists large files for triage only):
```bash
find apps/[app]/src/features -name '*.tsx' -path '*/components/*' ! -name '*.test.*' -exec wc -l {} + | awk '$1 > 350 {print}' | sort -rn
```

**Promote to P1 only if** the file mixes several of: fetching, transforms, multiple modals/flows, unrelated UI, and changing one thing risks another.

**Do not** split solely because `wc -l` is high.

---

## Critical logic buried in JSX / untyped boundaries (P1)

**Manual**: non-trivial domain rules, multi-step transforms, or payment/auth/enrollment logic inline in components.

**`any` on boundaries**:
```bash
rg -n ": any\b|as any\b" apps/[app]/src/features -g '*.ts' -g '*.tsx'
```

Prioritize public API mappers, route handlers’ client callers, and shared packages — not every cast in a test.

---

## Accidental cross-feature coupling (P1 only with impact)

**Search** — script filters to **importer feature ≠ imported feature**:
```bash
bash .cursor/skills/refactor-bulletproof-react/scripts/analyze-refactoring.sh apps/[app]
# See CROSS_FEATURE_IMPORTS section
```

**Promote only if**: cycle risk, junk-drawer import of another feature’s internals, or coupling blocks a planned change.

**Demote**: routine CRM composition (e.g. sessions using students helpers) unless Impact Gate passes.

Same-feature `from '@/features/this-feature/...'` is **not** a violation.

---

## Missing feature structure (P2)

Per feature: add `api/`, `hooks/`, `types/` only when that feature already fetches/has hooks/has shared types. Empty folder scaffolding is noise.

---

## Separation of concerns (P2)

```bash
# API files using React state hooks (verify — type-only imports are OK)
rg -l "useState|useEffect|useQuery" apps/[app]/src/features -g '**/api/**/*.ts'

# Utils doing network I/O
rg -l "fetch\(|supabase|axios" apps/[app]/src/features -g '**/utils/**'
```

Hooks that return JSX → move UI to `components/`.

---

## DRY domain logic (P2)

Prefer semantic review over grep. Heuristic:
```bash
rg -n "function format|const format" apps/[app]/src/features -g '*.ts' -g '*.tsx'
```

Extract only when the **same business rule** is copied and drifting — not similar JSX layout.

---

## AI slop (P2)

While reading files, flag: unused exports, wrapper-for-one-liner, empty catch, commented-out blocks, pointless `useMemo`/`useCallback`, duplicate types, “helper” folders with one function. Prefer delete/inline.

---

## Usually do not inventory

| Pattern | Why |
|---------|-----|
| Every component without `*.test.tsx` | Floods reports; not a refactor priority |
| Internal `from './index'` barrels | Low ROI |
| Missing useMemo on props | Do not “fix” by adding memo by default |
| All cross-feature imports as P0 | Wrong for this codebase |

Script may still print `MISSING_TESTS` / barrel hits as **informational** (capped). Do not put them on the plan unless the user asked for tests or you’re touching a critical path.
