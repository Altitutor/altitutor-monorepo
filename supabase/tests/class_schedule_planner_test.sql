BEGIN;

SELECT plan(11);

CREATE TEMP TABLE schedule_test_proposal AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000001',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Interview A',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', '2026-09-01',
  'end_date', '2026-09-09',
  'effective_from', '2026-09-01',
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', '2026-09-01',
  'recurring_rows', jsonb_build_array(
    jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'room', 'Room 1', 'position', 0),
    jsonb_build_object('day_of_week', 3, 'start_time', '14:00', 'end_time', '15:00', 'room', 'Room 2', 'position', 1)
  )
) AS proposal;

SELECT has_table(
  'public',
  'class_schedule_revisions',
  'Classes own durable schedule revisions'
);

SELECT has_column(
  'public',
  'classes',
  'schedule_summary_short',
  'Classes expose one canonical schedule projection to every app'
);

SELECT has_function(
  'public',
  'preview_class_schedule',
  ARRAY['jsonb'],
  'ADMINSTAFF can preview a Class schedule through one planner interface'
);

SELECT is(
  (
    public.preview_class_schedule(
      jsonb_build_object(
        'schedule_type', 'RECURRING',
        'start_date', '2026-09-01',
        'end_date', '2026-09-09',
        'effective_from', '2026-09-01',
        'timezone', 'Australia/Adelaide',
        'frequency_weeks', 1,
        'anchor_date', '2026-09-01',
        'recurring_rows', jsonb_build_array(
          jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'room', 'Room 1'),
          jsonb_build_object('day_of_week', 3, 'start_time', '14:00', 'end_time', '15:00', 'room', 'Room 2')
        )
      )
    )->'counts'->>'create'
  )::INTEGER,
  4,
  'a weekly multi-row schedule previews every concrete Class session'
);

SELECT has_function(
  'public',
  'apply_class_schedule',
  ARRAY['jsonb', 'text'],
  'ADMINSTAFF applies the exact previewed Class schedule transactionally'
);

SELECT has_table(
  'public',
  'class_schedule_slots',
  'Recurring schedules own weekday, time, and room rows'
);

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM schedule_test_proposal
  $$,
  'the exact previewed proposal applies transactionally'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.classes WHERE id = '90000000-0000-0000-0000-000000000001'),
  1,
  'apply creates one stable Class cohort'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.class_schedule_revisions WHERE class_id = '90000000-0000-0000-0000-000000000001'),
  1,
  'apply records one durable schedule revision'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.class_schedule_slots css
    JOIN public.class_schedule_revisions csr ON csr.id = css.schedule_revision_id
    WHERE csr.class_id = '90000000-0000-0000-0000-000000000001'
  ),
  2,
  'apply stores the two recurring weekday/time rows'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000001'
      AND status = 'ACTIVE'
      AND schedule_origin = 'GENERATED'
  ),
  4,
  'apply materializes exactly four active generated Sessions'
);

SELECT * FROM finish();

ROLLBACK;
