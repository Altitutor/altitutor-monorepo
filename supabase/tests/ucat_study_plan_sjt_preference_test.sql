BEGIN;

SELECT plan(5);

SELECT has_column(
  'public',
  'ucat_student_study_plan_profiles',
  'sjt_preference',
  'standalone SJT allocation is durable'
);

SELECT has_column(
  'public',
  'vstudent_ucat_study_plan_profiles',
  'sjt_preference',
  'Students read their SJT preference through the role facade'
);

SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ucat_student_study_plan_profiles'
      AND column_name = 'sjt_preference'
  ),
  '''a_little''::text',
  'SJT allocation defaults to a little'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ucat_student_study_plan_profiles'::regclass
      AND conname = 'ucat_student_study_plan_profiles_sjt_preference_check'
  ),
  'SJT preference has a database check constraint'
);

SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_study_plan_profiles'::regclass, true),
  'current_student_id',
  'the Student profile facade remains scoped to the current Student'
);

SELECT * FROM finish();
ROLLBACK;
