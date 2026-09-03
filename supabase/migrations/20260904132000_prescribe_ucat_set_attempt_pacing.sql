-- A reusable set owns default timing; a student's Study plan may prescribe
-- different pace for one standalone attempt. Effective timing is immutable.

ALTER TABLE public.student_question_set_attempts
  ADD COLUMN effective_timing_mode public.ucat_question_set_timing_mode,
  ADD COLUMN effective_pace_multiplier NUMERIC,
  ADD COLUMN timing_source TEXT,
  ADD COLUMN study_plan_task_id UUID;

-- Older attempts predate explicit timing intent. Some untimed attempts retained
-- the Set's default time snapshot, while some timed attempts lack a recoverable
-- exam-speed ratio. Resolve only evidence that was actually persisted instead
-- of inventing timing metadata merely to satisfy the new invariant.
WITH timing_candidates AS (
  SELECT
    attempt.id,
    attempt.student_ucat_mock_attempt_id,
    attempt.was_timed,
    attempt.content_snapshot ->> 'timingMode' AS snapshot_mode,
    CASE
      WHEN attempt.set_time_limit_seconds > 0 THEN attempt.set_time_limit_seconds
      WHEN attempt.content_snapshot ->> 'timeLimitSeconds' ~ '^[1-9][0-9]*$'
        THEN (attempt.content_snapshot ->> 'timeLimitSeconds')::INTEGER
      WHEN attempt.set_time_limit_at_exam_speed_seconds > 0
           AND attempt.set_speed > 0
        THEN CEIL(attempt.set_time_limit_at_exam_speed_seconds / attempt.set_speed)::INTEGER
      WHEN attempt.student_ucat_mock_attempt_id IS NOT NULL
           AND attempt.set_time_limit_at_exam_speed_seconds > 0
        THEN CEIL(attempt.set_time_limit_at_exam_speed_seconds)::INTEGER
      ELSE NULL
    END AS resolved_time_limit_seconds,
    CASE
      WHEN attempt.student_ucat_mock_attempt_id IS NOT NULL THEN 1::NUMERIC
      WHEN attempt.set_speed > 0 THEN attempt.set_speed
      WHEN attempt.content_snapshot ->> 'paceMultiplier'
             ~ '^(0|[1-9][0-9]*)([.][0-9]+)?$'
           AND (attempt.content_snapshot ->> 'paceMultiplier')::NUMERIC > 0
        THEN (attempt.content_snapshot ->> 'paceMultiplier')::NUMERIC
      ELSE NULL
    END AS resolved_pace_multiplier
  FROM public.student_question_set_attempts attempt
), resolved_timing AS (
  SELECT
    candidate.*,
    CASE
      WHEN candidate.student_ucat_mock_attempt_id IS NOT NULL
           AND candidate.resolved_time_limit_seconds IS NOT NULL
        THEN 'pace'::public.ucat_question_set_timing_mode
      WHEN candidate.resolved_time_limit_seconds IS NULL
        THEN 'untimed'::public.ucat_question_set_timing_mode
      WHEN candidate.snapshot_mode = 'untimed'
        THEN 'untimed'::public.ucat_question_set_timing_mode
      WHEN candidate.snapshot_mode = 'fixed'
        THEN 'fixed'::public.ucat_question_set_timing_mode
      WHEN candidate.snapshot_mode = 'pace'
           AND candidate.resolved_pace_multiplier IS NOT NULL
        THEN 'pace'::public.ucat_question_set_timing_mode
      WHEN candidate.snapshot_mode = 'pace'
        THEN 'fixed'::public.ucat_question_set_timing_mode
      WHEN NOT candidate.was_timed
        THEN 'untimed'::public.ucat_question_set_timing_mode
      WHEN candidate.resolved_pace_multiplier IS NOT NULL
        THEN 'pace'::public.ucat_question_set_timing_mode
      ELSE 'fixed'::public.ucat_question_set_timing_mode
    END AS resolved_mode
  FROM timing_candidates candidate
)
UPDATE public.student_question_set_attempts attempt
SET
  effective_timing_mode = resolved.resolved_mode,
  effective_pace_multiplier = CASE
    WHEN resolved.resolved_mode = 'pace' THEN resolved.resolved_pace_multiplier
    ELSE NULL
  END,
  set_time_limit_seconds = CASE
    WHEN resolved.resolved_mode = 'untimed' THEN NULL
    ELSE resolved.resolved_time_limit_seconds
  END,
  timing_source = CASE
    WHEN resolved.student_ucat_mock_attempt_id IS NOT NULL THEN 'mock_blueprint'
    ELSE 'set_default'
  END
FROM resolved_timing resolved
WHERE resolved.id = attempt.id;

ALTER TABLE public.student_question_set_attempts
  ALTER COLUMN effective_timing_mode SET NOT NULL,
  ALTER COLUMN timing_source SET NOT NULL,
  ADD CONSTRAINT student_question_set_attempts_effective_timing_check CHECK (
    (effective_timing_mode = 'pace' AND effective_pace_multiplier > 0 AND set_time_limit_seconds > 0)
    OR (effective_timing_mode = 'fixed' AND effective_pace_multiplier IS NULL AND set_time_limit_seconds > 0)
    OR (effective_timing_mode = 'untimed' AND effective_pace_multiplier IS NULL AND set_time_limit_seconds IS NULL)
  ),
  ADD CONSTRAINT student_question_set_attempts_timing_source_check CHECK (
    timing_source IN ('set_default', 'study_plan', 'mock_blueprint')
  ),
  ADD CONSTRAINT student_question_set_attempts_study_plan_source_check CHECK (
    (timing_source = 'study_plan' AND study_plan_task_id IS NOT NULL AND student_ucat_mock_attempt_id IS NULL)
    OR (timing_source <> 'study_plan' AND study_plan_task_id IS NULL)
  );

COMMENT ON COLUMN public.student_question_set_attempts.effective_timing_mode IS
  'Immutable timing mode delivered for this attempt; may differ from the set default.';
COMMENT ON COLUMN public.student_question_set_attempts.effective_pace_multiplier IS
  'Immutable prescribed working pace for a paced attempt; 1 is exam pace and lower values allow more time.';
COMMENT ON COLUMN public.student_question_set_attempts.timing_source IS
  'Origin of effective timing: set_default, study_plan, or mock_blueprint.';
COMMENT ON COLUMN public.student_question_set_attempts.study_plan_task_id IS
  'Immutable originating Study plan task identifier. Deliberately not a foreign key because plan regeneration may remove the task.';

CREATE FUNCTION public.prevent_ucat_set_attempt_timing_rewrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.effective_timing_mode,
    NEW.effective_pace_multiplier,
    NEW.timing_source,
    NEW.study_plan_task_id,
    NEW.set_time_limit_seconds,
    NEW.set_time_limit_at_exam_speed_seconds,
    NEW.set_speed,
    NEW.was_timed
  ) IS DISTINCT FROM ROW(
    OLD.effective_timing_mode,
    OLD.effective_pace_multiplier,
    OLD.timing_source,
    OLD.study_plan_task_id,
    OLD.set_time_limit_seconds,
    OLD.set_time_limit_at_exam_speed_seconds,
    OLD.set_speed,
    OLD.was_timed
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Effective set attempt timing is immutable';
  END IF;

  IF OLD.engine_snapshot IS NOT NULL
    AND NEW.engine_snapshot IS NOT NULL
    AND NEW.engine_snapshot -> 'examTiming'
      IS DISTINCT FROM OLD.engine_snapshot -> 'examTiming'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Effective set attempt timing snapshot is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_ucat_set_attempt_timing_rewrite
  BEFORE UPDATE OF
    effective_timing_mode,
    effective_pace_multiplier,
    timing_source,
    study_plan_task_id,
    set_time_limit_seconds,
    set_time_limit_at_exam_speed_seconds,
    set_speed,
    was_timed,
    engine_snapshot
  ON public.student_question_set_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ucat_set_attempt_timing_rewrite();

REVOKE ALL ON FUNCTION public.prevent_ucat_set_attempt_timing_rewrite()
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_set_attempt_snapshot_and_speed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_limit INTEGER;
  v_exam_time INTEGER;
  v_default_mode public.ucat_question_set_timing_mode;
  v_default_pace NUMERIC;
  v_task_pace NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_exam_time := public.ucat_question_set_exam_time_seconds(NEW.question_set_id);

    IF NEW.study_plan_task_id IS NOT NULL THEN
      IF NEW.student_ucat_mock_attempt_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Mock set timing cannot be prescribed by a Study plan task';
      END IF;

      SELECT CASE
        WHEN jsonb_typeof(task.launch_config -> 'prescribedPace') = 'number'
          THEN (task.launch_config ->> 'prescribedPace')::NUMERIC
        ELSE NULL
      END
      INTO v_task_pace
      FROM public.ucat_student_study_plan_tasks task
      WHERE task.id = NEW.study_plan_task_id
        AND task.student_id = NEW.student_id
        AND task.question_set_id = NEW.question_set_id
        AND task.task_type = 'section_benchmark'
        AND task.status IN ('in_progress', 'partial')
        AND task.launch_config ->> 'kind' = 'set';

      IF v_task_pace IS NULL OR v_task_pace < 0.5 OR v_task_pace > 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid Study plan set pace prescription';
      END IF;
      IF v_exam_time IS NULL OR v_exam_time <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Question set has no exam-time reference';
      END IF;

      v_time_limit := CEIL(v_exam_time::NUMERIC / v_task_pace)::INTEGER;
      NEW.effective_timing_mode := 'pace';
      NEW.effective_pace_multiplier := v_task_pace;
      NEW.timing_source := 'study_plan';
      NEW.was_timed := TRUE;
    ELSE
      SELECT question_set.timing_mode, question_set.pace_multiplier
      INTO v_default_mode, v_default_pace
      FROM public.question_sets question_set
      WHERE question_set.id = NEW.question_set_id;

      v_time_limit := public.ucat_question_set_time_limit_seconds(NEW.question_set_id);
      IF NEW.student_ucat_mock_attempt_id IS NOT NULL THEN
        NEW.effective_timing_mode := 'pace';
        NEW.effective_pace_multiplier := 1;
        NEW.timing_source := 'mock_blueprint';
      ELSE
        NEW.effective_timing_mode := v_default_mode;
        NEW.effective_pace_multiplier := CASE WHEN v_default_mode = 'pace' THEN v_default_pace ELSE NULL END;
        NEW.timing_source := 'set_default';
      END IF;
      NEW.was_timed := v_time_limit IS NOT NULL AND v_time_limit > 0;
    END IF;

    NEW.set_time_limit_seconds := v_time_limit;
    NEW.set_time_limit_at_exam_speed_seconds := v_exam_time;
    NEW.set_speed := CASE WHEN v_time_limit > 0 AND v_exam_time > 0
      THEN v_exam_time::NUMERIC / v_time_limit ELSE NULL END;

    IF NEW.engine_snapshot IS NOT NULL AND NEW.study_plan_task_id IS NOT NULL THEN
      NEW.engine_snapshot := jsonb_set(
        NEW.engine_snapshot,
        '{examTiming}',
        COALESCE(NEW.engine_snapshot -> 'examTiming', '{}'::JSONB)
          || jsonb_build_object(
            'setModeTiming',
            COALESCE(NEW.engine_snapshot #> '{examTiming,setModeTiming}', '{}'::JSONB)
              || jsonb_build_object('setTimeLimitSeconds', v_time_limit)
          ),
        TRUE
      );
    END IF;
  END IF;

  IF NEW.time_taken_seconds IS NOT NULL AND NEW.time_taken_seconds > 0 THEN
    IF NEW.student_set_speed IS NULL AND NEW.set_time_limit_seconds > 0 THEN
      NEW.student_set_speed := NEW.set_time_limit_seconds::NUMERIC / NEW.time_taken_seconds;
    END IF;
    IF NEW.student_exam_speed IS NULL AND NEW.set_time_limit_at_exam_speed_seconds > 0 THEN
      NEW.student_exam_speed := NEW.set_time_limit_at_exam_speed_seconds / NEW.time_taken_seconds;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.create_ucat_exam_attempt_records(
  TEXT, UUID, UUID, UUID, JSONB, TIMESTAMPTZ, BOOLEAN, UUID, UUID
);

CREATE FUNCTION public.create_ucat_exam_attempt_records(
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
  IF p_attempt_kind <> 'set' AND p_study_plan_task_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Only standalone set attempts accept a Study plan timing prescription';
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
      current_segment_ends_at, last_activity_at, was_timed
    ) VALUES (
      p_attempt_id, p_student_id, p_resource_id, p_engine_snapshot,
      p_current_segment_ends_at, now(), p_was_timed
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

REVOKE ALL ON FUNCTION public.create_ucat_exam_attempt_records(
  TEXT, UUID, UUID, UUID, JSONB, TIMESTAMPTZ, BOOLEAN, UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ucat_exam_attempt_records(
  TEXT, UUID, UUID, UUID, JSONB, TIMESTAMPTZ, BOOLEAN, UUID, UUID, UUID
) TO service_role;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.question_set_id,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken_seconds,
  attempt.student_ucat_mock_attempt_id,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.set_time_limit_seconds,
  attempt.set_time_limit_at_exam_speed_seconds,
  attempt.set_speed,
  attempt.student_set_speed,
  attempt.student_exam_speed,
  attempt.was_timed,
  attempt.content_snapshot,
  attempt.effective_timing_mode,
  attempt.effective_pace_multiplier,
  attempt.timing_source,
  attempt.study_plan_task_id
FROM public.student_question_set_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access;

GRANT SELECT ON public.vstudent_ucat_my_set_attempts TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_student_set_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id AS attempt_id,
  attempt.student_id,
  student.first_name || ' ' || student.last_name AS student_name,
  attempt.question_set_id AS set_id,
  question_set.description AS set_name,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.set_time_limit_seconds,
  attempt.set_time_limit_at_exam_speed_seconds,
  attempt.set_speed,
  attempt.student_set_speed,
  attempt.student_exam_speed,
  attempt.was_timed,
  attempt.time_taken_seconds,
  attempt.student_ucat_mock_attempt_id,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.effective_timing_mode,
  attempt.effective_pace_multiplier,
  attempt.timing_source,
  attempt.study_plan_task_id
FROM public.student_question_set_attempts attempt
JOIN public.students student ON student.id = attempt.student_id
JOIN public.question_sets question_set ON question_set.id = attempt.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(attempt.student_id);

GRANT SELECT ON public.vtutor_ucat_student_set_attempts TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_ucat_progress_attempt_history
WITH (security_invoker = false)
AS
SELECT
  'set'::TEXT AS source,
  attempt.id,
  placement.section_id,
  section.name AS section_name,
  attempt.question_set_id AS resource_id,
  attempt.content_snapshot -> 'name' AS resource_name,
  false AS unlimited,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken_seconds,
  attempt.set_time_limit_seconds AS time_limit_seconds,
  attempt.student_set_speed,
  attempt.student_exam_speed,
  attempt.was_timed,
  null::INTEGER AS question_count,
  null::NUMERIC AS scaled_score_max,
  attempt.effective_pace_multiplier AS prescribed_pace,
  attempt.timing_source
FROM public.student_question_set_attempts attempt
LEFT JOIN LATERAL (
  SELECT (question_attempt.content_snapshot #>> '{stem,sectionId}')::UUID AS section_id
  FROM public.student_question_attempts question_attempt
  WHERE question_attempt.student_question_set_attempt_id = attempt.id
  ORDER BY question_attempt.attempted_at, question_attempt.id
  LIMIT 1
) placement ON true
LEFT JOIN public.ucat_sections section ON section.id = placement.section_id
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
  AND attempt.student_ucat_mock_attempt_id IS NULL
UNION ALL
SELECT
  'practice'::TEXT,
  attempt.id,
  attempt.ucat_section_id,
  section.name,
  attempt.ucat_section_id,
  to_jsonb(section.name),
  attempt.unlimited,
  attempt.started_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  null::NUMERIC,
  extract(epoch FROM (attempt.completed_at - attempt.started_at))::INTEGER,
  null::INTEGER,
  null::NUMERIC,
  null::NUMERIC,
  false,
  attempt.question_count,
  null::NUMERIC,
  CASE
    WHEN attempt.was_timed AND jsonb_typeof(attempt.filters_snapshot -> 'timeSpeedMultiplier') = 'number'
      THEN (attempt.filters_snapshot ->> 'timeSpeedMultiplier')::NUMERIC
    ELSE NULL::NUMERIC
  END,
  null::TEXT
FROM public.student_practice_sessions attempt
JOIN public.ucat_sections section ON section.id = attempt.ucat_section_id
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL
UNION ALL
SELECT
  'mock'::TEXT,
  attempt.id,
  null::UUID,
  null::TEXT,
  attempt.ucat_mock_id,
  attempt.content_snapshot -> 'name',
  false,
  attempt.attempted_at,
  attempt.completed_at,
  attempt.score_points,
  attempt.total_points,
  attempt.scaled_score,
  attempt.time_taken,
  attempt.mock_time_limit_seconds,
  null::NUMERIC,
  attempt.student_mock_speed,
  (attempt.mock_time_limit_seconds IS NOT NULL AND attempt.mock_time_limit_seconds > 0),
  null::INTEGER,
  2700::NUMERIC,
  CASE WHEN attempt.mock_time_limit_seconds > 0 THEN 1::NUMERIC ELSE NULL::NUMERIC END,
  'mock_blueprint'::TEXT
FROM public.student_ucat_mock_attempts attempt
WHERE attempt.student_id = public.current_student_id()
  AND public.is_ucat_student()
  AND attempt.completed_at IS NOT NULL;

GRANT SELECT ON public.vstudent_ucat_progress_attempt_history TO authenticated;

DROP INDEX IF EXISTS public.idx_ucat_set_attempt_percentile_cohort;
CREATE INDEX idx_ucat_set_attempt_percentile_cohort
  ON public.student_question_set_attempts (
    question_set_id,
    effective_timing_mode,
    effective_pace_multiplier,
    set_time_limit_seconds,
    student_id,
    completed_at,
    id
  )
  INCLUDE (scaled_score)
  WHERE completed_at IS NOT NULL AND scaled_score IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_ucat_set_attempt_percentile_cohort(
  p_attempt_id UUID
)
RETURNS TABLE (
  target_score NUMERIC,
  cohort_size BIGINT,
  scores_below BIGINT,
  scores_equal BIGINT,
  bins JSONB
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  WITH target AS (
    SELECT
      attempt.question_set_id,
      attempt.scaled_score,
      attempt.effective_timing_mode,
      attempt.effective_pace_multiplier,
      attempt.set_time_limit_seconds
    FROM public.student_question_set_attempts AS attempt
    WHERE attempt.id = p_attempt_id
      AND attempt.completed_at IS NOT NULL
      AND attempt.scaled_score IS NOT NULL
  ),
  ranked_attempts AS (
    SELECT
      attempt.scaled_score,
      row_number() OVER (
        PARTITION BY attempt.student_id
        ORDER BY attempt.completed_at, attempt.id
      ) AS completion_number
    FROM public.student_question_set_attempts AS attempt
    INNER JOIN target
      ON target.question_set_id = attempt.question_set_id
     AND target.effective_timing_mode = attempt.effective_timing_mode
     AND target.effective_pace_multiplier IS NOT DISTINCT FROM attempt.effective_pace_multiplier
     AND target.set_time_limit_seconds IS NOT DISTINCT FROM attempt.set_time_limit_seconds
    WHERE attempt.completed_at IS NOT NULL
      AND attempt.scaled_score IS NOT NULL
  ),
  first_attempts AS (
    SELECT ranked_attempts.scaled_score
    FROM ranked_attempts
    WHERE ranked_attempts.completion_number = 1
  ),
  cohort_stats AS (
    SELECT
      count(*) AS cohort_size,
      count(*) FILTER (WHERE first_attempts.scaled_score < target.scaled_score) AS scores_below,
      count(*) FILTER (WHERE first_attempts.scaled_score = target.scaled_score) AS scores_equal
    FROM first_attempts
    CROSS JOIN target
  ),
  score_bins AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('score', grouped_scores.scaled_score, 'count', grouped_scores.score_count)
        ORDER BY grouped_scores.scaled_score
      ),
      '[]'::JSONB
    ) AS bins
    FROM (
      SELECT first_attempts.scaled_score, count(*) AS score_count
      FROM first_attempts
      GROUP BY first_attempts.scaled_score
    ) AS grouped_scores
  )
  SELECT
    target.scaled_score,
    cohort_stats.cohort_size,
    cohort_stats.scores_below,
    cohort_stats.scores_equal,
    score_bins.bins
  FROM target
  CROSS JOIN cohort_stats
  CROSS JOIN score_bins;
$function$;
