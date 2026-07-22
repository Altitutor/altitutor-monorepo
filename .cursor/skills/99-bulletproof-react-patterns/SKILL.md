---
name: 99-bulletproof-react-patterns
description: Bulletproof React architecture patterns and anti-patterns reference. Use only when explicitly invoked or when following /refactor-bulletproof-react.
disable-model-invocation: true
---

# Bulletproof React Patterns

Short index for this monorepo. Full examples: [references/PATTERNS.md](references/PATTERNS.md).

## Non-negotiables

1. **Feature-first** — `features/[name]/{api,components,hooks,types,mappers,index.ts}`
2. **No cross-feature imports** — compose at app/route level; share via `shared/` or `packages/`
3. **SoC** — UI components render; hooks/utils/API own logic and fetching
4. **React Query for server state** — never `useEffect` fetch; API layer stays pure
5. **Barrels** — `index.ts` is public API only; internal imports are direct paths
6. **Types** — no `any`; props and API results typed

## Checklist

- [ ] Cross-feature imports / wrong file placement
- [ ] God components / business logic in UI
- [ ] `useEffect` or local state for server data
- [ ] Untyped boundaries / `any`
- [ ] Internal barrel imports / circular deps
- [ ] Global store used for local or server state

## Impact priorities (refactor)

Use `/refactor-bulletproof-react`. Prefer impact over purity:

- **P0:** build-breaking cycles; server state in `useEffect`/local state; cache bugs
- **P1:** god modules; critical untyped boundaries; coupling that blocks change
- **P2:** opportunistic SoC/DRY while already in the file
- **Skip:** mass cross-feature untangling, line-count-only splits

## External

- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
