-- Migration: expose signup onboarding progress on vstudent_ucat_my_access
-- Depends on 20260607200000 (signup columns) and 20260609100000 (unlimited trial column name).

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
