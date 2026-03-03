---
name: quality-check-pipeline
description: Run lint, typecheck, test, and build sequentially; spin up subagents to fix failures until all pass. Use when the user asks to run quality checks, fix all lint/type/test/build errors, or prepare code for commit.
---

# Quality Check Pipeline

Run the full quality check sequence (lint → typecheck → test → build) and fix all failures using subagents. Each phase must pass before proceeding to the next.

## Context

- **Monorepo**: pnpm workspace, Turborepo. Run all commands from repo root.
- **Commands**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (or `pnpm checkall` for all).
- **Rules**: `.cursor/rules/` for ESLint, TypeScript, testing standards.

## Trigger

User asks to run quality checks, fix all errors, prepare for commit, or similar.

**Invocation examples**: "Run the quality check pipeline", "Fix all lint and type errors", "Run quality-check-pipeline", "Prepare my code for commit".

## Workflow (Sequential)

Execute phases in order. Do not proceed to the next phase until the current one passes with zero errors and zero warnings.

### Phase 1: Lint

1. Run `pnpm lint` in the repo root.
2. If exit code ≠ 0 or there are warnings:
   - Summarize the lint output (errors and warnings by file).
   - Launch subagent(s) via `mcp_task` with `subagent_type: "generalPurpose"`:
     - **Prompt**: "Fix all ESLint errors and warnings in this monorepo. Run `pnpm lint` to see current issues. Fix them systematically. Follow project rules in .cursor/rules/ (especially 15-eslint-quality.mdc). Zero warnings policy. Return a summary of fixes applied."
   - After subagent completes, re-run `pnpm lint`.
   - Repeat until `pnpm lint` passes with zero errors and zero warnings.
3. Proceed to Phase 2 only when lint is clean.

### Phase 2: Typecheck

1. Run `pnpm typecheck` in the repo root.
2. If exit code ≠ 0:
   - Summarize the type errors (by file and message).
   - Launch subagent(s) via `mcp_task` with `subagent_type: "generalPurpose"`:
     - **Prompt**: "Fix all TypeScript type errors in this monorepo. Run `pnpm typecheck` to see current errors. Fix them. Never use `any`; use proper types or `unknown` with type guards. Follow .cursor/rules/10-typescript.mdc. Return a summary of fixes applied."
   - After subagent completes, re-run `pnpm typecheck`.
   - Repeat until `pnpm typecheck` passes.
3. Proceed to Phase 3 only when typecheck is clean.

### Phase 3: Test

1. Run `pnpm test` in the repo root.
2. If exit code ≠ 0:
   - Summarize the failing tests (test name, file, error message).
   - For each failure, the subagent must decide:
     - **Bad test**: Test is wrong (outdated expectations, incorrect assertions). Fix the test.
     - **Bad business logic**: Implementation is wrong. Fix the code under test.
     - **Uncertain**: Cannot determine desired behavior. **STOP and ask the user** before making changes.
   - Launch subagent(s) via `mcp_task` with `subagent_type: "generalPurpose"`:
     - **Prompt**: "Fix failing tests in this monorepo. Run `pnpm test` to see failures. For each failure, determine: (1) Is the test wrong? Fix the test. (2) Is the implementation wrong? Fix the code. (3) If unsure what the desired behavior is, STOP and report back that you need user clarification—do NOT guess. Follow .cursor/rules/80-testing.mdc. Return a summary of fixes applied, or list any failures where you need user input."
   - If the subagent reports uncertainty about desired behavior: **Stop the pipeline and ask the user** to clarify.
   - After subagent completes (and no uncertainty), re-run `pnpm test`.
   - Repeat until `pnpm test` passes or user clarification is needed.
3. Proceed to Phase 4 only when tests pass.

### Phase 4: Build

1. Run `pnpm build` in the repo root.
2. If exit code ≠ 0:
   - Summarize the build errors.
   - Launch subagent(s) via `mcp_task` with `subagent_type: "generalPurpose"`:
     - **Prompt**: "Fix all build errors in this monorepo. Run `pnpm build` to see current failures. Fix them. Return a summary of fixes applied."
   - After subagent completes, re-run `pnpm build`.
   - Repeat until `pnpm build` passes.
3. Pipeline complete when build passes.

## Guardrails

- **Sequential only**: Never run typecheck before lint passes, test before typecheck passes, or build before test passes.
- **Zero warnings for lint**: Project has zero-warnings policy; fix warnings as well as errors.
- **Test uncertainty**: If the subagent cannot determine whether a failing test or the implementation is wrong, stop and ask the user. Do not guess.
- **No bypassing**: Do not use `--no-verify`, `eslint-disable` without justification, or skip phases.
- **Max iterations**: If a phase fails after 3 subagent fix attempts, report the remaining issues and ask the user for guidance.

## Output

After each phase, report:

- Phase name and status (pass/fail).
- If fail: summary of issues and subagent fixes applied.
- If test phase stopped for uncertainty: list failures needing user clarification.

Final summary when all phases pass:

```markdown
## Quality Check Pipeline Complete ✅

- ✅ Lint: passed
- ✅ Typecheck: passed
- ✅ Test: passed
- ✅ Build: passed

Ready for commit.
```
