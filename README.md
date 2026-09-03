# Altitutor Monorepo

pnpm + Turborepo workspace for Altitutor's web apps, native student app, and shared packages.

## Project Structure

### Apps

- `apps/admin-web`: Admin CRM (port 3000)
- `apps/student-web`: Student portal (port 3001)
- `apps/tutor-web`: Tutor portal (port 3002)
- `apps/marketing-web`: Marketing site (port 3003)
- `apps/ucat-web`: UCAT student product (port 3004)
- `apps/student-app`: Expo native student app

### Packages

- `packages/shared`: Shared types and utilities
- `packages/ui`: Shared UI components
- `packages/ucat-marking`: UCAT marking logic

## Getting Started

1. Clone the repository
2. Install dependencies from the repo root:

```bash
pnpm install
```

3. Copy each app's `.env.example` to `.env.local` (or the app's documented env file) and fill in values. See `apps/student-app/README.md` for native env setup, and `secrets/README.md` for deploying shared secrets.

4. Start local Supabase (optional but needed for most local API/DB work):

```bash
supabase start
pnpm db:types
```

A first `supabase start` applies migrations and seed. Use `supabase db reset` later if you need to rebuild the local database from scratch.

5. Run development servers:

```bash
pnpm dev
```

Or one app:

```bash
pnpm --filter admin-web dev
pnpm --filter student-web dev
pnpm --filter tutor-web dev
pnpm --filter marketing-web dev
pnpm --filter ucat-web dev
pnpm --filter @altitutor/student-app start
```

6. Open in the browser:

- Admin: http://localhost:3000
- Student: http://localhost:3001
- Tutor: http://localhost:3002
- Marketing: http://localhost:3003
- UCAT: http://localhost:3004

## Available Scripts

### Root

- `pnpm dev`: Start all development servers
- `pnpm build`: Build all apps
- `pnpm lint` / `pnpm lint:fix`: Lint (and autofix)
- `pnpm test` / `pnpm test:coverage`: Tests
- `pnpm typecheck`: TypeScript across the workspace
- `pnpm checkall`: full local CI — lint, typecheck, unit tests, UCAT coverage, Edge Function contracts, build, database contracts, and UCAT critical browser journeys
- `pnpm db:types`: Generate TypeScript types from local Supabase
- `pnpm db:email-templates`: Render email templates
- `pnpm db:committypes`: Reset local DB, lint schema, regenerate types, commit if changed

### App-specific

Run with `pnpm --filter <package-name> <script>`. Common scripts vary by app and may include `dev` / `dev:local` / `dev:remote`, `build`, `start`, `lint`, `test`, `typecheck`, and `storybook`.

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
supabase start
pnpm db:types
```

`supabase start` applies migrations and seed on a fresh stack. If the stack is
already running, `supabase db reset` rebuilds the local database from those
same files. `pnpm db:committypes` still resets before regenerating types.

### Remote

Migrations go through CI/CD. Do not apply migrations manually to shared development or production databases.

Production web deployments are released by `.github/workflows/supabase-deploy.yml` only after the corresponding Supabase deployment succeeds. Vercel Git auto-deployments are disabled so they cannot bypass that gate. Before enabling or rotating the release credential, run:

```bash
./scripts/setup-production-release-gate.sh
```
