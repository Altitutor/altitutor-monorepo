# Altitutor Student App

Native student application built with Expo SDK 56 and Expo Router.

## Environment

Create a local environment file from `.env.example` and configure:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STUDENT_WEB_URL`

## Development Builds

This app uses native Expo modules and is developed with `expo-dev-client`.
Do not open it in Expo Go.

Install workspace dependencies from the repository root:

```bash
pnpm install
```

Build and install the iOS development client in Simulator:

```bash
pnpm --filter @altitutor/student-app ios
```

Expo SDK 56 native iOS compilation requires Xcode 26.4 or newer.

Build and install the Android development client:

```bash
pnpm --filter @altitutor/student-app android
```

After a development client is installed, reconnect it to Metro without
rebuilding native code:

```bash
pnpm --filter @altitutor/student-app start
```

The `development-simulator` profile in `eas.json` can produce an iOS
Simulator development build through EAS while local Xcode is unavailable:

```bash
cd apps/student-app
eas build --platform ios --profile development-simulator
```

Use the `development` profile instead when building for a physical device.

## Validation

```bash
pnpm --filter @altitutor/student-app run typecheck
pnpm --filter @altitutor/student-app run lint
pnpm --filter @altitutor/student-app exec expo install --check
```
