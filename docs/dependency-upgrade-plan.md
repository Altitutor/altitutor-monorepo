# Dependency Upgrade Plan

Last audited: 2026-06-29 with `pnpm outdated -r --format json`.

## Current Shape

- The repo is pinned to `packageManager: pnpm@11.7.0`, matching the pnpm runtime used for this audit.
- pnpm 11 ignores the old root `package.json` `pnpm.overrides` and `pnpm.patchedDependencies` fields, so those settings now live in `pnpm-workspace.yaml`.
- The web apps are on a shared Next 14 / React 18 / TypeScript 5 stack:
  - `admin-web`
  - `marketing-web`
  - `student-web`
  - `tutor-web`
  - `ucat-web`
- `apps/student-app` is a separate Expo 56 / React 19 / TypeScript 6 stack and should be upgraded through Expo-compatible version sets, not the web stack.
- `packages/ui` currently peers against React 18, so it is part of any future web React 19 migration.

## Audit Highlights

| Area | Current wanted | Latest observed | Apps/packages affected | Recommendation |
| --- | --- | --- | --- | --- |
| Next.js | `14.2.35` | `16.2.9` | all web apps | Major migration; do separately from dependency cleanup. |
| React web stack | `18.3.1` wanted for `@altitutor/ui` dev deps | `19.2.7` | shared UI, then web apps | Treat as part of the Next major migration. |
| TypeScript | `5.9.3` wanted under current ranges, `6.0.3` latest | `6.0.3` | all apps/packages | Align web packages to a single 5.x first; keep Expo on its managed TS version. |
| ESLint | `8.57.1` wanted | `10.6.0` | web apps | Upgrade with Next lint/tooling changes, not alone. |
| `@typescript-eslint/*` | `6.21.0` wanted | `8.62.0` | admin/student/tutor web | Upgrade after ESLint strategy is chosen. |
| Supabase auth helpers | `0.8.7` wanted | `0.15.0`, deprecated | admin/student/tutor web | Replace deprecated helpers with `@supabase/ssr` patterns. |
| `@supabase/ssr` | `0.5.2` wanted | `0.12.0` | admin/student/tutor/ucat web | Upgrade after auth helper migration plan. |
| Storybook | `8.6.17` wanted | `10.4.6` | admin/student/tutor web | Separate tooling PR. |
| Tailwind CSS | `3.4.18` wanted | `4.3.1` | all web apps | Major styling/tooling migration; defer until web app builds are stable. |
| Tiptap | `3.20.4` wanted | `3.27.1` | mostly `@altitutor/ui` plus admin/tutor usage | Align all Tiptap packages together. |
| Deprecated type packages | `@types/axios`, `@types/react-leaflet` | deprecated | admin/student/tutor, student-web | Remove once usage confirms bundled types are enough. |

## Staged Plan

## Executed Stage 0-3 Work

- Moved pnpm overrides, patches, build approvals, and peer rules into `pnpm-workspace.yaml`.
- Removed deprecated `@supabase/auth-helpers-nextjs` from `admin-web`, `student-web`, and `tutor-web`; the remaining tutor auth call now uses the existing Supabase client.
- Removed unused `axios` and deprecated `@types/axios` from `admin-web`, `student-web`, and `tutor-web`.
- Removed deprecated `@types/react-leaflet` from `student-web`; React Leaflet's bundled types typecheck cleanly.
- Aligned direct Tiptap packages to `3.22.5` across `admin-web`, `tutor-web`, and `@altitutor/ui`.
- Added direct manifest entries for packages already imported by `@altitutor/ui`, `@altitutor/shared`, `admin-web`, `student-web`, and `tutor-web` instead of relying on hoisted transitive dependencies.
- Added a Storybook docs pnpm package extension so React 18 Storybook workspaces do not resolve through the React 19 Expo app.
- Aligned web/internal package manifest ranges to the compatible versions already resolved in `pnpm-lock.yaml`, including TypeScript 5, Supabase JS, TanStack Query, Radix UI, React Hook Form, React 18 type packages, Node 20 types, PostCSS, and Supabase CLI.
- Fixed dev-script package issues found during validation: `@altitutor/ucat-marking` now declares Jest test globals directly, and Turbo is upgraded to a version that parses pnpm 11 patched dependency lockfile metadata.
- Deferred `@supabase/ssr`, Next, React, Tailwind, Storybook, and ESLint major upgrades to later stages.

### Stage 0: Baseline Safety

- Keep dependency work isolated from feature changes because this worktree already has unrelated app and lockfile changes.
- Run `pnpm install --frozen-lockfile` before any version changes.
- Run targeted validation for each affected workspace before widening scope.

### Stage 1: Package Manager Alignment

- Keep pnpm settings in `pnpm-workspace.yaml`.
- Keep `packageManager` aligned with the pnpm version used by local development and CI.
- Re-run `pnpm install --frozen-lockfile` and confirm there are no ignored-settings or build-approval failures.

### Stage 2: Low-Risk Web Stack Normalization

- Align TypeScript specs across the web apps and internal packages to one 5.x version.
- Align repeated minor-version families that already share compatible majors:
  - `@supabase/supabase-js`
  - `@tanstack/react-query`
  - `@tanstack/react-query-devtools`
  - `@swc/jest`
  - `@testing-library/*`
- Remove deprecated standalone type packages only after typecheck confirms they are redundant.

### Stage 3: Auth Dependency Cleanup

- Audit `@supabase/auth-helpers-nextjs` usage in `admin-web`, `student-web`, and `tutor-web`.
- Move remaining auth helper usage to the existing `@supabase/ssr` style used elsewhere.
- Upgrade `@supabase/ssr` after usage is consistent.

### Stage 4: Web Major Migration

- Upgrade the web stack as one planned migration:
  - Next
  - React / React DOM
  - `@types/react`
  - `eslint-config-next`
  - shared `@altitutor/ui` peer dependencies
- Validate every web app build, not just typecheck.

### Stage 5: Tooling Majors

- Upgrade Storybook separately from the app runtime migration.
- Upgrade Tailwind CSS separately because it changes styling/tooling behavior.
- Upgrade Vitest/Vite after Storybook and app runtime choices are settled.

### Stage 6: Expo Stack

- Use Expo-managed commands for `apps/student-app`.
- Do not force web dependency versions onto the native app.
- Validate with `expo-doctor`, native build/startup, and app typecheck.

## Validation Matrix

For low-risk dependency normalization:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @altitutor/shared typecheck`
- `pnpm --filter @altitutor/ui typecheck`
- `pnpm --filter ucat-web typecheck`
- `pnpm --filter admin-web typecheck`
- `pnpm --filter student-web typecheck`
- `pnpm --filter tutor-web typecheck`
- `pnpm --filter marketing-web typecheck`

For runtime or major framework upgrades, add builds for every affected app.
