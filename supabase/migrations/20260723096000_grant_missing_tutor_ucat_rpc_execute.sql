-- Migration: grant_missing_tutor_ucat_rpc_execute
-- Why: several tutor_ucat_* RPCs were created with GRANT TO authenticated, but
-- prod/dev ACLs only retained postgres/service_role. Tutors then hit
-- "permission denied for function ..." on create module / generate stems /
-- content lifecycle actions.

GRANT EXECUTE ON FUNCTION public.tutor_ucat_update_learning_module_study_plan_metadata(
  UUID,
  TEXT,
  UUID[],
  UUID[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_sample_question_stem_ids(
  UUID,
  INTEGER,
  UUID,
  BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_access(
  TEXT,
  UUID,
  public.ucat_access_scope
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_status(
  TEXT,
  UUID,
  public.ucat_content_status
) TO authenticated;
