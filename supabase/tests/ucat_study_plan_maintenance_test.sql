BEGIN;
SELECT plan(15);

DELETE FROM public.ucat_student_preparation_refresh_requests
WHERE student_id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

UPDATE public.ucat_student_study_plan_profiles
SET study_plan_enabled = TRUE,
    setup_completed_at = clock_timestamp(),
    test_year = extract(year FROM current_date + 21)::INTEGER,
    test_date = current_date + 21,
    last_authenticated_visit_at = clock_timestamp(),
    next_weekly_replan_on = current_date - 1,
    next_maintenance_at = clock_timestamp() - interval '1 minute',
    last_missed_work_replan_on = NULL
WHERE student_id = '10000000-0000-0000-0000-000000000001';

SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  1,
  'a recently engaged eligible Student receives due maintenance'
);
SELECT ok(
  (
    SELECT requested_reasons @> ARRAY['scheduled_rebalance']
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000001'
  ),
  'due maintenance enters the durable queue'
);

DELETE FROM public.ucat_student_preparation_refresh_requests
WHERE student_id = '10000000-0000-0000-0000-000000000001';
UPDATE public.ucat_student_study_plan_profiles
SET last_authenticated_visit_at = clock_timestamp() - interval '15 days'
WHERE student_id = '10000000-0000-0000-0000-000000000001';
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  0,
  'scheduled maintenance pauses after fourteen days without a UCAT visit'
);

UPDATE public.ucat_student_study_plan_profiles
SET last_authenticated_visit_at = clock_timestamp(),
    test_year = extract(year FROM current_date - 1)::INTEGER,
    test_date = current_date - 1
WHERE student_id = '10000000-0000-0000-0000-000000000001';
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  0,
  'an exact test date ends scheduled maintenance after that date'
);

UPDATE public.ucat_student_study_plan_profiles
SET test_year = extract(year FROM current_date + 21)::INTEGER,
    test_date = current_date + 21
WHERE student_id = '10000000-0000-0000-0000-000000000001';
DELETE FROM public.student_online_product_relationships
WHERE student_id = '10000000-0000-0000-0000-000000000001'
  AND product = 'UCAT_WEB';
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  0,
  'a missing UCAT Online product relationship blocks maintenance'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.list_ucat_study_plan_maintenance_anomalies(100)
    WHERE student_id = '10000000-0000-0000-0000-000000000001'
  ),
  'a configured plan without its product relationship is reported as an anomaly'
);

INSERT INTO public.student_online_product_relationships (
  student_id, product, started_at
) VALUES (
  '10000000-0000-0000-0000-000000000001', 'UCAT_WEB', clock_timestamp()
);

UPDATE public.ucat_student_study_plan_profiles
SET test_year = extract(year FROM current_date)::INTEGER + 1,
    test_date = NULL,
    next_weekly_replan_on = current_date - 1,
    next_maintenance_at = clock_timestamp() - interval '1 minute'
WHERE student_id = '10000000-0000-0000-0000-000000000001';
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  1,
  'a year-only profile without a configured window remains eligible through that year'
);

UPDATE public.ucat_student_study_plan_profiles
SET last_authenticated_visit_at = clock_timestamp() - interval '15 days'
WHERE student_id = '10000000-0000-0000-0000-000000000001';

DELETE FROM public.ucat_student_preparation_refresh_requests
WHERE student_id = '10000000-0000-0000-0000-000000000002';
DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = '10000000-0000-0000-0000-000000000002';
UPDATE public.ucat_student_study_plan_profiles
SET study_plan_enabled = TRUE,
    setup_completed_at = clock_timestamp(),
    test_year = extract(year FROM current_date + 30)::INTEGER,
    test_date = current_date + 30,
    last_authenticated_visit_at = clock_timestamp(),
    next_weekly_replan_on = current_date + 7,
    last_missed_work_replan_on = NULL
WHERE student_id = '10000000-0000-0000-0000-000000000002';

INSERT INTO public.ucat_student_study_plan_generations (
  id, student_id, profile_id, reason, planning_date, starts_on, ends_on
) VALUES (
  'e1000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'f5000000-0000-4000-8000-000000000002',
  'weekly', current_date + 30, current_date, current_date + 21
);

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order, task_type,
  status, title, estimated_minutes, completed_units
) VALUES
  (
    'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    current_date - 1, 0, 'learn', 'planned', 'Missed active task', 15, 0
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    current_date + 2, 0, 'learn', 'planned', 'Disposable draft', 15, 0
  ),
  (
    'e2000000-0000-4000-8000-000000000003',
    'e1000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    current_date + 3, 0, 'learn', 'completed', 'Evidence task', 15, 1
  );
SELECT public.recompute_ucat_study_plan_maintenance_at(
  '10000000-0000-0000-0000-000000000002'
);
SELECT ok(
  (
    SELECT next_maintenance_at <= clock_timestamp()
    FROM public.ucat_student_study_plan_profiles
    WHERE student_id = '10000000-0000-0000-0000-000000000002'
  ),
  'the indexed watermark becomes due for missed active-generation work'
);
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  1,
  'missed work in the active generation queues a rebalance'
);

DELETE FROM public.ucat_student_preparation_refresh_requests
WHERE student_id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);
UPDATE public.ucat_student_study_plan_profiles AS profile
SET last_missed_work_replan_on = (
      clock_timestamp() AT TIME ZONE coalesce(
        nullif(student.timezone, ''),
        'Australia/Adelaide'
      )
    )::DATE,
    next_maintenance_at = clock_timestamp() - interval '1 minute'
FROM public.students AS student
WHERE profile.student_id = '10000000-0000-0000-0000-000000000002'
  AND student.id = profile.student_id;
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  0,
  'missed-work full regeneration is limited to once per Student-local day'
);

UPDATE public.ucat_student_study_plan_generations
SET superseded_at = clock_timestamp()
WHERE id = 'e1000000-0000-4000-8000-000000000001';
UPDATE public.ucat_student_study_plan_profiles
SET last_missed_work_replan_on = NULL,
    next_maintenance_at = clock_timestamp() - interval '1 minute'
WHERE student_id = '10000000-0000-0000-0000-000000000002';
SELECT is(
  public.enqueue_due_ucat_study_plan_rebalances(10),
  0,
  'overdue tasks in a superseded generation cannot trigger maintenance'
);

SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000003',
  'activity_completed'
);
UPDATE public.ucat_student_preparation_refresh_requests
SET dead_lettered_at = clock_timestamp(), attempt_count = 5
WHERE student_id = '10000000-0000-0000-0000-000000000003';
SELECT is(
  public.redrive_ucat_preparation_refresh(
    '10000000-0000-0000-0000-000000000003'
  ),
  TRUE,
  'service redrive revives a dead-lettered request'
);

UPDATE public.ucat_student_study_plan_generations
SET superseded_at = NULL
WHERE id = 'e1000000-0000-4000-8000-000000000001';

SELECT public.replace_ucat_study_plan_generation_for_refresh(
  '10000000-0000-0000-0000-000000000002',
  'f5000000-0000-4000-8000-000000000002',
  'weekly', current_date + 30, current_date, current_date + 21,
  '{}'::JSONB, '{}'::JSONB, NULL, '[]'::JSONB,
  current_date + 7, clock_timestamp(), current_date, 9001
);
SELECT public.replace_ucat_study_plan_generation_for_refresh(
  '10000000-0000-0000-0000-000000000002',
  'f5000000-0000-4000-8000-000000000002',
  'weekly', current_date + 30, current_date, current_date + 21,
  '{}'::JSONB, '{}'::JSONB, NULL, '[]'::JSONB,
  current_date + 7, clock_timestamp(), current_date, 9001
);
SELECT is(
  (
    SELECT count(*)::BIGINT
    FROM public.ucat_student_study_plan_generations
    WHERE student_id = '10000000-0000-0000-0000-000000000002'
      AND refresh_request_version = 9001
  ),
  1::BIGINT,
  'generation replacement is idempotent for one refresh version'
);
SELECT is(
  (
    SELECT count(*)::BIGINT
    FROM public.ucat_student_study_plan_tasks
    WHERE id = 'e2000000-0000-4000-8000-000000000002'
  ),
  0::BIGINT,
  'replacement prunes an evidence-free future draft from the superseded plan'
);
SELECT is(
  (
    SELECT count(*)::BIGINT
    FROM public.ucat_student_study_plan_tasks
    WHERE id = 'e2000000-0000-4000-8000-000000000003'
  ),
  1::BIGINT,
  'replacement preserves future task evidence from the superseded plan'
);

SELECT * FROM finish();
ROLLBACK;
