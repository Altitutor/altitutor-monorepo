-- Migration: Create vtutor_students view
-- Description:
--  Create a view that shows all students accessible to a tutor.
--  Students are accessible if they are enrolled in classes or sessions where the tutor is assigned.
--  This allows tutors to search and select students for tutor logs.

-- ========================
-- VIEW: vtutor_students
-- All students accessible to the tutor (via classes or sessions)
-- ========================

CREATE OR REPLACE VIEW public.vtutor_students
WITH (security_invoker = false)
AS
SELECT DISTINCT
  s.id,
  s.first_name,
  s.last_name,
  s.status,
  s.school,
  s.curriculum,
  s.year_level,
  s.availability_monday,
  s.availability_tuesday,
  s.availability_wednesday,
  s.availability_thursday,
  s.availability_friday,
  s.availability_saturday_am,
  s.availability_saturday_pm,
  s.availability_sunday_am,
  s.availability_sunday_pm,
  s.created_at,
  s.updated_at
FROM public.students s
WHERE s.id IN (
  -- Students in tutor's classes
  SELECT DISTINCT cs.student_id
  FROM public.classes_students cs
  JOIN public.classes_staff cst ON cst.class_id = cs.class_id
  WHERE cst.staff_id = public.current_tutor_id()
    AND cst.unassigned_at IS NULL
    AND cs.unenrolled_at IS NULL
  
  UNION
  
  -- Students in tutor's sessions
  SELECT DISTINCT ss.student_id
  FROM public.sessions_students ss
  JOIN public.sessions_staff sst ON sst.session_id = ss.session_id
  WHERE sst.staff_id = public.current_tutor_id()
)
ORDER BY s.first_name, s.last_name;

GRANT SELECT ON public.vtutor_students TO authenticated;

COMMENT ON VIEW public.vtutor_students IS 'Tutor view: All students accessible to the tutor via classes or sessions (scoped fields only)';

