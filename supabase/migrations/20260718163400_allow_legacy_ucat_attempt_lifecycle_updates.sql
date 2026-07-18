-- Allow lifecycle metadata updates on UCAT attempt rows created before content
-- snapshots were introduced. The snapshot capture migration intentionally kept
-- historical rows whose source content had already been deleted, but a strict
-- NOT VALID check still rejects every later UPDATE of those rows. That prevents
-- stale-attempt expiry and, in turn, blocks students from starting new attempts.
--
-- Inserts made after the snapshot rollout remain protected by both the capture
-- triggers and these checks.

alter table public.student_question_attempts
  drop constraint if exists student_question_attempts_content_snapshot_required;
alter table public.student_question_attempts
  add constraint student_question_attempts_content_snapshot_required
  check (
    content_snapshot is not null
    or attempted_at < timestamptz '2026-07-14 08:01:34+00'
  ) not valid;

alter table public.student_question_set_attempts
  drop constraint if exists student_question_set_attempts_content_snapshot_required;
alter table public.student_question_set_attempts
  add constraint student_question_set_attempts_content_snapshot_required
  check (
    content_snapshot is not null
    or attempted_at < timestamptz '2026-07-14 08:01:34+00'
  ) not valid;

alter table public.student_ucat_mock_attempts
  drop constraint if exists student_ucat_mock_attempts_content_snapshot_required;
alter table public.student_ucat_mock_attempts
  add constraint student_ucat_mock_attempts_content_snapshot_required
  check (
    content_snapshot is not null
    or attempted_at < timestamptz '2026-07-14 08:01:34+00'
  ) not valid;
