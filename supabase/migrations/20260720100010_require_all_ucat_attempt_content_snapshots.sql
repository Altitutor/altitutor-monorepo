-- Pre-production cleanup: every retained attempt can be backfilled from its
-- current source content, so remove the date-based lifecycle exemption and
-- make immutable snapshots a universal invariant.

alter table public.student_question_attempts
  disable trigger capture_ucat_question_attempt_content;
alter table public.student_question_set_attempts
  disable trigger capture_ucat_set_attempt_content;
alter table public.student_ucat_mock_attempts
  disable trigger capture_ucat_mock_attempt_content;

update public.student_question_attempts attempt
set content_snapshot = public.ucat_question_content_snapshot(attempt.question_id)
where attempt.content_snapshot is null;

update public.student_question_set_attempts attempt
set content_snapshot = public.ucat_question_set_content_snapshot(attempt.question_set_id)
where attempt.content_snapshot is null;

update public.student_ucat_mock_attempts attempt
set content_snapshot = public.ucat_mock_content_snapshot(attempt.ucat_mock_id)
where attempt.content_snapshot is null;

alter table public.student_question_attempts
  enable trigger capture_ucat_question_attempt_content;
alter table public.student_question_set_attempts
  enable trigger capture_ucat_set_attempt_content;
alter table public.student_ucat_mock_attempts
  enable trigger capture_ucat_mock_attempt_content;

alter table public.student_question_attempts
  drop constraint if exists student_question_attempts_content_snapshot_required;
alter table public.student_question_attempts
  add constraint student_question_attempts_content_snapshot_required
  check (content_snapshot is not null) not valid;

alter table public.student_question_set_attempts
  drop constraint if exists student_question_set_attempts_content_snapshot_required;
alter table public.student_question_set_attempts
  add constraint student_question_set_attempts_content_snapshot_required
  check (content_snapshot is not null) not valid;

alter table public.student_ucat_mock_attempts
  drop constraint if exists student_ucat_mock_attempts_content_snapshot_required;
alter table public.student_ucat_mock_attempts
  add constraint student_ucat_mock_attempts_content_snapshot_required
  check (content_snapshot is not null) not valid;

alter table public.student_question_attempts
  validate constraint student_question_attempts_content_snapshot_required;
alter table public.student_question_set_attempts
  validate constraint student_question_set_attempts_content_snapshot_required;
alter table public.student_ucat_mock_attempts
  validate constraint student_ucat_mock_attempts_content_snapshot_required;
