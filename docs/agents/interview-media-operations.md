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
4. Apply `supabase/manual/interviews_realtime_rls.sql` once using the owner of
   `realtime.messages`, via the approved deployment bootstrap. This is the same
   ownership constraint as the existing connector wake policy. Do not grant
   public channel access. Until that policy exists, scoped polling recovers state
   but private broadcast delivery is unavailable.
5. The private `interview-recordings` bucket is created by migration. Client
   uploads go through the tutor API; playback requests recheck scoped access,
   result release and expiry before issuing a short-lived URL.

## Recovery and validation

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
