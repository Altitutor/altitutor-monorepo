# Sentry collection policy

Automatic error reporting requires deployment identity and a configured DSN.
`NODE_ENV=production` and `SENTRY_ENVIRONMENT=production` are labels/build modes,
not permission to report. Missing deployment identity fails closed.

| Runtime | Production identity |
| --- | --- |
| Next.js server / edge | `VERCEL_TARGET_ENV` (or `VERCEL_ENV`) is `production`, and `NODE_ENV=production` |
| Browser | Deployment identity baked by `next.config.js` from those Vercel variables, production build, and the exact app hostname |
| Expo UCAT | `EXPO_PUBLIC_SENTRY_DEPLOYMENT_ENVIRONMENT=production`, set by the production EAS profile, and a release bundle |
| Supabase Edge Functions | Hosted `DENO_DEPLOYMENT_ID` plus `SENTRY_DEPLOYMENT_ENVIRONMENT=production`, derived by the secrets deployment script from its production target |

Browser hostnames are `admin.altitutor.com`, `student.altitutor.com`,
`tutor.altitutor.com`, `ucat.altitutor.com`, and `altitutor.com` / `www.altitutor.com`
for marketing. Preview URLs and development subdomains do not qualify. Custom
Vercel environments take precedence over `VERCEL_ENV`. Public deployment identity
is build-time configuration; rebuild to change it.

The UCAT native app is instrumented. Student native currently has no Sentry
initialization; this cleanup does not add new telemetry coverage.

Local and development browser SDKs with a DSN remain available for intentional
feedback. Automatic errors and transactions are dropped, BrowserSession is
removed, client discard reports are disabled, and replay integrations are absent.
Existing mobile-auth privacy filtering and URL sanitization still apply.

## Explicit testing opt-in

For a deliberate Sentry integration test outside CI/E2E, configure a test-project
DSN and set only the relevant flag to the literal `true`:

- Server / Next edge / Supabase Edge: `SENTRY_TEST_OPT_IN=true`
- Browser: `NEXT_PUBLIC_SENTRY_TEST_OPT_IN=true`
- Expo: `EXPO_PUBLIC_SENTRY_TEST_OPT_IN=true`

Opted-in events are always tagged `sentry-test`, including when an inherited
Sentry environment label says production. Browser and Expo flags require a
rebuild/restart. This flag intentionally bypasses normal deployment eligibility;
it does not bypass privacy filtering or confirmed expected-outcome filtering.
Do not use live production telemetry to test filtering. Regression tests use
synthetic fixtures and mocked SDK initialization or a real SDK with `beforeSend`
returning null, so they send no events.

`SENTRY_DISABLED=true`, `NEXT_PUBLIC_SENTRY_DISABLED=true`, and
`EXPO_PUBLIC_SENTRY_DISABLED=true` are hard kill switches for their respective
runtimes. CI and test processes also fail closed and override the opt-in.
`pnpm checkall`, CI, and Playwright explicitly disable telemetry, clear DSNs,
and clear opt-ins. Playwright always starts its own server so it cannot inherit
an existing Sentry-enabled server. Turborepo passes these controls to child
processes and keys build caches by deployment identity and public collection flags.

## Conservative filtering and duplicates

Retain unexpected production failures, permission failures, network failures,
unclassified validation errors, and generic HTTP 4xx outcomes. The study-plan
permission and `invalid_study_plan_task` errors are not expected outcomes.

Existing UCAT quota/login and tutor domain-validation exceptions remain filtered
only by their established exact codes/signatures. Matching a phrase within an
unrelated failure no longer suppresses that event; an unexpected exception in a
cause chain keeps the event. Native sign-in completion failures are retained;
only exact known credential/quota/session outcomes are excluded.

The study-plan task route reads through instrumented Supabase before the active
work guard RPC. The installed SDK captures that RPC's `42501` error automatically.
For that exact route, code, and function error only, the route omits a second
manual capture when an enabled SDK and DSN are present. The offline SDK test
requires one permission-error event and proves that it is retained. Other
routes/codes/messages and disabled/uninitialized SDKs keep their manual capture.
This depends on the current Supabase instrumentation contract; keep the regression
test when updating Sentry.

## Replays and deployment considerations

Normal-session replay sampling is zero everywhere. UCAT retains its existing
100% error-triggered sampling; admin/student/tutor retain 10%. Marketing has no
replay integration. Mobile-auth contexts remain excluded. Replay can buffer a
session before an error to support error-triggered capture; zero normal sampling
does not disable this existing on-error feature.

Supabase collection will fail closed until the new deployment identity variable
is propagated through the existing secrets deployment workflow. This is a
required rollout dependency, not authorization to change live secrets or deploy.
EAS production bundles use the profile's explicit identity; OTA/export workflows
must preserve the matching identity and never reuse production identity for a
preview. No new credentials or paid Sentry features are required. Error-triggered
replays still consume the existing replay allowance; no quota, billing, trial,
log-drain, or paid-feature settings are changed by this work.
