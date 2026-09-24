-- Aggregate practice evidence for the readiness-led UCAT study planner.
-- The source view already scopes rows to the authenticated UCAT student.

CREATE OR REPLACE VIEW public.vstudent_ucat_study_plan_readiness_evidence
WITH (security_invoker = false)
AS
WITH submitted_evidence AS (
  SELECT
    attempt.ucat_section_id AS section_id,
    attempt.question_stem_category_id AS category_id,
    coalesce(
      attempt.student_practice_session_id::text,
      attempt.student_question_set_attempt_id::text
    ) AS evidence_session_id,
    attempt.question_id,
    attempt.score,
    attempt.student_question_speed,
    attempt.was_timed
  FROM public.vstudent_ucat_my_question_attempts attempt
  LEFT JOIN public.student_practice_sessions practice_session
    ON practice_session.id = attempt.student_practice_session_id
  LEFT JOIN public.student_question_set_attempts set_attempt
    ON set_attempt.id = attempt.student_question_set_attempt_id
  WHERE attempt.is_submitted
    AND attempt.ucat_section_id IS NOT NULL
    AND (
      practice_session.completed_at IS NOT NULL
      OR set_attempt.completed_at IS NOT NULL
    )
), session_category AS (
  SELECT
    practice.section_id,
    practice.category_id,
    practice.evidence_session_id,
    count(DISTINCT practice.question_id)::integer AS question_count,
    avg(practice.score) FILTER (WHERE practice.score IS NOT NULL) AS accuracy,
    coalesce(
      avg(practice.student_question_speed) FILTER (
        WHERE NOT practice.was_timed
          AND practice.student_question_speed > 0
      ),
      avg(practice.student_question_speed) FILTER (
        WHERE practice.student_question_speed > 0
      )
    ) AS observed_pace
  FROM submitted_evidence practice
  GROUP BY
    practice.section_id,
    practice.category_id,
    practice.evidence_session_id
), category_evidence AS (
  SELECT
    session_category.section_id,
    session_category.category_id,
    'category'::text AS readiness_scope,
    sum(session_category.question_count)::integer AS attempted_question_count,
    count(*)::integer AS completed_practice_sessions,
    count(*) FILTER (
      WHERE session_category.question_count >= 10
    )::integer AS qualifying_practice_sessions,
    max(session_category.question_count)::integer AS largest_practice_session_question_count,
    avg(session_category.accuracy) AS recent_accuracy,
    avg(session_category.observed_pace) AS observed_pace
  FROM session_category
  WHERE session_category.category_id IS NOT NULL
  GROUP BY session_category.section_id, session_category.category_id
), session_section AS (
  SELECT
    practice.section_id,
    practice.evidence_session_id,
    count(DISTINCT practice.question_id)::integer AS question_count,
    avg(practice.score) FILTER (WHERE practice.score IS NOT NULL) AS accuracy,
    coalesce(
      avg(practice.student_question_speed) FILTER (
        WHERE NOT practice.was_timed
          AND practice.student_question_speed > 0
      ),
      avg(practice.student_question_speed) FILTER (
        WHERE practice.student_question_speed > 0
      )
    ) AS observed_pace
  FROM submitted_evidence practice
  GROUP BY practice.section_id, practice.evidence_session_id
), section_evidence AS (
  SELECT
    session_section.section_id,
    NULL::uuid AS category_id,
    'section'::text AS readiness_scope,
    sum(session_section.question_count)::integer AS attempted_question_count,
    count(*)::integer AS completed_practice_sessions,
    count(*) FILTER (
      WHERE session_section.question_count >= 10
    )::integer AS qualifying_practice_sessions,
    max(session_section.question_count)::integer AS largest_practice_session_question_count,
    avg(session_section.accuracy) AS recent_accuracy,
    avg(session_section.observed_pace) AS observed_pace
  FROM session_section
  GROUP BY session_section.section_id
)
SELECT * FROM category_evidence
UNION ALL
SELECT * FROM section_evidence;

REVOKE ALL ON public.vstudent_ucat_study_plan_readiness_evidence FROM anon;
REVOKE ALL ON public.vstudent_ucat_study_plan_readiness_evidence FROM authenticated;
GRANT SELECT ON public.vstudent_ucat_study_plan_readiness_evidence TO authenticated;
