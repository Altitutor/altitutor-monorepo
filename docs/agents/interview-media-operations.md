# Interview media operations

DEV-8 uses private Daily rooms for each student/tutor pair and phase. Reading and
question rooms expire at the server phase deadline with provider ejection enabled.
Question/feedback recordings use 480p, 15fps, 800kbps video and 64kbps audio. Reading
is never recorded. In-person recording uses independent 30-second audio segments.

## Deployment configuration

1. Ship the interview migrations through the existing CI/CD database workflow.
2. Set server-only `DAILY_API_KEY` in both tutor-web and student-web. Never prefix
   it with `NEXT_PUBLIC_`. Configure Daily cloud recording and verify the account
   permits at least six simultaneous rooms and six recording instances.
3. Set `CRON_SECRET` on tutor-web. Its `/api/cron/interview-media` minute schedule
   retries durable media jobs, refreshes recording readiness and deletes expired
   recording objects. No webhook is required: recording metadata is reconciled
   from Daily, including when the initiating request was interrupted.
4. The `interview_realtime_authorization` migration installs the private Broadcast
   receive policy through CI/CD. Supabase permits `postgres` to manage policies on
   `realtime.messages` through `supautils`; no owner bootstrap is required. RLS is
   already enabled, so do not add `ALTER TABLE` statements. The policy authorizes
   only eligible round participants, their exact requested topic and Broadcast
   messages. It grants no client send permission or anonymous access. Both server
   publications and client channels use `private: true`. The authorization probe
   leaves the message row's `private` flag at its default, so the policy must not
   require that row flag to be true. Verify private subscription and delivery
   separately from fallback polling.
   See [Supabase authorization](https://supabase.com/docs/guides/realtime/authorization)
   and [the ownership distinction](https://supabase.com/docs/guides/troubleshooting/realtime-must-be-owner-of-table-messages).
5. The private `interview-recordings` bucket is created by migration. Client
   uploads go through the tutor API; playback requests recheck scoped access,
   result release and expiry before issuing a short-lived URL.

## Recovery and validation

Live tutor/student participation shares one scheduler. Healthy realtime uses a
30-second fallback read; disconnected subscriptions use a 10-second fallback.
Focus and reconnection refresh immediately. Active participants send a heartbeat
every 10 seconds; the database accepts one presence update per five seconds and
uses a 35-second freshness window. New/reconnected presence sends one scoped
invalidation so waiting-room status updates promptly; ordinary beats do not
broadcast. Presence writes do not lock the assessment
round or create idempotency receipts. Completed/result pages do not heartbeat,
and their fallback reads run at most once per minute while visible.

Phase ticks occur at server deadlines, with bounded retries, rather than every
few seconds. Media capability monitoring uses a 10-second fallback (30 seconds
when disabled), while online ticket errors retry after three seconds. Phase
changes, pause/end controls and independent capability expiry timers continue
to enforce access without waiting for that monitor. Ticket provisioning reuses
its initial round read and rechecks current authorization before issuing a token.

Recording object bytes are not stored in PostgreSQL: in-person audio uses the
private Storage bucket and online recordings use Daily. Database disk I/O still
includes metadata, indexes, WAL and temporary query files. A Supabase Disk I/O
budget warning concerns burst performance above compute baseline, rather than
recording storage capacity. Diagnose its timestamp using disk-balance metrics,
request rates and query statistics; cumulative counters alone cannot attribute
a particular warning. See [Supabase compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk).

Round updates enqueue durable jobs. Claims carry a lease token so a stale worker
cannot acknowledge a newer lease. Failed room deletion leaves the job retryable.
Optimistic command conflicts use `PT409` (HTTP 409); do not raise custom `40001`
errors, which PostgREST can retry indefinitely. The owned database gate exercises
twelve concurrent requests for transitions, independent saves, duplicate command
IDs and exclusive in-person claims.

Manual phase actions reconcile immediately; provider errors produce a visible
warning without pretending the external room was closed. Provider expiration is
the independent question-time cutoff even when browsers disconnect.

Recording REST acceptance is not confirmation that recording started. The UI
shows starting/unavailable until provider state confirms recording. Pending
recording identities are created before issuance of a recording-enabled token,
so later readiness can appear within an already released result. New additional
segments still require release. Expired recordings are denied immediately even
if the scheduled deletion has not yet run. Cleanup prioritises live room recovery
within one 50-second budget. Failed object deletions retain an error and retry
after five minutes; one failure does not block other recordings. Audio capture
metadata has no Daily object to delete.

Before enabling online rounds for users, validate six simultaneous pairs against
the configured Daily account: one-way exam reading, two-way questions, deadline
ejection, early finish, pause/resume, reconnect, recording readiness, playback,
retention deletion and provider outage recovery. Mocked HTTP tests do not prove
network or provider reliability. Current implementation work does not provision
an external account or mutate remote databases.

Official references: [Daily room configuration](https://docs.daily.co/reference/rest-api/rooms/config),
[meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token),
[recording start](https://docs.daily.co/reference/rest-api/rooms/recordings/start),
[recording access links](https://docs.daily.co/reference/rest-api/recordings/get-recording-link).

## Verified local provider exercise — 23 October 2026

Implementation commits `b2b65d1db` and `633719a96` passed `pnpm checkall`, including
the twelve-party HTTP command races. The latter fixes stale authenticated reads
by disabling fetch caching in both portals' server clients. Student browser
checks confirmed the published score remains visible while corrections are draft.

With explicitly configured local Daily credentials and an owned disposable
database, twelve synthetic SDK clients exercised the production ticket/API path:

- Six concurrent pairs joined; exam reading delivered student media only to
  tutors, and questions delivered playable audio/video in both directions.
- All six cloud recordings started. A student disconnected and rejoined without
  pausing the round. Early completion stopped only that pair; pause stopped all
  pairs, and resume reconnected the five unfinished pairs.
- The question deadline stopped exam media. All eleven recording segments from
  the initial and resumed sessions became ready. Protected tutor playback decoded
  854 × 480 video.
- A separate feedback-mode pair had two-way reading without recording, recorded
  questions and verbal feedback, and stopped after feedback completion. After
  explicit release, protected student playback decoded 854 × 480 video.
- The actual tutor UI captured and uploaded two in-person audio segments, then
  flushed and stopped at the exam feedback boundary. Playback returned valid mono
  Opus at approximately 64 kbps. Anonymous access returned 401 and unreleased
  student access returned 404.

These runs used fake cameras/microphones on one machine and network. They do not
prove reliability across twelve independent devices or networks. Observed phase
rejoins took roughly 3–5 seconds; cloud recording confirmation took roughly 6–9
seconds after the question phase began in the six-pair run. Recording startup is
asynchronous, so the first instant of an answer is not guaranteed to be captured.
Provider outage/backoff and retention logic have automated coverage; the local
exercise does not substitute for deployment configuration or a real-device pilot.

## Handled call-failure monitoring

Both web portals report unrecoverable Daily errors and three consecutive failed
join/recovery attempts through a typed shared callback. Network interruption
notifications that Daily recovers from, camera permission declines, obsolete
call callbacks, provider ejection at cutoff and planned lease expiry are not
fatal-call reports. Unexpected HTTP errors, including 4xx responses, remain
eligible after three consecutive failures. Existing recovery/polling remains authoritative; reporting
never adds a database write or another polling loop. Categories identify the
observed failure, not whether Altitutor, the provider or the network caused it.

The portal Sentry adapter groups by app/source/category and bounds each browser
tab to one event per kind per minute and three events per five minutes. The
browser `beforeSend` applies the existing production/host/test-opt-in policy,
then replaces a marked call-failure event with an allowlisted payload. It keeps
only bounded source/category/phase/state, app, release/environment, event identity
and coarse browser name/version. Provider messages, URLs, encounter/room/user
IDs, device labels, user scope, breadcrumbs, traces and media are excluded.
Normal local and preview automatic collection stays disabled.

Develop delivery is not proof that production events or alerts arrive. After a
separately authorized production release, verify a controlled safe failure from
each portal reaches its intended Sentry project and record the release, event
receipt and grouping. Verify alert routing/delivery separately with the owner;
do not treat event capture as an email/pager receipt or alter recipients during
routine QA. Retain the original intermittent-disconnect issue until its own
reproduction/evidence gate is met. These probes do not establish its cause.


### Production receipt checklist (separate release and QA authorization required)

Use a private synthetic QA round and two consenting staff-controlled accounts;
never interrupt a teaching round. Run once in tutor-web and once in student-web,
in separate browser tabs so each starts with an unused reporting budget.

1. Confirm the authorized production release includes DEV-246 and normal Sentry
   collection is enabled for that production host/project. Record the release
   and portal; do not change collection flags, DSNs, alert rules or recipients.
2. Start a questions phase lasting at least two minutes. Confirm the test pair
   connects. In the tested portal's browser DevTools, enable request blocking for
   the path pattern `*/api/interviews/rounds/*/media*` only. This blocks the local
   policy request; it does not inject an SDK payload or expose a room token.
3. Wait for three failed existing policy polls (normally about 30 seconds).
   Disable blocking immediately, confirm the policy request succeeds again and
   that the test call recovers. If the browser does not apply request blocking
   to fetch, stop and record the probe as unavailable rather than claiming a pass.
4. In that portal's production Sentry project, find `Interview call failed` at
   the recorded time/release. Expect source `recovery`, category `unknown`, phase
   `questions`, and state `joined` (or `joining` if the call lease elapsed).
   Grouping is app/source/category. Record event ID/link, release, environment,
   portal, timestamp and observed tags. Inspect the event payload: no user scope,
   request URL, room/round/session IDs, device labels, provider text, breadcrumbs,
   traces or replay context. Do not paste raw call requests into the workpad.
5. Record alert delivery separately: the matching rule, destination type and
   delivery timestamp/receipt, or the concrete missing rule/receipt. Existing
   rules may not alert on this group/frequency; an event receipt alone is not an
   alert pass. Ask the owner before changing alert routing or collection policy.
6. End the synthetic round and confirm request blocking is disabled in both
   portals. Keep the safe receipt summary on DEV-246; this does not reproduce or
   close the separate intermittent-disconnect incident.
