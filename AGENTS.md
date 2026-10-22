# AGENTS.md

Altitutor monorepo (pnpm + Turborepo).

## Apps

- Web: `apps/*-web` (Next.js) — admin, student, tutor, marketing, ucat
- Expo: `apps/*-app` (e.g. `student-app`) — Expo skills apply here only

## Architecture

- Feature-first under `features/[name]/` (`api/`, `components/`, `hooks/`, `types/`, …)
- Packages: `packages/shared`, `packages/ui`, `packages/ucat-marking`

## Supabase / RLS

- **ADMINSTAFF**: base-table access
- **TUTOR / STUDENT**: no base tables — **read** via `vtutor_*` / `vstudent_*` views; **write** via API routes only
- Wrap auth helpers as `(select auth.uid())`
- **Do not** mutate remote DBs (apply migrations, push functions, ad-hoc SQL writes) unless the user explicitly says so — migrations/functions ship via **CI/CD**
- After migration SQL: use the owned disposable database workflow in `docs/agents/local-database-tests.md`; `pnpm checkall`, `pnpm db:seed:ucat`, `pnpm db:types` and `pnpm db:committypes` automatically use a separate disposable stack; a shared lock covers startup/reset/seed/tests/cleanup while non-DB work remains concurrent. Normal Docker bindings are approved; unproven targets are rejected. Never run a bare reset against the normal shared stack.
- **Do not** edit migration files after they have been applied to any remote db. If you are unsure, check the github actions or the corresponding remote db.

## Quality

- Zero lint warnings; no `any`
- Full gate when shipping: `/check-and-commit` (`pnpm checkall`)
- **Sentry fixes**: before committing or opening a PR for a Sentry-tracked bug,
  follow §4 of `docs/agents/sentry-morning-maintenance.md`.

## Tracking

- Verified tracker: Altitutor workspace `928fdb63-c8a2-4540-8ab0-a3d0293d03bb`, Dev (`DEV`) team `a477ee8f-c947-4a6d-a1d8-3575d9185a32`. Verify both through the connector before writes. All170 Obsidian sources are mapped to DEV issues; exact migration evidence and recoverable cleanup receipts are on [DEV-1](https://linear.app/altitutor/issue/DEV-1/verify-obsidian-source-migration-evidence-and-recoverable-cleanup). Icebox is present and excluded from agent execution unless Matthew explicitly promotes an issue. The old `altitutor-archive` workspace is read-only; Every Language is unrelated. Browser fallback is forbidden. See `docs/agents/issue-tracker.md`.

- Issues/specs and durable progress live in the Altitutor Linear workspace. See `docs/agents/issue-tracker.md`.
- Stress-test plans with `/grill-with-docs`

## Development portal testing

- For deployed web smoke tests and local-only test-account credentials, see `docs/agents/development-web-smoke-testing.md`.

## Agent skills

### Issue tracker

Linear is canonical for scheduled and manually started Codex work. Link or create the relevant Dev (DEV) issue before implementation; publish durable progress, candidate SHA, verification evidence, and human-review links there. Icebox is excluded from agent work unless Matthew explicitly asks to move it out. Read the current issue and check claims before taking over work. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Official Symphony

DEV-186 replaces the retired DEV-172 custom coordinator with unmodified upstream
Symphony. Read `docs/agents/symphony.md` and the repository `WORKFLOW.md`. Dispatch
was initially disabled during setup. Matthew approved ordinary foreground
pickup on 2026-10-12 and Backlog eligibility on 2026-10-13; the normal workflow
now selects Backlog/Todo/In Progress/Merging in the accepted project. Startup requires this process's privately supplied Linear key.
No unselected issues are enrolled and no background service is installed. Preserve Matthew/manual ownership and Icebox exclusions. Existing human
approvals, subscription-only access, private preview scope and shared-database
safety remain. No separate reviewer account, privileged publisher or custom App.


For every Symphony issue, Matthew explicitly requests the evidence-first
`/grill-with-docs` assessment in `WORKFLOW.md`: read the actual skill and its
`grilling`/`domain-modeling` dependencies, resolve questions from the ticket/docs/
code first, and ask in Linear only for remaining product decisions. Clear fixes
and fully specified improvements proceed autonomously. Keep a durable workpad
brief; use Awaiting Input to pause and read answers before resuming.
For unclear UI or UI without a clear repo pattern, use the actual `/prototype`
skill, verify a versioned remotely reachable preview, and pause for feedback.
See `docs/agents/symphony.md` for procedure and current hosting limitations.
Matthew approved automatic push and draft/create/update PR publication to `develop`
for admitted Symphony issues. Follow the PR lifecycle in `WORKFLOW.md`: keep drafts
and issues In Progress while required work/CI remains; mark ready and move to
In Review only after latest-head checks and implementation/review/input obligations
are complete. Final review evidence is separate from exploratory prototypes:
visual-only changes need inspected candidate-SHA screenshots in Linear; functional
UI needs a checked private interactive preview, test data/steps/access/lifetime.
Non-UI fixes can use relevant tests. Missing preview support needs an exact blocker,
not instructions for Matthew to pull/run code. Genuine human decisions still pause in Awaiting Input. Exclude setup
scaffolding from issue commits; preserve concurrent work and link PR/head/evidence
in Linear. Matthew approved a develop-only merge policy on 2026-10-14: narrow,
unambiguous verified red-green restorations may merge after all gates; product/
functionality, owner-verifiable UX and critical changes need explicit head-bound
owner approval, and billing always does. The agent supplies PR/base/head in the
approval request; Matthew can reply directly and move to Merging without copying
hashes. Read WORKFLOW.md for safeguards. The CI prerequisite, approved develop protections
and Dev Merging status were verified on 2026-10-14; bounded merge execution is
now enabled. Develop delivery hands off In QA; the existing main rule moves Done,
which does not prove deployment. No admin bypass, native auto-merge, main/release merge or
deployment authority is granted by this policy.

After accepted product/prototype decisions, use the actual `/implement` skill
and its TDD/verification/review conventions. Invoke the existing `/code-review`
once; its Standards/Spec subagents provide both required axes. Do not duplicate
review passes or waive an axis without an explicit override.

For bug tickets, explicitly use `.agents/skills/diagnosing-bugs/SKILL.md` before
`/implement`. The reproduction must match the original incident through the
relevant code path, not merely fail an assumed-solution test. If substantial
investigation cannot reproduce it, record attempts/results/uncertainty and the
exact missing question. The same /diagnosing-bugs investigation should propose
and, within existing authority, prepare minimal targeted redacted diagnostics
with explicit predictions, capture expectations, tests and removal criteria.
This gathers evidence; it does not satisfy the reproduction gate for a product
fix. Follow normal /implement, review, PR/status and required approval; no logging
activation/deployment bypass, broad secrets/PII capture or token-bearing URLs.
Diagnostic-only PR/commit/release links to the original bug must be standalone
"Related to DEV-n"; never closing words, "Refs" or the original ID in branch/PR
title/squash subject. Verify native linkage and release output; the original stays
Triage/needs-evidence across develop/main while diagnostics delivery is tracked
separately. If safe linkage cannot be verified, use a separate diagnostic issue
under existing admission rules; verify parent-completion behavior before using a
subissue. Keep workpad cross-references until safe linking is known; no rule edits.
Billing always needs explicit approval. No safe useful probe means a documented
blocker, not fabricated progress or guaranteed resolution. When ready to await
evidence, reserve Awaiting Input for specific actionable human input; otherwise
record an agent-parked hold in Triage/needs-evidence, preserving ownership/project/
unrelated labels. Include original attempts, evidence baseline, missing question,
diagnostic PR/release when known, expected next evidence and re-entry criteria;
distinguish pending deployment from deployed/awaiting recurrence. Verify parking;
no speculative fix/merge or resolved claim. No required review dates.
Only explicit agent-parked, unassigned, nonheld eligible holds may re-enter Backlog
through existing intake: a related instrumented-release occurrence, independently
useful new evidence or materially worsened impact triggers one investigation.
Dedupe bursts and old-release/no-new-evidence repeats; absent expected diagnostics
require capture-failure assessment, not blind retry. Preserve human ownership/
holds, Icebox, project and assignments; unclear cases stay parked. Manual Todo
remains possible under existing admission rules. No extra service or bulk moves.
Read latest evidence/instructions before resuming; comments alone do not resume.
Give the existing Spec reviewer the original incident, reproduction evidence and
unresolved assumptions to check against the implementation. Retain concise
actual review findings/resolutions and reviewed SHA in the workpad; no extra
review layer.
