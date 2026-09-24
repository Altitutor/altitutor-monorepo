BEGIN;
SET LOCAL TIME ZONE 'Australia/Adelaide';
SELECT plan(7);

DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id = '10000000-0000-0000-0000-000000000003';

INSERT INTO public.ucat_student_study_plan_generations (
  id, student_id, profile_id, reason, planning_date, starts_on, ends_on
)
SELECT
  'ed000000-0000-4000-8000-000000000001', profile.student_id, profile.id,
  'weekly', current_date, current_date, current_date + 21
FROM public.ucat_student_study_plan_profiles profile
WHERE profile.student_id = '10000000-0000-0000-0000-000000000003';

INSERT INTO public.ucat_student_study_plan_tasks (
  id, generation_id, student_id, scheduled_date, sort_order, task_type,
  status, title, estimated_minutes, section_id, target_units
)
SELECT
  'ed000000-0000-4000-8000-000000000002',
  'ed000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  current_date, 0, 'practice', 'planned', 'Linked practice', 15, section.id, 10
FROM public.ucat_sections section
ORDER BY section.section_number
LIMIT 1;

INSERT INTO public.student_practice_sessions (
  id, student_id, ucat_section_id, section_key, filters_snapshot,
  unlimited, study_plan_task_id
)
SELECT
  'ed000000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  task.section_id,
  section.section_number::TEXT,
  jsonb_build_object('studyPlanTaskId', task.id),
  false,
  task.id
FROM public.ucat_student_study_plan_tasks task
JOIN public.ucat_sections section ON section.id = task.section_id
WHERE task.id = 'ed000000-0000-4000-8000-000000000002';

SELECT is(
  (SELECT status FROM public.ucat_student_study_plan_tasks
   WHERE id = 'ed000000-0000-4000-8000-000000000002'),
  'in_progress',
  'creating a linked resumable attempt activates the task'
);

SELECT ok(
  public.discard_ucat_exam_attempt(
    '10000000-0000-0000-0000-000000000003',
    'practice',
    'ed000000-0000-4000-8000-000000000003'
  ),
  'an activity can discard its linked attempt'
);

SELECT is(
  (SELECT status FROM public.ucat_student_study_plan_tasks
   WHERE id = 'ed000000-0000-4000-8000-000000000002'),
  'planned',
  'discarding inside an activity resets its task to unattempted'
);

UPDATE public.student_practice_sessions
SET discarded_at = NULL
WHERE id = 'ed000000-0000-4000-8000-000000000003';
UPDATE public.ucat_student_study_plan_tasks
SET status = 'in_progress', started_at = now()
WHERE id = 'ed000000-0000-4000-8000-000000000002';

SELECT ok(
  public.discard_ucat_study_plan_task(
    '10000000-0000-0000-0000-000000000003',
    'ed000000-0000-4000-8000-000000000002'
  ),
  'Study plan Discard closes the linked attempt and skips the task'
);

SELECT isnt(
  (SELECT discarded_at FROM public.student_practice_sessions
   WHERE id = 'ed000000-0000-4000-8000-000000000003'),
  NULL::TIMESTAMPTZ,
  'Study plan Discard terminates the resumable attempt'
);

SELECT is(
  (SELECT status FROM public.ucat_student_study_plan_tasks
   WHERE id = 'ed000000-0000-4000-8000-000000000002'),
  'skipped',
  'Study plan Discard leaves the task skipped'
);

SELECT is(
  (SELECT skipped_reason FROM public.ucat_student_study_plan_tasks
   WHERE id = 'ed000000-0000-4000-8000-000000000002'),
  'manual',
  'Study plan Discard records a manual skip'
);

SELECT * FROM finish();
ROLLBACK;
