-- Add welcome modal acknowledgement timestamp for student-web onboarding.
-- Students should see the welcome modal until they explicitly dismiss once.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS welcome_modal_acknowledged_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.students.welcome_modal_acknowledged_at IS
  'Timestamp when student acknowledged the one-time welcome modal in student-web.';

CREATE OR REPLACE VIEW public.vstudent_profile
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.status,
  s.user_id,
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
  s.updated_at,
  s.welcome_modal_acknowledged_at
FROM public.students s
WHERE s.id = public.current_student_id();

GRANT SELECT ON public.vstudent_profile TO authenticated;
