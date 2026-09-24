# Supabase Sentry

Supabase Edge Functions send unexpected failures to a dedicated Sentry project
through `supabase/functions/_shared/sentry.ts`. The wrapper uses a request-local
scope because Supabase can reuse Deno isolates between requests.

## Deployment setup

Create a dedicated Sentry project using the **Deno** platform. Put its DSN in
`SUPABASE_SENTRY_DSN` in both `secrets/.env.development` and
`secrets/.env.production`. The same project DSN can be used for both; Sentry
separates their events using the environment tag.

Deploy through the repository's secrets system:

```bash
./secrets/scripts/deploy-supabase.sh
```

The script maps `SUPABASE_SENTRY_DSN` to `SENTRY_DSN` in each Supabase project
and derives `SENTRY_ENVIRONMENT` from the deployment target:

- `.env.development` project → `development`
- `.env.production` project → `production`

An empty local DSN is skipped without affecting the other Edge Function
secrets. It does not remove a DSN that was deployed previously; use
`supabase secrets unset SENTRY_DSN --project-ref <project-ref>` when the
integration must be disabled remotely.

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
