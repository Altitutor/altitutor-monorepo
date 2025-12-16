# Build Issue

Implement Linear issue(s) with comprehensive testing and incremental commits.

## Context

This is the Every Language monorepo:

- **Stack**: React 19, TypeScript 5.8, TailwindCSS, TanStack Query 5.83, Zustand 5.0, Supabase (Postgres 17), Deno Edge Functions
- **Project Rules**: See `.cursor/rules/` for frontend, backend, testing guidelines
- **Testing**: Write tests for all new features and bug fixes
- **Documentation**: Use context7 MCP for library best practices

## Workflow

### 1. Identify Issue(s) to Build

**Auto-detect from Git:**

- Get current branch name
- Extract issue IDs from latest commit message (look for `ref {issue_id}` pattern)
- Check draft PR description for `fixes {issue_id}` pattern

**Fallback:**

- If no issues found in git, ask user: "Which Linear issue(s) should I build? (e.g., `EL-123`)"

### 2. Fetch Issue Details from Linear

For each issue:

- Use Linear MCP to fetch:
  - Full description (should have context from `/write-issue` if used)
  - Acceptance criteria
  - Labels (frontend/backend/fullstack)
  - Related project
  - Comments (may have clarifications)

### 3. Analyze Codebase Context

**Identify Affected Areas:**

- Based on issue description, find relevant files:
  - Frontend: Components in `apps/*/src/features/`, stores, hooks
  - Backend: Migrations in `supabase/migrations/`, Edge Functions in `supabase/functions/`
  - Types: Check `packages/shared-types/types/database.types.ts`

**Search for Similar Patterns:**

- Look for existing implementations of similar features
- Identify reusable components, hooks, or utilities
- Check for established patterns to follow

**Review Project Rules:**

- Read `.cursor/rules/frontend.mdc` for React/TanStack Query/Zustand patterns
- Read `.cursor/rules/backend.mdc` for Supabase migration rules
- Read `.cursor/rules/testing.mdc` for testing patterns
- Apply `.cursor/rules/general.mdc` conventions

### 4. Create Implementation Plan

Show user a detailed plan:

```markdown
## Implementation Plan for {issue_id}

### Overview

{Summary of what will be implemented}

### Changes Required

1. **{Component/File 1}**
   - Action: {What will be done}
   - Rationale: {Why this approach}

2. **{Component/File 2}**
   - Action: {What will be done}
   - Rationale: {Why this approach}

### Testing Strategy

- **Unit Tests**: {Which components/functions}
- **Integration Tests**: {Which flows}
- **E2E Manual Testing**: {Which user scenarios}

### Potential Risks

- {Risk 1}: {Mitigation}
- {Risk 2}: {Mitigation}

### Breaking Changes

{None | List breaking changes}
```

**Wait for User Approval:**

- Ask: "Does this plan look good? Any changes before I start implementing?"
- Allow user to adjust approach, scope, or priorities

### 5. Look Up Best Practices (REQUIRED)

**Before implementing, use context7 MCP to:**

- Get official documentation for any libraries being used
- Verify best practices for patterns being implemented
- Check for updated API usage if using external libraries

Example queries:

- "TanStack Query 5 optimistic updates pattern"
- "React Hook Form with Zod validation"
- "Supabase RLS policy examples"

### 6. Implement Changes Incrementally

**TDD Approach (Preferred):**

1. Create test file first (if doesn't exist)
2. Write failing tests based on acceptance criteria
3. Implement code to make tests pass
4. Refactor and cleanup

**Implementation Order:**

1. **Backend First (if applicable):**
   - Database migrations (must be idempotent - see backend.mdc)
   - Edge Functions
   - Update RLS policies
   - Generate types: `pnpm db:generate-types`

2. **Frontend Next:**
   - Create/update components
   - Add state management (Zustand stores)
   - Add data fetching (TanStack Query hooks)
   - Style with TailwindCSS

3. **Tests:**
   - Unit tests for components/functions
   - Integration tests for user flows
   - Follow testing.mdc patterns

**Make Incremental Commits:**
Don't make one giant commit. Instead:

```bash
# After implementing a component
git add src/features/example/ComponentA.tsx
git commit -m "feat: add ComponentA for {feature}

ref {issue_id}"

# After adding tests
git add src/features/example/ComponentA.test.tsx
git commit -m "test: add tests for ComponentA

ref {issue_id}"

# After database migration
git add supabase/migrations/*.sql
git commit -m "feat: add migration for {table}

ref {issue_id}"
```

**Stop and Ask for Breaking Changes:**

- If implementation requires breaking changes, STOP and ask user:
  - "This change will break existing API/component. Proceed? (y/n)"
  - Explain the breaking change and impact

### 7. Run Quality Checks After Implementation

**Continuous Verification:**
After each major change, run:

```bash
pnpm run lint          # Check linting
pnpm run type-check    # Check TypeScript errors
pnpm run test          # Run tests
```

**Fix Issues Immediately:**

- If linter errors: Fix them before moving to next change
- If type errors: Fix them immediately
- If tests fail: Debug and fix before continuing

### 8. Final Verification

Run full quality check:

```bash
pnpm run ci:pr
```

This runs (mirroring CI workflow):

- Format check (all workspaces)
- Lint (all workspaces)
- Type check (all workspaces)
- Tests with coverage (all workspaces)
- Build (all workspaces)
- Backend checks (if backend changed: Supabase start, tests, Deno type-check)
- App-specific validations (App Bible managed workflow check)
- Security audit

**Note**: The script automatically detects which parts of the monorepo changed and only runs relevant checks.

\*\*If `ci:pr` fails:

- Identify which step failed
- Fix the issues
- Re-run `ci:pr`
- Repeat until it passes

### 9. Update Documentation (if needed)

**Database Changes:**

- If migrations added/modified tables, update docs in `docs/database/`
- Follow domain-based organization (ref-languages-and-regions, bible, analytics, users, finance, projects)

**API Changes:**

- If Edge Functions changed, update relevant API docs
- Add JSDoc comments to new functions

**Component Changes:**

- Add JSDoc/TSDoc to complex components
- Update Storybook stories if applicable

### 10. Provide E2E Testing Instructions

Give user specific manual testing steps:

```markdown
## E2E Testing Instructions

### Setup

1. Start development server:
   - Frontend: `pnpm --filter={workspace} dev`
   - Backend: `pnpm dev` (starts local Supabase)

2. Navigate to: {URL}

### Test Scenarios

**Scenario 1: {Happy Path}**

1. {Step 1}
2. {Step 2}
3. Expected result: {What should happen}

**Scenario 2: {Edge Case}**

1. {Step 1}
2. {Step 2}
3. Expected result: {What should happen}

**Scenario 3: {Error Case}**

1. {Step 1}
2. {Step 2}
3. Expected result: {Error handling behavior}

### Verification Checklist

- [ ] UI renders correctly
- [ ] Data persists correctly
- [ ] Error states display properly
- [ ] Loading states work
- [ ] Responsive design works
- [ ] Accessibility (keyboard navigation, screen reader)
- [ ] Performance (no lag, smooth interactions)

### Database Verification (if applicable)

- Check data in Supabase dashboard
- Verify RLS policies work correctly
- Test with different user roles
```

### 11. Final Summary

Provide summary:

```markdown
## Implementation Complete ✅

### Changes Made

- {List of files changed}
- {Key features implemented}

### Commits

- {commit_sha}: {commit_message}
- {commit_sha}: {commit_message}

### Quality Checks

- ✅ Lint passed
- ✅ Type check passed
- ✅ Tests passed ({X} tests)
- ✅ Build successful

### Next Steps

1. Complete E2E testing above
2. If tests pass, run `/close-issue` to finalize PR
3. If issues found, let me know and I'll fix them
```

## Success Criteria

- All changes implemented according to acceptance criteria
- Incremental commits with proper messages
- All tests pass (unit + integration)
- Type check passes
- Linting passes
- Documentation updated (if needed)
- User has clear E2E testing instructions
- Ready for `/close-issue` command

## Error Handling

- If no issue found: Ask user for issue ID
- If Linear API fails: Continue with cached/manual context
- If tests fail: Debug, fix, and re-run
- If breaking changes needed: Get user approval first
- If `ci:pr` fails: Identify and fix issues iteratively
- If library usage unclear: Use context7 MCP for documentation

## Important Notes

- **Never use `any` type**: Use `unknown` instead
- **Always enable RLS**: For new database tables
- **Migrations must be idempotent**: See backend.mdc
- **Write explicit return types**: For all functions
- **Use conventional commits**: feat:, fix:, test:, chore:
- **Reference issues in commits**: `ref {issue_id}`
