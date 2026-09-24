-- Give the internal/test classification platform-wide semantics, hide those
-- Students from peer-facing rosters, and expose the classification to staff.

ALTER TABLE public.students
  RENAME COLUMN ucat_analytics_account_class TO account_class;

ALTER TABLE public.students
  RENAME CONSTRAINT students_ucat_analytics_account_class_check
  TO students_account_class_check;

COMMENT ON COLUMN public.students.account_class IS
  'Account population: external customer or internal/test. Internal/test Students remain fully operational but may be hidden from peer-facing rosters and public rankings.';

-- The view column name is stored independently from its source column name.
ALTER VIEW public.vstudent_ucat_my_access
  RENAME COLUMN ucat_analytics_account_class TO account_class;

CREATE OR REPLACE FUNCTION public.current_ucat_portal_access()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'student_id', (SELECT public.current_student_id()),
    'has_online_access', access_record.has_online_access,
    'has_in_person_access', access_record.has_in_person_access,
    'has_ucat_access', access_record.has_ucat_access,
    'online_tier', access_record.online_tier,
    'is_quota_exempt', access_record.is_quota_exempt,
    'ucat_onboarding_completed_at', access_record.ucat_onboarding_completed_at,
    'unlimited_trial_eligible', access_record.unlimited_trial_eligible,
    'ucat_signup_step', access_record.ucat_signup_step,
    'ucat_signup_completed_at', access_record.ucat_signup_completed_at,
    'account_class', access_record.account_class,
    'ucat_test_year', access_record.ucat_test_year,
    'ucat_test_date', access_record.ucat_test_date,
    'active_staff_role', public.current_ucat_signup_staff_role()
  )
  FROM (SELECT (SELECT auth.uid()) AS user_id) AS caller
  LEFT JOIN LATERAL (
    SELECT access.*
    FROM public.vstudent_ucat_my_access AS access
    LIMIT 1
  ) AS access_record ON TRUE
  WHERE caller.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.current_ucat_portal_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_ucat_portal_access()
  TO authenticated;

-- A Student sees external peers and always retains their own identity.
CREATE OR REPLACE FUNCTION public.is_student_peer_visible(
  p_student_id UUID,
  p_account_class TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p_account_class = 'external'
    OR p_student_id = (SELECT public.current_student_id());
$$;

REVOKE ALL ON FUNCTION public.is_student_peer_visible(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_peer_visible(UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.is_student_peer_visible(UUID, TEXT) IS
  'Peer-roster policy: external Students are visible; an internal/test Student can still see their own identity.';

CREATE OR REPLACE VIEW public.vstudent_class_detail
WITH (security_invoker = false)
AS
SELECT
  c.id AS class_id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  c.subject_id,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  (
    SELECT json_agg(json_build_object(
      'id', student.id,
      'first_name', student.first_name,
      'last_name', student.last_name,
      'year_level', student.year_level
    ))
    FROM public.classes_students class_student
    JOIN public.students student ON student.id = class_student.student_id
    WHERE class_student.class_id = c.id
      AND class_student.unenrolled_at IS NULL
      AND public.is_student_peer_visible(student.id, student.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'subjects', (
        SELECT json_agg(json_build_object('id', subject.id, 'name', subject.name))
        FROM public.staff_subjects staff_subject
        JOIN public.subjects subject ON subject.id = staff_subject.subject_id
        WHERE staff_subject.staff_id = staff.id
      )
    ))
    FROM public.classes_staff class_staff
    JOIN public.staff staff ON staff.id = class_staff.staff_id
    WHERE class_staff.class_id = c.id AND class_staff.unassigned_at IS NULL
  ) AS staff,
  c.short_name,
  c.long_name,
  c.schedule_summary_short,
  c.schedule_summary_long,
  c.schedule_weekdays,
  c.next_session_start_at,
  c.schedule_rows,
  c.session_start_date,
  c.session_end_date,
  c.schedule_timezone,
  c.cohort_label,
  c.schedule_frequency_weeks,
  c.schedule_anchor_date
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE EXISTS (
  SELECT 1
  FROM public.classes_students class_student
  WHERE class_student.class_id = c.id
    AND class_student.student_id = public.current_student_id()
    AND class_student.unenrolled_at IS NULL
);

GRANT SELECT ON public.vstudent_class_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_session_detail
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  session_student.id AS session_student_id,
  session_student.planned_absence,
  session_student.planned_absence_logged_at,
  session_student.is_rescheduled,
  session_student.rescheduled_at,
  session_student.is_credited,
  session_student.credited_at,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  subject.short_name AS subject_short_name,
  subject.long_name AS subject_long_name,
  (
    SELECT json_agg(json_build_object(
      'id', peer.id,
      'first_name', peer.first_name,
      'last_name', peer.last_name,
      'year_level', peer.year_level
    ))
    FROM public.sessions_students peer_session
    JOIN public.students peer ON peer.id = peer_session.student_id
    WHERE peer_session.session_id = session.id
      AND public.is_student_peer_visible(peer.id, peer.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', session_staff.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff
FROM public.sessions session
JOIN public.sessions_students session_student ON session_student.session_id = session.id
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session_student.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_session_base
WITH (security_invoker = false)
AS
SELECT * FROM public.vstudent_session_detail;

GRANT SELECT ON public.vstudent_session_base TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_sessions
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  session_student.id AS session_student_id,
  session_student.planned_absence,
  session_student.planned_absence_logged_at,
  session_student.is_rescheduled,
  session_student.rescheduled_at,
  session_student.is_credited,
  session_student.credited_at,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  (
    SELECT json_agg(json_build_object(
      'id', peer.id,
      'first_name', peer.first_name,
      'last_name', peer.last_name,
      'year_level', peer.year_level
    ))
    FROM public.sessions_students peer_session
    JOIN public.students peer ON peer.id = peer_session.student_id
    WHERE peer_session.session_id = session.id
      AND public.is_student_peer_visible(peer.id, peer.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', session_staff.type,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', staff_subject.id,
          'name', staff_subject.name
        ))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff,
  (
    SELECT attendance.attended IS FALSE
    FROM public.tutor_logs tutor_log
    INNER JOIN public.tutor_logs_student_attendance attendance
      ON attendance.tutor_log_id = tutor_log.id
      AND attendance.student_id = session_student.student_id
    WHERE tutor_log.session_id = session.id
    LIMIT 1
  ) AS tutor_log_marked_absent
FROM public.sessions session
JOIN public.sessions_students session_student ON session_student.session_id = session.id
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session_student.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_sessions TO authenticated;

-- Staff-facing projections retain all Students and carry the classification.
CREATE OR REPLACE VIEW public.vtutor_class_detail
WITH (security_invoker = false)
AS
SELECT
  class.id AS class_id,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  class.subject_id,
  class.created_at,
  class.updated_at,
  class.short_name,
  class.long_name,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  (
    SELECT json_agg(json_build_object(
      'id', student.id,
      'first_name', student.first_name,
      'last_name', student.last_name,
      'status', student.status,
      'school', student.school,
      'curriculum', student.curriculum,
      'year_level', student.year_level,
      'availability_monday', student.availability_monday,
      'availability_tuesday', student.availability_tuesday,
      'availability_wednesday', student.availability_wednesday,
      'availability_thursday', student.availability_thursday,
      'availability_friday', student.availability_friday,
      'availability_saturday_am', student.availability_saturday_am,
      'availability_saturday_pm', student.availability_saturday_pm,
      'availability_sunday_am', student.availability_sunday_am,
      'availability_sunday_pm', student.availability_sunday_pm,
      'account_class', student.account_class,
      'enrollment_id', class_student.id,
      'enrolled_at', class_student.enrolled_at,
      'unenrolled_at', class_student.unenrolled_at
    ))
    FROM public.classes_students class_student
    JOIN public.students student ON student.id = class_student.student_id
    WHERE class_student.class_id = class.id AND class_student.unenrolled_at IS NULL
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'email', staff.email,
      'phone', staff.phone_number,
      'role', staff.role,
      'status', staff.status,
      'classes_staff_id', class_staff.id,
      'classes_staff_status', CASE WHEN class_staff.unassigned_at IS NULL THEN 'ACTIVE' ELSE 'INACTIVE' END
    ))
    FROM public.classes_staff class_staff
    JOIN public.staff staff ON staff.id = class_staff.staff_id
    WHERE class_staff.class_id = class.id AND class_staff.unassigned_at IS NULL
  ) AS staff,
  class.schedule_summary_short,
  class.schedule_summary_long,
  class.schedule_weekdays,
  class.next_session_start_at,
  class.schedule_rows,
  class.session_start_date,
  class.session_end_date,
  class.schedule_timezone,
  class.cohort_label,
  class.schedule_frequency_weeks,
  class.schedule_anchor_date
FROM public.classes class
LEFT JOIN public.subjects subject ON subject.id = class.subject_id
WHERE class.id IN (
  SELECT class_id
  FROM public.classes_staff
  WHERE staff_id = public.current_tutor_id() AND unassigned_at IS NULL
);

GRANT SELECT ON public.vtutor_class_detail TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_session_detail
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  subject.short_name AS subject_short_name,
  subject.long_name AS subject_long_name,
  (
    SELECT json_agg(json_build_object(
      'id', student.id,
      'first_name', student.first_name,
      'last_name', student.last_name,
      'status', student.status,
      'school', student.school,
      'curriculum', student.curriculum,
      'year_level', student.year_level,
      'availability_monday', student.availability_monday,
      'availability_tuesday', student.availability_tuesday,
      'availability_wednesday', student.availability_wednesday,
      'availability_thursday', student.availability_thursday,
      'availability_friday', student.availability_friday,
      'availability_saturday_am', student.availability_saturday_am,
      'availability_saturday_pm', student.availability_saturday_pm,
      'availability_sunday_am', student.availability_sunday_am,
      'availability_sunday_pm', student.availability_sunday_pm,
      'account_class', student.account_class,
      'session_student_id', session_student.id,
      'planned_absence', session_student.planned_absence,
      'is_rescheduled', session_student.is_rescheduled,
      'is_credited', session_student.is_credited
    ))
    FROM public.sessions_students session_student
    JOIN public.students student ON student.id = session_student.student_id
    WHERE session_student.session_id = session.id
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', session_staff.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff
FROM public.sessions session
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session.id IN (
  SELECT session_id
  FROM public.sessions_staff
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_session_detail TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_students
WITH (security_invoker = false)
AS
SELECT DISTINCT
  student.id,
  student.first_name,
  student.last_name,
  student.status,
  student.school,
  student.curriculum,
  student.year_level,
  student.availability_monday,
  student.availability_tuesday,
  student.availability_wednesday,
  student.availability_thursday,
  student.availability_friday,
  student.availability_saturday_am,
  student.availability_saturday_pm,
  student.availability_sunday_am,
  student.availability_sunday_pm,
  student.created_at,
  student.updated_at,
  student.account_class
FROM public.students student
WHERE student.id IN (
  SELECT class_student.student_id
  FROM public.classes_students class_student
  JOIN public.classes_staff class_staff ON class_staff.class_id = class_student.class_id
  WHERE class_staff.staff_id = public.current_tutor_id()
    AND class_staff.unassigned_at IS NULL
    AND class_student.unenrolled_at IS NULL
  UNION
  SELECT session_student.student_id
  FROM public.sessions_students session_student
  JOIN public.sessions_staff session_staff ON session_staff.session_id = session_student.session_id
  WHERE session_staff.staff_id = public.current_tutor_id()
)
ORDER BY student.first_name, student.last_name;

GRANT SELECT ON public.vtutor_students TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_student_progress_summary
WITH (security_invoker = false)
AS
SELECT
  student.id AS student_id,
  student.first_name || ' ' || student.last_name AS student_name,
  (
    SELECT COUNT(*)::INT
    FROM public.student_question_set_attempts attempt
    WHERE attempt.student_id = student.id AND attempt.completed_at IS NOT NULL
  ) AS total_sets_attempted,
  (
    SELECT COUNT(*)::INT
    FROM public.student_ucat_mock_attempts attempt
    WHERE attempt.student_id = student.id AND attempt.completed_at IS NOT NULL
  ) AS total_mocks_attempted,
  (
    SELECT AVG(attempt.score_points)
    FROM public.student_question_set_attempts attempt
    WHERE attempt.student_id = student.id AND attempt.completed_at IS NOT NULL
  ) AS avg_score_points,
  (
    SELECT AVG(attempt.scaled_score)
    FROM public.student_question_set_attempts attempt
    WHERE attempt.student_id = student.id AND attempt.completed_at IS NOT NULL
  ) AS avg_scaled_score,
  (
    SELECT MAX(attempt.attempted_at)
    FROM public.student_question_set_attempts attempt
    WHERE attempt.student_id = student.id
  ) AS last_attempted_at,
  student.account_class
FROM public.students student
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(student.id);

GRANT SELECT ON public.vtutor_ucat_student_progress_summary TO authenticated;
