BEGIN;
SELECT plan(15);

SELECT has_column(
  'public',
  'student_question_set_attempts',
  'effective_pace_multiplier',
  'set attempts record the pace actually delivered'
);
SELECT has_column(
  'public',
  'student_question_set_attempts',
  'study_plan_task_id',
  'set attempts can retain their originating Study plan task'
);

INSERT INTO public.ucat_student_study_plan_profiles (
  id, student_id, target_score, test_year, test_date,
  available_days, preferred_mock_weekday, setup_completed_at
)
VALUES (
  'ee000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  2100,
  2026,
  DATE '2026-12-01',
  '[]'::JSONB,
  1,
  NOW()
);

INSERT INTO public.ucat_student_study_plan_generations (
  id, student_id, profile_id, reason, planning_date, starts_on, ends_on
)
VALUES (
  'ee000000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000007',
  'ee000000-0000-4000-8000-000000000001',
  'manual',
  DATE '2026-09-01',
  DATE '2026-09-01',
  DATE '2026-12-01'
);

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order,
  task_type, status, title, estimated_minutes, target_units,
  section_id, question_set_id, launch_path, launch_config, started_at
)
SELECT
  'ee000000-0000-4000-8000-000000000003',
  'ee000000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000007',
  DATE '2026-09-03',
  1,
  'section_benchmark',
  'in_progress',
  'Paced benchmark',
  44,
  44,
  question_set.section_id,
  question_set.id,
  '/sets/' || question_set.id::TEXT,
  '{"kind":"set","prescribedPace":0.5}'::JSONB,
  NOW()
FROM public.question_sets question_set
WHERE question_set.id = 'f3000000-0000-4000-8000-000000000001';

INSERT INTO public.student_question_set_attempts (
  id, student_id, question_set_id, engine_snapshot, study_plan_task_id
)
VALUES (
  'ee000000-0000-4000-8000-000000000004',
  '10000000-0000-0000-0000-000000000007',
  'f3000000-0000-4000-8000-000000000001',
  '{"state":{"phase":"intro"},"examTiming":{"setModeTiming":{"setTimeLimitSeconds":1320}}}'::JSONB,
  'ee000000-0000-4000-8000-000000000003'
);

SELECT is(
  (SELECT timing_source FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  'study_plan',
  'a task-bound attempt records the Study plan as its timing source'
);
SELECT is(
  (SELECT effective_timing_mode::TEXT FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  'pace',
  'a pace prescription resolves to paced attempt timing'
);
SELECT is(
  (SELECT effective_pace_multiplier FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  0.5::NUMERIC,
  'the effective pace comes from the validated task rather than the set default'
);
SELECT is(
  (SELECT set_time_limit_seconds FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  (SELECT CEIL(public.ucat_question_set_exam_time_seconds(
    'f3000000-0000-4000-8000-000000000001'
  )::NUMERIC / 0.5)::INTEGER),
  'the attempt time limit is derived from exam time and prescribed pace'
);
SELECT is(
  (SELECT engine_snapshot #>> '{examTiming,setModeTiming,setTimeLimitSeconds}'
    FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  (SELECT CEIL(public.ucat_question_set_exam_time_seconds(
    'f3000000-0000-4000-8000-000000000001'
  )::NUMERIC / 0.5)::INTEGER::TEXT),
  'the persisted engine receives the authoritative effective time limit'
);

SELECT throws_ok(
  $$UPDATE public.student_question_set_attempts
    SET effective_pace_multiplier = 0.6
    WHERE id = 'ee000000-0000-4000-8000-000000000004'$$,
  '22023',
  'Effective set attempt timing is immutable',
  'effective timing metadata cannot change after the attempt starts'
);
SELECT throws_ok(
  $$UPDATE public.student_question_set_attempts
    SET engine_snapshot = jsonb_set(
      engine_snapshot,
      '{examTiming,setModeTiming,setTimeLimitSeconds}',
      '999'::JSONB
    )
    WHERE id = 'ee000000-0000-4000-8000-000000000004'$$,
  '22023',
  'Effective set attempt timing snapshot is immutable',
  'the effective engine timing cannot change after the attempt starts'
);

UPDATE public.student_question_set_attempts
SET completed_at = NOW(), scaled_score = 700, total_points = 44
WHERE id = 'ee000000-0000-4000-8000-000000000004';

INSERT INTO public.student_question_set_attempts (
  id, student_id, question_set_id, engine_snapshot
)
VALUES (
  'ee000000-0000-4000-8000-000000000005',
  '10000000-0000-0000-0000-000000000008',
  'f3000000-0000-4000-8000-000000000001',
  '{"state":{"phase":"intro"},"examTiming":{"setModeTiming":{"setTimeLimitSeconds":1320}}}'::JSONB
);

SELECT is(
  (SELECT timing_source FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000005'),
  'set_default',
  'a direct attempt continues to use the reusable set default'
);
SELECT is(
  (SELECT effective_pace_multiplier FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000005'),
  1::NUMERIC,
  'the direct attempt snapshots the set default pace'
);

UPDATE public.student_question_set_attempts
SET completed_at = NOW(), scaled_score = 800, total_points = 44
WHERE id = 'ee000000-0000-4000-8000-000000000005';

SELECT is(
  (SELECT cohort_size FROM public.get_ucat_set_attempt_percentile_cohort(
    'ee000000-0000-4000-8000-000000000004'
  )),
  1::BIGINT,
  'set percentiles only compare attempts delivered at the same effective pace'
);

UPDATE public.ucat_student_study_plan_tasks
SET status = 'planned'
WHERE id = 'ee000000-0000-4000-8000-000000000003';

SELECT throws_ok(
  $$INSERT INTO public.student_question_set_attempts (
      id, student_id, question_set_id, study_plan_task_id
    ) VALUES (
      'ee000000-0000-4000-8000-000000000006',
      '10000000-0000-0000-0000-000000000007',
      'f3000000-0000-4000-8000-000000000001',
      'ee000000-0000-4000-8000-000000000003'
    )$$,
  '22023',
  'Invalid Study plan set pace prescription',
  'a task must be in progress before it can prescribe attempt pacing'
);

UPDATE public.ucat_student_study_plan_tasks
SET status = 'in_progress'
WHERE id = 'ee000000-0000-4000-8000-000000000003';

SELECT throws_ok(
  $$INSERT INTO public.student_question_set_attempts (
      id, student_id, question_set_id, study_plan_task_id
    ) VALUES (
      'ee000000-0000-4000-8000-000000000007',
      '10000000-0000-0000-0000-000000000008',
      'f3000000-0000-4000-8000-000000000001',
      'ee000000-0000-4000-8000-000000000003'
    )$$,
  '22023',
  'Invalid Study plan set pace prescription',
  'a Student cannot use another Student''s pace prescription'
);

SELECT is(
  (SELECT study_plan_task_id FROM public.student_question_set_attempts
    WHERE id = 'ee000000-0000-4000-8000-000000000004'),
  'ee000000-0000-4000-8000-000000000003'::UUID,
  'the originating task remains attributable on the attempt'
);

SELECT * FROM finish();
ROLLBACK;
