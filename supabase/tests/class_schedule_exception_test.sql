BEGIN;

SELECT plan(3);

CREATE TEMP TABLE exception_proposal AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000003',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Exception A',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', '2027-01-05',
  'end_date', '2027-01-05',
  'effective_from', '2027-01-05',
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', '2027-01-05',
  'recurring_rows', jsonb_build_array(
    jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'position', 0)
  )
) AS proposal;

SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM exception_proposal;

UPDATE public.sessions
SET start_at = start_at + INTERVAL '1 hour', end_at = end_at + INTERVAL '1 hour'
WHERE class_id = '90000000-0000-0000-0000-000000000003';

SELECT ok(
  (SELECT is_schedule_exception FROM public.sessions WHERE class_id = '90000000-0000-0000-0000-000000000003'),
  'editing one generated Session marks only that Session as an exception'
);

SELECT is(
  (SELECT (public.preview_class_schedule(proposal)->'counts'->>'preserve')::INTEGER FROM exception_proposal),
  1,
  'the planner recognizes a moved exception by its original occurrence'
);

SELECT is(
  (SELECT (public.preview_class_schedule(proposal)->'counts'->>'create')::INTEGER FROM exception_proposal),
  0,
  'the planner does not recreate the original slot underneath a moved exception'
);

SELECT * FROM finish();

ROLLBACK;
