-- UCAT: Add student_ucat_mock_attempt_id and time_taken_seconds to vtutor_ucat_student_set_attempts
-- Description: Required for progress API to distinguish standalone vs mock set attempts and show timing.
-- Date: 2026-03-17

DROP VIEW IF EXISTS public.vtutor_ucat_student_set_attempts;
CREATE VIEW public.vtutor_ucat_student_set_attempts
WITH (security_invoker = false)
AS
SELECT
  sqsa.id AS attempt_id,
  sqsa.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  sqsa.question_set_id AS set_id,
  qs.description AS set_name,
  sqsa.score_points,
  sqsa.total_points,
  sqsa.scaled_score,
  sqsa.set_time_limit_seconds,
  sqsa.set_time_limit_at_exam_speed_seconds,
  sqsa.set_speed,
  sqsa.student_set_speed,
  sqsa.student_exam_speed,
  sqsa.was_timed,
  sqsa.time_taken_seconds,
  sqsa.student_ucat_mock_attempt_id,
  sqsa.attempted_at,
  sqsa.completed_at
FROM public.student_question_set_attempts sqsa
JOIN public.students s ON s.id = sqsa.student_id
JOIN public.question_sets qs ON qs.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);
