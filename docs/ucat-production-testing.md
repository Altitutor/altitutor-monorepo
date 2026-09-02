# UCAT production testing

## Supported clients

UCAT Web supports the latest two stable releases of Chrome, Edge, Firefox, and
Safari, plus current iOS Safari and Android Chrome. The interface must remain
functional on phones and tablets; complete responsive visual polish is tracked
separately from the production release gate.

Playwright exercises the current stable browser engines and representative
phone viewports on every production release. Previous-stable support is covered
by the compatibility policy, dependency-transpilation baseline, production
telemetry, and targeted manual checks when a browser-specific regression is
suspected.

## Test layers

- Jest covers components, hooks, domain logic, and HTTP route contracts. It
  collects all application source, including files no test imports, and blocks
  regressions below the checked-in coverage baseline.
- Deno tests cover Supabase Edge Function contracts.
- `supabase test db` covers migrations, database functions, and RLS behavior
  against a local database started from migrations and seed.
- Playwright runs against a production build and a deterministic local
  Supabase instance.
- A read-only post-deploy smoke check verifies the production login boundary and
  exact public billing configuration.

## Browser strategy

Pull requests and development releases run the `@critical` journeys in
Chromium. Main-branch releases additionally run `@compat` journeys in Chrome,
Edge, Firefox, WebKit/Safari, Android Chrome, and iOS Safari profiles.

Every supported top-level route family has an authenticated smoke check. Deep
E2E coverage is reserved for workflows where browser, routing, persistence, or
service integration failures would be costly:

- anonymous access and return-intent login;
- authenticated dashboard access;
- practice configuration and launch surfaces;
- active-attempt recovery after refresh, reconnection, and a fresh device
  context;
- the currently shipped `/sessions` surface;
- subscription selection and launch billing configuration.

Do not create one exhaustive E2E test for every path and state. Add or deepen an
E2E journey when a feature crosses multiple system boundaries or when a defect
could lose student work, grant or deny access incorrectly, corrupt scoring, or
mischarge a customer. Keep lower-level permutations in Jest or database tests.

## Commands

From the repository root:

```sh
# Full local CI (lint, types, unit tests, coverage, Edge contracts, build,
# database contracts, UCAT critical browser journeys)
pnpm checkall

# Jest unit, component, and route tests only (all workspace packages)
pnpm test

# UCAT Jest tests with the enforced production coverage baseline
pnpm --filter ucat-web test:coverage

# Playwright's four release-critical journeys in desktop Chromium
pnpm --filter ucat-web test:e2e:critical

# Every Playwright journey in desktop Chromium
pnpm --filter ucat-web test:e2e

# Every @compat journey across desktop and mobile browser profiles, plus all
# desktop-Chromium journeys
UCAT_E2E_FULL_BROWSER_MATRIX=true pnpm --filter ucat-web test:e2e

# Database and Edge Function contracts
supabase test db
deno test --config supabase/functions/deno.json --allow-env supabase/functions
```

`pnpm test` deliberately does not include Playwright, database, or Deno tests:
those suites require browser binaries and/or local Supabase services and would
make the normal unit-test loop slow and environment-dependent.

`pnpm checkall` is the local equivalent of CI. It runs lint, typecheck, unit
tests, UCAT coverage, Edge Function contracts, build, database contracts, and
the `@critical` Chromium journeys. A fresh `supabase start` applies migrations
and seed; if the local stack is already running, checkall resets it so the
schema matches CI.

Playwright requires a running local Supabase stack and installed browser
binaries. CI starts Supabase (without a redundant `db reset`) and installs the
required browsers before executing these commands.

For a first local run, start Supabase and install Chromium once:

```sh
supabase start
pnpm --filter ucat-web exec playwright install chromium
pnpm --filter ucat-web test:e2e:critical
```

`supabase start` on a fresh stack applies every migration and the automatic
seed. `supabase db reset` is only needed when the local database is already
running and you want to rebuild it from scratch. `seed/manual` is not applied
automatically; paste those files in the Dashboard when you need them.

## Continuous integration

The `UCAT Browser and Database` job runs for pull requests, `develop`, and
`main` when the diff can affect UCAT or Supabase. Unrelated app-only changes
skip it. Pull requests and `develop` run the release-critical Chromium
journeys. `main` and manual CI runs execute the full Chrome, Edge, Firefox,
WebKit/Safari, Android, and iOS matrix. The same job starts a fresh local
Supabase (migrations and seed applied once) and runs every database contract
before starting Playwright. The separate `UCAT Contracts` job enforces Jest
coverage and runs all Deno Edge Function tests.
