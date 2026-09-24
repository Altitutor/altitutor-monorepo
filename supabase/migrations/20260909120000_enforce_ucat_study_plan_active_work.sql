-- Make Study-plan in_progress mean that durable, resumable work exists.

ALTER TABLE public.student_practice_sessions
  ADD COLUMN study_plan_task_id UUID
  REFERENCES public.ucat_student_study_plan_tasks(id) ON DELETE SET NULL;
ALTER TABLE public.student_ucat_mock_attempts
  ADD COLUMN study_plan_task_id UUID
  REFERENCES public.ucat_student_study_plan_tasks(id) ON DELETE SET NULL;
ALTER TABLE public.student_skill_trainer_attempts
  ADD COLUMN study_plan_task_id UUID
  REFERENCES public.ucat_student_study_plan_tasks(id) ON DELETE SET NULL;

CREATE INDEX student_practice_sessions_study_plan_task_idx
  ON public.student_practice_sessions (study_plan_task_id)
  WHERE study_plan_task_id IS NOT NULL;
CREATE INDEX student_ucat_mock_attempts_study_plan_task_idx
  ON public.student_ucat_mock_attempts (study_plan_task_id)
  WHERE study_plan_task_id IS NOT NULL;
CREATE INDEX student_skill_trainer_attempts_study_plan_task_idx
  ON public.student_skill_trainer_attempts (study_plan_task_id)
  WHERE study_plan_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_ucat_exam_attempt_records(
  p_attempt_kind TEXT,
  p_student_id UUID,
  p_attempt_id UUID,
  p_resource_id UUID,
  p_engine_snapshot JSONB,
  p_current_segment_ends_at TIMESTAMPTZ,
  p_was_timed BOOLEAN,
  p_first_set_id UUID DEFAULT NULL,
  p_first_set_attempt_id UUID DEFAULT NULL,
  p_study_plan_task_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_rejection JSONB;
BEGIN
  IF p_attempt_kind NOT IN ('set', 'mock') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid exam attempt kind';
  END IF;
  v_rejection := public.ucat_quota_rejection_for_start(
    p_student_id,
    CASE p_attempt_kind WHEN 'set' THEN 'sets' ELSE 'mocks' END,
    p_resource_id
  );
  IF v_rejection IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUOTA_EXCEEDED:' || v_rejection::TEXT;
  END IF;
  IF p_attempt_kind = 'set' THEN
    INSERT INTO public.student_question_set_attempts (
      id, student_id, question_set_id, was_timed, engine_snapshot,
      current_segment_ends_at, last_activity_at, study_plan_task_id
    ) VALUES (
      p_attempt_id, p_student_id, p_resource_id, p_was_timed,
      p_engine_snapshot, p_current_segment_ends_at, now(), p_study_plan_task_id
    );
  ELSE
    INSERT INTO public.student_ucat_mock_attempts (
      id, student_id, ucat_mock_id, engine_snapshot,
      current_segment_ends_at, last_activity_at, was_timed, study_plan_task_id
    ) VALUES (
      p_attempt_id, p_student_id, p_resource_id, p_engine_snapshot,
      p_current_segment_ends_at, now(), p_was_timed, p_study_plan_task_id
    );
    IF p_first_set_id IS NOT NULL AND p_first_set_attempt_id IS NOT NULL THEN
      INSERT INTO public.student_question_set_attempts (
        id, student_id, question_set_id, student_ucat_mock_attempt_id, was_timed
      ) VALUES (
        p_first_set_attempt_id, p_student_id, p_first_set_id, p_attempt_id,
        p_was_timed
      );
    END IF;
  END IF;
END;
$$;

CREATE FUNCTION public.activate_ucat_study_plan_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.ucat_student_study_plan_tasks%ROWTYPE;
  v_activity_type TEXT;
BEGIN
  IF NEW.study_plan_task_id IS NULL THEN RETURN NEW; END IF;

  SELECT task.* INTO v_task
  FROM public.ucat_student_study_plan_tasks task
  JOIN public.ucat_student_study_plan_generations generation
    ON generation.id = task.generation_id
  WHERE task.id = NEW.study_plan_task_id
    AND task.student_id = NEW.student_id
    AND task.status NOT IN ('completed', 'skipped')
    AND generation.superseded_at IS NULL
  FOR UPDATE OF task;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_task';
  END IF;

  IF TG_TABLE_NAME = 'student_practice_sessions' THEN
    IF v_task.task_type <> 'practice'
       OR v_task.section_id IS DISTINCT FROM NEW.ucat_section_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_task';
    END IF;
    v_activity_type := 'practice_session';
  ELSIF TG_TABLE_NAME = 'student_question_set_attempts' THEN
    IF v_task.task_type <> 'section_benchmark'
       OR v_task.question_set_id IS DISTINCT FROM NEW.question_set_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_task';
    END IF;
    v_activity_type := 'set_attempt';
  ELSIF TG_TABLE_NAME = 'student_ucat_mock_attempts' THEN
    IF v_task.task_type <> 'mock'
       OR v_task.mock_id IS DISTINCT FROM NEW.ucat_mock_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_task';
    END IF;
    v_activity_type := 'mock_attempt';
  ELSIF TG_TABLE_NAME = 'student_skill_trainer_attempts' THEN
    IF v_task.task_type <> 'skill_trainer'
       OR v_task.skill_trainer_id IS DISTINCT FROM NEW.skill_trainer_id THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_task';
    END IF;
    -- A Skill Trainer run is deliberately not resumable. Keep its task
    -- unattempted while the live run exists; completion reconciliation is the
    -- only transition that consumes the task.
    RETURN NEW;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_attempt_table';
  END IF;

  UPDATE public.ucat_student_study_plan_tasks
  SET status = 'in_progress',
      started_at = coalesce(started_at, now()),
      skipped_at = NULL,
      skipped_reason = NULL,
      matched_activity_type = v_activity_type,
      matched_activity_id = NEW.id
  WHERE id = NEW.study_plan_task_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_ucat_study_plan_attempt()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER activate_ucat_study_plan_practice_attempt
AFTER INSERT OR UPDATE OF study_plan_task_id
ON public.student_practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.activate_ucat_study_plan_attempt();
CREATE TRIGGER activate_ucat_study_plan_set_attempt
AFTER INSERT OR UPDATE OF study_plan_task_id
ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.activate_ucat_study_plan_attempt();
CREATE TRIGGER activate_ucat_study_plan_mock_attempt
AFTER INSERT OR UPDATE OF study_plan_task_id
ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.activate_ucat_study_plan_attempt();
CREATE TRIGGER activate_ucat_study_plan_skill_attempt
AFTER INSERT OR UPDATE OF study_plan_task_id
ON public.student_skill_trainer_attempts
FOR EACH ROW EXECUTE FUNCTION public.activate_ucat_study_plan_attempt();

CREATE FUNCTION public.activate_ucat_study_plan_learning_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.study_plan_task_id IS NULL OR NEW.completion_percent >= 100 THEN
    RETURN NEW;
  END IF;
  UPDATE public.ucat_student_study_plan_tasks task
  SET status = 'in_progress',
      started_at = coalesce(task.started_at, now()),
      skipped_at = NULL,
      skipped_reason = NULL,
      matched_activity_type = 'learning_module',
      matched_activity_id = NEW.id
  FROM public.ucat_student_study_plan_generations generation
  WHERE task.id = NEW.study_plan_task_id
    AND task.student_id = NEW.student_id
    AND task.learning_module_id = NEW.learning_module_id
    AND task.task_type = 'learn'
    AND task.status NOT IN ('completed', 'skipped')
    AND generation.id = task.generation_id
    AND generation.superseded_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_study_plan_learning_task';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_ucat_study_plan_learning_progress()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER activate_ucat_study_plan_learning_progress
AFTER INSERT OR UPDATE OF study_plan_task_id
ON public.ucat_student_learning_module_progress
FOR EACH ROW EXECUTE FUNCTION public.activate_ucat_study_plan_learning_progress();

CREATE FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.discarded_at IS NULL AND NEW.discarded_at IS NOT NULL
     AND NEW.study_plan_task_id IS NOT NULL THEN
    UPDATE public.ucat_student_study_plan_tasks
    SET status = 'planned',
        completed_units = 0,
        started_at = NULL,
        completed_at = NULL,
        skipped_at = NULL,
        skipped_reason = NULL,
        matched_activity_type = NULL,
        matched_activity_id = NULL
    WHERE id = NEW.study_plan_task_id
      AND student_id = NEW.student_id
      AND status = 'in_progress';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER reset_ucat_study_plan_task_after_practice_discard
AFTER UPDATE OF discarded_at ON public.student_practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard();
CREATE TRIGGER reset_ucat_study_plan_task_after_set_discard
AFTER UPDATE OF discarded_at ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard();
CREATE TRIGGER reset_ucat_study_plan_task_after_mock_discard
AFTER UPDATE OF discarded_at ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard();
CREATE TRIGGER reset_ucat_study_plan_task_after_skill_discard
AFTER UPDATE OF discarded_at ON public.student_skill_trainer_attempts
FOR EACH ROW EXECUTE FUNCTION public.reset_ucat_study_plan_task_after_attempt_discard();

CREATE FUNCTION public.discard_ucat_study_plan_task(
  p_student_id UUID,
  p_task_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_task public.ucat_student_study_plan_tasks%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT task.* INTO v_task
  FROM public.ucat_student_study_plan_tasks task
  JOIN public.ucat_student_study_plan_generations generation
    ON generation.id = task.generation_id
  WHERE task.id = p_task_id
    AND task.student_id = p_student_id
    AND generation.superseded_at IS NULL
  FOR UPDATE OF task;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_task.status <> 'in_progress' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'study_plan_task_not_in_progress';
  END IF;

  UPDATE public.student_practice_sessions
  SET discarded_at = v_now, current_segment_ends_at = NULL,
      prefetched_stem_snapshot = NULL
  WHERE study_plan_task_id = p_task_id AND student_id = p_student_id
    AND completed_at IS NULL AND discarded_at IS NULL AND expired_at IS NULL;
  UPDATE public.student_question_set_attempts
  SET discarded_at = v_now, current_segment_ends_at = NULL
  WHERE study_plan_task_id = p_task_id AND student_id = p_student_id
    AND completed_at IS NULL AND discarded_at IS NULL AND expired_at IS NULL;
  UPDATE public.student_ucat_mock_attempts
  SET discarded_at = v_now, current_segment_ends_at = NULL
  WHERE study_plan_task_id = p_task_id AND student_id = p_student_id
    AND completed_at IS NULL AND discarded_at IS NULL AND expired_at IS NULL;
  UPDATE public.student_question_set_attempts child
  SET discarded_at = v_now, current_segment_ends_at = NULL
  FROM public.student_ucat_mock_attempts parent
  WHERE parent.study_plan_task_id = p_task_id
    AND child.student_ucat_mock_attempt_id = parent.id
    AND child.completed_at IS NULL AND child.discarded_at IS NULL
    AND child.expired_at IS NULL;
  UPDATE public.student_skill_trainer_attempts
  SET discarded_at = v_now
  WHERE study_plan_task_id = p_task_id AND student_id = p_student_id
    AND completed_at IS NULL AND discarded_at IS NULL;

  UPDATE public.ucat_student_study_plan_tasks
  SET status = 'skipped', skipped_at = v_now, skipped_reason = 'manual'
  WHERE id = p_task_id;
  UPDATE public.ucat_student_study_plan_tasks
  SET status = 'skipped', skipped_at = v_now, skipped_reason = 'manual'
  WHERE source_task_id = p_task_id AND status NOT IN ('completed', 'skipped');
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_ucat_study_plan_task(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discard_ucat_study_plan_task(UUID, UUID)
  TO service_role;

CREATE FUNCTION public.ucat_study_plan_task_has_active_work(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.ucat_student_learning_module_progress progress
      WHERE progress.study_plan_task_id = p_task_id
        AND progress.completion_percent < 100
    )
    OR EXISTS (
      SELECT 1 FROM public.student_practice_sessions attempt
      WHERE attempt.study_plan_task_id = p_task_id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.student_question_set_attempts attempt
      WHERE attempt.study_plan_task_id = p_task_id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.student_ucat_mock_attempts attempt
      WHERE attempt.study_plan_task_id = p_task_id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.ucat_study_plan_task_has_active_work(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rollover_ucat_study_plan_for_student(
  p_student_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
  v_today DATE;
  v_count INTEGER := 0;
BEGIN
  SELECT coalesce(nullif(student.timezone, ''), 'Australia/Adelaide')
  INTO v_timezone
  FROM public.students student
  WHERE student.id = p_student_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_today := (now() AT TIME ZONE v_timezone)::DATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_student_study_plan_generations generation
    JOIN public.ucat_student_study_plan_tasks task
      ON task.generation_id = generation.id
    WHERE generation.student_id = p_student_id
      AND generation.superseded_at IS NULL
      AND task.scheduled_date = v_today
      AND task.status IN ('planned', 'partial')
      AND NOT coalesce((task.launch_config ->> 'optional')::BOOLEAN, FALSE)
  ) THEN
    PERFORM public.recompute_ucat_study_plan_maintenance_at(p_student_id);
    RETURN 0;
  END IF;

  UPDATE public.ucat_student_study_plan_tasks task
  SET status = 'skipped',
      skipped_at = now(),
      skipped_reason = 'rollover'
  FROM public.ucat_student_study_plan_generations generation
  WHERE generation.id = task.generation_id
    AND generation.student_id = p_student_id
    AND generation.superseded_at IS NULL
    AND task.scheduled_date < v_today
    AND (
      task.status IN ('planned', 'partial')
      OR (
        task.status = 'in_progress'
        AND NOT public.ucat_study_plan_task_has_active_work(task.id)
      )
    )
    AND NOT coalesce((task.launch_config ->> 'optional')::BOOLEAN, FALSE);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.recompute_ucat_study_plan_maintenance_at(p_student_id);
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rollover_ucat_study_plan_for_student(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_ucat_study_plan_for_student(UUID)
  TO service_role;

-- Backfill links that were already recorded by reconciliation.
UPDATE public.student_practice_sessions attempt
SET study_plan_task_id = task.id
FROM public.ucat_student_study_plan_tasks task
WHERE task.status = 'in_progress'
  AND task.student_id = attempt.student_id
  AND task.section_id = attempt.ucat_section_id
  AND (
    (task.matched_activity_type = 'practice_session'
      AND task.matched_activity_id = attempt.id)
    OR attempt.filters_snapshot ->> 'studyPlanTaskId' = task.id::TEXT
  )
  AND attempt.discarded_at IS NULL AND attempt.completed_at IS NULL
  AND attempt.expired_at IS NULL;
UPDATE public.student_question_set_attempts attempt
SET study_plan_task_id = task.id
FROM public.ucat_student_study_plan_tasks task
WHERE task.status = 'in_progress'
  AND task.matched_activity_type = 'set_attempt'
  AND task.matched_activity_id = attempt.id
  AND attempt.discarded_at IS NULL AND attempt.completed_at IS NULL
  AND attempt.expired_at IS NULL;
UPDATE public.student_ucat_mock_attempts attempt
SET study_plan_task_id = task.id
FROM public.ucat_student_study_plan_tasks task
WHERE task.status = 'in_progress'
  AND task.student_id = attempt.student_id
  AND task.mock_id = attempt.ucat_mock_id
  AND (
    (task.matched_activity_type = 'mock_attempt'
      AND task.matched_activity_id = attempt.id)
    OR task.matched_activity_id IS NULL
  )
  AND attempt.discarded_at IS NULL AND attempt.completed_at IS NULL
  AND attempt.expired_at IS NULL;

-- Legacy Skill-trainer tasks were marked active before navigation and could
-- outlive a discarded, non-resumable run. Preserve a link to any live run for
-- audit/completion, but no Skill-trainer task may remain in_progress.
WITH candidates AS (
  SELECT DISTINCT ON (task.id) task.id AS task_id, attempt.id AS attempt_id
  FROM public.ucat_student_study_plan_tasks task
  JOIN public.student_skill_trainer_attempts attempt
    ON attempt.student_id = task.student_id
   AND attempt.skill_trainer_id = task.skill_trainer_id
   AND attempt.completed_at IS NULL
   AND attempt.discarded_at IS NULL
   AND attempt.ends_at > now()
  WHERE task.status = 'in_progress' AND task.task_type = 'skill_trainer'
  ORDER BY task.id, attempt.started_at DESC
)
UPDATE public.student_skill_trainer_attempts attempt
SET study_plan_task_id = candidates.task_id
FROM candidates
WHERE attempt.id = candidates.attempt_id;

-- Any remaining legacy in_progress row has no durable resumable work. Reset
-- today's work to unattempted and lapse older work immediately.
UPDATE public.ucat_student_study_plan_tasks task
SET status = CASE
      WHEN task.scheduled_date <
        (now() AT TIME ZONE coalesce(nullif(student.timezone, ''), 'Australia/Adelaide'))::DATE
        THEN 'skipped'
      ELSE 'planned'
    END,
    started_at = NULL,
    skipped_at = CASE
      WHEN task.scheduled_date <
        (now() AT TIME ZONE coalesce(nullif(student.timezone, ''), 'Australia/Adelaide'))::DATE
        THEN now()
      ELSE NULL
    END,
    skipped_reason = CASE
      WHEN task.scheduled_date <
        (now() AT TIME ZONE coalesce(nullif(student.timezone, ''), 'Australia/Adelaide'))::DATE
        THEN 'rollover'
      ELSE NULL
    END,
    matched_activity_type = NULL,
    matched_activity_id = NULL
FROM public.students student
WHERE task.student_id = student.id
  AND task.status = 'in_progress'
  AND NOT (
    (task.task_type = 'learn' AND EXISTS (
      SELECT 1 FROM public.ucat_student_learning_module_progress progress
      WHERE progress.study_plan_task_id = task.id
        AND progress.completion_percent < 100
    ))
    OR (task.task_type = 'practice' AND EXISTS (
      SELECT 1 FROM public.student_practice_sessions attempt
      WHERE attempt.study_plan_task_id = task.id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    ))
    OR (task.task_type = 'section_benchmark' AND EXISTS (
      SELECT 1 FROM public.student_question_set_attempts attempt
      WHERE attempt.study_plan_task_id = task.id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    ))
    OR (task.task_type = 'mock' AND EXISTS (
      SELECT 1 FROM public.student_ucat_mock_attempts attempt
      WHERE attempt.study_plan_task_id = task.id
        AND attempt.completed_at IS NULL AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    ))
  );

COMMENT ON FUNCTION public.discard_ucat_study_plan_task(UUID, UUID) IS
  'Atomically discards a task-linked active attempt and manually skips its Study-plan task.';
