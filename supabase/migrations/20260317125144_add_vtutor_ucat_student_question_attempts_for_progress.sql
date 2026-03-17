-- UCAT: Add vtutor_ucat_student_question_attempts_for_progress view
-- Description: Extends vtutor_ucat_student_question_attempts with section and category columns for progress tracking.
-- Same pattern as vstudent_ucat_my_question_attempts - joins through ucat_questions, question_stems, ucat_sections.
-- Date: 2026-03-17

CREATE VIEW public.vtutor_ucat_student_question_attempts_for_progress
WITH (security_invoker = false)
AS
SELECT
  sqa.id,
  sqa.student_id,
  s.first_name AS student_first_name,
  s.last_name AS student_last_name,
  sqa.student_question_set_attempt_id,
  sqa.question_id,
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
JOIN public.ucat_questions q ON q.id = sqa.question_id
JOIN public.question_stems st ON st.id = q.question_stem_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = st.question_stem_category_id
JOIN public.ucat_sections us ON us.id = st.section_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqa.student_id);

GRANT SELECT ON public.vtutor_ucat_student_question_attempts_for_progress TO authenticated;
