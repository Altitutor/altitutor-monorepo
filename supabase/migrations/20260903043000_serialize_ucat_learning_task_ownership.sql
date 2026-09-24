-- Reconciliation reads a generated task before claiming the durable learning
-- progress row. A concurrent plan replacement can supersede that task between
-- those operations, so claim ownership inside the same profile lock used by
-- generation replacement and re-check the active task atomically.

CREATE FUNCTION public.claim_ucat_study_plan_learning_ownership(
  p_student_id UUID,
  p_progress_id UUID,
  p_study_plan_task_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM public.ucat_student_study_plan_profiles profile
  WHERE profile.student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ucat_student_learning_module_progress progress
  SET study_plan_task_id = p_study_plan_task_id
  WHERE progress.id = p_progress_id
    AND progress.student_id = p_student_id
    AND progress.study_plan_task_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.ucat_student_study_plan_tasks task
      JOIN public.ucat_student_study_plan_generations generation
        ON generation.id = task.generation_id
      WHERE task.id = p_study_plan_task_id
        AND task.student_id = p_student_id
        AND task.task_type = 'learn'
        AND generation.superseded_at IS NULL
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION
  public.claim_ucat_study_plan_learning_ownership(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.claim_ucat_study_plan_learning_ownership(UUID, UUID, UUID)
  TO service_role;

COMMENT ON FUNCTION
  public.claim_ucat_study_plan_learning_ownership(UUID, UUID, UUID) IS
  'Claims an unowned learning-progress row for an active Study-plan task while serialized with generation replacement.';
