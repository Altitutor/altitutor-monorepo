-- Make Answer scheme authoritative for student catalogue denominators and
-- expose it to tutor progress reporting.

CREATE OR REPLACE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH question_rows AS (
  SELECT
    question.answer_scheme,
    question.question_stem_id,
    stem.section_id,
    stem.question_stem_category_id,
    row_number() OVER (
      PARTITION BY question.question_stem_id, question.answer_scheme
      ORDER BY question.index NULLS LAST, question.id
    ) AS scheme_stem_index
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.vstudent_ucat_accessible_question_stems accessible
    ON accessible.id = stem.id
  WHERE question.deleted_at IS NULL
    AND stem.deleted_at IS NULL
)
SELECT
  question_rows.section_id,
  question_rows.question_stem_category_id,
  sum(
    CASE
      WHEN question_rows.answer_scheme = 'decision_making_binary_placement'
        AND question_rows.scheme_stem_index = 1 THEN 2
      WHEN question_rows.answer_scheme = 'decision_making_binary_placement' THEN 0
      ELSE 1
    END
  )::INTEGER AS total_questions
FROM question_rows
GROUP BY question_rows.section_id, question_rows.question_stem_category_id;

CREATE OR REPLACE VIEW public.vtutor_ucat_student_question_attempts_for_progress
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  student.first_name AS student_first_name,
  student.last_name AS student_last_name,
  attempt.student_question_set_attempt_id,
  attempt.question_id,
  attempt.question_answer_option_id,
  attempt.answer_snapshot,
  attempt.score,
  attempt.is_flagged,
  attempt.is_submitted,
  attempt.attempted_at,
  attempt.time_spent_seconds,
  attempt.student_question_speed,
  attempt.was_timed,
  attempt.mode,
  section.id AS ucat_section_id,
  section.name AS section_name,
  section.section_number,
  question.question_type,
  stem.question_stem_category_id,
  category.name AS category_name,
  question.question_stem_id,
  question.answer_scheme
FROM public.student_question_attempts attempt
JOIN public.students student ON student.id = attempt.student_id
JOIN public.ucat_questions question
  ON question.id = attempt.question_id
  AND question.deleted_at IS NULL
JOIN public.question_stems stem
  ON stem.id = question.question_stem_id
  AND stem.deleted_at IS NULL
LEFT JOIN public.question_stem_categories category
  ON category.id = stem.question_stem_category_id
JOIN public.ucat_sections section ON section.id = stem.section_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(attempt.student_id);

GRANT SELECT ON public.vstudent_ucat_public_question_counts TO authenticated;
GRANT SELECT ON public.vtutor_ucat_student_question_attempts_for_progress TO authenticated;
