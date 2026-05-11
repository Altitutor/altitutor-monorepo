-- Migration: Expose tutor-log absence on student sessions list
-- Description:
--   Add tutor_log_marked_absent to vstudent_sessions: true when a tutor log
--   exists for the session and tutor_logs_student_attendance.attended is false
--   for the current student. NULL when there is no attendance row yet.

CREATE OR REPLACE VIEW public.vstudent_sessions
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
  (
    SELECT tlsa.attended IS FALSE
    FROM public.tutor_logs tl
    INNER JOIN public.tutor_logs_student_attendance tlsa
      ON tlsa.tutor_log_id = tl.id
      AND tlsa.student_id = ss.student_id
    WHERE tl.session_id = s.id
    LIMIT 1
  ) AS tutor_log_marked_absent,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
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
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', subj.id,
          'name', subj.name
        ))
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

COMMENT ON VIEW public.vstudent_sessions IS
  'Student view: Sessions for enrolled classes (includes tutor_log_marked_absent from tutor attendance).';
