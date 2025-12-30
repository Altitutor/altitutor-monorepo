# Commit

Analyze staged changes and create a conventional commit message following project standards.

## Context

- **Commit Convention**: Conventional Commits with strict rules (enforced by commitlint + husky)
- **Types**: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
- **Format**: `type(scope): subject` (scope optional)
- **Constraints**:
  - Header max 100 characters
  - Subject cannot end with period
  - Subject cannot be empty
  - Type must be lowercase
- **Issue References**: Include `ref {issue_id}` in commit body if working on Linear issue

## Workflow

### 1. Check Git Status

Show current git status:

```bash
git status
```

Read any files if you need to gather more context

### 2. Write commit message

DO NOT use emojis anywhere in your commit message.

#### 2.1 detect issue context

Auto-detect if working on a Linear issue:

- Check current branch name for issue ID pattern `[A-Z]+-\d+`
- Check recent commits for `ref {issue_id}` pattern
- Check if draft PR exists with `fixes {issue_id}`

If issue detected:

- Extract issue ID(s)
- Note for commit body

#### 2.2 Analyze Changes and Generate Commit Message

**Determine Commit Type:**
Based on file changes:

- `feat`: New features or capabilities
- `fix`: Bug fixes
- `test`: Adding/updating tests (if only test files)
- `docs`: Documentation only changes
- `style`: Code style/formatting (no logic changes)
- `refactor`: Code restructuring (no behavior change)
- `perf`: Performance improvements
- `chore`: Maintenance (deps, configs, build)
- `ci`: CI/CD pipeline changes
- `build`: Build system/dependencies

#### 2.3 **Determine Scope (optional):**

Based on affected area:

- Frontend: Component/feature name
- Backend: Migration/function name
- Monorepo: Workspace name (e.g., `admin-web`, `student-web`, `tutor-web`, `shared`, `ui`)

#### 2.4 **Write Subject:**

- Clear, concise description of what changed
- Imperative mood ("add feature" not "added feature")
- Max 100 chars total including type and scope

#### ** 2.5 Write Body (if needed):**

- Explain WHY the change was made (not what - that's in the diff)
- Include issue reference: `ref {issue_id}` if applicable
- Break long explanations into multiple lines (max 100 chars per line)
- Leave blank line between subject and body

### 3. Commit

```bash
git commit -m '<commit_message>'
```
