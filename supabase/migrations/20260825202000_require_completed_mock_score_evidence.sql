-- Score refresh must not regroup a Student's lifetime question history. Store
-- one compact row per completed activity/section when that activity closes.
-- Mock child Sets remain invisible until their parent Mock completes.

ALTER FUNCTION public.get_student_ucat_score_projection_evidence(UUID)
  RENAME TO get_student_ucat_score_projection_evidence_unfiltered_v1;

REVOKE ALL ON FUNCTION
  public.get_student_ucat_score_projection_evidence_unfiltered_v1(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.student_ucat_score_projection_evidence (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evidence_session_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('practice', 'set', 'mock')),
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  score_points NUMERIC NOT NULL,
  total_points NUMERIC NOT NULL,
  question_count INTEGER NOT NULL,
  section_question_count INTEGER NOT NULL,
  section_category_count INTEGER NOT NULL,
  was_timed BOOLEAN NOT NULL,
  prescribed_pace NUMERIC,
  observed_pace NUMERIC,
  breadth TEXT NOT NULL CHECK (breadth IN ('narrow', 'mixed', 'broad')),
  category_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  feedback_withheld BOOLEAN NOT NULL,
  is_student_generated BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, source, evidence_session_id, section_id)
);

CREATE INDEX student_ucat_score_projection_evidence_student_completed_idx
  ON public.student_ucat_score_projection_evidence (student_id, completed_at DESC);

ALTER TABLE public.student_ucat_score_projection_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_ucat_score_projection_evidence
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.student_ucat_score_projection_evidence TO service_role;

-- One-time conversion is allowed to use the superseded aggregate. Runtime
-- refreshes below never call it.
INSERT INTO public.student_ucat_score_projection_evidence (
  student_id, evidence_session_id, source, section_id, section_number,
  completed_at, score_points, total_points, question_count,
  section_question_count, section_category_count, was_timed,
  prescribed_pace, observed_pace, breadth, category_ids,
  feedback_withheld, is_student_generated
)
SELECT
  student.student_id, evidence.evidence_session_id, evidence.source,
  evidence.section_id, evidence.section_number, evidence.completed_at,
  evidence.score_points, evidence.total_points, evidence.question_count,
  evidence.section_question_count, evidence.section_category_count,
  evidence.was_timed, evidence.prescribed_pace, evidence.observed_pace,
  evidence.breadth, coalesce(evidence.category_ids, '{}'::UUID[]),
  evidence.feedback_withheld, evidence.is_student_generated
FROM (
  SELECT DISTINCT practice.student_id
  FROM public.student_practice_sessions practice
  WHERE practice.completed_at IS NOT NULL
  UNION
  SELECT DISTINCT attempt.student_id
  FROM public.student_question_set_attempts attempt
  WHERE attempt.completed_at IS NOT NULL
) student
CROSS JOIN LATERAL
  public.get_student_ucat_score_projection_evidence_unfiltered_v1(
    student.student_id
  ) evidence
WHERE evidence.score_points IS NOT NULL
  AND evidence.total_points > 0
  AND (evidence.source <> 'mock'
  OR EXISTS (
    SELECT 1
    FROM public.student_question_set_attempts set_attempt
    JOIN public.student_ucat_mock_attempts mock_attempt
      ON mock_attempt.id = set_attempt.student_ucat_mock_attempt_id
    WHERE set_attempt.id::TEXT = evidence.evidence_session_id
      AND set_attempt.student_id = student.student_id
      AND mock_attempt.completed_at IS NOT NULL
      AND mock_attempt.discarded_at IS NULL
      AND mock_attempt.expired_at IS NULL
  ));

DROP FUNCTION public.get_student_ucat_score_projection_evidence_unfiltered_v1(UUID);

CREATE OR REPLACE FUNCTION public.refresh_student_ucat_score_projection_evidence(
  p_activity_type TEXT,
  p_activity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_activity_type = 'practice' THEN
    DELETE FROM public.student_ucat_score_projection_evidence evidence
    WHERE evidence.source = 'practice'
      AND evidence.evidence_session_id = p_activity_id::TEXT;

    INSERT INTO public.student_ucat_score_projection_evidence (
      student_id, evidence_session_id, source, section_id, section_number,
      completed_at, score_points, total_points, question_count,
      section_question_count, section_category_count, was_timed,
      prescribed_pace, observed_pace, breadth, category_ids,
      feedback_withheld, is_student_generated
    )
    WITH aggregate AS (
      SELECT
        practice.student_id,
        practice.id::TEXT AS evidence_session_id,
        practice.ucat_section_id AS section_id,
        section.section_number,
        practice.completed_at,
        practice.score_points,
        practice.total_points,
        count(DISTINCT attempt.question_id)::INTEGER AS question_count,
        section.number_of_questions AS section_question_count,
        greatest((
          SELECT count(*) FROM public.question_stem_categories category
          WHERE category.ucat_section_id = section.id
        ), 1)::INTEGER AS section_category_count,
        practice.was_timed,
        CASE WHEN practice.was_timed
          AND jsonb_typeof(practice.filters_snapshot -> 'timeSpeedMultiplier') = 'number'
          THEN (practice.filters_snapshot ->> 'timeSpeedMultiplier')::NUMERIC
        END AS prescribed_pace,
        avg(attempt.student_question_speed) FILTER (
          WHERE attempt.student_question_speed > 0
        ) AS observed_pace,
        array_remove(array_agg(DISTINCT stem.question_stem_category_id), NULL)
          AS category_ids,
        count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count
      FROM public.student_practice_sessions practice
      JOIN public.student_question_attempts attempt
        ON attempt.student_practice_session_id = practice.id
       AND attempt.is_submitted
      JOIN public.ucat_questions question ON question.id = attempt.question_id
      JOIN public.question_stems stem ON stem.id = question.question_stem_id
      JOIN public.ucat_sections section ON section.id = practice.ucat_section_id
      WHERE practice.id = p_activity_id
        AND practice.completed_at IS NOT NULL
        AND practice.score_points IS NOT NULL
        AND practice.total_points > 0
        AND practice.discarded_at IS NULL
        AND practice.expired_at IS NULL
      GROUP BY practice.id, section.id
    )
    SELECT
      aggregate.student_id, aggregate.evidence_session_id, 'practice',
      aggregate.section_id, aggregate.section_number, aggregate.completed_at,
      aggregate.score_points, aggregate.total_points, aggregate.question_count,
      aggregate.section_question_count, aggregate.section_category_count,
      aggregate.was_timed, aggregate.prescribed_pace, aggregate.observed_pace,
      CASE
        WHEN aggregate.section_number = 3
          AND aggregate.question_count >= aggregate.section_question_count * 0.5 THEN 'broad'
        WHEN aggregate.section_number = 3
          AND aggregate.question_count >= aggregate.section_question_count * 0.25 THEN 'mixed'
        WHEN aggregate.question_count >= aggregate.section_question_count * 0.5
          AND aggregate.category_count >= ceil(aggregate.section_category_count * 0.5) THEN 'broad'
        WHEN aggregate.category_count >= 2 THEN 'mixed'
        ELSE 'narrow'
      END,
      coalesce(aggregate.category_ids, '{}'::UUID[]), false, true
    FROM aggregate;
  ELSIF p_activity_type = 'set' THEN
    DELETE FROM public.student_ucat_score_projection_evidence evidence
    WHERE evidence.source IN ('set', 'mock')
      AND evidence.evidence_session_id = p_activity_id::TEXT;

    INSERT INTO public.student_ucat_score_projection_evidence (
      student_id, evidence_session_id, source, section_id, section_number,
      completed_at, score_points, total_points, question_count,
      section_question_count, section_category_count, was_timed,
      prescribed_pace, observed_pace, breadth, category_ids,
      feedback_withheld, is_student_generated
    )
    WITH aggregate AS (
      SELECT
        attempt.student_id,
        attempt.id::TEXT AS evidence_session_id,
        CASE WHEN attempt.student_ucat_mock_attempt_id IS NULL
          THEN 'set' ELSE 'mock' END AS source,
        stem.section_id,
        section.section_number,
        attempt.completed_at,
        attempt.score_points,
        attempt.total_points,
        count(DISTINCT question_attempt.question_id)::INTEGER AS question_count,
        section.number_of_questions AS section_question_count,
        greatest((
          SELECT count(*) FROM public.question_stem_categories category
          WHERE category.ucat_section_id = section.id
        ), 1)::INTEGER AS section_category_count,
        attempt.was_timed,
        CASE WHEN attempt.was_timed THEN coalesce(attempt.set_speed, 1) END
          AS prescribed_pace,
        attempt.student_exam_speed AS observed_pace,
        array_remove(array_agg(DISTINCT stem.question_stem_category_id), NULL)
          AS category_ids,
        count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count
      FROM public.student_question_set_attempts attempt
      JOIN public.student_question_attempts question_attempt
        ON question_attempt.student_question_set_attempt_id = attempt.id
       AND question_attempt.is_submitted
      JOIN public.ucat_questions question ON question.id = question_attempt.question_id
      JOIN public.question_stems stem ON stem.id = question.question_stem_id
      JOIN public.ucat_sections section ON section.id = stem.section_id
      LEFT JOIN public.student_ucat_mock_attempts mock_attempt
        ON mock_attempt.id = attempt.student_ucat_mock_attempt_id
      WHERE attempt.id = p_activity_id
        AND attempt.completed_at IS NOT NULL
        AND attempt.score_points IS NOT NULL
        AND attempt.total_points > 0
        AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
        AND (
          attempt.student_ucat_mock_attempt_id IS NULL
          OR (
            mock_attempt.completed_at IS NOT NULL
            AND mock_attempt.discarded_at IS NULL
            AND mock_attempt.expired_at IS NULL
          )
        )
      GROUP BY attempt.id, stem.section_id, section.id
    )
    SELECT
      aggregate.student_id, aggregate.evidence_session_id, aggregate.source,
      aggregate.section_id, aggregate.section_number, aggregate.completed_at,
      aggregate.score_points, aggregate.total_points, aggregate.question_count,
      aggregate.section_question_count, aggregate.section_category_count,
      aggregate.was_timed, aggregate.prescribed_pace, aggregate.observed_pace,
      CASE
        WHEN aggregate.source = 'mock' THEN 'broad'
        WHEN aggregate.section_number = 3
          AND aggregate.question_count >= aggregate.section_question_count * 0.5 THEN 'broad'
        WHEN aggregate.section_number = 3
          AND aggregate.question_count >= aggregate.section_question_count * 0.25 THEN 'mixed'
        WHEN aggregate.question_count >= aggregate.section_question_count * 0.5
          AND aggregate.category_count >= ceil(aggregate.section_category_count * 0.5) THEN 'broad'
        WHEN aggregate.category_count >= 2 THEN 'mixed'
        ELSE 'narrow'
      END,
      coalesce(aggregate.category_ids, '{}'::UUID[]), true, false
    FROM aggregate;
  ELSE
    RAISE EXCEPTION 'unsupported_ucat_score_evidence_activity_type';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.refresh_student_ucat_score_projection_evidence(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.refresh_student_ucat_score_projection_evidence(TEXT, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.project_completed_ucat_score_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_set_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'student_practice_sessions' THEN
    PERFORM public.refresh_student_ucat_score_projection_evidence('practice', NEW.id);
  ELSIF TG_TABLE_NAME = 'student_question_set_attempts' THEN
    PERFORM public.refresh_student_ucat_score_projection_evidence('set', NEW.id);
  ELSE
    FOR v_set_id IN
      SELECT attempt.id
      FROM public.student_question_set_attempts attempt
      WHERE attempt.student_ucat_mock_attempt_id = NEW.id
    LOOP
      PERFORM public.refresh_student_ucat_score_projection_evidence('set', v_set_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_completed_ucat_score_evidence()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_completed_ucat_practice_score_evidence
AFTER UPDATE OF completed_at, discarded_at, expired_at, score_points,
  total_points, was_timed, filters_snapshot
ON public.student_practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_score_evidence();

CREATE TRIGGER project_completed_ucat_set_score_evidence
AFTER UPDATE OF completed_at, discarded_at, expired_at, score_points,
  total_points, was_timed, set_speed, student_exam_speed
ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_score_evidence();

CREATE TRIGGER project_completed_ucat_mock_score_evidence
AFTER UPDATE OF completed_at, discarded_at, expired_at
ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_score_evidence();

CREATE FUNCTION public.get_student_ucat_score_projection_evidence(
  p_student_id UUID
)
RETURNS SETOF public.student_ucat_score_projection_evidence
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH ranked AS (
    SELECT
      evidence.*,
      row_number() OVER (
        PARTITION BY evidence.section_id
        ORDER BY evidence.completed_at DESC, evidence.evidence_session_id DESC
      ) AS recency_rank
    FROM public.student_ucat_score_projection_evidence evidence
    WHERE evidence.student_id = p_student_id
  )
  SELECT
    ranked.student_id,
    ranked.evidence_session_id,
    ranked.source,
    ranked.section_id,
    ranked.section_number,
    ranked.completed_at,
    ranked.score_points,
    ranked.total_points,
    ranked.question_count,
    ranked.section_question_count,
    ranked.section_category_count,
    ranked.was_timed,
    ranked.prescribed_pace,
    ranked.observed_pace,
    ranked.breadth,
    ranked.category_ids,
    ranked.feedback_withheld,
    ranked.is_student_generated,
    ranked.updated_at
  FROM ranked
  WHERE ranked.recency_rank <= 200
  ORDER BY ranked.completed_at DESC, ranked.evidence_session_id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_score_projection_evidence(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_score_projection_evidence(UUID)
  TO service_role;

COMMENT ON TABLE public.student_ucat_score_projection_evidence IS
  'Bounded per-activity score evidence projected when an activity completes; Mock child Sets are admitted only after Mock completion.';

COMMENT ON FUNCTION public.get_student_ucat_score_projection_evidence(UUID) IS
  'Returns at most the 200 newest projected activities per UCAT section (800 rows total), safely below the PostgREST row cap.';
