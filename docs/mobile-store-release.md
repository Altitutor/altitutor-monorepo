# Mobile store release

`develop` reaches the `preview` EAS channel after the Supabase deployment gate. For each app and platform, CI checks the Expo native fingerprint. A compatible finished preview build receives an OTA update. If none exists, CI builds a new preview binary with the current JavaScript embedded. Install that binary to receive later preview updates.

`main` reaches the `production` EAS channel after the production web smoke gate. The same fingerprint check publishes an OTA when a compatible production store build exists. A native change triggers a new signed store build. The production GitHub Environment variable `MOBILE_STORE_AUTO_SUBMIT_ENABLED` controls whether those builds are automatically handed to EAS Submit; its default is `false` until both store accounts and submission credentials are ready.

Once initial listings are complete, configure `submit.production.android` with the intended Play track and release status, confirm the EAS Submit credentials for both apps, and set `MOBILE_STORE_AUTO_SUBMIT_ENABLED=true` in the production GitHub Environment. EAS Submit uploads iOS builds to TestFlight. App Store metadata, screenshots, review information, and the App Review submission remain in App Store Connect; approved versions can be set to release automatically. Android production release follows the configured Play track and status.

The manual `eas-student-app.yml` and `eas-ucat-app.yml` GitHub workflows remain available for an explicit build or submission. Store build and submission results should be checked in EAS and the store consoles before treating a release as live.
