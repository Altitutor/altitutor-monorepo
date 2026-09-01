BEGIN;
SET LOCAL TIME ZONE 'Australia/Adelaide';
SELECT plan(7);

CREATE TEMP TABLE chosen_lesson AS
SELECT id
FROM public.ucat_learning_modules
WHERE kind = 'lesson' AND deleted_at IS NULL
ORDER BY id
LIMIT 1;

DELETE FROM public.ucat_student_learning_module_progress
WHERE student_id = '10000000-0000-0000-0000-000000000002'
  AND learning_module_id = (SELECT id FROM chosen_lesson);
DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = '10000000-0000-0000-0000-000000000002';

INSERT INTO public.ucat_student_study_plan_generations (
  id, student_id, profile_id, reason, planning_date, starts_on, ends_on
)
SELECT
  'eb000000-0000-4000-8000-000000000001',
  profile.student_id,
  profile.id,
  'weekly',
  current_date + 60,
  current_date,
  current_date + 21
FROM public.ucat_student_study_plan_profiles profile
WHERE profile.student_id = '10000000-0000-0000-0000-000000000002';

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order, task_type,
  status, title, estimated_minutes, learning_module_id
) VALUES
  (
    'ec000000-0000-4000-8000-000000000001',
    'eb000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    current_date, 0, 'learn', 'planned', 'Owned module', 10,
    (SELECT id FROM chosen_lesson)
  );

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order, task_type,
  status, title, estimated_minutes, learning_module_id
)
SELECT
  'ec000000-0000-4000-8000-000000000002',
  'eb000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  current_date + 7, 0, 'learn', 'planned', 'Future copy', 10, id
FROM chosen_lesson;

SELECT is(
  public.start_ucat_learning_module(
    '10000000-0000-0000-0000-000000000002',
    (SELECT id FROM chosen_lesson),
    'ec000000-0000-4000-8000-000000000001'
  ) ->> 'status',
  'started',
  'a Study-plan learning launch starts successfully'
);
SELECT is(
  (
    SELECT study_plan_task_id
    FROM public.ucat_student_learning_module_progress
    WHERE student_id = '10000000-0000-0000-0000-000000000002'
      AND learning_module_id = (SELECT id FROM chosen_lesson)
  ),
  'ec000000-0000-4000-8000-000000000001'::UUID,
  'learning progress is owned by the explicitly launched task'
);

SELECT public.start_ucat_learning_module(
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM chosen_lesson),
  NULL
);
SELECT is(
  (
    SELECT study_plan_task_id
    FROM public.ucat_student_learning_module_progress
    WHERE student_id = '10000000-0000-0000-0000-000000000002'
      AND learning_module_id = (SELECT id FROM chosen_lesson)
  ),
  'ec000000-0000-4000-8000-000000000001'::UUID,
  'independent Learn access cannot erase explicit task ownership'
);
SELECT throws_ok(
  $$SELECT public.start_ucat_learning_module(
    '10000000-0000-0000-0000-000000000002',
    (SELECT id FROM chosen_lesson),
    'ec000000-0000-4000-8000-000000000002'
  )$$,
  '22023',
  'invalid_study_plan_learning_task',
  'a second untouched future copy cannot steal learning ownership'
);

DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = '10000000-0000-0000-0000-000000000003';
UPDATE public.ucat_student_study_plan_profiles
SET study_plan_enabled = TRUE,
    setup_completed_at = clock_timestamp(),
    last_authenticated_visit_at = clock_timestamp(),
    next_weekly_replan_on = current_date + 7
WHERE student_id = '10000000-0000-0000-0000-000000000003';

INSERT INTO public.ucat_student_study_plan_generations (
  id, student_id, profile_id, reason, planning_date, starts_on, ends_on
)
SELECT
  'eb000000-0000-4000-8000-000000000009',
  profile.student_id,
  profile.id,
  'weekly',
  current_date + 60,
  current_date - 1,
  current_date + 21
FROM public.ucat_student_study_plan_profiles profile
WHERE profile.student_id = '10000000-0000-0000-0000-000000000003';

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order, task_type,
  status, title, estimated_minutes, section_id, target_units
)
SELECT
  task.id,
  'eb000000-0000-4000-8000-000000000009',
  '10000000-0000-0000-0000-000000000003',
  task.scheduled_date,
  0,
  'practice',
  'planned',
  task.title,
  15,
  section.id,
  10
FROM (VALUES
  ('ec000000-0000-4000-8000-000000000009'::UUID, current_date - 1, 'Carry-over'),
  ('ec000000-0000-4000-8000-000000000010'::UUID, current_date, 'Today')
) task(id, scheduled_date, title)
CROSS JOIN LATERAL (
  SELECT id FROM public.ucat_sections ORDER BY section_number LIMIT 1
) section;

SELECT is(
  public.rollover_ucat_study_plan_for_student(
    '10000000-0000-0000-0000-000000000003'
  ),
  1,
  'rollover skips only earlier work when a real planned day begins'
);
SELECT is(
  (
    SELECT skipped_reason
    FROM public.ucat_student_study_plan_tasks
    WHERE id = 'ec000000-0000-4000-8000-000000000009'
  ),
  'rollover',
  'rollover records an auditable skip reason'
);
SELECT is(
  (
    SELECT debt_units
    FROM public.ucat_student_study_plan_exposure_debts
    WHERE student_id = '10000000-0000-0000-0000-000000000003'
  ),
  10::NUMERIC,
  'missed required Practice records bounded exposure debt'
);

SELECT * FROM finish();
ROLLBACK;
