# Supabase Sentry

Supabase Edge Functions send unexpected failures to a dedicated Sentry project
through `supabase/functions/_shared/sentry.ts`. The wrapper uses a request-local
scope because Supabase can reuse Deno isolates between requests.

## Deployment setup

Create the GitHub Environment secret `SUPABASE_SENTRY_DSN` in both the
`development` and `production` environments. Use the DSN/client key intended
for that environment's dedicated Supabase Sentry destination.

The Supabase deployment workflow copies that value into the linked Supabase
project as `SENTRY_DSN` and sets `SENTRY_ENVIRONMENT` from the branch:

- `develop` → `development`
- `main` → `production`

The deployment intentionally fails when the GitHub Environment secret is
missing so a function release cannot silently lose error reporting.

## Data handling

The Edge Function integration disables default Deno integrations and default
PII collection. Events include only:

- Function name
- Runtime and HTTP status/method
- Supabase region, execution ID, and deployment ID when available

Do not add request bodies, authorization headers, email addresses, phone
numbers, or Supabase records to Sentry context.

## Expected Sentry behavior

- Uncaught handler exceptions are captured with their stack and rethrown.
- Handled responses with status 500 or above are grouped by function and
  status so failures still alert even when legacy handlers convert errors into
  responses.
- The SDK flushes for at most two seconds only after recording an event.
- Next.js Supabase clients are instrumented separately. Query filters and
  mutation bodies remain redacted by the Sentry SDK default.

Supabase Log Drains remain intentionally disabled. They are a paid, broader
logging integration and send events to Sentry Logs rather than Sentry Issues.
