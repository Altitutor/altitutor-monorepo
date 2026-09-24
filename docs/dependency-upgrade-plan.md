# Dependency Upgrade Plan

Status: Stages 0–3 complete (as of 2026-06-29). Remaining work is stages 4–6.

## Current Shape

- `packageManager: pnpm@11.7.0`
- pnpm overrides, patches, and peer rules live in `pnpm-workspace.yaml`
- Web apps share Next 14 / React 18 / TypeScript 5:
  - `admin-web`
  - `marketing-web`
  - `student-web`
  - `tutor-web`
  - `ucat-web`
- `apps/student-app` is Expo 56 / React 19 / TypeScript 6 and must upgrade through Expo-compatible sets, not the web stack
- `packages/ui` peers React 18, so it is part of any web React 19 migration

## Remaining Gaps (from last audit)

| Area | Current | Latest observed | Recommendation |
| --- | --- | --- | --- |
| Next.js | `14.2.35` | `16.x` | Major migration; separate from cleanup. |
| React web stack | `18.3.x` | `19.x` | Bundle with Next major migration. |
| TypeScript | mostly `^5.9.3` (`marketing-web` still `^5.8.3`) | `6.x` | Finish web alignment on 5.x; keep Expo on managed TS. |
| ESLint | `8.57.1` | `10.x` | Upgrade with Next lint/tooling, not alone. |
| `@typescript-eslint/*` | `6.21.0` | `8.x` | After ESLint strategy is chosen. |
| `@supabase/ssr` | `^0.5.2` | `0.12.x` | Upgrade after usage is consistent across apps. |
| Storybook | `8.6.x` | `10.x` | Separate tooling PR. |
| Tailwind CSS | `3.4.x` | `4.x` | Major styling/tooling migration; defer. |
| Tiptap | `3.22.5` | newer 3.x | Keep packages aligned when bumping. |

## Completed (stages 0–3)

- Moved pnpm overrides, patches, build approvals, and peer rules into `pnpm-workspace.yaml`
- Removed `@supabase/auth-helpers-nextjs`, unused `axios` / `@types/axios`, and `@types/react-leaflet`
- Aligned direct Tiptap packages to `3.22.5`
- Added direct manifest entries instead of relying on hoisted transitive deps
- Added a Storybook docs pnpm package extension so React 18 Storybook workspaces do not resolve through the Expo React 19 app
- Aligned most web/internal package ranges to versions already resolved in the lockfile
- Fixed `@altitutor/ucat-marking` Jest globals and upgraded Turbo for pnpm 11 patched-dependency metadata

## Remaining Stages

### Stage 4: Web Major Migration

- Upgrade as one planned migration: Next, React / React DOM, `@types/react`, `eslint-config-next`, and `@altitutor/ui` peer deps
- Validate every web app build, not just typecheck

### Stage 5: Tooling Majors

- Upgrade Storybook separately from the app runtime migration
- Upgrade Tailwind CSS separately
- Upgrade Vitest/Vite after Storybook and runtime choices are settled

### Stage 6: Expo Stack

- Use Expo-managed commands for `apps/student-app`
- Do not force web dependency versions onto the native app
- Validate with `expo-doctor`, native build/startup, and app typecheck

## Validation Matrix

For dependency normalization:

```bash
pnpm install --frozen-lockfile
pnpm --filter @altitutor/shared typecheck
pnpm --filter @altitutor/ui typecheck
pnpm --filter ucat-web typecheck
pnpm --filter admin-web typecheck
pnpm --filter student-web typecheck
pnpm --filter tutor-web typecheck
pnpm --filter marketing-web typecheck
```

For runtime or major framework upgrades, add builds for every affected app.
