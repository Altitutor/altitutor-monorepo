-- Add stems_snapshot to vstudent_ucat_my_practice_sessions for practice session review
-- Date: 2026-03-18
-- Must DROP first: CREATE OR REPLACE cannot add columns (PostgreSQL preserves column order)

DROP VIEW IF EXISTS public.vstudent_ucat_my_practice_sessions;

CREATE VIEW public.vstudent_ucat_my_practice_sessions
WITH (security_invoker = false)
AS
SELECT
  sps.id,
  sps.student_id,
  sps.ucat_section_id,
  us.name AS section_name,
  sps.section_key,
  sps.stems_snapshot,
  sps.score_points,
  sps.total_points,
  sps.question_count,
  sps.started_at,
  sps.completed_at,
  sps.unlimited
FROM public.student_practice_sessions sps
JOIN public.ucat_sections us ON us.id = sps.ucat_section_id
WHERE public.is_ucat_student() AND sps.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_ucat_my_practice_sessions TO authenticated;
