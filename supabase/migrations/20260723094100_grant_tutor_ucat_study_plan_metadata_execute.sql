-- Migration: grant_tutor_ucat_study_plan_metadata_execute
-- Why: authenticated tutors were missing EXECUTE on study-plan metadata RPC
-- (create/update learning module returns permission denied).

GRANT EXECUTE ON FUNCTION public.tutor_ucat_update_learning_module_study_plan_metadata(
  UUID,
  TEXT,
  UUID[],
  UUID[]
) TO authenticated;
