---
name: refactor-bulletproof-react
description: Turn AI-generated or messy React code into maintainable, feature-first code using impact-ranked Bulletproof React practices. Use when the user asks to refactor, clean up AI slop, improve structure/maintainability, or apply Bulletproof React.
disable-model-invocation: true
---
# Refactor Bulletproof React

Turn AI-generated or messy React/TypeScript into **well-structured, maintainable, clean code** that follows this monorepo’s feature-first patterns and real React best practices.

Prioritize by **impact** (bugs, stale data, untestable god modules), not architectural purity theater. Confirm before changing code.

Patterns: `.cursor/skills/99-bulletproof-react-patterns/SKILL.md` (+ `references/PATTERNS.md`)  
Priorities: `references/BULLETPROOF_REACT_PRIORITIES.md`  
Detection: `references/DETECTION_PATTERNS.md`

## When to Use

- Cleaning up AI-generated features/PRs
- User says refactor, clean up, technical debt, Bulletproof React, or “make this maintainable”
- A feature became hard to change (god components, fetch-in-useEffect, tangled logic)

## Context

- **Stack**: React, TypeScript, TanStack Query, Zustand, Next.js App Router
- **Structure**: `apps/*/src/features/` (feature-first), `packages/shared/`, `packages/ui/`
- **Goal**: readable modules with clear SoC — not mass file-splitting or cross-feature untangling for its own sake

## Impact Gate (required for every finding)

Before ranking anything P0/P1, answer yes to at least one:

1. Fixes a bug or likely stale/incorrect data?
2. Makes the **next** change to this area meaningfully easier?
3. Removes a known footgun (duplicate fetches, untyped boundaries, circular import that breaks)?

If none → P2 at best, or omit. Prefer **opportunistic** cleanup when already touching a file over drive-by purity campaigns.

## Three-Phase Workflow

### Phase 1: Discovery

**1.1 Scope**

Ask or infer: one feature (preferred), one app, or a specific set of files. Prefer feature/file scope for AI cleanup; avoid codebase-wide purity sweeps.

**1.2 Run discovery**

Option A — analysis script (from repo root):
```bash
bash .cursor/skills/refactor-bulletproof-react/scripts/analyze-refactoring.sh <apps/admin-web|apps/student-web|apps/tutor-web|apps/ucat-web|.>
```

Option B — manual search using `references/DETECTION_PATTERNS.md`.

Always filter script output through the **Impact Gate**. Script heuristics have false positives.

**1.3 Findings**

For each kept finding: path, type, why it matters (impact), suggested fix, rough effort.

**1.4 Early exit**

If zero P0/P1 and no meaningful P2 (≤2 low-value P2s):

```markdown
## Analysis Complete – No Refactoring Recommended

Scope follows practices well enough / no high-impact issues.

- **P0/P1**: 0
- **Recommendation**: Stop. Only touch P3/style if the user has a specific pain point.
```

Stop. Do not invent work.

### Phase 2: Prioritization

Load `references/BULLETPROOF_REACT_PRIORITIES.md`. Summarize:

```markdown
## Refactoring Plan (impact order)

### P0 – Fix now (X)
1. [File] – [Issue] – [Why it matters]

### P1 – High maintainability tax (X)
...

### P2 – Opportunistic (X)
...

### Skip / demoted
- [Items found by script but rejected by Impact Gate, with one-line reason]

**Total actionable**: X. Estimated effort: Y.

Proceed? (y/n) — or name which items to do.
```

**Stop and wait for confirmation.** Do not edit until the user approves.

### Phase 3: Execution

**3.1 One approved item at a time**

1. Read the relevant files
2. Prefer adding/adjusting tests only when the path is critical **and** behavior is non-obvious (forms, fetch/cache, domain transforms). Skip inventory-style “test every component”
3. Implement the smallest change that restores clarity
4. Run `pnpm lint` and `pnpm typecheck` (and `pnpm test` if tests exist for that area)
5. **Do not commit** unless the user explicitly asks. Summarize the diff and offer a commit message
6. After each P0/P1 (or every 2–3 P2s), check in: continue?

**3.2 Preferred refactor moves**

| Problem | Move |
|---------|------|
| `useEffect` + local state for server data | `api/` fetcher + `useXQuery` / mutation hooks |
| God module (many jobs, not just “lines”) | Extract hook (logic), subcomponents (UI), utils (pure) |
| Logic hard to test / duplicated domain rules | Hook or `utils/` / `packages/shared` |
| Accidental cross-feature import **blocking change or causing a cycle** | Compose at app/route, or move truly shared code to `shared/` / `packages/shared` — do **not** mass-decouple intentional CRM coupling |
| `any` on important boundaries | Proper types or `unknown` + guards |
| Client component doing server work | Prefer Server Components / route data load where App Router fits; keep client for interactivity |
| AI slop (unused vars, over-abstraction, pointless memo) | Delete noise; follow repo React guidance — **do not** add `useMemo`/`useCallback` by default |

**3.3 Preserve behavior**

Refactoring must not change product behavior unless the user asked for a fix.

### Phase 4: Summary

```markdown
## Refactoring Summary

### Done
- Items: …
- Files: …

### Left
- …

### Verification
- [ ] typecheck / lint / relevant tests
```

## Error Handling

- Breaks tests → fix or revert; don’t skip
- Scope unclear → ask for feature/files
- Huge finding list → P0/P1 only; offer to stop
- User says no → stop
- Circular dependency that breaks builds → P0; explain cycle; propose break; wait

## Repeatability

- Stateless re-analyze each run
- Fixed issues disappear next run
- Before a new run, baseline should be clean (`pnpm typecheck` / lint); fix leftovers first

## Hard Rules

- Never refactor without confirmation after the plan
- Don’t refactor for purity alone
- Impact Gate on every P0/P1
- No auto-commits
- No mass cross-feature untangling; no line-count-only splits; no missing-test inventory campaigns; no memoization churn
- Prefer deleting AI noise over adding layers

## References

- `references/BULLETPROOF_REACT_PRIORITIES.md`
- `references/DETECTION_PATTERNS.md`
- `.cursor/skills/99-bulletproof-react-patterns/SKILL.md`
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
