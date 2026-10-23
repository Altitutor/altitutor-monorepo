# DEV-8 development QA

Use development accounts and synthetic interview content. Start with two tutors
and two students on separate devices, then repeat the live checks with six pairs.
Use headphones to avoid feedback. Do not use the `/interviews/prototype` pages:
they are design fixtures, not the persisted feature.

## Deployment prerequisites

- The merged commit's **Supabase Deploy** database job must pass against
  `altitutor-backend-dev` (`ysfslbdcacpbemodkwtl`). Migrations ship through CI/CD.
- Both web apps must serve that commit and use the development database. A
  successful database job alone does not prove web delivery: Git deployment is
  disabled in their `vercel.json`, and the current workflow's web job targets
  `main` only. Verify the development deployment's commit before starting.
- Development `DAILY_API_KEY` belongs in `secrets/.env.development`; deploy only
  the relevant values with the repository script:

  ```sh
  bash secrets/scripts/deploy-vercel.sh --only DAILY_API_KEY --environment development
  bash secrets/scripts/deploy-vercel.sh --only CRON_SECRET --environment development
  ```

  Daily goes to tutor/student Preview environments. Cron goes to tutor and the
  existing UCAT recipient. New environment values require a new web deployment.
  Do not paste secret values into a terminal command, issue, or screenshot.
- The database job must include `interview_realtime_authorization`, which installs
  the private receive policy through normal CI/CD. Supabase delegates policy DDL
  to `postgres` even though `realtime.messages` has a different owner; no manual
  owner bootstrap or `ALTER TABLE` is needed. Channel privacy comes from the
  server/client `private: true` configuration; the synthetic authorization row's
  `private` field is not the requested channel's privacy flag. Verify that the
  private channel reaches `SUBSCRIBED` and delivers a `changed` event to an
  eligible participant.
  An unrelated or no-longer-eligible user must be denied on a fresh subscription,
  and clients must not be able to publish. Polling recovery alone does not prove
  Broadcast delivery. See [Supabase authorization](https://supabase.com/docs/guides/realtime/authorization).
- Vercel schedules cron only on Production deployments, not Preview. For
  development maintenance QA, invoke the tutor `/api/cron/interview-media`
  endpoint using the development `CRON_SECRET` in an Authorization Bearer header
  through trusted server tooling. Do not wait for a Preview schedule to fire or
  point development tests at production. See [Vercel's cron guidance](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs).

See [media operations](interview-media-operations.md) for lifecycle and rollout
details. Production delivery remains separate from this QA procedure.

## Accounts and preparation

1. Sign into [tutor Interviews](https://tutor.development.altitutor.com/interviews)
   with tutors assigned the **Medicine interview** subject. Students must have
   current interview enrolment. Use the private development test-account source
   described in [web smoke testing](development-web-smoke-testing.md).
2. Open **Question bank**. Create a QA category, two tags and at least four
   questions with distinct reading prompts and rubrics. Check search/filter,
   one category per question, multiple tags and the persistent preview.
3. Create a two-station interview, two questions per station. Set one maximum
   to **6.5** and the other to **6**. Reuse a question once: a warning should
   appear without blocking. Reorder questions and check printed prompts follow
   the first question of each station.
4. Create an online exam round with short reading/question durations, recording
   enabled, two distinct tutors and two students. Check cross-class selection,
   scheduling with the shared date/time pickers, then use Start now for the test.
   Another short round with one student should show an idle station correctly.

## Live online exam

1. Students open [their Interviews page](https://student.development.altitutor.com/interviews)
   or the notification link. Each should reach the correct fullscreen waiting
   room. A tutor without the required subject must not gain access by URL.
2. Mark tutors ready. Leave a student disconnected and try starting: the tutor
   should see the connection check and a deliberate override. Rejoin before
   continuing normally.
3. In reading, tutors see/hear their student; students see their own preview,
   numbered station and first-question prompt, with a countdown. Students must
   not see/hear the tutor, rubric or station name.
4. In questions, both directions work. Tutor sees the timer; student does not.
   Record the delay before media reconnects and before recording is confirmed.
   Previous synthetic tests observed roughly 3–5 seconds and 6–9 seconds,
   respectively; recording can miss the beginning of an answer.
5. Type feedback: the unanswered badge clears and save status completes. Move
   between questions and refresh after saving: feedback and fractional score
   remain. Edit a rubric and check another tutor sees the revision notice.
6. Disconnect one student for 30–45 seconds, then reconnect. Other stations keep
   running; the student returns to the current phase. Test manual pause/resume.
7. End one station early. Only that exam pair loses media/recording. At the
   question deadline, all remaining exam pairs lose media; tutors can mark.
8. Finish marking. Have two tutors click Next nearly together: the circuit must
   advance only once. Repeat across all stations, including an idle station.
9. Try Exit, browser Back and refresh while live: deliberate leave warnings
   should appear where the browser supports them.

## Results and alternative modes

- Before release, students cannot read marks, feedback or recordings. Resolve a
  missing station using a reasoned Not assessed exception: its points are
  excluded and the result is Partial. Missing marks must never silently become 0.
- Release when every result is resolved. Check total earned/possible points,
  per-question feedback, recording playback and 90-day expiry display.
- Draft a score correction: students keep the prior published value. Release
  the update and confirm the new value. An unenrolled student loses result access.
- Run a short **feedback-mode** round: two-way reading without recording;
  recorded questions and verbal feedback; Finish feedback ends that pair's media.
- Run **in person**: no assigned student order. Tutors select walk-in students;
  simultaneous claims for the same student cannot both succeed. Changing a
  student after notes requires confirmation. Audio records during eligible
  phases, uploads in segments and flushes at the phase boundary.
- Repeat a round with recording disabled: calls work and no recordings are
  created. Deny microphone permission in an in-person test: a visible recording
  warning must not stop the interview itself.

## Report a failure

Record deployment commit, round ID, mode, phase, role, browser/device and time
with timezone. Include expected versus actual behavior and a sanitized
screenshot. Distinguish application connection, media connection, recording
startup and saved feedback. Never include credentials or signed playback URLs.

Do not approve live assessed interviews until the multi-device run passes and
the observed media/recording startup delay is acceptable or improved.
