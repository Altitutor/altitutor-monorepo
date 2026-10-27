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
