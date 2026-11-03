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
- After migration SQL: use the owned disposable database workflow in `docs/agents/local-database-tests.md`; `pnpm checkall`, `pnpm db:seed:ucat`, `pnpm db:types` and `pnpm db:committypes` each use a separate disposable stack and ports. Locks protect only that runtime, so independent stacks run concurrently. Normal Docker bindings are approved; unproven targets are rejected. Never run a bare reset against the normal shared stack.
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

- For agent development in a Treehouse or Git worktree, use `pnpm dev:isolated --apps ucat-web` (comma-separated app directory names). Read `docs/agents/worktree-development.md` for status, environment-bound commands, cleanup and recovery.
- For deployed web smoke tests and local-only test-account credentials, see `docs/agents/development-web-smoke-testing.md`.

## Agent skills

### Issue tracker

Linear is canonical for scheduled and manually started Codex work. Link or create the relevant Dev (DEV) issue before implementation; publish durable progress, candidate SHA, verification evidence, and human-review links there. Icebox is excluded from agent work unless Matthew explicitly asks to move it out. Read the current issue and check claims before taking over work. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Scheduled bug work

Daily bug pickup and evidence holds follow
[scheduled-bug-work.md](docs/agents/scheduled-bug-work.md). Read it for unattended
selection, diagnostic-only changes, evidence-driven resumption, scheduled merge
approval, or blocker audits. Manual ticket delivery follows the invoked
`work-on-ticket` skill. Preserve human ownership, Icebox, private preview access
and owned-database safety in both workflows.
