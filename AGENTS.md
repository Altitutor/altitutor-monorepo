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
- After migration SQL: test locally (`supabase db reset`) and run `pnpm db:types`
- **Do not** edit migration files after they have been applied to any remote db. If you are unsure, check the github actions or the corresponding remote db.

## Quality

- Zero lint warnings; no `any`
- Full gate when shipping: `/check-and-commit` (`pnpm checkall`)

## Tracking

- Issues/specs live in Obsidian (not Linear). See `docs/agents/issue-tracker.md`.
- Stress-test plans with `/grill-with-docs`

## Development portal testing

- For deployed web smoke tests and local-only test-account credentials, see `docs/agents/development-web-smoke-testing.md`.

## Agent skills

### Issue tracker

Issues live as Obsidian markdown notes under `Areas/Altitutor/Issues/` in the Matt Remote vault. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
