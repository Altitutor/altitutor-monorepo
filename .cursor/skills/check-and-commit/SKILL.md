---
name: check-and-commit
description: Run lint, typecheck, test, and build until all pass, then commit all changes on the current branch. Use when the user asks to pass CI, run checkall, fix quality checks and commit, ship local changes, or says check-and-commit.
---

# Check and Commit

Get the current branch green (lint → typecheck → test → build), then commit all changes with a conventional commit message.

## Context

- **Monorepo**: pnpm workspace + Turborepo. Run all commands from repo root.
- **Full gate**: `pnpm checkall` (runs lint, typecheck, test, build in order)
- **Individual phases** (for fixing): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- **Rules**: `.cursor/rules/` — zero lint warnings, strict TypeScript, no `any`
- **Commit convention**: Conventional Commits (commitlint + husky). Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert. Format: `type(scope): subject`

## Trigger

User asks to pass CI, run checkall, fix checks and commit, ship changes, or invokes `/check-and-commit`.

## Workflow

### Phase 1: Quality checks

1. Run `pnpm checkall` from repo root.
2. If it passes, skip to Phase 2.
3. If it fails, identify which phase failed (lint, typecheck, test, or build) and fix **only that phase** before re-running `pnpm checkall`:
   - **Lint**: `pnpm lint` → fix all errors and warnings (zero-warnings policy) → re-run lint until clean
   - **Typecheck**: `pnpm typecheck` → fix type errors (no `any`) → re-run until clean
   - **Test**: `pnpm test` → for each failure, fix the test if wrong, fix code if wrong; **stop and ask the user** if desired behavior is unclear
   - **Build**: `pnpm build` → fix build errors → re-run until clean
4. After each fix cycle, re-run `pnpm checkall`. Repeat until exit code 0.
5. **Max 3 fix attempts per failing phase** — if still failing, report remaining issues and stop (do not commit).

#### Fix strategy

- Fix issues directly when straightforward; use subagents for large failure sets.
- Never skip hooks, use `--no-verify`, or blanket `eslint-disable` without justification.
- Do not proceed to commit until `pnpm checkall` passes.

### Phase 2: Commit all changes

Only run when `pnpm checkall` passes.

1. **Gather context** (run in parallel):

```bash
git status
git diff
git diff --cached
git log -5 --oneline
```

2. **Review changes**:
   - Do not commit `.env`, credentials, or other secrets — warn the user if present
   - Stage all intended changes: `git add -A` (or stage specific paths if secrets are mixed in)

3. **If nothing to commit** (`git diff --cached --quiet` after staging): report "checks passed, nothing to commit" and stop.

4. **Draft commit message**:
   - Detect Linear issue from branch name (`[A-Z]+-\d+`) or recent commits; add `ref {issue_id}` in body if found
   - Choose type/scope from the diff (see commit skill conventions)
   - Subject: imperative mood, no trailing period, header ≤100 chars
   - Body: explain **why** (not what); no emojis

5. **Commit** (never update git config; never skip hooks):

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject

Why this change was made.
ref ALT-123
EOF
)"
```

6. **Verify**: `git status` — working tree should be clean (or only intentionally unstaged files).

## Guardrails

- **No commit on red**: Never commit while `pnpm checkall` fails.
- **No force push**: Do not push unless the user explicitly asks.
- **Pre-commit hooks**: If commit fails due to hooks, fix the issue and create a **new** commit (do not amend unless user requested amend and HEAD was unpushed).
- **Test uncertainty**: Do not guess behavior — ask the user before changing tests or business logic.

## Output

**On success:**

```markdown
## Check and Commit Complete

- Lint, typecheck, test, build: passed (`pnpm checkall`)
- Committed: `<commit hash>` — `<subject>`
- Branch: `<branch name>`
```

**On failure:** Report which phase failed, what was fixed, what remains, and whether user input is needed.
