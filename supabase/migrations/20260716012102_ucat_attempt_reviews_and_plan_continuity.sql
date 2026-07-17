-- Durable review progress for every UCAT attempt. Study-plan scheduling remains
-- opt-in: only attempts launched by the plan receive a companion review task.
CREATE TABLE public.student_ucat_attempt_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN (
    'practice_session',
    'set_attempt',
    'mock_attempt'
  )),
  attempt_id UUID NOT NULL,
  required_question_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  viewed_question_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completion_method TEXT CHECK (completion_method IN ('automatic', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attempt_type, attempt_id),
  CONSTRAINT student_ucat_attempt_reviews_completion_consistent CHECK (
    (completed_at IS NULL AND completion_method IS NULL)
    OR (completed_at IS NOT NULL AND completion_method IS NOT NULL)
  )
);

CREATE INDEX idx_student_ucat_attempt_reviews_student
  ON public.student_ucat_attempt_reviews (student_id, updated_at DESC);
CREATE INDEX idx_student_ucat_attempt_reviews_incomplete
  ON public.student_ucat_attempt_reviews (student_id, started_at)
  WHERE completed_at IS NULL;

CREATE TRIGGER update_student_ucat_attempt_reviews_updated_at
  BEFORE UPDATE ON public.student_ucat_attempt_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.student_ucat_attempt_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own UCAT attempt reviews"
  ON public.student_ucat_attempt_reviews
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));
CREATE POLICY "Students start own UCAT attempt reviews"
  ON public.student_ucat_attempt_reviews
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT public.current_student_id()));
CREATE POLICY "Students update own UCAT attempt reviews"
  ON public.student_ucat_attempt_reviews
  FOR UPDATE TO authenticated
  USING (student_id = (SELECT public.current_student_id()))
  WITH CHECK (student_id = (SELECT public.current_student_id()));

GRANT SELECT, INSERT, UPDATE ON public.student_ucat_attempt_reviews TO authenticated;

COMMENT ON TABLE public.student_ucat_attempt_reviews IS
  'Durable per-attempt review state. Required questions are incorrect, partial, or unanswered; students may finish automatically by viewing them all or manually after a lighter review.';

-- Replace the active future plan atomically while carrying every task through
-- the preservation boundary into the new active generation. This keeps task
-- ids, completion, and matched attempts stable when settings change.
CREATE OR REPLACE FUNCTION public.replace_ucat_study_plan_generation(
  p_student_id UUID,
  p_profile_id UUID,
  p_reason TEXT,
  p_planning_date DATE,
  p_starts_on DATE,
  p_ends_on DATE,
  p_input_snapshot JSONB,
  p_projection_snapshot JSONB,
  p_capacity_risk JSONB,
  p_tasks JSONB,
  p_next_weekly_replan_on DATE,
  p_setup_completed_at TIMESTAMPTZ,
  p_preserve_through DATE DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_old_generation public.ucat_student_study_plan_generations%ROWTYPE;
  v_generation_id UUID := gen_random_uuid();
  v_generated_at TIMESTAMPTZ := clock_timestamp();
  v_starts_on DATE := p_starts_on;
BEGIN
  PERFORM 1
  FROM public.ucat_student_study_plan_profiles
  WHERE id = p_profile_id AND student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Study plan profile does not belong to student';
  END IF;

  SELECT * INTO v_old_generation
  FROM public.ucat_student_study_plan_generations
  WHERE student_id = p_student_id AND superseded_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    v_starts_on := LEAST(v_old_generation.starts_on, p_starts_on);
    UPDATE public.ucat_student_study_plan_generations
    SET superseded_at = v_generated_at
    WHERE id = v_old_generation.id;
  END IF;

  INSERT INTO public.ucat_student_study_plan_generations (
    id, student_id, profile_id, reason, planning_date, starts_on, ends_on,
    input_snapshot, projection_snapshot, capacity_risk, generated_at
  ) VALUES (
    v_generation_id, p_student_id, p_profile_id, p_reason, p_planning_date,
    v_starts_on, p_ends_on, COALESCE(p_input_snapshot, '{}'::JSONB),
    COALESCE(p_projection_snapshot, '{}'::JSONB), p_capacity_risk,
    v_generated_at
  );

  IF v_old_generation.id IS NOT NULL AND p_preserve_through IS NOT NULL THEN
    UPDATE public.ucat_student_study_plan_tasks
    SET generation_id = v_generation_id
    WHERE generation_id = v_old_generation.id
      AND scheduled_date <= p_preserve_through;
  END IF;

  INSERT INTO public.ucat_student_study_plan_tasks (
    generation_id, student_id, scheduled_date, sort_order, task_type, title,
    description, rationale, estimated_minutes, target_units, section_id,
    question_stem_category_id, question_tag_id, learning_module_id,
    question_set_id, mock_id, skill_trainer_id, launch_path, launch_config
  )
  SELECT
    v_generation_id, p_student_id, task.scheduled_date, task.sort_order,
    task.task_type, task.title, task.description, task.rationale,
    task.estimated_minutes, task.target_units, task.section_id,
    task.question_stem_category_id, task.question_tag_id,
    task.learning_module_id, task.question_set_id, task.mock_id,
    task.skill_trainer_id, task.launch_path, COALESCE(task.launch_config, '{}'::JSONB)
  FROM jsonb_to_recordset(COALESCE(p_tasks, '[]'::JSONB)) AS task(
    scheduled_date DATE,
    sort_order INTEGER,
    task_type TEXT,
    title TEXT,
    description TEXT,
    rationale TEXT,
    estimated_minutes INTEGER,
    target_units INTEGER,
    section_id UUID,
    question_stem_category_id UUID,
    question_tag_id UUID,
    learning_module_id UUID,
    question_set_id UUID,
    mock_id UUID,
    skill_trainer_id UUID,
    launch_path TEXT,
    launch_config JSONB
  )
  WHERE p_preserve_through IS NULL OR task.scheduled_date > p_preserve_through;

  UPDATE public.ucat_student_study_plan_profiles
  SET last_generated_at = v_generated_at,
      next_weekly_replan_on = p_next_weekly_replan_on,
      setup_completed_at = COALESCE(setup_completed_at, p_setup_completed_at)
  WHERE id = p_profile_id;

  RETURN v_generation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_ucat_study_plan_generation(
  UUID, UUID, TEXT, DATE, DATE, DATE, JSONB, JSONB, JSONB, JSONB, DATE,
  TIMESTAMPTZ, DATE
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_ucat_study_plan_generation(
  UUID, UUID, TEXT, DATE, DATE, DATE, JSONB, JSONB, JSONB, JSONB, DATE,
  TIMESTAMPTZ, DATE
) TO service_role;
