# Altitutor Tutor

Develop from the repository root with an owned Supabase database, Tutor Web API, and Expo server.

```sh
pnpm dev:isolated --apps tutor-app
pnpm dev:isolated status
```

Open the allocated Expo URL with Expo Go in a local simulator or emulator. Use a seeded tutor account from `supabase/seed/test/01z_auth_users.sql`. Stop the owned runtime with `pnpm dev:isolated stop` after testing. The Expo browser preview supports sign-in, Documentation, Resources, and Search. Use a simulator or emulator to check session history and authenticated writes.

For a native build, configure the Supabase URL and public key and the Tutor Web URL using `.env.example`. Remote push requires the Tutor app’s EAS project ID, APNs credentials for its iOS bundle, and FCM credentials and Google services file for its Android package. Set `EXPO_PUBLIC_TUTOR_EAS_PROJECT_ID` and, for Android, `TUTOR_GOOGLE_SERVICES_FILE` in the build environment. In the app, open **Menu → Notification settings** to enable alerts on the device. Use two physical devices or accounts to verify delivery, preference changes, tap routing, and deregistration on sign-out.

## GitHub Actions builds

In **Actions → Tutor app EAS → Run workflow**, choose `preview` or `production` and iOS, Android, or both. The workflow queues the build. Follow the EAS link in the job log for the build status and artifacts. Run production builds from `main` after verifying the release commit, production CI/CD, and Tutor backend deployment for [DEV-365](https://linear.app/altitutor/issue/DEV-365/release-the-native-tutor-app-for-ios-and-android).

- Set the GitHub Actions variable `EXPO_PUBLIC_TUTOR_EAS_PROJECT_ID` to the ID of `altitutor/tutor-app`. The workflow uses `EXPO_TOKEN` from the selected GitHub environment (`development` for preview, `production` for production).
- In the Tutor EAS project's `preview` and `production` environments, set the matching Supabase and Tutor Web values from `.env.example`, the same Tutor project ID, and the Android `TUTOR_GOOGLE_SERVICES_FILE` file variable. Set up the signing and push credentials for `com.altitutor.tutor` in EAS.
- Leave **submit** off for build-only runs. For TestFlight submission, configure `submit.production.ios.ascAppId` in `eas.json` and the App Store Connect credentials in EAS. For Google Play, complete the first manual upload and configure the Play service account in EAS. The Android submission profile creates a draft on the internal track.
