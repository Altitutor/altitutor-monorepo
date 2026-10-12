BEGIN;
SELECT plan(21);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL TIME ZONE 'Australia/Adelaide';


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


SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001');
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000002')$$, '22023', 'invalid_study_plan_learning_task', 'another active task cannot steal existing learning ownership');
UPDATE public.ucat_student_learning_module_progress SET completion_percent=100, completed_at=now() WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
UPDATE public.ucat_student_study_plan_tasks SET status='completed', completed_at=now() WHERE id='ec000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE original_completed_progress AS SELECT to_jsonb(progress) AS snapshot FROM public.ucat_student_learning_module_progress progress WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
CREATE TEMP TABLE original_completed_task AS SELECT to_jsonb(task) AS snapshot FROM public.ucat_student_study_plan_tasks task WHERE id='ec000000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, 'refreshing the exact completed lesson task succeeds');
GRANT SELECT ON chosen_lesson TO service_role;
SET LOCAL ROLE service_role;
SELECT is(public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001'), '{"status":"started","created":false}'::jsonb, 'the actual service role can revisit completed owned progress');
RESET ROLE;
SELECT is(public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001'), '{"status":"started","created":false}'::jsonb, 'completed revisit returns the existing-start contract without creation');
SELECT is((SELECT to_jsonb(progress) FROM public.ucat_student_learning_module_progress progress WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson)), (SELECT snapshot FROM original_completed_progress), 'completed revisit leaves every progress field unchanged');
SELECT is((SELECT to_jsonb(task) FROM public.ucat_student_study_plan_tasks task WHERE id='ec000000-0000-4000-8000-000000000001'), (SELECT snapshot FROM original_completed_task), 'completed revisit does not reactivate or change its task');
UPDATE public.students SET ucat_online_tier_override='force_free' WHERE id='10000000-0000-0000-0000-000000000002';
UPDATE public.ucat_subscription_config SET free_learn_limit=0;
SELECT is(public.get_student_ucat_online_tier('10000000-0000-0000-0000-000000000002'), 'free', 'the server auth context resolves the fixture tier explicitly');
SELECT ok(NOT public.is_ucat_online_quota_exempt('10000000-0000-0000-0000-000000000002'), 'the quota regression uses a genuine Free student');
SELECT ok(public.ucat_quota_rejection_for_start('10000000-0000-0000-0000-000000000002', 'learn', (SELECT id FROM public.ucat_learning_modules WHERE kind='lesson' AND deleted_at IS NULL AND id<>(SELECT id FROM chosen_lesson) AND NOT public.student_has_in_person_ucat_session_resource('10000000-0000-0000-0000-000000000002', 'learning_module', id) ORDER BY id LIMIT 1)) IS NOT NULL, 'zero quota still blocks a never-opened lesson');
SELECT is(public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')->>'status', 'started', 'completed revisit uses existing Learn allowance even at zero new-lesson quota');
UPDATE public.ucat_student_study_plan_tasks SET task_type='practice' WHERE id='ec000000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'a different task type cannot use completed review');
UPDATE public.ucat_student_study_plan_tasks SET task_type='learn' WHERE id='ec000000-0000-4000-8000-000000000001';
UPDATE public.ucat_student_study_plan_tasks SET status='skipped' WHERE id='ec000000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'skipped tasks remain rejected even with completed progress');
UPDATE public.ucat_student_study_plan_tasks SET status='completed' WHERE id='ec000000-0000-4000-8000-000000000001';
UPDATE public.ucat_student_learning_module_progress SET completion_percent=50 WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'unfinished progress cannot use completed review');
UPDATE public.ucat_student_learning_module_progress SET completion_percent=100, completed_at=NULL WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'a completion percentage alone is insufficient');
UPDATE public.ucat_student_learning_module_progress SET completed_at=now(), study_plan_task_id=NULL WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'completed independent progress cannot claim a completed task');
UPDATE public.ucat_student_learning_module_progress SET study_plan_task_id='ec000000-0000-4000-8000-000000000001' WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
UPDATE public.ucat_student_study_plan_generations SET superseded_at=now() WHERE id='eb000000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'superseded generations remain rejected');
UPDATE public.ucat_student_study_plan_generations SET superseded_at=NULL WHERE id='eb000000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000001', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'another student cannot use the completed task');
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM public.ucat_learning_modules WHERE kind='lesson' AND deleted_at IS NULL AND id<>(SELECT id FROM chosen_lesson) ORDER BY id LIMIT 1), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'another lesson cannot use the completed task');
DELETE FROM public.ucat_student_learning_module_progress WHERE student_id='10000000-0000-0000-0000-000000000002' AND learning_module_id=(SELECT id FROM chosen_lesson);
SELECT throws_ok($$SELECT public.start_ucat_learning_module('10000000-0000-0000-0000-000000000002', (SELECT id FROM chosen_lesson), 'ec000000-0000-4000-8000-000000000001')$$, '22023', 'invalid_study_plan_learning_task', 'a completed task without durable completed progress remains rejected');
SELECT ok(NOT has_function_privilege('authenticated', 'public.start_ucat_learning_module(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated browser role cannot call the admin RPC directly');
SELECT ok(has_function_privilege('service_role', 'public.start_ucat_learning_module(uuid,uuid,uuid)', 'EXECUTE'), 'service-role permission is preserved');
SELECT * FROM finish();
ROLLBACK;
