-- UCAT: Question-based progress counts and exclude deleted questions from attempts
-- Description: Align vstudent_ucat_public_question_counts with per-question progress
-- points (syllogism stem = 2 once, else 1 per question). Exclude soft-deleted
-- questions from student/tutor question-attempt progress views.
-- Date: 2026-07-07

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  sqa.student_question_set_attempt_id,
  sqa.student_practice_session_id,
  sqa.question_id,
  q.question_stem_id,
  q.index AS question_index,
  q.question_text,
  q.question_type,
  q.time_burden_seconds,
  st.stem_text,
  st.question_stem_category_id,
  qsc.name AS category_name,
  us.id AS ucat_section_id,
  us.name AS section_name,
  us.section_number,
  sqa.question_answer_option_id,
  qao.answer_text AS selected_answer_text,
  sqa.answer_snapshot,
  sqa.score,
  sqa.is_flagged,
  sqa.is_submitted,
  sqa.attempted_at,
  sqa.time_spent_seconds,
  sqa.student_question_speed,
  sqa.was_timed,
  sqa.mode
FROM public.student_question_attempts sqa
JOIN public.vstudent_ucat_access_context ctx
  ON ctx.student_id = sqa.student_id
  AND ctx.has_ucat_access
JOIN public.ucat_questions q
  ON q.id = sqa.question_id
  AND q.deleted_at IS NULL
JOIN public.question_stems st
  ON st.id = q.question_stem_id
  AND st.deleted_at IS NULL
JOIN public.vstudent_ucat_accessible_question_stems ast
  ON ast.id = st.id
LEFT JOIN public.question_stem_categories qsc
  ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us
  ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao
  ON qao.id = sqa.question_answer_option_id;

CREATE OR REPLACE VIEW public.vstudent_ucat_public_question_counts
WITH (security_invoker = false)
AS
WITH question_rows AS (
  SELECT
    q.id,
    q.question_stem_id,
    q.question_type,
    st.section_id,
    st.question_stem_category_id,
    row_number() OVER (
      PARTITION BY q.question_stem_id
      ORDER BY q.index NULLS LAST, q.id
    ) AS stem_question_index
  FROM public.ucat_questions q
  JOIN public.question_stems st
    ON st.id = q.question_stem_id
  JOIN public.vstudent_ucat_accessible_question_stems ast
    ON ast.id = st.id
  WHERE q.deleted_at IS NULL
    AND st.deleted_at IS NULL
)
SELECT
  question_rows.section_id,
  question_rows.question_stem_category_id,
  sum(
    CASE
      WHEN question_rows.question_type = 'syllogism'
        AND question_rows.stem_question_index = 1 THEN 2
      WHEN question_rows.question_type = 'syllogism' THEN 0
      ELSE 1
    END
  )::integer AS total_questions
FROM question_rows
GROUP BY question_rows.section_id, question_rows.question_stem_category_id;

CREATE OR REPLACE VIEW public.vtutor_ucat_student_question_attempts_for_progress
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  sqa.student_question_set_attempt_id,
  sqa.question_id,
  q.question_stem_id,
  sqa.question_answer_option_id,
  sqa.answer_snapshot,
  sqa.score,
  sqa.is_flagged,
  sqa.is_submitted,
  sqa.attempted_at,
  sqa.time_spent_seconds,
  sqa.student_question_speed,
  sqa.was_timed,
  sqa.mode,
  us.id AS ucat_section_id,
  us.name AS section_name,
  us.section_number,
  q.question_type,
  st.question_stem_category_id,
  qsc.name AS category_name
FROM public.student_question_attempts sqa
JOIN public.students s ON s.id = sqa.student_id
JOIN public.ucat_questions q
  ON q.id = sqa.question_id
  AND q.deleted_at IS NULL
JOIN public.question_stems st
  ON st.id = q.question_stem_id
  AND st.deleted_at IS NULL
LEFT JOIN public.question_stem_categories qsc ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us ON us.id = st.section_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqa.student_id);
