-- Migration: Expose classes.short_name and long_name on vtutor_classes and vtutor_class_detail
-- So tutor app can display trigger-updated class display names without building from subject.

DROP VIEW IF EXISTS public.vtutor_class_detail CASCADE;
DROP VIEW IF EXISTS public.vtutor_classes CASCADE;

CREATE VIEW public.vtutor_classes
WITH (security_invoker = false)
AS
SELECT
  c.id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level,
  c.status,
  c.subject_id,
  c.created_at,
  c.updated_at,
  c.short_name,
  c.long_name,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id
  FROM public.classes_staff
  WHERE staff_id = public.current_tutor_id()
    AND unassigned_at IS NULL
)
AND c.status = 'ACTIVE';

GRANT SELECT ON public.vtutor_classes TO authenticated;

CREATE VIEW public.vtutor_class_detail
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
  c.created_at,
  c.updated_at,
  c.short_name,
  c.long_name,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level,
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'status', s.status,
      'school', s.school,
      'curriculum', s.curriculum,
      'year_level', s.year_level,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'enrollment_id', cs.id,
      'enrolled_at', cs.enrolled_at,
      'unenrolled_at', cs.unenrolled_at
    ))
    FROM public.classes_students cs
    JOIN public.students s ON s.id = cs.student_id
    WHERE cs.class_id = c.id
      AND cs.unenrolled_at IS NULL
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'email', st.email,
      'phone', st.phone_number,
      'role', st.role,
      'status', st.status,
      'classes_staff_id', cst.id,
      'classes_staff_status', (CASE WHEN cst.unassigned_at IS NULL THEN 'ACTIVE' ELSE 'INACTIVE' END)
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id
      AND cst.unassigned_at IS NULL
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id
  FROM public.classes_staff
  WHERE staff_id = public.current_tutor_id()
    AND unassigned_at IS NULL
);

GRANT SELECT ON public.vtutor_class_detail TO authenticated;
