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
  against a reset local database.
- Playwright runs against a production build and a freshly reset, deterministic
  local Supabase instance.
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
pnpm --filter ucat-web test:coverage
pnpm --filter ucat-web test:e2e:critical
UCAT_E2E_FULL_BROWSER_MATRIX=true pnpm --filter ucat-web test:e2e
supabase test db
deno test --allow-env supabase/functions
```

Playwright requires a running local Supabase stack and installed browser
binaries. CI starts and resets Supabase and installs the required browsers
before executing these commands.
