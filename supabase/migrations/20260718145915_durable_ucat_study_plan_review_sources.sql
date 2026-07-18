-- Review tasks are dependants of a concrete attempt task. Date/sort coordinates
-- are presentation details and are not stable across replans or extra study.
ALTER TABLE public.ucat_student_study_plan_tasks
  ADD COLUMN source_task_id UUID;

ALTER TABLE public.ucat_student_study_plan_tasks
  ADD CONSTRAINT ucat_student_study_plan_tasks_source_task_id_fkey
  FOREIGN KEY (source_task_id)
  REFERENCES public.ucat_student_study_plan_tasks(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT ucat_student_study_plan_tasks_source_shape_check CHECK (
    task_type = 'review' OR source_task_id IS NULL
  ),
  ADD CONSTRAINT ucat_student_study_plan_tasks_source_not_self_check CHECK (
    source_task_id IS NULL OR source_task_id <> id
  );

-- Backfill only active plans. When old positional metadata collides with a
-- completed preserved task, the concrete completed task is the useful source:
-- repair the review's label and launch target to match it. For incomplete work,
-- require the review metadata to still describe the same task.
WITH candidates AS (
  SELECT
    review.id AS review_id,
    source.id AS source_id,
    source.title AS source_title,
    source.section_id,
    source.question_stem_category_id,
    source.question_tag_id,
    source.question_set_id,
    source.mock_id,
    source.matched_activity_type,
    source.matched_activity_id,
    source.completed_units
  FROM public.ucat_student_study_plan_tasks AS review
  JOIN public.ucat_student_study_plan_generations AS generation
    ON generation.id = review.generation_id
   AND generation.superseded_at IS NULL
  JOIN public.ucat_student_study_plan_tasks AS source
    ON source.generation_id = review.generation_id
   AND source.student_id = review.student_id
   AND source.scheduled_date = review.launch_config->>'sourceTaskScheduledDate'
   AND source.sort_order = (review.launch_config->>'sourceTaskSortOrder')::INTEGER
   AND source.task_type IN ('practice', 'section_benchmark', 'mock')
  WHERE review.task_type = 'review'
    AND review.source_task_id IS NULL
    AND jsonb_typeof(review.launch_config->'sourceTaskScheduledDate') = 'string'
    AND jsonb_typeof(review.launch_config->'sourceTaskSortOrder') = 'number'
    AND (
      source.matched_activity_id IS NOT NULL
      OR (
        review.section_id IS NOT DISTINCT FROM source.section_id
        AND review.question_stem_category_id IS NOT DISTINCT FROM source.question_stem_category_id
        AND review.question_tag_id IS NOT DISTINCT FROM source.question_tag_id
        AND review.question_set_id IS NOT DISTINCT FROM source.question_set_id
        AND review.mock_id IS NOT DISTINCT FROM source.mock_id
      )
    )
)
UPDATE public.ucat_student_study_plan_tasks AS review
SET source_task_id = candidate.source_id,
    title = 'Review · ' || candidate.source_title,
    section_id = candidate.section_id,
    question_stem_category_id = candidate.question_stem_category_id,
    question_tag_id = candidate.question_tag_id,
    question_set_id = candidate.question_set_id,
    mock_id = candidate.mock_id,
    matched_activity_type = candidate.matched_activity_type,
    matched_activity_id = candidate.matched_activity_id,
    launch_path = CASE candidate.matched_activity_type
      WHEN 'mock_attempt' THEN '/progress/mock-attempts/' || candidate.matched_activity_id::TEXT
      WHEN 'practice_session' THEN '/progress/practice-sessions/' || candidate.matched_activity_id::TEXT
      ELSE review.launch_path
    END,
    launch_config = (
      review.launch_config
      - 'sourceTaskScheduledDate'
      - 'sourceTaskSortOrder'
    ) || CASE
      WHEN candidate.matched_activity_id IS NOT NULL THEN jsonb_build_object(
        'awaitingAttempt', FALSE,
        'sourceActivityType', candidate.matched_activity_type,
        'sourceActivityId', candidate.matched_activity_id
      )
      ELSE jsonb_build_object('awaitingAttempt', TRUE)
    END,
    estimated_minutes = CASE
      WHEN candidate.matched_activity_type = 'practice_session'
        AND candidate.completed_units > 0
      THEN GREATEST(3, LEAST(20, CEIL(candidate.completed_units::NUMERIC / 6)::INTEGER))
      ELSE review.estimated_minutes
    END
FROM candidates AS candidate
WHERE review.id = candidate.review_id;

-- Remove duplicate dependants before enforcing one review per source.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source_task_id
      ORDER BY (matched_activity_id IS NOT NULL) DESC, scheduled_date, sort_order, id
    ) AS duplicate_rank
  FROM public.ucat_student_study_plan_tasks
  WHERE source_task_id IS NOT NULL
)
DELETE FROM public.ucat_student_study_plan_tasks AS review
USING ranked
WHERE review.id = ranked.id
  AND ranked.duplicate_rank > 1;

-- Active legacy reviews with no real source can never become actionable.
DELETE FROM public.ucat_student_study_plan_tasks AS review
USING public.ucat_student_study_plan_generations AS generation
WHERE generation.id = review.generation_id
  AND generation.superseded_at IS NULL
  AND review.task_type = 'review'
  AND review.source_task_id IS NULL;

CREATE UNIQUE INDEX idx_ucat_student_study_plan_tasks_one_review_per_source
  ON public.ucat_student_study_plan_tasks (source_task_id)
  WHERE source_task_id IS NOT NULL;

CREATE INDEX idx_ucat_student_study_plan_tasks_source
  ON public.ucat_student_study_plan_tasks (source_task_id)
  WHERE source_task_id IS NOT NULL;

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
    -- Preserve completed/current work first.
    UPDATE public.ucat_student_study_plan_tasks
    SET generation_id = v_generation_id
    WHERE generation_id = v_old_generation.id
      AND scheduled_date <= p_preserve_through;

    -- Preserve the dependency closure: a review follows its preserved source
    -- even when the review is scheduled after the preservation boundary.
    UPDATE public.ucat_student_study_plan_tasks AS review
    SET generation_id = v_generation_id
    WHERE review.generation_id = v_old_generation.id
      AND review.source_task_id IN (
        SELECT source.id
        FROM public.ucat_student_study_plan_tasks AS source
        WHERE source.generation_id = v_generation_id
      );

    -- Put carried future reviews first and reserve their positions before the
    -- regenerated future plan is inserted.
    UPDATE public.ucat_student_study_plan_tasks
    SET sort_order = sort_order + 1000000
    WHERE generation_id = v_generation_id
      AND task_type = 'review'
      AND scheduled_date > p_preserve_through
      AND source_task_id IS NOT NULL;

    WITH ranked_reviews AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY scheduled_date
          ORDER BY sort_order, id
        ) - 1 AS next_sort_order
      FROM public.ucat_student_study_plan_tasks
      WHERE generation_id = v_generation_id
        AND task_type = 'review'
        AND scheduled_date > p_preserve_through
        AND source_task_id IS NOT NULL
    )
    UPDATE public.ucat_student_study_plan_tasks AS review
    SET sort_order = ranked.next_sort_order
    FROM ranked_reviews AS ranked
    WHERE review.id = ranked.id;
  END IF;

  INSERT INTO public.ucat_student_study_plan_tasks (
    id, generation_id, student_id, scheduled_date, sort_order, task_type,
    title, description, rationale, estimated_minutes, target_units, section_id,
    question_stem_category_id, question_tag_id, learning_module_id,
    question_set_id, mock_id, skill_trainer_id, launch_path, launch_config,
    source_task_id
  )
  SELECT
    task.id, v_generation_id, p_student_id, task.scheduled_date,
    task.sort_order + COALESCE(carried_review.count, 0), task.task_type,
    task.title, task.description, task.rationale, task.estimated_minutes,
    task.target_units, task.section_id, task.question_stem_category_id,
    task.question_tag_id, task.learning_module_id, task.question_set_id,
    task.mock_id, task.skill_trainer_id, task.launch_path,
    COALESCE(task.launch_config, '{}'::JSONB), task.source_task_id
  FROM jsonb_to_recordset(COALESCE(p_tasks, '[]'::JSONB)) AS task(
    id UUID,
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
    launch_config JSONB,
    source_task_id UUID
  )
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS count
    FROM public.ucat_student_study_plan_tasks AS preserved_review
    WHERE preserved_review.generation_id = v_generation_id
      AND preserved_review.task_type = 'review'
      AND preserved_review.source_task_id IS NOT NULL
      AND preserved_review.scheduled_date = task.scheduled_date
      AND (
        p_preserve_through IS NULL
        OR preserved_review.scheduled_date > p_preserve_through
      )
  ) AS carried_review ON TRUE;

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
