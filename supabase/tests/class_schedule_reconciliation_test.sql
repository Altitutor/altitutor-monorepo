BEGIN;

SELECT plan(8);

CREATE TEMP TABLE initial_schedule AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000002',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Revision A',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', '2026-09-01',
  'end_date', '2026-09-23',
  'effective_from', '2026-09-01',
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', '2026-09-01',
  'recurring_rows', jsonb_build_array(
    jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'position', 0),
    jsonb_build_object('day_of_week', 3, 'start_time', '14:00', 'end_time', '15:00', 'position', 1)
  )
) AS proposal;

SELECT public.apply_class_schedule(
  proposal,
  public.preview_class_schedule(proposal)->>'proposal_hash'
)
FROM initial_schedule;

UPDATE public.sessions
SET
  is_schedule_exception = TRUE,
  schedule_origin = 'EXCEPTION'
WHERE class_id = '90000000-0000-0000-0000-000000000002'
  AND (start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2026-09-09';

INSERT INTO public.sessions_students (
  id,
  session_id,
  student_id,
  planned_absence,
  created_by
)
SELECT
  gen_random_uuid(),
  s.id,
  '10000000-0000-0000-0000-000000000001',
  TRUE,
  '00000000-0000-0000-0000-000000000001'
FROM public.sessions s
WHERE s.class_id = '90000000-0000-0000-0000-000000000002'
  AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2026-09-16';

SELECT is(
  (
    SELECT (public.preview_class_schedule(proposal || jsonb_build_object(
      'end_date', '2026-09-15',
      'effective_from', '2026-09-08'
    ))->'counts'->>'cancel')::INTEGER
    FROM initial_schedule
  ),
  2,
  'shortening a Class previews pristine removals after the new end date'
);

SELECT throws_ok(
  $$ UPDATE public.classes
     SET status = 'INACTIVE'
     WHERE id = '90000000-0000-0000-0000-000000000002' $$,
  'P0001', 'Class status changes must use the timetable preview',
  'direct Class status changes cannot bypass schedule reconciliation'
);

SELECT is(
  (public.preview_class_deletion('90000000-0000-0000-0000-000000000002')->>'protected_future_session_count')::INTEGER,
  2,
  'Class deletion preview exposes exceptional and enriched future Sessions as protected'
);

CREATE TEMP TABLE changed_schedule AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000002',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Revision A',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', '2026-09-01',
  'end_date', '2026-09-23',
  'effective_from', '2026-09-08',
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', '2026-09-01',
  'recurring_rows', jsonb_build_array(
    jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'position', 0)
  )
) AS proposal;

SELECT is(
  (
    SELECT (public.preview_class_schedule(proposal)->'counts'->>'cancel')::INTEGER
    FROM changed_schedule
  ),
  1,
  'preview marks only a pristine removed future Session for cancellation'
);

SELECT is(
  (
    SELECT (public.preview_class_schedule(proposal)->'counts'->>'protected')::INTEGER
    FROM changed_schedule
  ),
  2,
  'preview exposes exceptional and enriched Sessions as protected'
);

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM changed_schedule
  $$,
  'the previewed reconciliation applies transactionally'
);

SELECT results_eq(
  $$
    SELECT
      COUNT(*) FILTER (WHERE status = 'ACTIVE')::INTEGER,
      COUNT(*) FILTER (WHERE status = 'INACTIVE' AND calendar_tombstone_until IS NOT NULL)::INTEGER
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000002'
  $$,
  $$ VALUES (7, 1) $$,
  'apply preserves history and protected Sessions while tombstoning only the pristine removal'
);

UPDATE public.classes
SET subject_id = (
  SELECT id FROM public.subjects
  WHERE id IS DISTINCT FROM public.classes.subject_id
  ORDER BY id
  LIMIT 1
)
WHERE id = '90000000-0000-0000-0000-000000000002';

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000002'
      AND status = 'INACTIVE'
      AND calendar_tombstone_until IS NOT NULL
  ),
  1,
  'a Class subject edit does not reactivate a cancellation tombstone'
);

SELECT * FROM finish();

ROLLBACK;
