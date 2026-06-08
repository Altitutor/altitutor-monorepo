-- Migration: UCAT signup onboarding progress on students + access view
-- Adds persisted wizard step, completion timestamp, test year, and exposes them
-- on vstudent_ucat_my_access for the unified /signup/complete flow.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS ucat_signup_step SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ucat_signup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ucat_test_year INTEGER;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_ucat_signup_step_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_signup_step_check
  CHECK (ucat_signup_step >= 1 AND ucat_signup_step <= 5);

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_ucat_test_year_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_test_year_check
  CHECK (
    ucat_test_year IS NULL
    OR (ucat_test_year >= 2020 AND ucat_test_year <= 2100)
  );

COMMENT ON COLUMN public.students.ucat_signup_step IS
  'Current signup onboarding wizard step (1=details, 2=password, 3=plan, 4=test details, 5=targets).';

COMMENT ON COLUMN public.students.ucat_signup_completed_at IS
  'When the student finished signup onboarding (Begin or Skip on step 4). Gates app access.';

COMMENT ON COLUMN public.students.ucat_test_year IS
  'Calendar year the student expects to sit UCAT; may be set without ucat_test_date.';

-- Legacy: plan choice at /subscribe counts as fully onboarded for the new gate.
UPDATE public.students
SET
  ucat_signup_completed_at = COALESCE(
    ucat_signup_completed_at,
    ucat_onboarding_completed_at
  ),
  ucat_signup_step = GREATEST(ucat_signup_step, 5)
WHERE ucat_onboarding_completed_at IS NOT NULL
  AND ucat_signup_completed_at IS NULL;

-- Mid-flow: plan not chosen yet but profile exists — resume at plan step when step is still 1.
UPDATE public.students s
SET ucat_signup_step = 3
FROM auth.users u
WHERE s.user_id = u.id
  AND s.ucat_signup_completed_at IS NULL
  AND s.ucat_onboarding_completed_at IS NULL
  AND s.ucat_signup_step < 3
  AND (u.raw_user_meta_data ->> 'profile_setup_complete') = 'true';

DROP VIEW IF EXISTS public.vstudent_ucat_my_access;

CREATE VIEW public.vstudent_ucat_my_access
WITH (security_invoker = false)
AS
SELECT
  public.is_ucat_online_student() AS has_online_access,
  public.is_ucat_in_person_student() AS has_in_person_access,
  public.is_ucat_student() AS has_ucat_access,
  public.get_student_ucat_online_tier((SELECT public.current_student_id())) AS online_tier,
  public.is_ucat_online_quota_exempt((SELECT public.current_student_id())) AS is_quota_exempt,
  (
    SELECT s.ucat_onboarding_completed_at
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS ucat_onboarding_completed_at,
  (
    SELECT s.ucat_unlimited_trial_consumed_at IS NULL
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS unlimited_trial_eligible,
  (
    SELECT s.ucat_signup_step
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS ucat_signup_step,
  (
    SELECT s.ucat_signup_completed_at
    FROM public.students s
    WHERE s.id = (SELECT public.current_student_id())
  ) AS ucat_signup_completed_at
WHERE (SELECT public.current_student_id()) IS NOT NULL;

GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_access IS
  'UCAT entitlements: online tier, quota exemption, plan onboarding, signup wizard progress, trial eligibility.';
