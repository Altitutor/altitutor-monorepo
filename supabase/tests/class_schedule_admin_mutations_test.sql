BEGIN;

SELECT plan(5);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  TRUE
);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE class_schedule_admin_test_proposal AS
WITH test_bounds AS (
  SELECT (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE + 7 AS start_date
)
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000099',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Authenticated mutation test',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', test_bounds.start_date,
  'end_date', test_bounds.start_date,
  'effective_from', test_bounds.start_date,
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', test_bounds.start_date,
  'recurring_rows', jsonb_build_array(
    jsonb_build_object(
      'day_of_week', EXTRACT(DOW FROM test_bounds.start_date)::INTEGER,
      'start_time', '13:00',
      'end_time', '14:00',
      'room', 'Room 1',
      'position', 0
    )
  )
) AS proposal
FROM test_bounds;

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM class_schedule_admin_test_proposal
  $$,
  'an authenticated ADMINSTAFF can create a Class schedule'
);

UPDATE class_schedule_admin_test_proposal
SET proposal = jsonb_set(proposal, '{status}', '"INACTIVE"');

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM class_schedule_admin_test_proposal
  $$,
  'an authenticated ADMINSTAFF can make a Class inactive'
);

SELECT lives_ok(
  $$ DELETE FROM public.classes WHERE id = '90000000-0000-0000-0000-000000000099' $$,
  'an authenticated ADMINSTAFF can delete a Class with only pristine future Sessions'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.cleanup_session_files(uuid)',
    'EXECUTE'
  ),
  'authenticated callers still cannot invoke the private file-cleanup routine directly'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  TRUE
);

SELECT throws_ok(
  $$ SELECT public.is_pristine_generated_class_session('90000000-0000-0000-0000-000000000099') $$,
  '42501',
  'ADMINSTAFF access required',
  'non-admin authenticated callers cannot use the privileged pristine-session check'
);

SELECT * FROM finish();

ROLLBACK;
