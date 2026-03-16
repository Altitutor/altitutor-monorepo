-- UCAT: Recreate vstudent_ucat_my_set_attempts to expose timing columns
-- Description: In PostgreSQL, a view's columns are fixed at creation time. The view was created
-- before set_time_limit_seconds, student_set_speed, student_exam_speed, was_timed were added
-- to student_question_set_attempts. Recreating the view picks up these columns.
-- Date: 2026-03-16

CREATE OR REPLACE VIEW public.vstudent_ucat_my_set_attempts
WITH (security_invoker = false)
AS
SELECT sqsa.*
FROM public.student_question_set_attempts sqsa
WHERE public.is_ucat_student() AND sqsa.student_id = public.current_student_id();
