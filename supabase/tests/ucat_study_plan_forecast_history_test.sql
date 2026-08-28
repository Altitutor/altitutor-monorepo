BEGIN;
SELECT plan(4);

DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = '10000000-0000-0000-0000-000000000002';

UPDATE public.students
SET timezone = 'Australia/Adelaide'
WHERE id = '10000000-0000-0000-0000-000000000002';

INSERT INTO public.ucat_student_study_plan_generations (
  id,
  student_id,
  profile_id,
  reason,
  planning_date,
  starts_on,
  ends_on,
  generated_at,
  superseded_at
)
SELECT
  md5('forecast-history-generation-' || series::TEXT)::UUID,
  '10000000-0000-0000-0000-000000000002',
  'f5000000-0000-4000-8000-000000000002',
  'weekly',
  DATE '2026-09-30',
  DATE '2026-08-01',
  DATE '2026-08-22',
  TIMESTAMPTZ '2026-08-01 00:00:00+09:30'
    + make_interval(secs => series),
  TIMESTAMPTZ '2026-08-01 01:00:00+09:30'
FROM generate_series(1, 70) series;

INSERT INTO public.ucat_student_study_plan_generations (
  id,
  student_id,
  profile_id,
  reason,
  planning_date,
  starts_on,
  ends_on,
  generated_at
) VALUES (
  'ab000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'f5000000-0000-4000-8000-000000000002',
  'weekly',
  DATE '2026-09-30',
  DATE '2026-08-02',
  DATE '2026-08-23',
  TIMESTAMPTZ '2026-08-02 09:00:00+09:30'
);

INSERT INTO public.ucat_student_study_plan_tasks (
  id,
  generation_id,
  student_id,
  scheduled_date,
  sort_order,
  task_type,
  title,
  estimated_minutes
)
SELECT
  md5('forecast-history-task-' || generation.id::TEXT)::UUID,
  generation.id,
  generation.student_id,
  DATE '2026-08-01',
  0,
  'practice',
  'Historical practice',
  15
FROM public.ucat_student_study_plan_generations generation
WHERE generation.student_id = '10000000-0000-0000-0000-000000000002';

CREATE TEMP TABLE forecast_history AS
SELECT public.get_student_ucat_study_plan_forecast_history(
  '10000000-0000-0000-0000-000000000002',
  DATE '2026-08-02'
) AS value;

SELECT is(
  (SELECT jsonb_array_length(value -> 'generations') FROM forecast_history),
  2,
  'forecast history keeps the active generation and one representative per local day'
);

SELECT is(
  (SELECT jsonb_array_length(value -> 'tasks') FROM forecast_history),
  2,
  'forecast task history is limited to the selected representative generations'
);

SELECT ok(
  (SELECT pg_column_size(value) < 10000 FROM forecast_history),
  'forecast history remains bounded when one day contains many generations'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_student_ucat_study_plan_forecast_history(uuid,date)',
    'EXECUTE'
  ),
  'Students cannot invoke the cross-Student forecast history function'
);

SELECT * FROM finish();
ROLLBACK;
