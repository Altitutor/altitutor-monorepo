-- Student progress totals and Preparation inventory both walk active questions
-- by stem. Keep those catalogue reads index-backed as the published bank grows.
CREATE INDEX IF NOT EXISTS idx_ucat_questions_active_stem_scheme_order
  ON public.ucat_questions (
    question_stem_id,
    answer_scheme,
    "index",
    id
  )
  WHERE deleted_at IS NULL;

-- The practice inventory aggregates tag IDs for every question in each stem.
-- Cover the lookup so publishing more tagged questions does not multiply heap
-- reads across the entire student catalogue.
CREATE INDEX IF NOT EXISTS idx_questions_question_tags_question_tag
  ON public.questions_question_tags (question_id, tag_id);

-- One indexed watermark lets the score-projection route reuse a persisted
-- snapshot without serving stale evidence or opening the full Preparation
-- query fan-out merely to check freshness.
CREATE OR REPLACE FUNCTION public.get_student_ucat_preparation_evidence_watermark()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH current_student AS (
    SELECT student.id
    FROM public.students student
    WHERE student.user_id = (SELECT auth.uid())
  ), evidence AS (
    SELECT practice.completed_at
    FROM public.student_practice_sessions practice
    JOIN current_student student ON student.id = practice.student_id
    WHERE practice.completed_at IS NOT NULL
    ORDER BY practice.completed_at DESC
    LIMIT 1
  ), set_evidence AS (
    SELECT attempt.completed_at
    FROM public.student_question_set_attempts attempt
    JOIN current_student student ON student.id = attempt.student_id
    WHERE attempt.completed_at IS NOT NULL
    ORDER BY attempt.completed_at DESC
    LIMIT 1
  ), mock_evidence AS (
    SELECT attempt.completed_at
    FROM public.student_ucat_mock_attempts attempt
    JOIN current_student student ON student.id = attempt.student_id
    WHERE attempt.completed_at IS NOT NULL
    ORDER BY attempt.completed_at DESC
    LIMIT 1
  )
  SELECT max(latest.completed_at)
  FROM (
    SELECT completed_at FROM evidence
    UNION ALL
    SELECT completed_at FROM set_evidence
    UNION ALL
    SELECT completed_at FROM mock_evidence
  ) latest;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_preparation_evidence_watermark()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_preparation_evidence_watermark()
  TO authenticated;
