# DEV-8 development QA

Use development accounts and synthetic interview content. Start with two tutors
and two students on separate devices, then repeat the live checks with six pairs.
Use headphones to avoid feedback.

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
2. Open **Station bank**. Create a QA category, two question tags and two
   stations with distinct prompts and at least two linked questions each. Check
   search/filter, exactly one category per station, multiple tags independently
   on each question, per-question rubric and recommended timing.
3. Create an interview from both whole stations. Set one bank station maximum
   to **6.5** and the other to **6**. Repeat a whole station: a warning should
   appear without blocking. Reorder stations and check each printed page uses
   its station prompt. Questions can be reordered only in the station editor;
   reordering questions must never change the shared prompt. Duplicate a bank
   station for an independent variant. Archive hides it from new selection while
   preserving existing prepared references.
4. Create an online exam round with short reading/question durations, recording
   enabled, two distinct tutors and two students. Check cross-class selection,
   scheduling with the shared date/time pickers, then use Start now for the test.
   Another short round with one student should show an idle station correctly.

## Import a station

1. In Station bank, choose **Import station**. Paste a prompt by itself or a
   whole Word station document in the first step. The supplied MMI 1 Station 2
   and Station 3 formats should detect five and four linked questions respectively.
   Administrative interview/feedback tables must not become prompt content, and
   repeated Word text-box copies of the same Prompt must appear only once.
2. Continue to questions. Check the auto-filled Question table, or paste a
   separate numbered list/table. A **Rubric** column supplies each question's
   marking guidance; **Feedback** columns are ignored. Rubrics may be empty.
   Plain-text tab-separated tables and `Rubric:` under numbered questions are
   supported; preserve rich formatting in rubric lists and question content.
3. Preview the station. Correct the name, prompt, ordered questions, rubrics,
   pacing, category, tags and maximum score. Go Back and forward without source
   changes: preview edits should remain. No station should exist before clicking
   **Add station**. Missing prompt, name/category or questions must prevent save.
4. Add, reopen and check persistence. A failed save must keep the preview for
   retry; cancel/discard must not create a partial station. Repeat at a narrow
   viewport and check paste/preview scrolling and footer navigation.

## Live online exam

1. Students open [their Interviews page](https://student.development.altitutor.com/interviews)
   or the notification link. Each should reach the correct fullscreen waiting
   room. A tutor without the required subject must not gain access by URL.
2. Mark tutors ready. Leave a student disconnected and try starting: the tutor
   should see the connection check and a deliberate override. Rejoin before
   continuing normally.
3. In reading, tutors see/hear their student; students see their own preview,
   numbered station and shared station prompt, with a countdown. Students must
   not see/hear the tutor, rubric or station name.
4. In questions, both directions work. Tutor sees the timer; student does not.
   Record the delay before media reconnects and before recording is confirmed.
   Previous synthetic tests observed roughly 3–5 seconds and 6–9 seconds,
   respectively; recording can miss the beginning of an answer.
5. Enter optional **General station feedback**: it autosaves but leaves every
   question unanswered. Type question feedback: its unanswered badge clears and
   save status completes. Move
   between questions and refresh after saving: feedback and fractional score
   remain, including general station feedback. Edit a rubric and check another tutor sees the revision notice.
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
  general station feedback, per-question feedback, recording playback and 90-day expiry display.
- Draft score and general-feedback corrections: students keep the prior published
  values. Release
  the update and confirm the new value. An unenrolled student loses result access.
- Run a short **feedback-mode** round: two-way reading without recording;
  recorded questions and verbal feedback; Finish feedback ends that pair's media.
- Run **in person**: no assigned student order. Tutors select walk-in students;
  simultaneous claims for the same student cannot both succeed. Changing a
  student after general feedback alone requires confirmation and moves the note
  to the corrected student, clearing it from the former student. Existing target
  feedback must not be overwritten. Audio records during eligible
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
