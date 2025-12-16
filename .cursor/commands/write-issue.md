# Write Issue

Write out a linear issue properly, and enhance it with detailed context from the codebase to prepare it for implementation.

## Context

This is an Every Language monorepo with:

- **Stack**: React 19, TypeScript 5.8, TailwindCSS, TanStack Query 5.83, Zustand 5.0, Supabase (Postgres 17)
- **Structure**: `apps/`, `packages/shared-types` (DB types), `supabase/` (migrations, Edge Functions)
- **Environments**: `develop` branch → dev, `main` branch → prod

## Workflow

### 1. Get Linear Issue ID

- Prompt user for the Linear issue ID (e.g., `EL-123`)

### 2. Fetch Issue from Linear

- Use the Linear MCP to fetch the issue details:
  - Issue title, description, and current status
  - Issue type (feature/bug/improvement)
  - Assigned team (Backend/Frontend)
  - Related project (if any)
  - Labels
  - Assignee

### 3. Analyze Codebase Context

Based on the issue type and description:

**For Frontend Issues:**

- Search for related components in `apps/*/src/features/` and `apps/*/src/shared/components/`
- Identify relevant state management (Zustand stores, TanStack Query hooks)
- Look for similar features or patterns in the codebase
- Check existing tests in `*.test.tsx` files

**For Backend Issues:**

- Search for related database tables in `supabase/migrations/`
- Look for relevant Edge Functions in `supabase/functions/`
- Check RLS policies and RBAC permissions
- Review database documentation in `docs/database/`

**For Full-Stack Issues:**

- Analyze both frontend and backend components
- Identify API integration points
- Check type definitions in `packages/shared-types`

### 4. Gather Additional Context

Ask the user targeted questions to clarify:

- **Ambiguities**: Any unclear requirements in the issue
- **Technical Decisions**: Preferred approach if multiple options exist
- **Scope**: What's in/out of scope
- **Dependencies**: Are there other issues that need to be completed first?
- **Acceptance Criteria**: What defines "done"?
- **Edge Cases**: Specific scenarios to handle

### 5. Update Linear Issue

Using the Linear MCP, update the issue with:

**Enhanced Description:**

```markdown
## Overview

[Original issue description]

## Technical Context

- **Affected Files**: [List key files from codebase analysis]
- **Dependencies**: [Related issues/projects]
- **Stack Components**: [Relevant tech: React components, DB tables, Edge Functions]

## Implementation Approach

[Recommended approach based on codebase analysis]

## Acceptance Criteria

- [ ] [Specific, testable criteria]
- [ ] [Include edge cases]
- [ ] [Tests pass]

## Testing Notes

- **Unit Tests**: [Components/functions to test]
- **E2E Testing**: [User flows to verify]
- **Edge Cases**: [Scenarios to manually verify]

## Related Code

[Links to relevant files/functions in the codebase]
```

**Labels to Add:**

- `frontend` or `backend` or `fullstack` (based on analysis)
- `needs-tests` if tests are required
- `breaking-change` if it affects existing APIs

### 6. Confirm with User

- Show the updated issue description
- Ask: "Does this capture everything needed for implementation?"
- Make any final adjustments based on feedback

## Success Criteria

- Issue has detailed technical context from codebase
- Implementation approach is clear
- Acceptance criteria are specific and testable
- Another AI agent can implement this without additional questions
- User confirms the issue is ready

## Error Handling

- If Linear API fails: Ask user to provide issue details manually
- If issue not found: Verify the issue ID is correct
- If codebase analysis finds no related code: Ask user for pointers to similar features
