# Linear issue description template

Use after **Gate A** in `discover-build-issue`. Paste into `save_issue` `description` (Markdown).

```markdown
## Overview

{Problem and outcome in plain language — preserve original intent}

## Shared decisions

| Topic | Decision |
|-------|----------|
| {from Decision log} | |

## Technical context

- **Affected apps**: {admin-web | student-web | tutor-web | student-app}
- **Layer**: {frontend | backend | fullstack}
- **Key paths**:
  - `{path}` — {why relevant}
- **Dependencies**: {issues or none}
- **Stack**: {React, migrations, Edge Functions, etc. as applicable}

## Implementation approach

{Recommended approach aligned with existing patterns — high level, not a full diff}

## Acceptance criteria

- [ ] {Specific, testable}
- [ ] {Edge case covered}
- [ ] Tests pass (`pnpm test` in affected workspace)
- [ ] {Role/RLS check if applicable}

## Out of scope

- {Explicit exclusions}

## Testing notes

- **Unit**: {components / functions}
- **Manual E2E**: {user flows}
- **Edge cases**: {scenarios}

## Related code

- `{repo-relative/path}` — {one line}
```

## Labels (Altitutor)

| Label | When |
|-------|------|
| `frontend` | UI / client-only |
| `backend` | DB, RLS, Edge Functions only |
| `fullstack` | Both |
| `needs-tests` | New behavior needs coverage |
| `breaking-change` | API or contract break |
