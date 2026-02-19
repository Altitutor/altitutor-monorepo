---
name: refactor-bulletproof-react
description: Find antipatterns, suggest refactors by Bulletproof React priority, then execute refactors after user confirmation
disable-model-invocation: true
---
# Refactor Bulletproof React

Find code antipatterns and refactoring opportunities that improve performance and maintainability, prioritize them according to [Bulletproof React](https://github.com/alan2207/bulletproof-react), then execute refactors after user confirmation.

## When to Use

- User wants to improve code quality, performance, or maintainability
- User mentions "refactor," "clean up," "technical debt," or "Bulletproof React"
- Preparing codebase for scaling or team growth
- After adding features that may have introduced antipatterns

## Context

This monorepo follows Bulletproof React principles:
- **Stack**: React 18, TypeScript 5.8, TanStack Query 5.77, Zustand 4.5, Next.js App Router
- **Structure**: `apps/*/src/features/` (feature-first), `packages/shared/`, `packages/ui/`
- **Reference**: See `references/BULLETPROOF_REACT_PRIORITIES.md` for priority definitions
- **Detection**: See `references/DETECTION_PATTERNS.md` for search patterns

## Three-Phase Workflow

### Phase 1: Discovery

**1.1 Determine Scope**

Ask user (or infer from context):
- Entire app (`admin-web`, `student-web`, `tutor-web`)
- Specific feature (e.g., `features/students`)
- Codebase-wide (all apps)

**1.2 Run Discovery**

Option A: Run the analysis script for structured output (from repo root):
```bash
bash .cursor/skills/refactor-bulletproof-react/scripts/analyze-refactoring.sh <apps/admin-web|apps/student-web|apps/tutor-web|.>
```

Option B: Use grep/codebase_search to find antipatterns manually. For each category, search:

- **Cross-feature imports**: `from '@/features/[other-feature]'` or `from "@/features/` where importing feature ≠ current feature
- **Large components**: Components with > 200 lines (check `**/components/*.tsx`, `**/components/**/*.tsx`)
- **useEffect + fetch**: Files with `useEffect` containing fetch/axios/supabase/api calls
- **Any types**: `: any` or `as any` in TypeScript files
- **Business logic in components**: Components with complex calculations, data transforms, or API calls in render
- **Barrel imports (internal)**: `from '../index'` or `from './index'` within a feature
- **Separation of concerns**: API with UI logic, hooks with rendering, utils with side effects, mixed concerns in one file
- **Missing tests**: Components/hooks without corresponding `*.test.tsx` or `*.test.ts` files
- **DRY violations**: Duplicated logic across components, repeated formatters/validators, copy-pasted blocks

**1.3 Build Findings Report**

For each finding, record:
- File path
- Antipattern type
- Brief description
- Line number or relevant snippet (if applicable)
- Estimated impact (performance / maintainability / both)

**1.4 Early Exit – No Refactoring Needed**

**Before building the full plan, check if refactoring would produce meaningful gain.**

If **zero P0, P1, and P2 findings** (only P3 or none):
```markdown
## Analysis Complete – No Refactoring Recommended

The scope (`[app/feature]`) appears to follow Bulletproof React principles well.

- **P0/P1/P2 findings**: 0
- **Conclusion**: Refactoring would produce minimal gain. No changes recommended.
- **Optional**: You could address any P3 items (docs, style) if desired, but they are low priority.
```

**Stop here. Do not proceed to Phase 2 or 3.** Do not suggest refactoring for the sake of it.

If **only P3 findings** (or very few P2, e.g. ≤2):
```markdown
## Analysis Complete – Minimal Refactoring Value

- **P0/P1/P2 findings**: 0 (or very few)
- **P3 findings**: [list]
- **Recommendation**: Scope is healthy. Refactoring would have minimal impact. Proceed only if you have specific pain points.
```

Ask: "Do you want to address any of these P3 items, or consider this done?"

**Only proceed to Phase 2 if there are P0, P1, or meaningful P2 findings.**

### Phase 2: Prioritization

Order findings by Bulletproof React priority (only when refactoring is warranted). Load `references/BULLETPROOF_REACT_PRIORITIES.md` for the authoritative order:

**P0 - Critical (Fix First)**
- Cross-feature imports
- Business logic bugs in components
- Data fetching causing performance issues (useEffect fetch, no caching)
- Server state in local state causing stale/incorrect data

**P1 - High**
- Large components (> 300 lines)
- Missing React Query hooks (components fetching directly)
- Type safety issues (`any` types)
- Prop drilling > 3 levels

**P2 - Medium**
- Components 200-300 lines
- Import pattern improvements (barrel vs direct)
- Missing feature structure (api/, hooks/, types/)
- Expensive computations in render (missing useMemo/useCallback)
- **Separation of concerns violations**: API files with UI logic, hooks doing rendering, utils with side effects
- **Missing tests**: Components/hooks without test files (especially for critical paths)
- **DRY violations**: Duplicated logic, repeated formatters, copy-pasted blocks across components

**P3 - Low**
- Documentation
- Minor code organization
- Code style

**Present to User:**

```markdown
## Refactoring Plan (Bulletproof React Order)

### P0 - Critical (X items)
1. [File] - [Antipattern] - [Impact]
2. ...

### P1 - High (X items)
...

### P2 - Medium (X items)
...

### P3 - Low (X items)
...

**Total**: X findings. Estimated effort: Y hours.

Proceed with refactoring? (y/n)
If yes, start with P0 or specify which items to tackle.
```

**Stop and wait for user confirmation.** Do not proceed to Phase 3 without explicit approval.

### Phase 3: Execution

**3.1 One Item at a Time**

Work through the approved list in priority order. For each item:

1. Read the file(s) involved
2. Plan the refactor (what to extract, where to move, what to create)
3. Implement the change
4. Run quality checks: `pnpm lint`, `pnpm typecheck` (and `pnpm test` if tests exist)
5. Commit: `git add ... && git commit -m "refactor(scope): description"`
6. Move to next item

**3.2 Refactoring Patterns**

**Cross-feature import** → Move shared code to `shared/` or `packages/shared/`, or compose at app level

**Large component** → Extract to: hook (logic), sub-components (UI), utils (pure functions)

**useEffect fetch** → Create `use[Resource]Query` hook with React Query, move fetch to `api/` layer

**Any types** → Replace with proper interfaces or `unknown` + type guards

**Business logic in component** → Extract to custom hook (e.g., `use[Feature]Table`)

**Barrel imports (internal)** → Replace with direct imports (`from '../api/students'` not `from '../index'`)

**Separation of concerns** → Move API logic to api/, UI to components/, pure logic to hooks/utils. Split mixed files.

**Missing tests** → Add `*.test.tsx` or `*.test.ts` for components/hooks. Use React Testing Library, mock external deps.

**DRY violations** → Extract duplicated logic to shared util, hook, or component. Move to `utils/` or `shared/` as appropriate.

**3.3 After Each Refactor**

- Verify `pnpm typecheck` passes
- Verify `pnpm lint` passes
- If tests exist, run `pnpm test`
- Commit with conventional message

**3.4 User Check-in**

After completing each P0 and P1 item (or every 2-3 P2 items), briefly summarize what was done and ask: "Continue with next item? (y/n)"

### Phase 4: Summary

When done (or user requests stop):

```markdown
## Refactoring Summary

### Completed
- [X] Items refactored
- Files modified: [...]
- Commits: [...]

### Remaining (if any)
- [List unchecked items]

### Verification
- [ ] pnpm typecheck
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build (optional)
```

## Error Handling

- **Refactor breaks tests**: Revert or fix until tests pass. Do not skip tests.
- **Scope unclear**: Ask user to specify app or feature.
- **Too many findings**: Focus on P0 and P1 first. Offer to stop after those.
- **User says "no" to confirmation**: Stop. Do not execute.
- **Circular dependency discovered**: Pause, explain, ask user how to resolve.

## Repeatability / Idempotency

**The skill is designed for multiple runs across different agent sessions.**

- **Stateless**: Each run re-analyzes the codebase from scratch. No persistent "done" list.
- **Progressive**: Fixed issues disappear from findings. A refactored 900-line component won't be flagged on the next run.
- **Agent-agnostic**: Different agents can run it in succession. Each sees only the current state and remaining issues.
- **Convergent**: Successive runs reduce findings until P0/P1/P2 are zero, then early exit reports "already good."

**Before each run**: Ensure `pnpm checkall` passes so the next agent starts from a clean baseline. If a prior run left failing tests or type errors, fix those first.

## Important Notes

- **Never refactor without confirmation** after presenting the plan
- **Don't refactor for the sake of it** – if P0/P1/P2 findings are zero, stop and report "already good"
- **Add tests before refactoring** when possible (TDD approach)
- **One change at a time** - easier to review and revert
- **Preserve behavior** - refactoring must not change functionality
- **Commit incrementally** - one logical change per commit

## References

- `references/BULLETPROOF_REACT_PRIORITIES.md` - Priority order and refactoring rules
- `references/DETECTION_PATTERNS.md` - How to find each antipattern
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- [Project Standards](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md)
