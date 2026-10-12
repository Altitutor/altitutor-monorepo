CREATE OR REPLACE FUNCTION public.start_ucat_learning_module(
  p_student_id UUID,
  p_learning_module_id UUID,
  p_study_plan_task_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_rejection JSONB;
  v_created BOOLEAN := FALSE;
  v_completed_revisit BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_learning_modules module
    WHERE module.id = p_learning_module_id
      AND module.kind = 'lesson'
      AND module.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Reopening the exact completed task reads its existing progress; it must
  -- not reactivate a task, consume another quota unit, or transfer ownership.
  SELECT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_tasks task
    JOIN public.ucat_student_study_plan_generations generation
      ON generation.id = task.generation_id
    JOIN public.ucat_student_learning_module_progress progress
      ON progress.study_plan_task_id = task.id
      AND progress.student_id = task.student_id
      AND progress.learning_module_id = task.learning_module_id
    WHERE task.id = p_study_plan_task_id
      AND task.student_id = p_student_id
      AND task.task_type = 'learn'
      AND task.learning_module_id = p_learning_module_id
      AND task.status = 'completed'
      AND generation.superseded_at IS NULL
      AND progress.completion_percent = 100
      AND progress.completed_at IS NOT NULL
  ) INTO v_completed_revisit;

  IF p_study_plan_task_id IS NOT NULL AND NOT v_completed_revisit
     AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_tasks task
    JOIN public.ucat_student_study_plan_generations generation
      ON generation.id = task.generation_id
    WHERE task.id = p_study_plan_task_id
      AND task.student_id = p_student_id
      AND task.task_type = 'learn'
      AND task.learning_module_id = p_learning_module_id
      AND task.status NOT IN ('completed', 'skipped')
      AND generation.superseded_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid_study_plan_learning_task';
  END IF;

  IF p_study_plan_task_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.ucat_student_learning_module_progress progress
    JOIN public.ucat_student_study_plan_tasks owner
      ON owner.id = progress.study_plan_task_id
    WHERE progress.student_id = p_student_id
      AND progress.learning_module_id = p_learning_module_id
      AND progress.study_plan_task_id <> p_study_plan_task_id
      AND owner.status NOT IN ('completed', 'skipped')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'invalid_study_plan_learning_task';
  END IF;

  v_rejection := public.ucat_quota_rejection_for_start(
    p_student_id,
    'learn',
    p_learning_module_id
  );
  IF v_rejection IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'quota', v_rejection
    );
  END IF;

  IF v_completed_revisit THEN
    RETURN jsonb_build_object('status', 'started', 'created', FALSE);
  END IF;

  INSERT INTO public.ucat_student_learning_module_progress (
    student_id,
    learning_module_id,
    completion_percent,
    study_plan_task_id
  ) VALUES (
    p_student_id,
    p_learning_module_id,
    0,
    p_study_plan_task_id
  )
  ON CONFLICT (student_id, learning_module_id) DO UPDATE
  SET study_plan_task_id = CASE
    WHEN excluded.study_plan_task_id IS NOT NULL
      THEN excluded.study_plan_task_id
    ELSE public.ucat_student_learning_module_progress.study_plan_task_id
  END
  RETURNING (xmax = 0) INTO v_created;

  RETURN jsonb_build_object('status', 'started', 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION
  public.start_ucat_learning_module(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.start_ucat_learning_module(UUID, UUID, UUID)
  TO service_role;

