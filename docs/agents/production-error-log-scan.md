# Supabase production log scan

Run as part of `sentry-morning-maintenance.md`, using its authority boundaries
and `production-error-tracking.md` for state. This is read-only observability;
reproduction and fixes happen later in development.

## Access and scope

Discover Supabase projects and verify production identity against deployment
configuration before querying. At setup, production was
`altitutor-backend-prod` (`mzgunxjfgvcyivcyqimn`); development was
`altitutor-backend-dev` (`ysfslbdcacpbemodkwtl`). Monitor only production projects
serving this monorepo. Check Postgres, Auth, API gateway/PostgREST, Storage,
Realtime, Edge Function request logs, and function runtime logs; use the service
sources actually exposed by the project. Report unavailable sources separately.

Discover Supabase `query_logs`/`get_logs` tools first. The connected tool set at
setup could list projects but did not expose these log tools. If unavailable,
use the Management API with an existing locally configured
`SUPABASE_ACCESS_TOKEN` granting `analytics_logs_read` (OAuth: `analytics:read`).
The setup check found no such token in the process or repository secrets files.
Load credentials privately into the request header, never shell arguments or
output. A signed-in Logs Explorer UI is another fallback when available; follow
the browser skill. Report access failure and continue Sentry work if none works.

The current read endpoint is
`GET https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs`.
It accepts ClickHouse SQL over the unified `logs` table. Discover current schema
and select source fields explicitly; do not assume Postgres SQL or pass these
queries to the application database `execute_sql` tool. The deprecated
`logs.all` endpoint is being retired. Use both `iso_timestamp_start` and
`iso_timestamp_end`: each request supports at most 24 hours and defaults can
otherwise silently narrow coverage to one minute. Verify current API constraints
when they change. See [Management API](https://supabase.com/docs/reference/api/)
and [log query documentation](https://supabase.com/docs/guides/observability/advanced-log-filtering).

## Scan and disposition

1. Capture a fixed run-end UTC timestamp. Read each source's successful cursor
   from the Obsidian ledger; query from that cursor minus one hour through the
   run end. First run: scan the preceding 24 hours, recording that initial bound.
   Catch up missed runs in windows no larger than 24 hours. Check available
   retention and report any expired interval instead of claiming it was scanned.
2. Use bounded read queries to inventory errors/fatal events, failed requests,
   and recurring timeout, permission, connection, or runtime failures. Examine
   nearby warnings or successful requests only when needed to distinguish user
   failure from normal behavior. Validate filter coverage for each source's
   severity/status fields. Save the filters/version in the ledger.
3. Exhaust pagination or split capped time windows until coverage is demonstrably
   complete. Use stable log IDs/timestamps to deduplicate the overlap and avoid
   losing equal-timestamp rows. A LIMIT-sized result may be truncated; it is not
   proof of completion. Back off on rate limits; retain a failed window to retry.
4. Group by normalized signature and correlate with Sentry events using request
   IDs, time, operation, error code, release, and cause. Reuse an existing ticket
   when it covers that bug; otherwise create one actionable ticket. Evidence
   must distinguish expected validation/auth failures, deliberate cancellations,
   health probes, and transient retried errors from actual user-impacting bugs.
   Low counts or unknown users alone are not grounds for dismissal.
5. Save sanitized evidence and original occurrence times, representative IDs,
   counts/time window, affected service, and reproduction leads in the ticket.
   Reuse unchanged noise dispositions from the ledger; record new noise reasons
   there rather than flooding the board. Uncertain impact remains a finding to
   investigate, not noise. Do not manufacture Sentry events, enable log drains,
   modify production logging, or forward raw payloads to another system.
6. Persist every finding/disposition, then advance only fully scanned source
   cursors. Record incomplete coverage and queued work explicitly. Combine the
   actionable tickets with the Sentry queue and process them by impact using
   the shared diagnosis and PR workflow.

Complete when every scoped source's window has either been fully inventoried
with durable dispositions or explicitly marked as a coverage/access gap.
