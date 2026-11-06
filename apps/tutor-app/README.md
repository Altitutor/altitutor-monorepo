# Altitutor Tutor

Develop from the repository root with an owned Supabase database, Tutor Web API, and Expo server.

```sh
pnpm dev:isolated --apps tutor-app
pnpm dev:isolated status
```

Open the allocated Expo URL with Expo Go in a local simulator or emulator. Use a seeded tutor account from `supabase/seed/test/01z_auth_users.sql`. Stop the owned runtime with `pnpm dev:isolated stop` after testing. The Expo browser preview supports sign-in, Documentation, Resources, and Search. Use a simulator or emulator to check session history and authenticated writes.

For a native build, configure the Supabase URL and public key and the Tutor Web URL using `.env.example`. Remote push requires the Tutor app’s EAS project ID, APNs credentials for its iOS bundle, and FCM credentials and Google services file for its Android package. Set `EXPO_PUBLIC_TUTOR_EAS_PROJECT_ID` and, for Android, `TUTOR_GOOGLE_SERVICES_FILE` in the build environment. In the app, open **Menu → Notification settings** to enable alerts on the device. Use two physical devices or accounts to verify delivery, preference changes, tap routing, and deregistration on sign-out.
