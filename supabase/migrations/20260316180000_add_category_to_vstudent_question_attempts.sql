-- UCAT: Add question_stem_category_id and category_name to vstudent_ucat_my_question_attempts
-- Description: Enables progress by category on section detail pages.
-- Date: 2026-03-16

-- vstudent_ucat_question_stem_categories: student-readable categories for section progress
CREATE OR REPLACE VIEW public.vstudent_ucat_question_stem_categories
WITH (security_invoker = false)
AS
SELECT
  qsc.id,
  qsc.name,
  qsc.ucat_section_id
FROM public.question_stem_categories qsc
WHERE public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_question_stem_categories TO authenticated;

-- Must DROP and CREATE to add columns (PostgreSQL rejects column reordering via CREATE OR REPLACE)
DROP VIEW IF EXISTS public.vstudent_ucat_my_question_attempts;
CREATE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  sqa.student_question_set_attempt_id,
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
JOIN public.ucat_questions q ON q.id = sqa.question_id
JOIN public.question_stems st ON st.id = q.question_stem_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us ON us.id = st.section_id
LEFT JOIN public.question_answer_options qao ON qao.id = sqa.question_answer_option_id
WHERE public.is_ucat_student() AND sqa.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;
