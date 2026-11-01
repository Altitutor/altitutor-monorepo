# Altitutor Monorepo

pnpm + Turborepo workspace for Altitutor's web apps, native student app, and shared packages.

## Project Structure

### Apps

- `apps/admin-web`: Admin CRM (port 3000)
- `apps/student-web`: Student portal (port 3001)
- `apps/tutor-web`: Tutor portal (port 3002)
- `apps/marketing-web`: Marketing site (port 3003)
- `apps/ucat-web`: UCAT student product (port 3004)
- `apps/student-app`: Expo native student app (Expo Go, Metro port 8082)
- `apps/ucat-app`: Expo UCAT native app (Expo Go, Metro port 8081)

### Packages

- `packages/shared`: Shared types and utilities
- `packages/ui`: Shared UI components
- `packages/ucat-marking`: UCAT marking logic

## Getting Started

Use **Node 24.22.2** (the supported Node 24 LTS line) and **pnpm 11.28.9**.
The Node version is pinned in `.nvmrc`; CI reads that same file. The engine
check also permits the compatible Node 22 LTS line (22.22+). Node 20 cannot
run pnpm 11. An older terminal can otherwise fail with
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` before a repository command starts.

1. Clone the repository. From the repo root, select the runtime with nvm and
   enable the pinned package manager:

```bash
nvm install
nvm use
corepack enable pnpm
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Run `nvm use` in an already-open terminal after changing the Node version.
For automatic selection when entering the repo, nvm documents a
[shell hook for `.nvmrc`](https://github.com/nvm-sh/nvm#deeper-shell-integration).
The install step does not change the environment of its parent terminal.

The web PostHog browser SDK is held at 1.402.0 to preserve the existing analytics
collection policy. Newer releases add advertising identifiers without a granular
opt-out that retains prior campaign attribution. Revisit this compatibility
exception through [DEV-296](https://linear.app/altitutor/issue/DEV-296/upgrade-web-posthog-sdks-while-preserving-analytics-collection)
before raising the pin; the server SDK can be upgraded independently.

2. For an isolated local web environment, start Docker and run:

```bash
pnpm dev:isolated --apps admin-web
# Or all five web portals:
pnpm dev:isolated --apps all
```

This creates its own migrated/seeded Supabase stack, supplies local app settings
and prints allocated URLs. Keep the command running. See
[worktree development](docs/agents/worktree-development.md) for fixture accounts,
status, native selections and scoped cleanup. Python 3.9+ and Docker are required;
the full `pnpm checkall` gate also needs Deno for Edge Function contracts.

3. For development using your existing app environments, copy each app's
   `.env.example` to `.env.local` (or its documented env file) and fill in values.
   See `apps/student-app/README.md` for native setup, and `secrets/README.md` for
   shared-secret deployment. Start all apps, only web apps, or one portal:

```bash
pnpm dev
pnpm dev-web
pnpm dev --filter=admin-web
```

The root dev commands above build shared-package prerequisites automatically.
Direct app entrypoints bypass that step; build the packages first in a fresh
checkout:

```bash
pnpm build --filter='./packages/*'

pnpm --filter admin-web dev
pnpm --filter student-web dev
pnpm --filter tutor-web dev
pnpm --filter marketing-web dev
pnpm --filter ucat-web dev
pnpm --filter @altitutor/student-app dev
pnpm --filter @altitutor/ucat-app dev
```

Existing-environment web defaults are Admin3000, Student3001, Tutor3002,
Marketing3003 and UCAT3004. External provider features need their relevant local
configuration; Node selection does not provision provider credentials. Installed
native apps also need the documented Xcode/Android SDK setup.

## Available Scripts

### Root

- `pnpm dev`: Start all development servers
- `pnpm build`: Build all apps
- `pnpm lint` / `pnpm lint:fix`: Lint (and autofix)
- `pnpm test` / `pnpm test:coverage`: Tests
- `pnpm typecheck`: TypeScript across the workspace
- `pnpm checkall`: full local CI — lint, typecheck, unit tests, UCAT coverage, Edge Function contracts, build, database contracts, and UCAT critical browser journeys
- `pnpm db:types`: Generate TypeScript types using an owned disposable database
- `pnpm db:email-templates`: Render email templates
- `pnpm db:committypes`: Validate an owned disposable database, regenerate types, commit if changed

### App-specific

Run with `pnpm --filter <package-name> <script>`. Common scripts vary by app and may include `dev` / `dev:local` / `dev:remote`, `build`, `start`, `lint`, `test`, and `typecheck`.

## Row Level Security (RLS)

Supabase RLS is based on roles in the `staff` table (and student identity for students).

### Roles

- `ADMINSTAFF`: Full read/write on base tables
- `TUTOR`: Read via `vtutor_*` views; write only through API endpoints
- `STUDENT`: Read via `vstudent_*` views; write only through API endpoints

### Helper functions

Policies typically use:

- `public.is_adminstaff_active()`
- `public.is_tutor()`
- `public.current_staff_id()`
- `public.current_student_id()`

These resolve against `auth.uid()`.

## Database Management

### Local

```bash
pnpm db:types
pnpm db:seed:ucat
# Validate/regenerate types and commit only the generated file if it changes:
pnpm db:committypes
```

Each command provisions its own disposable database from this checkout, selects
unique ports and cleans up that owned stack. These commands do not reset or seed
your normal shared development stack. Use the isolated app environment above
for browser testing; a standalone seed command's database ends with that command.
See [local database tests](docs/agents/local-database-tests.md) for verified
execution, targeted operations and recovery.

### Remote

Migrations go through CI/CD. Do not apply migrations manually to shared development or production databases.

Production web deployments are released by `.github/workflows/supabase-deploy.yml` only after the corresponding Supabase deployment succeeds. Vercel Git auto-deployments are disabled so they cannot bypass that gate. Before enabling or rotating the release credential, run:

```bash
./scripts/setup-production-release-gate.sh
```
