# Altitutor UCAT native app

Expo SDK 57 / React Native 0.86.3 / React 19.2.3, aligned with `student-app`.
The interface uses native navigation stacks and platform tab bars, system fonts,
light/dark appearance, accessible touch controls, and scrollable question content.

## Run

From the monorepo root:

```sh
pnpm install
pnpm --filter @altitutor/ucat-app start
```

Copy `.env.example` to `.env.local` in this directory and configure the public
Supabase URL/key, the UCAT web origin, and `EXPO_PUBLIC_SENTRY_DSN`. The app
and API must use the **same Supabase project**. Never put a service-role key
into Expo public variables.

For seeded local development, start the repository's Supabase stack and UCAT
fixtures using its normal setup, then run these in separate terminals:

```sh
pnpm --filter @altitutor/ucat-app api:local
pnpm --filter @altitutor/ucat-app ios
# or
pnpm --filter @altitutor/ucat-app android
```

`api:local` reads `supabase status` and explicitly uses the local database. It
runs `ucat-web` on port 3016 with an isolated `.next-ucat-native` build directory.
Get the local public key from `supabase status` for the Expo environment file.
On Android, forward ports with `adb reverse tcp:54321 tcp:54321` and
`adb reverse tcp:3016 tcp:3016`. For a physical device, use reachable LAN origins
for both services; localhost refers to the device itself.

Existing accounts sign in with email/password. Account creation and password
recovery open the UCAT website. API requests send the user's bearer token;
secure native storage persists the session. Catalog reads use student views
and existing read RPCs; writes go through the UCAT API.

## Implemented flows

- Home: daily preparation and study-plan tasks. A global active-attempt banner
  shows status, native resume, and confirmed discard above navigation.
- Four tabs (Home, Learn, Practice, Progress), with a study-orb accessory on iOS 26
  and a floating companion above Android navigation. The orb shows the next
  recommended activity and daily progress.
- Practice: skill trainers, practice questions, sets, and mocks. Practice uses
  native section/count dropdowns, unanswered questions, an exam-pace slider,
  optional session timing, and quota feedback.
- Question sets and mocks: instructions, section timers, answers, flags,
  calculator and navigator sheets, fixed native navigation toolbar, save/resume,
  submission, and results. Answer controls use the
  shared UCAT response contract, including placements and partial-credit scoring.
- Pending answer snapshots are kept locally until the server acknowledges them.
  Network access is required to start, navigate, and submit; this is not a fully
  offline question bank. Server deadlines continue while backgrounded.
- Learn: general/section libraries grouped into folders, module icons, lesson
  content, question activities, embedded trainers, and automatic reading completion.
  A fixed toolbar provides navigation and progress while completion saves run.
  Tapping progress opens a native lesson-part navigator.
  Video and document resources open through the system browser using signed URLs.
- Skill trainers: mental maths, calculator maths, numpad speed, quick syllogisms,
  find word, and find concept, with attempt menus and completed-question review.
- Progress: score history/projection with a pinned y-axis, score by section,
  section detail pages, and swipeable practice-streak weeks.
- Study plan: goal/date/availability editing and activity launches.
- Header menu sheet: app appearance/timezone dropdowns, profile, study plan,
  and membership.
  Header notifications open a native tray. Appearance controls native alerts
  and navigation as well as screen content.

The first native release uses fixed practice with review at the end. Unlimited
practice, per-stem feedback, advanced question-bank filters, subscription purchases,
referrals, class booking/resources, push notifications, and the full web study-plan
management controls remain web capabilities. Web preview is for layout work;
use iOS/Android for authenticated API testing (browser CORS is not enabled).

## Architecture and validation

`src/features` contains domain-specific adapters; `src/app` composes native routes.
The question mapping, scoring adapters, and pure trainer/calculator logic were
adapted from `ucat-web`. Canonical responses and scoring come from
`@altitutor/ucat-response-contract`. Keep the copied API shapes and pure adapters
aligned when changing their web counterparts.

```sh
pnpm --filter @altitutor/ucat-app typecheck
pnpm --filter @altitutor/ucat-app lint
pnpm --filter @altitutor/ucat-app test
pnpm --filter @altitutor/ucat-app build
pnpm --filter ucat-web test --runInBand server-native
pnpm checkall
```

Both native apps inject the shared workspace dependency with a React 19 peer
and enable Expo's autolinking module resolution. This keeps the web package's
React 18 development dependency out of native dependency resolution. Workspace
builds refresh injected copies through `syncInjectedDepsAfterScripts`.

The accompanying `ucat-web` bearer-auth and signed-file response changes must be
deployed before pointing the app at that environment. No database migration is
required. `eas.json` provides development, preview, and production profiles.
Register the EAS project (`cd apps/ucat-app && eas init`), add the resulting
`projectId` to `app.json`, and store App Store / Play signing identities in EAS
before the first store build. Source maps upload during native EAS builds when
`SENTRY_AUTH_TOKEN` is present. Trigger builds from GitHub Actions workflow
`UCAT app EAS` (`workflow_dispatch` only; store submit is production-profile
and opt-in). Existing `student-app` development clients need rebuilding for
SDK 57. Store submission and hosted deployment are separate from local
development.
