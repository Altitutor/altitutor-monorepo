---
name: check-and-commit
description: >-
  Run lint → typecheck → test → build until green, then commit. Use when the
  user asks to pass CI, run checkall, fix quality checks, prepare to commit,
  ship local changes, or says check-and-commit.
disable-model-invocation: true
---

# Check and Commit

Get the branch green with `pnpm checkall` (lint → typecheck → test → build), then commit.

## Context

- Run from repo root
- Zero lint warnings; no `any`
- Conventional Commits (commitlint + husky): `type(scope): subject`

## Workflow

### Phase 1: Quality checks

1. Run `pnpm checkall`.
2. On failure, fix only the failing phase, then re-run `pnpm checkall`:
   - Lint: `pnpm lint` — fix errors and warnings
   - Typecheck: `pnpm typecheck` — no `any`
   - Test: `pnpm test` — fix test or code; **ask** if behavior is unclear
   - Build: `pnpm build`
3. Max 3 fix attempts per phase; if still red, report and stop (do not commit).
4. For large failure sets, use subagents via the Task tool (`generalPurpose`).

Never `--no-verify` or blanket `eslint-disable`.

### Phase 2: Commit

Only after `pnpm checkall` passes.

1. In parallel: `git status`, `git diff`, `git diff --cached`, `git log -5 --oneline`
2. Do not commit secrets (`.env`, credentials) — warn if present
3. Stage intended changes; if nothing to commit, stop
4. Message: imperative subject ≤100 chars; body = **why**; add `ref ALT-123` if issue is in branch name
5. Commit via HEREDOC (never amend unless user asked and HEAD is unpushed)

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject

Why this change was made.
ref ALT-123
EOF
)"
```

6. Verify with `git status`. Do not push unless asked.

## Output

Success: checks passed, commit hash + subject, branch name.  
Failure: which phase failed, what remains, whether user input is needed.
