-- Migration: Add subject_year_level to vstudent_session_base view
-- Description:
--  Add subject.year_level field to vstudent_session_base view to match vstudent_classes format
--  This allows consistent subject display formatting: {curriculum} {year_level} {name} {level}

-- ================================================
-- UPDATE VSTUDENT_SESSION_BASE VIEW
-- ================================================
-- Note: Using DROP/CREATE instead of CREATE OR REPLACE because
-- PostgreSQL cannot add columns in the middle of a view definition
-- without causing column position mismatches

DROP VIEW IF EXISTS public.vstudent_session_base;

CREATE VIEW public.vstudent_session_base
WITH (security_invoker = false)
AS
SELECT
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level,
  -- Other students in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_base TO authenticated;

COMMENT ON VIEW public.vstudent_session_base IS 'Student view: Individual session detail with class and attendance info (includes subject_year_level for consistent formatting)';
