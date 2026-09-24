-- Completed attempt evidence for section-level Timing progression. Scheduled
-- work never appears here. The durable prescribed rung is stored separately
-- from observed speed so one poor session cannot demote a Student.

ALTER TABLE public.ucat_student_preparation_section_states
  ADD COLUMN prescribed_pace NUMERIC,
  ADD COLUMN prescribed_pace_set_at TIMESTAMPTZ,
  ADD COLUMN pace_policy_version TEXT,
  ADD COLUMN timing_evidence_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.ucat_student_preparation_section_states
  ADD CONSTRAINT ucat_preparation_section_states_prescribed_pace_check CHECK (
    prescribed_pace IS NULL OR (
      prescribed_pace BETWEEN 0.5 AND 1.0
      AND prescribed_pace * 10 = round(prescribed_pace * 10)
    )
  ),
  ADD CONSTRAINT ucat_preparation_section_states_pace_shape_check CHECK (
    (prescribed_pace IS NULL
      AND prescribed_pace_set_at IS NULL
      AND pace_policy_version IS NULL)
    OR
    (prescribed_pace IS NOT NULL
      AND prescribed_pace_set_at IS NOT NULL
      AND length(trim(pace_policy_version)) > 0)
  ),
  ADD CONSTRAINT ucat_preparation_section_states_timing_snapshot_check CHECK (
    jsonb_typeof(timing_evidence_snapshot) = 'object'
  );

DROP VIEW public.vstudent_ucat_preparation_section_states;
CREATE VIEW public.vstudent_ucat_preparation_section_states
WITH (security_invoker = false)
AS
SELECT
  state.id,
  state.student_id,
  state.test_year,
  state.section_id,
  state.learning_graduated_at,
  state.learning_graduation_route,
  state.policy_version,
  state.evidence_snapshot,
  state.prescribed_pace,
  state.prescribed_pace_set_at,
  state.pace_policy_version,
  state.timing_evidence_snapshot,
  state.created_at,
  state.updated_at
FROM public.ucat_student_preparation_section_states state
WHERE state.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_preparation_section_states
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_preparation_section_states
  TO authenticated;

CREATE VIEW public.vstudent_ucat_preparation_timing_evidence
WITH (security_invoker = false)
AS
WITH category_totals AS (
  SELECT
    category.ucat_section_id AS section_id,
    count(*)::INTEGER AS category_count
  FROM public.question_stem_categories category
  GROUP BY category.ucat_section_id
), practice_sessions AS (
  SELECT
    practice.id::TEXT AS evidence_session_id,
    'practice'::TEXT AS source,
    practice.student_id,
    practice.ucat_section_id AS section_id,
    practice.completed_at,
    CASE
      WHEN practice.was_timed
        AND jsonb_typeof(practice.filters_snapshot -> 'timeSpeedMultiplier') = 'number'
      THEN (practice.filters_snapshot ->> 'timeSpeedMultiplier')::NUMERIC
      ELSE NULL::NUMERIC
    END AS prescribed_pace,
    avg(attempt.student_question_speed) FILTER (
      WHERE attempt.student_question_speed > 0
    ) AS observed_pace,
    avg(attempt.score) FILTER (WHERE attempt.score IS NOT NULL) AS accuracy,
    count(DISTINCT attempt.question_id)::NUMERIC
      / greatest(section.number_of_questions, 1) AS section_equivalents,
    array_remove(
      array_agg(DISTINCT stem.question_stem_category_id),
      NULL
    ) AS category_ids,
    count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count,
    greatest(category_totals.category_count, 1) AS section_category_count,
    section.section_number,
    count(DISTINCT attempt.question_id)::INTEGER AS question_count,
    section.number_of_questions AS section_question_count
  FROM public.student_practice_sessions practice
  JOIN public.student_question_attempts attempt
    ON attempt.student_practice_session_id = practice.id
   AND attempt.is_submitted
  JOIN public.ucat_questions question ON question.id = attempt.question_id
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = practice.ucat_section_id
  LEFT JOIN category_totals ON category_totals.section_id = section.id
  WHERE practice.completed_at IS NOT NULL
    AND practice.discarded_at IS NULL
    AND practice.expired_at IS NULL
  GROUP BY
    practice.id,
    practice.student_id,
    practice.ucat_section_id,
    practice.completed_at,
    practice.was_timed,
    practice.filters_snapshot,
    section.number_of_questions,
    section.section_number,
    category_totals.category_count
), set_sessions AS (
  SELECT
    attempt.id::TEXT AS evidence_session_id,
    CASE
      WHEN attempt.student_ucat_mock_attempt_id IS NULL THEN 'set'
      ELSE 'mock'
    END::TEXT AS source,
    attempt.student_id,
    stem.section_id,
    attempt.completed_at,
    CASE
      WHEN attempt.was_timed THEN coalesce(attempt.set_speed, 1)
      ELSE NULL::NUMERIC
    END AS prescribed_pace,
    attempt.student_exam_speed AS observed_pace,
    attempt.score_points / nullif(attempt.total_points, 0) AS accuracy,
    count(DISTINCT question_attempt.question_id)::NUMERIC
      / greatest(section.number_of_questions, 1) AS section_equivalents,
    array_remove(
      array_agg(DISTINCT stem.question_stem_category_id),
      NULL
    ) AS category_ids,
    count(DISTINCT stem.question_stem_category_id)::INTEGER AS category_count,
    greatest(category_totals.category_count, 1) AS section_category_count,
    section.section_number,
    count(DISTINCT question_attempt.question_id)::INTEGER AS question_count,
    section.number_of_questions AS section_question_count
  FROM public.student_question_set_attempts attempt
  JOIN public.student_question_attempts question_attempt
    ON question_attempt.student_question_set_attempt_id = attempt.id
   AND question_attempt.is_submitted
  JOIN public.ucat_questions question ON question.id = question_attempt.question_id
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN category_totals ON category_totals.section_id = section.id
  WHERE attempt.completed_at IS NOT NULL
    AND attempt.discarded_at IS NULL
    AND attempt.expired_at IS NULL
  GROUP BY
    attempt.id,
    attempt.student_id,
    attempt.student_ucat_mock_attempt_id,
    stem.section_id,
    attempt.completed_at,
    attempt.was_timed,
    attempt.set_speed,
    attempt.student_exam_speed,
    attempt.score_points,
    attempt.total_points,
    section.number_of_questions,
    section.section_number,
    category_totals.category_count
), evidence AS (
  SELECT * FROM practice_sessions
  UNION ALL
  SELECT * FROM set_sessions
)
SELECT
  evidence.evidence_session_id,
  evidence.source,
  evidence.section_id,
  evidence.completed_at,
  evidence.prescribed_pace,
  evidence.observed_pace,
  evidence.accuracy,
  evidence.section_equivalents,
  evidence.category_ids,
  CASE
    WHEN evidence.source = 'mock' THEN 'broad'
    WHEN evidence.section_number = 3
      AND evidence.question_count >= evidence.section_question_count * 0.5
      THEN 'broad'
    WHEN evidence.section_number = 3
      AND evidence.question_count >= evidence.section_question_count * 0.25
      THEN 'mixed'
    WHEN evidence.question_count >= evidence.section_question_count * 0.5
      AND evidence.category_count >= ceil(evidence.section_category_count * 0.5)
      THEN 'broad'
    WHEN evidence.category_count >= 2 THEN 'mixed'
    ELSE 'narrow'
  END::TEXT AS breadth
FROM evidence
WHERE evidence.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_preparation_timing_evidence
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_preparation_timing_evidence
  TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_preparation_timing_evidence IS
  'Completed current-Student Timing evidence classified by section breadth; scheduled and abandoned work is excluded.';
