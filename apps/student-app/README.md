# Altitutor Student App

Native student application built with Expo SDK 57 and Expo Router.

## Environment

Create a local environment file from `.env.example` and configure:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STUDENT_WEB_URL`

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @altitutor/student-app dev
```

`start` is an alias for `dev`. Metro uses port **8082** (distinct from `ucat-app` on
8081) so both native apps can run during root `pnpm dev`.

Open the project in **Expo Go** on a device or simulator:

```bash
pnpm --filter @altitutor/student-app ios
# or
pnpm --filter @altitutor/student-app android
```

Use `expo run:ios` / `expo run:android` only when you need a custom native build
(for example store signing or native config not bundled in Expo Go).

`eas.json` provides development, preview, and production profiles. The
`development-simulator` profile can produce an iOS Simulator build through EAS
when local Xcode is unavailable:

```bash
cd apps/student-app
eas build --platform ios --profile development-simulator
```

## Validation

```bash
pnpm --filter @altitutor/student-app run typecheck
pnpm --filter @altitutor/student-app run lint
pnpm --filter @altitutor/student-app exec expo install --check
```
