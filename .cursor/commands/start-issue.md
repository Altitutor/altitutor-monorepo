# Start Issue

Create a feature branch and draft PR for one or more Linear issues, following the Every Language workflow.

## Context

- **Branch Strategy**: All branches created from `develop`, PRs merge to `develop`
- **Commit Convention**: Conventional commits with Linear references
- **PR Format**: Draft PRs with `fixes {issue_id}` tags

## Workflow

### 1. Pre-flight Checks

**Verify Git State:**

- Check current branch: Must be on `develop`
  - If not on `develop`: Ask user to switch or offer to do it
- Check for uncommitted changes: Working directory must be clean
  - If dirty: Ask user to commit or stash changes first
- Pull latest changes: `git pull origin develop`
  - If pull fails: Ask user to resolve conflicts

### 2. Get Linear Issue ID(s)

- Prompt user for Linear issue ID(s): "Provide Linear issue ID(s) (e.g., `EL-123` or `EL-123 EL-124`)"
- Parse input to handle both single and multiple issue IDs
- Validate format: Issues should match pattern `[A-Z]+-\d+`

### 3. Fetch Issues from Linear

For each issue ID:

- Use Linear MCP to fetch issue details:
  - Title
  - Description
  - Status (should be "Backlog" or "Todo")
  - Branch name from Linear
  - Team/project assignment

**Handle Multiple Issues:**

- If multiple issues provided, ask: "Which issue should be primary for branch naming?"
- Use primary issue's branch name from Linear
- Verify all issues are not already "Done" or "Canceled"

### 4. Create Git Branch

**Single Issue:**

```bash
git checkout -b {branch_name_from_linear}
```

**Multiple Issues:**

```bash
git checkout -b {primary_issue_branch_name}
```

**Branch Name Conflict:**

- If branch already exists locally: Ask user "Branch exists. Options: (1) Use existing branch, (2) Delete and recreate, (3) Cancel"
- If branch exists remotely: Inform user and ask how to proceed

### 5. Create Initial Commit

**Single Issue:**

```bash
git commit --allow-empty -m "chore: start work on {issue_title}

ref {issue_id}"
```

**Multiple Issues:**

```bash
git commit --allow-empty -m "chore: start work on {primary_issue_title}

ref {issue_id_1} {issue_id_2} {issue_id_3}"
```

### 6. Push Branch

```bash
git push -u origin {branch_name}
```

### 7. Create Draft PR

**Fetch PR Template:**

- Check if `.github/PULL_REQUEST_TEMPLATE.md` or `.github/pull_request_template.md` exists
- If exists, read template and use it as structure
- If not, use default structure

**Single Issue PR - Use heredoc format:**

```bash
gh pr create --title "{issue_title}" --body "BODY_CONTENT_HERE" --draft --base develop
```

Where BODY_CONTENT_HERE includes:

- Summary section with issue title and brief description
- Changes checklist
- Testing checklist
- "fixes {issue_id}" at the end

**Multiple Issues PR:**

- Similar format but list all issues in summary
- Include "fixes {issue_id_1} {issue_id_2}" for all issues

**Add PR Checklist Based on Issue Type:**

- If feature: Add "New feature checklist" items
- If bug: Add "Bug fix verification" items
- If involves DB changes: Add "Migration checklist"
- If involves tests: Add "Test coverage checklist"

### 8. Verify Linear Integration

- Check that Linear has automatically moved issues to "In Progress" or "Todo"
- If not updated within a few seconds, inform user: "Note: Linear should auto-update issue status. If it doesn't, check the PR description has correct 'fixes {issue_id}' format."

### 9. Next Steps

Inform user:

```
✅ Branch created: {branch_name}
✅ Draft PR created: {pr_url}
✅ Linear issue(s) updated

Next steps:
1. Run `/build-issue` to implement the changes
2. Or start coding manually
3. When ready, run `/close-issue` to finalize
```

## Success Criteria

- Branch created from `develop`
- Initial commit pushed with proper `ref {issue_id}` tags
- Draft PR created with proper `fixes {issue_id}` tags
- Linear issue status updated to "In Progress" or "Todo"
- User knows next steps

## Error Handling

- If not on `develop`: Guide user to switch branches
- If uncommitted changes: Ask user to commit/stash
- If Linear API fails: Fall back to manual input for issue details
- If `gh` CLI not available: Provide manual PR creation instructions
- If branch exists: Provide resolution options
- If PR creation fails: Show error and suggest manual PR creation
