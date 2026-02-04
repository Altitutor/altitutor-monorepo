# Altitutor Monorepo

A pnpm-based Turborepo monorepo containing three Next.js applications for Altitutor's platform.

## Project Structure

This monorepo contains:
- **`apps/admin-web`**: Admin CRM system (port 3000)
- **`apps/student-web`**: Student-facing portal (port 3001)
- **`apps/tutor-web`**: Tutor-facing portal (port 3002)
- **`packages/shared`**: Shared types and utilities
- **`packages/ui`**: Shared UI components

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:
   - Copy `.env.example` to `.env.local` in each app directory
   - Fill in the required environment variables

4. Run all development servers:
   ```bash
   pnpm dev
   ```

   Or run a specific app:
   ```bash
   pnpm --filter admin-web dev
   pnpm --filter student-web dev
   pnpm --filter tutor-web dev
   ```

5. Open the apps in your browser:
   - Admin: [http://localhost:3000](http://localhost:3000)
   - Student: [http://localhost:3001](http://localhost:3001)
   - Tutor: [http://localhost:3002](http://localhost:3002)

## Available Scripts

### Root Level (Runs across all apps)
- `pnpm dev` - Start all development servers
- `pnpm build` - Build all apps for production
- `pnpm lint` - Run ESLint across all apps
- `pnpm lint:fix` - Fix linting errors across all apps
- `pnpm test` - Run tests across all apps
- `pnpm test:coverage` - Run tests with coverage
- `pnpm typecheck` - Type check all apps
- `pnpm checkall` - Run lint, typecheck, test, and build
- `pnpm db:types` - Generate TypeScript types from local Supabase schema
- `pnpm db:types:remote` - Generate TypeScript types from remote Supabase schema

### App-Specific Scripts
Each app has its own scripts (run with `pnpm --filter <app-name> <script>`):
- `dev` / `dev:local` / `dev:remote` - Start development server
- `build` - Build for production
- `start` - Start production server
- `lint` / `lint:fix` - Run ESLint
- `test` / `test:watch` / `test:coverage` / `test:e2e` - Run tests
- `typecheck` - Type check
- `storybook` - Start Storybook

## Documentation

- UI components are built using shadcn/ui - see [components.json](components.json) for configuration

## Row Level Security (RLS)

This project uses Supabase Row Level Security policies based on roles stored in the `staff` table.

### User Roles

The system has three user roles:
- **`ADMINSTAFF`**: Admin users with full read/write access to all base tables
- **`TUTOR`**: Tutors with read-only access through `vtutor_*` views and write access only through API endpoints
- **`STUDENT`**: Students with read-only access through `vstudent_*` views and write access only through API endpoints

### Access Control

- **ADMINSTAFF**: Direct access to all base tables with full permissions
- **TUTOR**: Must use `vtutor_*` views for reads and API endpoints for writes (no direct table access)
- **STUDENT**: Must use `vstudent_*` views for reads and API endpoints for writes (no direct table access)

### Database Helper Functions

RLS policies use database functions to check roles:
- `public.is_adminstaff()` - Checks if current user is ADMINSTAFF
- `public.is_tutor()` - Checks if current user is TUTOR
- `public.is_staff()` - Checks if current user is ADMINSTAFF or TUTOR
- `public.current_staff_id()` - Returns the staff ID for the current user
- `public.current_student_id()` - Returns the student ID for the current user

These functions query the `staff` table based on `auth.uid()`.

## Database Management

### Local Development

1. Start local Supabase:
   ```bash
   supabase start
   ```

2. Apply migrations:
   ```bash
   supabase db reset
   ```

3. Generate TypeScript types:
   ```bash
   pnpm db:types
   ```

### Remote Deployment

Migrations are deployed through the CI/CD pipeline. Never apply migrations manually to dev/prod environments.

For generating types from remote database:
```bash
pnpm db:types:remote
```

Note: Requires `SUPABASE_PROJECT_ID` environment variable to be set.
 