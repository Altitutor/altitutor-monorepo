# Bulletproof React Refactoring Priorities

Source: [Bulletproof React](https://github.com/alan2207/bulletproof-react) - project structure, project standards, components, API layer, state management, performance.

## Priority Order

### P0 - Critical (Fix Immediately)

These cause tight coupling, bugs, or significant performance problems.

| Antipattern | Why Critical | Refactor Action |
|-------------|--------------|-----------------|
| **Cross-feature imports** | Tight coupling, hard to test, circular deps risk | Move to `shared/` or compose at app level |
| **Business logic bugs in components** | Data transformation/calculation errors in render | Extract to hook or util |
| **useEffect for data fetching** | No caching, no loading/error states, duplicate requests, stale data | Create React Query hook + api/ layer |
| **Server state in local state** | Stale data, no cache, manual sync | Use React Query for server data |

### P1 - High (Fix Soon)

These hurt maintainability and developer experience significantly.

| Antipattern | Why High | Refactor Action |
|-------------|----------|-----------------|
| **Large components (> 300 lines)** | Hard to understand, test, modify | Split into smaller components + hook |
| **Missing React Query hooks** | Components fetching directly | Create `use[Resource]Query` in hooks/ |
| **Type safety (`any` types)** | Runtime errors, poor DX | Replace with interfaces or `unknown` + guards |
| **Prop drilling > 3 levels** | Brittle, hard to change | Context or composition |

### P2 - Medium (Fix When Convenient)

These improve structure, testability, and minor performance.

| Antipattern | Why Medium | Refactor Action |
|-------------|------------|-----------------|
| **Components 200-300 lines** | Borderline, consider splitting | Extract sub-components or logic |
| **Barrel imports (internal)** | Worse tree-shaking, larger bundles | Use direct imports within feature |
| **Missing feature structure** | Inconsistent, harder to find code | Add api/, hooks/, types/ as needed |
| **Expensive computation in render** | Unnecessary re-renders | useMemo/useCallback or extract |
| **Separation of concerns** | API with UI logic, hooks with rendering, utils with side effects | Split into api/, components/, hooks/, utils/ |
| **Missing tests** | Untested components/hooks risk regressions | Add *.test.tsx for components, *.test.ts for hooks/utils |
| **DRY violations** | Duplicated logic increases maintenance burden | Extract to shared util, hook, or component |

### P3 - Low (Nice to Have)

| Antipattern | Why Low | Refactor Action |
|-------------|---------|-----------------|
| **Documentation** | Helps onboarding | Add JSDoc, comments |
| **Code organization** | Minor readability | Reorder, group related code |
| **Code style** | Consistency | Linter/formatter |

## Bulletproof React Principles (Summary)

### Architecture
- **Feature-first**: Code in `features/[name]/` with api/, components/, hooks/, types/
- **No cross-feature imports**: Compose at app level or use shared/
- **Unidirectional**: shared → features → app (features don't import from app)

### Components
- **< 200 lines** ideally; extract nested render functions to separate components
- **Colocate** as close as possible to usage
- **Limit props**: Use composition (children/slots) if too many props
- **Pure UI**: No business logic, no data fetching in components

### Data Fetching
- **React Query** for all server data (never useEffect for fetch)
- **API layer**: Pure fetcher functions in api/, hooks wrap them with useQuery/useMutation
- **Single API client** instance, predefined config

### State
- **Server state**: React Query (cache)
- **Form state**: React Hook Form
- **Global client state**: Zustand (when needed across features)
- **Local UI state**: useState
- **URL state**: Route params / query params

### Performance
- **State location**: Keep state close to where it's used (fewer re-renders)
- **Children optimization**: Use `children` prop to isolate re-renders
- **Lazy init**: `useState(() => expensiveFn())` for expensive initial state
- **Code splitting**: At route level, not excessive
- **Zero-runtime styling**: Prefer Tailwind/CSS modules over styled-components at runtime

### Types
- **No `any`**: Use proper types or `unknown` + type guards
- **Absolute imports**: `@/` for src
- **Validation**: Zod for runtime validation when needed

### Separation of Concerns
- **Components**: Pure UI only – no API calls, no business logic, no side effects
- **API layer**: Pure data fetching – no UI, no React hooks
- **Hooks**: Stateful logic and data fetching (React Query) – no JSX
- **Utils**: Pure functions – no side effects, no state
- **One responsibility per file**: Avoid mixing API + component, or util + component

### Testing
- **Test components**: React Testing Library, test behavior not implementation
- **Test hooks**: With QueryClient wrapper for React Query
- **Test utils**: Unit tests for pure functions
- **Colocate tests**: `*.test.tsx` next to component, or in `__tests__/`

### DRY (Don't Repeat Yourself)
- **Extract repeated logic**: Same filter/map/reduce across components → util
- **Shared formatters**: Use `shared/utils` or feature utils for date/currency/name formatting
- **Compose components**: Don't copy-paste UI blocks – extract reusable component
