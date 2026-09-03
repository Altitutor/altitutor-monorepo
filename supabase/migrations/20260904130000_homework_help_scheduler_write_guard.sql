-- Follow-up to the committed Homework Help migration. Keep the original
-- migration immutable while ensuring the scheduler writes a valid Class row
-- before the immediate offering-configuration check constraint is evaluated.

CREATE OR REPLACE FUNCTION public.set_scheduled_offering_configuration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_session_type TEXT := current_setting('app.class_session_type', TRUE);
  v_billing_type TEXT := current_setting('app.class_billing_type', TRUE);
BEGIN
  IF current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true' THEN
    RETURN NEW;
  END IF;

  IF NULLIF(v_session_type, '') IS NULL THEN
    RAISE EXCEPTION 'Scheduled offering applies must provide an offering type';
  END IF;

  NEW.session_type := v_session_type::public.session_type;
  IF NEW.session_type = 'HOMEWORK_HELP'::public.session_type THEN
    NEW.subject_id := NULL;
    NEW.billing_type := NULL;
  ELSE
    IF NULLIF(v_billing_type, '') IS NULL THEN
      RAISE EXCEPTION 'Class schedule applies must provide a billing type';
    END IF;
    NEW.billing_type := v_billing_type::public.billing_type;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_scheduled_offering_configuration()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_set_scheduled_offering_configuration
  BEFORE INSERT OR UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_scheduled_offering_configuration();

-- Tutors need the offering type to render assigned Homework Help without
-- manufacturing a Subject. Columns are appended to preserve view contracts.
CREATE OR REPLACE VIEW public.vtutor_classes
WITH (security_invoker = false)
AS
SELECT
  class.id,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level,
  class.status,
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
  class.schedule_anchor_date,
  class.session_type
FROM public.classes class
LEFT JOIN public.subjects subject ON subject.id = class.subject_id
WHERE class.id IN (
  SELECT assignment.class_id
  FROM public.classes_staff assignment
  WHERE assignment.staff_id = (SELECT public.current_tutor_id())
    AND assignment.unassigned_at IS NULL
)
AND class.status = 'ACTIVE';

GRANT SELECT ON public.vtutor_classes TO authenticated;

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
      'id', student.id, 'first_name', student.first_name, 'last_name', student.last_name,
      'status', student.status, 'school', student.school, 'curriculum', student.curriculum,
      'year_level', student.year_level, 'availability_monday', student.availability_monday,
      'availability_tuesday', student.availability_tuesday, 'availability_wednesday', student.availability_wednesday,
      'availability_thursday', student.availability_thursday, 'availability_friday', student.availability_friday,
      'availability_saturday_am', student.availability_saturday_am, 'availability_saturday_pm', student.availability_saturday_pm,
      'availability_sunday_am', student.availability_sunday_am, 'availability_sunday_pm', student.availability_sunday_pm,
      'enrollment_id', enrollment.id, 'enrolled_at', enrollment.enrolled_at, 'unenrolled_at', enrollment.unenrolled_at
    ))
    FROM public.classes_students enrollment
    JOIN public.students student ON student.id = enrollment.student_id
    WHERE enrollment.class_id = class.id AND enrollment.unenrolled_at IS NULL
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id, 'first_name', staff.first_name, 'last_name', staff.last_name,
      'email', staff.email, 'phone', staff.phone_number, 'role', staff.role, 'status', staff.status,
      'classes_staff_id', assignment.id,
      'classes_staff_status', CASE WHEN assignment.unassigned_at IS NULL THEN 'ACTIVE' ELSE 'INACTIVE' END
    ))
    FROM public.classes_staff assignment
    JOIN public.staff staff ON staff.id = assignment.staff_id
    WHERE assignment.class_id = class.id AND assignment.unassigned_at IS NULL
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
  class.schedule_anchor_date,
  class.session_type
FROM public.classes class
LEFT JOIN public.subjects subject ON subject.id = class.subject_id
WHERE class.id IN (
  SELECT assignment.class_id
  FROM public.classes_staff assignment
  WHERE assignment.staff_id = (SELECT public.current_tutor_id())
    AND assignment.unassigned_at IS NULL
);

GRANT SELECT ON public.vtutor_class_detail TO authenticated;
