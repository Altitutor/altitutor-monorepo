-- Migration: Add subject short_name and long_name to session views
-- Description:
--  Add subject.short_name and subject.long_name fields to:
--    - vtutor_session_detail
--    - vstudent_session_detail (also adds missing subject_year_level)
--    - vstudent_session_base
--  This allows consistent subject display formatting using formatSubjectDisplay()
--  which expects subject.long_name to be available.

-- ================================================
-- UPDATE VTUTOR_SESSION_DETAIL VIEW
-- ================================================
-- Note: Using DROP/CREATE instead of CREATE OR REPLACE because
-- PostgreSQL cannot add columns in the middle of a view definition
-- without causing column position mismatches

DROP VIEW IF EXISTS public.vtutor_session_detail CASCADE;

CREATE VIEW public.vtutor_session_detail
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
  sub.short_name AS subject_short_name,
  sub.long_name AS subject_long_name,
  -- Students in this session (scoped fields only)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'session_student_id', ss.id,
      'planned_absence', ss.planned_absence,
      'is_rescheduled', ss.is_rescheduled,
      'is_credited', ss.is_credited
    ))
    FROM public.sessions_students ss
    JOIN public.students st ON st.id = ss.student_id
    WHERE ss.session_id = s.id
  ) AS students,
  -- Staff in this session (scoped fields)
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
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_session_detail TO authenticated;

COMMENT ON VIEW public.vtutor_session_detail IS 'Tutor view: Detailed session information with students (scoped) and staff (scoped), includes subject short_name and long_name';

-- ================================================
-- UPDATE VSTUDENT_SESSION_DETAIL VIEW
-- ================================================
-- Note: Also adding missing subject_year_level for consistency
-- Using DROP/CREATE instead of CREATE OR REPLACE because
-- PostgreSQL cannot add columns in the middle of a view definition
-- without causing column position mismatches

DROP VIEW IF EXISTS public.vstudent_session_detail CASCADE;

CREATE VIEW public.vstudent_session_detail
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
  sub.short_name AS subject_short_name,
  sub.long_name AS subject_long_name,
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

GRANT SELECT ON public.vstudent_session_detail TO authenticated;

COMMENT ON VIEW public.vstudent_session_detail IS 'Student view: Detailed session information (includes subject year_level, short_name, and long_name for consistent formatting)';

-- ================================================
-- UPDATE VSTUDENT_SESSION_BASE VIEW
-- ================================================
-- Note: Using DROP/CREATE instead of CREATE OR REPLACE because
-- PostgreSQL cannot add columns in the middle of a view definition
-- without causing column position mismatches

DROP VIEW IF EXISTS public.vstudent_session_base CASCADE;

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
  sub.short_name AS subject_short_name,
  sub.long_name AS subject_long_name,
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

COMMENT ON VIEW public.vstudent_session_base IS 'Student view: Individual session detail with class and attendance info (includes subject year_level, short_name, and long_name for consistent formatting)';
