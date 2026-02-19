---
name: close-issue
description: Finalize issue implementation with quality checks and mark PR ready for review
disable-model-invocation: true
---
# Close Issue

Finalize issue implementation with comprehensive checks, commit final changes, and mark PR ready for review.

## Context

- **Quality Gate**: `pnpm checkall` must pass (lint, typecheck, tests, build)
- **PR Workflow**: Draft PR → Ready for Review → Approved → Merged
- **Linear Integration**: PR status updates automatically sync to Linear

## Workflow

### 1. Pre-flight Verification

**Check Git State:**

- Verify you're on a feature branch (not `develop` or `main`)
  - If on `develop`/`main`: ERROR - Cannot close issue from main branches
- Check for uncommitted changes
  - If changes exist: They will be committed in step 3

**Identify Associated Issues:**

- Get current branch name
- Check latest commits for `ref {issue_id}` patterns
- Check draft PR description for `fixes {issue_id}` patterns
- Confirm issue IDs with user

### 2. Verify Acceptance Criteria

For each issue:

- Use Linear MCP to fetch issue details
- Extract acceptance criteria from description
- Show checklist to user:

```markdown
## Acceptance Criteria for {issue_id}

{List acceptance criteria from Linear}

Have all criteria been met? (y/n)
```

- If user says "no": Ask what's missing and offer to implement
- If user says "yes": Continue

### 3. Verify TODO Comments Resolved

Search codebase for TODO/FIXME comments:

```bash
# Search in changed files only
git diff --name-only develop...HEAD | xargs grep -n "TODO\|FIXME" || true
```

- If TODOs found: Show them to user
  - Ask: "These TODOs were added/remain. Should they be resolved or are they intentional?"
  - If need resolution: Fix them
  - If intentional: Continue

### 4. Run Comprehensive Quality Checks

Run full quality gate:

```bash
pnpm checkall
```

This executes:

1. **Lint** (all workspaces)
2. **Type check** (all workspaces)
3. **Tests** (all workspaces)
4. **Build** (all workspaces)

**Note**: This runs checks across all workspaces. For app-specific checks, run commands in the specific app directory.

\*\*If `checkall` fails:

Iterate on fixes:

1. Identify which step failed from error output
2. Analyze the error:
   - **Lint errors**: Fix code style issues
   - **Type errors**: Fix TypeScript type issues
   - **Test failures**: Debug and fix failing tests
   - **Build errors**: Fix compilation issues

3. Make fixes and commit:

```bash
git add .
git commit -m "fix: resolve {issue_type} errors

ref {issue_id}"
git push
```

4. Re-run `pnpm checkall`
5. Repeat until all checks pass

**Maximum Iterations:**

- If after 5 iterations `checkall` still fails, ask user:
  - "Quality checks still failing after 5 attempts. Options: (1) Continue fixing, (2) Show me errors for manual review, (3) Skip specific check (not recommended)"

### 5. Check for Merge Conflicts

Verify PR has no conflicts with `develop`:

```bash
git fetch origin develop
git merge-base --is-ancestor origin/develop HEAD || echo "Behind develop"
```

**If behind develop:**

- Inform user: "Your branch is behind develop. Need to update."
- Offer to merge develop:

```bash
git merge origin/develop
# If conflicts, notify user and pause for resolution
```

- After merge, re-run `pnpm checkall`

### 6. Commit Final Changes

If uncommitted changes exist:

```bash
git add .
git commit -m "chore: final cleanup and fixes

ref {issue_id}"
git push
```

### 7. Update PR Description

Enhance PR description with implementation summary using `gh pr edit`

Include:

- Original summary
- Auto-generated list of changes from commits
- Testing results (unit, integration, manual E2E)
- Quality checks status
- Review checklist
- Related issues with `fixes {issue_id}` tags

### 8. Request Reviewer Assignment

Ask user: "Who should review this PR?"

Options:

- If user provides GitHub usernames: Assign them
- If user says "team": Get team members from Linear and assign
- If user says "auto": Use GitHub's auto-assignment

```bash
gh pr edit --add-reviewer {github_username}
```

### 9. Add PR Comment with Summary

Add comment to PR documenting the implementation using `gh pr comment`

Include:

- Completed features/fixes
- Testing results (unit, integration, manual)
- Quality metrics (type safety, coverage, lint, build)
- Next steps for reviewer

### 10. Mark PR as Ready for Review

```bash
gh pr ready
```

**Verify Linear Integration:**

- Check that Linear automatically moves issues to "In Review"
- If not updated: Inform user to check Linear integration

### 11. Final Confirmation

Show success message:

```markdown
## Issue Closed Successfully! 🎉

### Summary

- ✅ Quality checks passed (lint, type-check, tests, build, security)
- ✅ All changes committed and pushed
- ✅ PR marked ready for review
- ✅ Reviewer(s) assigned: {reviewers}
- ✅ Linear issue(s) moved to "In Review"

### PR Details

- **URL**: {pr_url}
- **Branch**: {branch_name}
- **Issues**: {issue_ids}

### Next Steps

1. Wait for code review from {reviewers}
2. Address any review comments
3. Once approved, PR can be merged
4. Linear will auto-update to "Done" after merge

### Monitoring

- Watch PR for review comments: `gh pr view`
- Check CI/CD status: GitHub Actions should all pass
```

## Success Criteria

- `pnpm checkall` passes (all quality gates)
- All uncommitted changes committed
- No TODO comments unresolved (or intentional ones documented)
- No merge conflicts with `develop`
- PR description updated with implementation summary
- Reviewer(s) assigned
- PR marked as ready for review
- Linear issue(s) moved to "In Review" status

## Error Handling

- If on `develop`/`main`: Prevent execution, guide user to feature branch
- If `checkall` fails: Iterate on fixes up to 5 times, then ask user
- If merge conflicts: Pause and ask user to resolve
- If PR not found: Verify branch has associated PR
- If Linear API fails: Continue workflow, warn user to check Linear manually
- If reviewer assignment fails: Inform user to assign manually
- If `gh pr ready` fails: Show error, provide manual instructions

## Important Notes

- **Never skip quality checks**: `checkall` must pass
- **No direct merges**: PR must go through review process
- **Linear integration**: Should be automatic, but verify
- **Breaking changes**: Must be documented in PR description
- **Database migrations**: Must be reviewed carefully
- **Security**: Follow security best practices for RLS policies and data access
