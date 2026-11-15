# Supabase Sentry

Supabase Edge Functions send unexpected failures to a dedicated Sentry project
through `supabase/functions/_shared/sentry.ts`. The wrapper uses a request-local
scope because Supabase can reuse Deno isolates between requests.

## Deployment setup

Create a dedicated Sentry project using the **Deno** platform. Put its DSN in
`SUPABASE_SENTRY_DSN` in both `secrets/.env.development` and
`secrets/.env.production`. The same project DSN can be used for both; Sentry
separates their events using the environment tag. Automatic collection is now
production-only; development requires a deliberate test opt-in. See
[sentry-collection.md](sentry-collection.md).

Deploy through the repository's secrets system:

```bash
./secrets/scripts/deploy-supabase.sh
```

The script maps `SUPABASE_SENTRY_DSN` to `SENTRY_DSN` in each Supabase project
and derives `SENTRY_ENVIRONMENT` and `SENTRY_DEPLOYMENT_ENVIRONMENT` from the deployment target:

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

Billing-runner also reports uncertain operational-mail outcomes with a fixed
fingerprint and an allowlisted `operational_mail` context: draft-create,
draft-persist, send-request or submission-persist phase; bounded failure category;
directly observed HTTP status; and phase elapsed milliseconds capped at five
minutes. It does not attach the underlying error or correspondence identifiers.
The existing collection switch and bounded error flush apply. Observer failures
must preserve the durable uncertainty guard and must never permit a resend.

This DEV-425 diagnostic supports the unresolved absence-billing investigation.
Use event release/execution identity and time with the durable operational outbox
to investigate a recurrence; lack of an event alone proves neither delivery nor
failure. Verify deployment and collection before expecting evidence. Remove this
observer after a qualifying recurrence identifies the failing boundary and its
fix has a regression test. Existing uncertain drafts still require mailbox-owner
reconciliation before any resend; instrumentation does not resolve them.

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
