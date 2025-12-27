-- Migration: Create vtutor_sessions_students view
-- Description:
--  Create a view that shows sessions_students records for sessions where the tutor is assigned.
--  This allows tutors to query student enrollments in their sessions.

-- ========================
-- VIEW: vtutor_sessions_students
-- Sessions_students records for sessions where tutor is assigned
-- ========================

CREATE OR REPLACE VIEW public.vtutor_sessions_students
WITH (security_invoker = false)
AS
SELECT 
  ss.id,
  ss.session_id,
  ss.student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  ss.created_at,
  ss.updated_at,
  -- Session details
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Class details (if applicable)
  c.day_of_week AS class_day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  c.room AS class_room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  -- Sessions where tutor is assigned
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_sessions_students TO authenticated;

COMMENT ON VIEW public.vtutor_sessions_students IS 'Tutor view: Sessions_students records for sessions where tutor is assigned (includes session, class, and subject details)';

