BEGIN;

SELECT plan(9);

CREATE TEMP TABLE study_plan_replacement_fixture (
  student_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  old_generation_id UUID,
  new_generation_id UUID
);

INSERT INTO study_plan_replacement_fixture (student_id, profile_id)
SELECT student_id, id
FROM public.ucat_student_study_plan_profiles
ORDER BY id
LIMIT 1;

DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = (SELECT student_id FROM study_plan_replacement_fixture);

UPDATE study_plan_replacement_fixture
SET old_generation_id = public.replace_ucat_study_plan_generation(
  student_id,
  profile_id,
  'onboarding',
  CURRENT_DATE,
  CURRENT_DATE,
  CURRENT_DATE + 21,
  '{"versions":{"policy":"evidence-driven-preparation-policy-v2"}}'::JSONB,
  '{}'::JSONB,
  NULL,
  jsonb_build_array(
    jsonb_build_object(
      'id', '55300000-0000-4000-8000-000000000001',
      'scheduled_date', CURRENT_DATE,
      'sort_order', 0,
      'task_type', 'practice',
      'title', 'Completed today',
      'estimated_minutes', 20,
      'target_units', 10,
      'launch_config', '{}'::JSONB
    ),
    jsonb_build_object(
      'id', '55300000-0000-4000-8000-000000000002',
      'scheduled_date', CURRENT_DATE,
      'sort_order', 1,
      'task_type', 'practice',
      'title', 'In progress today',
      'estimated_minutes', 20,
      'target_units', 10,
      'launch_config', '{}'::JSONB
    ),
    jsonb_build_object(
      'id', '55300000-0000-4000-8000-000000000003',
      'scheduled_date', CURRENT_DATE,
      'sort_order', 2,
      'task_type', 'practice',
      'title', 'Planned today',
      'estimated_minutes', 20,
      'target_units', 10,
      'launch_config', '{}'::JSONB
    ),
    jsonb_build_object(
      'id', '55300000-0000-4000-8000-000000000004',
      'scheduled_date', CURRENT_DATE + 1,
      'sort_order', 0,
      'task_type', 'practice',
      'title', 'Retired future work',
      'estimated_minutes', 20,
      'target_units', 10,
      'launch_config', '{}'::JSONB
    )
  ),
  CURRENT_DATE + 7,
  NOW(),
  NULL
);

UPDATE public.ucat_student_study_plan_tasks
SET status = 'completed',
    completed_at = NOW() - INTERVAL '1 hour',
    completed_units = 10
WHERE id = '55300000-0000-4000-8000-000000000001';

UPDATE public.ucat_student_study_plan_tasks
SET status = 'in_progress',
    started_at = NOW() - INTERVAL '30 minutes',
    completed_units = 4
WHERE id = '55300000-0000-4000-8000-000000000002';

UPDATE study_plan_replacement_fixture
SET new_generation_id = public.replace_ucat_study_plan_generation(
  student_id,
  profile_id,
  'significant_activity',
  CURRENT_DATE,
  CURRENT_DATE,
  CURRENT_DATE + 21,
  '{"versions":{"policy":"evidence-driven-preparation-policy-v4"}}'::JSONB,
  '{}'::JSONB,
  NULL,
  jsonb_build_array(
    jsonb_build_object(
      'id', '55300000-0000-4000-8000-000000000005',
      'scheduled_date', CURRENT_DATE + 1,
      'sort_order', 0,
      'task_type', 'practice',
      'title', 'Regenerated future work',
      'estimated_minutes', 20,
      'target_units', 10,
      'launch_config', '{}'::JSONB
    )
  ),
  CURRENT_DATE + 7,
  NOW(),
  CURRENT_DATE
);

SELECT isnt(
  old_generation_id,
  new_generation_id,
  'replacement creates a distinct generation'
)
FROM study_plan_replacement_fixture;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.ucat_student_study_plan_generations
    WHERE student_id = fixture.student_id AND superseded_at IS NULL
  ),
  1,
  'replacement leaves exactly one active generation'
)
FROM study_plan_replacement_fixture AS fixture;

SELECT ok(
  (
    SELECT superseded_at IS NOT NULL
    FROM public.ucat_student_study_plan_generations
    WHERE id = fixture.old_generation_id
  ),
  'the previous active generation is superseded'
)
FROM study_plan_replacement_fixture AS fixture;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.ucat_student_study_plan_tasks
    WHERE generation_id = fixture.new_generation_id
      AND scheduled_date = CURRENT_DATE
  ),
  3,
  'all current-day work survives replacement'
)
FROM study_plan_replacement_fixture AS fixture;

SELECT results_eq(
  $$
    SELECT status
    FROM public.ucat_student_study_plan_tasks
    WHERE id IN (
      '55300000-0000-4000-8000-000000000001',
      '55300000-0000-4000-8000-000000000002',
      '55300000-0000-4000-8000-000000000003'
    )
    ORDER BY sort_order
  $$,
  $$VALUES ('completed'::TEXT), ('in_progress'::TEXT), ('planned'::TEXT)$$,
  'completed, in-progress and other current-day states remain durable'
);

SELECT is(
  (
    SELECT completed_units
    FROM public.ucat_student_study_plan_tasks
    WHERE id = '55300000-0000-4000-8000-000000000001'
  ),
  10,
  'completion progress remains durable'
);

SELECT is(
  (
    SELECT generation_id
    FROM public.ucat_student_study_plan_tasks
    WHERE id = '55300000-0000-4000-8000-000000000004'
  ),
  old_generation_id,
  'old future work remains retired with the superseded generation'
)
FROM study_plan_replacement_fixture;

SELECT is(
  (
    SELECT generation_id
    FROM public.ucat_student_study_plan_tasks
    WHERE id = '55300000-0000-4000-8000-000000000005'
  ),
  new_generation_id,
  'regenerated future work belongs to the new active generation'
)
FROM study_plan_replacement_fixture;

SELECT results_eq(
  $$
    SELECT input_snapshot->'versions'->>'policy'
    FROM public.ucat_student_study_plan_generations
    WHERE superseded_at IS NULL
      AND student_id = (
        SELECT student_id FROM study_plan_replacement_fixture
      )
  $$,
  $$VALUES ('evidence-driven-preparation-policy-v4'::TEXT)$$,
  'the replacement persists the current preparation policy version'
);

SELECT * FROM finish();
ROLLBACK;
