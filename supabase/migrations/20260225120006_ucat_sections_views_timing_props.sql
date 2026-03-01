-- ========================
-- UCAT: Update section views to expose timing props
-- vtutor_ucat_sections / vstudent_ucat_sections were created with SELECT us.*;
-- In PostgreSQL, view columns are fixed at creation time, so new base-table columns
-- (time_limit_seconds, number_of_questions, time_per_question, instructions_time_limit_seconds)
-- are not visible until we replace the views.
-- ========================

-- vtutor_ucat_sections: re-create so view includes time_limit_seconds, number_of_questions, time_per_question, instructions_time_limit_seconds
CREATE OR REPLACE VIEW public.vtutor_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_tutor();

-- vstudent_ucat_sections: same
CREATE OR REPLACE VIEW public.vstudent_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_student();
