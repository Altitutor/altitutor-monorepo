-- Add optional birthday (calendar date) to students and staff profiles.
-- Exposed on self-serve profile views used by student-web and tutor-web.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birthday date;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS birthday date;

COMMENT ON COLUMN public.students.birthday IS
  'Optional student birthday (date only, no timezone).';

COMMENT ON COLUMN public.staff.birthday IS
  'Optional staff birthday (date only, no timezone).';

-- Recreate student self-profile view to include birthday.
-- CREATE OR REPLACE can only append columns to the end of the existing list.
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
  s.onboarding_progress,
  s.birthday
FROM public.students s
WHERE s.id = public.current_student_id();

GRANT SELECT ON public.vstudent_profile TO authenticated;

COMMENT ON VIEW public.vstudent_profile IS
  'Student view: Own profile information (security_invoker = false)';

-- Recreate tutor self-profile view to include birthday
CREATE OR REPLACE VIEW public.vtutor_profile
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone_number AS phone,
  s.role,
  s.status,
  s.user_id,
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
  s.profile_bio,
  s.profile_image_file_id,
  s.birthday
FROM public.staff s
WHERE s.id = public.current_tutor_id();

GRANT SELECT ON public.vtutor_profile TO authenticated;
