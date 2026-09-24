-- Enrich tutor session views with the fields the tutor dashboard updates card
-- needs: schedule originals/names, extra-student flags, staff swap/absence
-- flags, and meeting parent attendees. Still scoped to sessions the current
-- tutor is assigned to via sessions_staff.
--
-- New columns are appended. CREATE OR REPLACE VIEW cannot rename or insert
-- columns in the middle of an existing view's column list.

CREATE OR REPLACE VIEW public.vtutor_sessions
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
  class.day_of_week AS class_day_of_week,
  class.start_time AS class_start_time,
  class.end_time AS class_end_time,
  class.room AS class_room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  session.original_start_at,
  session.original_end_at,
  session.short_name,
  session.long_name
FROM public.sessions session
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session.id IN (
  SELECT session_id
  FROM public.sessions_staff
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_sessions TO authenticated;

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
      'is_credited', session_student.is_credited,
      'is_extra', CASE
        WHEN session.class_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
          FROM public.classes_students class_student
          WHERE class_student.class_id = session.class_id
            AND class_student.student_id = student.id
            AND (class_student.unenrolled_at IS NULL OR class_student.unenrolled_at > session.start_at)
        ) THEN true
        WHEN session.class_id IS NULL AND session.type IS DISTINCT FROM 'CLASS'::public.session_type THEN true
        ELSE false
      END
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
      'planned_absence', COALESCE(session_staff.planned_absence, false),
      'is_swapped', COALESCE(session_staff.is_swapped, false),
      'is_swapped_in', EXISTS (
        SELECT 1
        FROM public.sessions_staff other_staff
        WHERE other_staff.swapped_sessions_staff_id = session_staff.id
      ),
      'swapped_staff', CASE
        WHEN swapped_staff.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', swapped_staff.id,
          'first_name', swapped_staff.first_name,
          'last_name', swapped_staff.last_name
        )
      END,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    LEFT JOIN public.sessions_staff swapped_session_staff
      ON swapped_session_staff.id = session_staff.swapped_sessions_staff_id
    LEFT JOIN public.staff swapped_staff ON swapped_staff.id = swapped_session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff,
  session.original_start_at,
  session.original_end_at,
  session.short_name,
  session.long_name,
  (
    SELECT json_agg(json_build_object(
      'id', parent.id,
      'first_name', parent.first_name,
      'last_name', parent.last_name
    ))
    FROM public.sessions_parents session_parent
    JOIN public.parents parent ON parent.id = session_parent.parent_id
    WHERE session_parent.session_id = session.id
  ) AS parents
FROM public.sessions session
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session.id IN (
  SELECT session_id
  FROM public.sessions_staff
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_session_detail TO authenticated;
