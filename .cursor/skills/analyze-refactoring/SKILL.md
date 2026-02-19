---
name: analyze-refactoring
description: Analyze codebase for anti-patterns and propose prioritized refactoring plans
disable-model-invocation: true
---
# Analyze Refactoring Opportunities

Analyze codebase for anti-patterns and deviations from Bulletproof React architecture, then propose prioritized refactoring plans.

## Context

This is the Altitutor monorepo following Bulletproof React principles:

- **Architecture**: Feature-first organization with clear boundaries
- **Stack**: React 18, TypeScript 5.8, TanStack Query 5.77, Zustand 4.5, Next.js App Router
- **Standards**: See `.cursor/rules/` for detailed patterns
- **Goal**: Identify anti-patterns and propose actionable refactoring plans

## Bulletproof React Core Principles

### 1. Feature-First Organization
- All feature code lives in `features/[feature-name]/`
- Each feature is self-contained with its own `api/`, `components/`, `hooks/`, `types/`
- Features should NOT import from other features (compose at app level)
- Only include folders necessary for each feature

### 2. Separation of Concerns
- **Components**: Pure UI rendering only, no business logic
- **Hooks**: Stateful logic and data fetching (React Query)
- **API Layer**: Pure data fetching, no UI logic
- **Utils**: Pure transformation functions
- **Types**: TypeScript definitions

### 3. Component Best Practices
- Components < 200 lines ideally
- No business logic in components
- Proper TypeScript props (no `any`)
- Handle loading/error states
- Use composition over prop drilling

### 4. Data Fetching
- **Always use React Query** for data fetching (never `useEffect` for fetching)
- Custom hooks in `features/*/hooks/` wrap React Query
- API functions in `features/*/api/` are pure data fetching

### 5. File Organization
- Direct imports preferred over barrel files (better tree-shaking)
- `index.ts` for public exports only
- Kebab-case for files/folders (except components: PascalCase)

## Anti-Patterns to Detect

### Architecture Anti-Patterns

1. **Cross-Feature Imports**
   - Feature A importing from Feature B
   - Should compose at app level instead
   - Check: `import from '@/features/[other-feature]'`

2. **Missing Feature Structure**
   - Files not organized in feature folders
   - Missing standard folders (`api/`, `components/`, `hooks/`, `types/`)
   - Files in wrong locations

3. **Business Logic in Components**
   - Complex calculations in components
   - Data transformation in render
   - API calls directly in components (not using React Query)

4. **Large Components**
   - Components > 200 lines
   - Multiple responsibilities
   - Should be split into smaller components

5. **Prop Drilling**
   - Passing props through many levels
   - Should use Context or state management

### Code Quality Anti-Patterns

6. **Data Fetching Anti-Patterns**
   - Using `useEffect` for data fetching instead of React Query
   - Fetching in components instead of hooks
   - Missing loading/error states

7. **Type Safety Issues**
   - Using `any` types
   - Missing prop types
   - Loose type definitions

8. **Missing Separation**
   - API functions with UI logic
   - Hooks with rendering logic
   - Utils with side effects

9. **Import Patterns**
   - Using barrel files (`index.ts`) for internal imports
   - Should use direct imports for better tree-shaking

10. **State Management Issues**
    - Using local state for server state
    - Not using React Query for server data
    - Global state for local concerns

## Workflow

### 1. Determine Scope

**Ask user for scope:**
- Entire app (e.g., `admin-web`)
- Specific feature (e.g., `features/students`)
- Codebase-wide (all apps)

**Default to app-level if not specified:**
```bash
# Check current directory or ask user
```

### 2. Analyze Feature Structure

**For each feature directory:**

1. **Check folder structure:**
   ```bash
   # List feature directories
   find apps/[app]/src/features -maxdepth 1 -type d
   
   # For each feature, check structure
   ls -la apps/[app]/src/features/[feature]/
   ```

2. **Verify standard folders exist:**
   - `api/` - API client functions
   - `components/` - Feature components
   - `hooks/` - React Query hooks and custom hooks
   - `types/` - TypeScript types
   - `index.ts` - Public exports

3. **Check for non-standard folders:**
   - Note any unusual organization
   - Check if files are in wrong locations

**Create structure report:**
```markdown
## Feature Structure Analysis

### ✅ Well-Structured Features
- `features/students/` - Has api/, components/, hooks/, types/, index.ts
- `features/billing/` - Complete structure

### ⚠️ Missing Structure
- `features/auth/` - Missing `types/` folder
- `features/messages/` - Missing `index.ts` export file

### ❌ Poor Structure
- `features/legacy/` - Files not organized in subfolders
```

### 3. Detect Cross-Feature Imports

**Search for cross-feature imports:**

```bash
# Find imports from other features
grep -r "from '@/features/" apps/[app]/src/features/ | \
  grep -v "from '@/features/[same-feature]"
```

**For each cross-feature import:**

1. **Read the importing file** to understand context
2. **Read the imported file** to see what's being used
3. **Determine if it should be:**
   - Moved to shared (`shared/` or `packages/shared/`)
   - Composed at app level
   - Refactored to remove dependency

**Create cross-feature import report:**
```markdown
## Cross-Feature Import Violations

### High Priority (Tight Coupling)
- `features/students/components/StudentsTable.tsx`
  - Imports: `@/features/classes/components/ViewClassModal`
  - Issue: Direct component import
  - Fix: Compose at app level or move to shared

### Medium Priority (Shared Logic)
- `features/enrollments/hooks/useEnrollmentConflicts.ts`
  - Imports: `@/features/classes/api/classes`
  - Issue: API import from another feature
  - Fix: Move shared API logic to `shared/api/` or compose queries at app level
```

### 4. Analyze Component Quality

**For each component file:**

1. **Check file size:**
   ```bash
   wc -l apps/[app]/src/features/**/components/*.tsx
   ```

2. **Read components > 200 lines** to analyze:
   - Number of responsibilities
   - Business logic presence
   - Prop drilling depth
   - Data fetching patterns

3. **Check for business logic:**
   - Complex calculations
   - Data transformations
   - API calls (should be in hooks)
   - State management logic

4. **Check prop types:**
   - Missing TypeScript interfaces
   - Using `any`
   - Optional props that should be required

**Create component analysis:**
```markdown
## Component Quality Analysis

### ❌ Large Components (> 200 lines)
- `features/students/components/StudentsTable.tsx` (817 lines)
  - Issues:
    - Multiple responsibilities (filtering, sorting, pagination, modals)
    - Business logic mixed with UI
    - Complex state management
  - Refactor: Split into:
    - `StudentsTable.tsx` (table rendering)
    - `StudentsTableFilters.tsx` (filtering UI)
    - `useStudentsTable.ts` (business logic hook)
    - `StudentsTablePagination.tsx` (pagination)

### ⚠️ Business Logic in Components
- `features/sessions/components/SessionDetailsTab.tsx`
  - Issues:
    - Data transformation in render
    - API calls in component (should use React Query hook)
  - Refactor: Extract to `useSessionDetails.ts` hook
```

### 5. Detect Data Fetching Anti-Patterns

**Search for `useEffect` with fetch/API calls:**

```bash
# Find useEffect with fetch patterns
grep -r "useEffect" apps/[app]/src/features/ | \
  grep -E "(fetch|axios|api\.|supabase\.)"
```

**For each occurrence:**

1. **Read the file** to understand the pattern
2. **Check if it should use React Query:**
   - Is it fetching server data?
   - Should it be cached?
   - Does it need loading/error states?

3. **Check if custom hook exists:**
   - Look for hooks in `features/*/hooks/`
   - Check if React Query hook should be created

**Create data fetching report:**
```markdown
## Data Fetching Anti-Patterns

### ❌ useEffect for Data Fetching
- `features/sessions/components/SessionsTable.tsx`
  - Line 45: `useEffect(() => { fetchSessions() })`
  - Issue: Should use React Query hook
  - Fix: Create `useSessionsQuery()` hook

### ⚠️ Missing React Query Hooks
- `features/parents/components/ParentsTable.tsx`
  - Direct API calls in component
  - Issue: No React Query hook exists
  - Fix: Create `useParentsQuery()` hook
```

### 6. Check Type Safety

**Search for `any` types:**

```bash
# Find any types
grep -r ": any" apps/[app]/src/features/
grep -r "any>" apps/[app]/src/features/
```

**Check for missing prop types:**

```bash
# Find components without prop interfaces
# (Manual review needed)
```

**Create type safety report:**
```markdown
## Type Safety Issues

### ❌ Any Types Found
- `features/classes/api/classes.ts` - 12 instances
- `features/messages/components/Composer.tsx` - 3 instances
- Fix: Replace with proper types or `unknown` with type guards
```

### 7. Analyze Import Patterns

**Check for barrel file usage:**

```bash
# Find imports from index files within same feature
grep -r "from './index'" apps/[app]/src/features/
grep -r "from '../index'" apps/[app]/src/features/
```

**Bulletproof React prefers direct imports:**
- Better tree-shaking
- Clearer dependencies
- Barrel files only for public exports (`index.ts`)

**Create import pattern report:**
```markdown
## Import Pattern Issues

### ⚠️ Barrel File Imports (Internal)
- `features/students/components/StudentCard.tsx`
  - Imports: `from '../index'`
  - Issue: Should use direct imports
  - Fix: `from '../api/students'` instead

### ✅ Correct Usage
- `features/students/index.ts` - Only exports public API
```

### 8. Check State Management

**Analyze state usage:**

1. **Server state in local state:**
   ```bash
   # Find useState with server data patterns
   grep -r "useState.*data" apps/[app]/src/features/
   ```

2. **Global state for local concerns:**
   - Check Zustand stores usage
   - Verify if state should be local

3. **Missing React Query:**
   - Server data not using React Query
   - Should be migrated

**Create state management report:**
```markdown
## State Management Issues

### ❌ Server State in Local State
- `features/sessions/components/SessionModal.tsx`
  - Uses `useState` for session data
  - Issue: Should use React Query
  - Fix: Create `useSessionQuery(sessionId)` hook
```

### 9. Prioritize Refactoring Opportunities

**Create prioritized refactoring plan:**

**Priority Levels:**

1. **P0 - Critical (Fix Immediately)**
   - Cross-feature imports causing tight coupling
   - Business logic in components causing bugs
   - Data fetching anti-patterns causing performance issues

2. **P1 - High (Fix Soon)**
   - Large components (> 300 lines)
   - Missing React Query hooks
   - Type safety issues (`any` types)

3. **P2 - Medium (Fix When Convenient)**
   - Components 200-300 lines
   - Import pattern improvements
   - Missing feature structure

4. **P3 - Low (Nice to Have)**
   - Code organization improvements
   - Documentation additions
   - Minor refactoring

**Prioritization Factors:**

- **Impact**: How many files/users affected?
- **Risk**: Likelihood of introducing bugs?
- **Effort**: Estimated time to fix?
- **Dependencies**: Blocks other work?
- **Technical Debt**: Accumulating problems?

**Create prioritized plan:**
```markdown
## Prioritized Refactoring Plan

### P0 - Critical (Do First)

#### 1. Cross-Feature Imports in Students Feature
**Impact**: High - Tight coupling between features
**Effort**: 4-6 hours
**Files**: 8 files
**Steps**:
1. Move shared components to `shared/components/`
2. Create shared hooks in `shared/hooks/`
3. Update imports to use shared modules
4. Test thoroughly

**Estimated Value**: Reduces coupling, improves maintainability

#### 2. Business Logic in StudentsTable Component
**Impact**: High - 817 line component, hard to maintain
**Effort**: 6-8 hours
**Files**: 1 file → split into 4 files
**Steps**:
1. Extract filtering logic to `useStudentsTableFilters.ts`
2. Extract sorting logic to `useStudentsTableSort.ts`
3. Create `StudentsTableFilters.tsx` component
4. Create `StudentsTablePagination.tsx` component
5. Refactor main component to < 200 lines

**Estimated Value**: Improves testability, maintainability

### P1 - High (Do Next)

#### 3. Missing React Query Hooks
**Impact**: Medium - Inconsistent data fetching
**Effort**: 2-3 hours per hook
**Files**: 5 hooks to create
**Steps**:
1. Create `useParentsQuery()` hook
2. Create `useClassesQuery()` hook
3. Migrate components to use hooks
4. Remove `useEffect` fetch patterns

**Estimated Value**: Consistent data fetching, better caching

### P2 - Medium (Do When Convenient)

#### 4. Type Safety Improvements
**Impact**: Medium - Better developer experience
**Effort**: 1-2 hours per file
**Files**: 15 files with `any` types
**Steps**:
1. Replace `any` with proper types
2. Add missing prop interfaces
3. Use `unknown` with type guards where needed

**Estimated Value**: Better type safety, fewer runtime errors

### P3 - Low (Nice to Have)

#### 5. Import Pattern Improvements
**Impact**: Low - Minor tree-shaking improvements
**Effort**: 30 min per file
**Files**: 20 files
**Steps**:
1. Replace barrel imports with direct imports
2. Verify tree-shaking improvements

**Estimated Value**: Slightly smaller bundle size
```

### 10. Generate Refactoring Tasks

**For each prioritized item, create detailed task:**

```markdown
## Refactoring Task: [Title]

### Context
[Why this refactoring is needed]

### Current State
[What the code looks like now]

### Target State
[What it should look like]

### Implementation Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Files to Modify
- `path/to/file1.tsx` - [What changes]
- `path/to/file2.ts` - [What changes]

### Files to Create
- `path/to/new-file.tsx` - [Purpose]

### Testing Strategy
- [ ] Unit tests for new hooks/components
- [ ] Integration tests for refactored flows
- [ ] Manual testing checklist

### Rollback Plan
[How to revert if issues arise]

### Dependencies
[Other refactorings that should happen first/after]

### Estimated Effort
[X hours]
```

### 11. Create Summary Report

**Generate final summary:**

```markdown
# Refactoring Analysis Summary

## Scope
- **App**: `admin-web`
- **Features Analyzed**: 25 features
- **Files Analyzed**: 342 files
- **Date**: [Current Date]

## Findings Summary

### Architecture Issues
- Cross-feature imports: 12 violations
- Missing feature structure: 3 features
- Large components: 8 components > 200 lines

### Code Quality Issues
- Data fetching anti-patterns: 15 instances
- Type safety issues: 45 `any` types
- Business logic in components: 10 components

### Import Patterns
- Barrel file imports: 20 instances
- Should use direct imports

## Prioritized Refactoring Plan

### P0 - Critical (2 items, ~12 hours)
1. Cross-feature imports
2. Large component refactoring

### P1 - High (3 items, ~15 hours)
1. Missing React Query hooks
2. Type safety improvements
3. Business logic extraction

### P2 - Medium (5 items, ~20 hours)
1. Component size reduction
2. Import pattern improvements
3. Feature structure improvements

### P3 - Low (10 items, ~10 hours)
1. Code organization
2. Documentation improvements

**Total Estimated Effort**: ~57 hours

## Recommendations

1. **Start with P0 items** - They have highest impact and reduce technical debt fastest
2. **Fix cross-feature imports first** - Enables better feature isolation
3. **Create React Query hooks** - Establishes consistent data fetching pattern
4. **Refactor large components incrementally** - Don't try to fix all at once
5. **Add tests before refactoring** - Ensures behavior preservation

## Next Steps

1. Review this analysis with team
2. Prioritize based on current sprint goals
3. Create Linear issues for each P0/P1 item
4. Start with highest-impact, lowest-risk items
5. Track progress and update analysis quarterly
```

## Success Criteria

- ✅ All features analyzed for structure
- ✅ Cross-feature imports identified
- ✅ Component quality assessed
- ✅ Data fetching patterns reviewed
- ✅ Prioritized refactoring plan created
- ✅ Detailed tasks for P0/P1 items
- ✅ Summary report generated

## Error Handling

**If scope is unclear:**
- Ask user to specify app or feature
- Default to current app if in app directory
- Offer to analyze all apps if at root

**If analysis takes too long:**
- Focus on P0/P1 items first
- Can run analysis incrementally by feature
- Save intermediate results

**If patterns are ambiguous:**
- Flag for manual review
- Provide examples of good vs bad patterns
- Reference Bulletproof React docs

## Important Notes

- **Don't refactor everything at once** - Prioritize and do incrementally
- **Add tests before refactoring** - Ensures behavior preservation
- **One feature at a time** - Easier to review and test
- **Document decisions** - Why refactoring was done
- **Measure impact** - Track improvements after refactoring

## References

- Bulletproof React: https://github.com/alan2207/bulletproof-react
- Project Rules: `.cursor/rules/`
- TypeScript Rules: `.cursor/rules/10-typescript.mdc`
- Component Rules: `.cursor/rules/60-feature-components.mdc`
- API Layer Rules: `.cursor/rules/70-api-layer.mdc`
- React Query Rules: `.cursor/rules/30-react-query.mdc`
