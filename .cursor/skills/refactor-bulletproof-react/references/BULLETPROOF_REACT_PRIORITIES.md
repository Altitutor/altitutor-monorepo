# Refactoring Priorities (Impact-First)

Goal: turn AI-generated / messy React into maintainable feature-first code.  
Rank by **pain and risk**, not Bulletproof purity. Apply the Impact Gate from `SKILL.md` before anything is P0/P1.

Patterns how-to: `.cursor/skills/99-bulletproof-react-patterns/SKILL.md`

## P0 – Fix now

Only when it causes bugs, stale/incorrect data, build/runtime failures, or a clear footgun.

| Issue | Why | Action |
|-------|-----|--------|
| **Circular dependencies that break builds/runtime** | Real failures, hard to debug | Break cycle: extract shared, invert dep, or compose at app |
| **`useEffect` + local state for server data** | No cache, duplicate requests, race/stale bugs | `api/` + TanStack Query hook |
| **Server state treated as client store** (Zustand/`useState` mirroring API) | Manual sync, stale UI | React Query as source of truth |
| **Incorrect data ownership / cache bugs** | Wrong UI, hard regressions | Fix query keys, invalidation, single owner |

## P1 – High maintainability tax

Blocks shipping or safe change in an area you care about.

| Issue | Why | Action |
|-------|-----|--------|
| **God modules** (many responsibilities — not line count alone) | Hard to change without breakage | Split by responsibility: hook / UI pieces / pure utils |
| **Critical domain logic untestable or buried in JSX** | Regressions when editing | Extract to hook/util; add tests only if behavior is non-obvious |
| **`any` / untyped data on important boundaries** (API payloads, shared contracts) | Runtime surprises | Types, Zod where runtime validation matters |
| **Accidental cross-feature coupling that blocks a change or creates a cycle** | Coupling tax | Compose at route/app, or move truly shared code — **not** every `@/features/X` import |

## P2 – Opportunistic (when already in the file / approved)

| Issue | Why | Action |
|-------|-----|--------|
| Missing `api/` / `hooks/` / `types/` when the feature clearly needs them | Findability | Add only what’s needed |
| SoC violations (API returning JSX, hooks with JSX, utils with side effects) | Confusion | Split layers |
| Real duplicated **domain** logic (same rules/formatters copied) | Drift | Shared util / feature util / `packages/shared` |
| AI slop (dead code, over-wrappers, pointless abstractions, noise comments) | Cognitive load | Delete |
| Components that are hard to read **because of mixed concerns** | DX | Extract; ignore pure line-count thresholds |

## Usually skip (demote / omit from plans)

| Issue | Why skip |
|-------|----------|
| **Blanket cross-feature imports** in a CRM (sessions↔students↔tasks) | Often intentional; mass-decouple creates worse abstractions |
| **Line-count-only splits** (>200 / >300) | Weak proxy; fragmentation ≠ clarity |
| **Missing-test inventory** (“every component needs a test”) | Noise; prefer tests on critical paths you’re changing |
| **Add `useMemo` / `useCallback` by default** | Conflicts with modern React / repo guidance; only for proven expensive work or eslint necessity |
| **Internal barrel-import churn** | Tiny win vs Next bundling; not session-worthy |
| **Docs / style-only** | P3; only if user asks |

## Cross-feature imports — nuance

Bulletproof recommends independent features. In this monorepo, many cross-feature imports are **intentional domain composition**.

**Flag only when:**
- Import creates or risks a **cycle**
- Feature B is used as a junk drawer for Feature A’s internals
- You’re about to change the boundary and coupling is the blocker

**Prefer:**
- Compose at `app/` / route level when wiring UI from two features
- Move **truly shared** UI/utils to `shared/` or `packages/shared` / `packages/ui`
- Enforce **new** violations with ESLint `import/no-restricted-paths` rather than rewriting the world

**Do not:** open a campaign to eliminate every `@/features/...` import across admin-web.

## Next.js App Router notes

- Prefer Server Components / route-level data where it fits; client components for interactivity
- Don’t force “everything in a client `useXQuery`” if the page can load data on the server cleanly
- Keep TanStack Query for client cache, mutations, and interactive refetch needs

## Principles (summary)

- Feature-first folders; only create subfolders you need
- Components: UI + interaction; hooks: state/fetch orchestration; `api/`: pure fetchers; utils: pure
- Server state → React Query (or RSC); local UI → `useState`; forms → RHF; rare global client → Zustand
- Preserve behavior unless fixing a bug the user approved
- Delete AI noise before adding structure

## P3 – Nice to have

Documentation, minor reordering, pure style — only on request.
