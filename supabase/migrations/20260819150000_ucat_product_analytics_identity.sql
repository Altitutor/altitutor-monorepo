-- Give UCAT analytics a durable, admin-controlled way to separate genuine
-- external customers from staff, friends, demo users, and invited testers.
ALTER TABLE public.students
  ADD COLUMN ucat_analytics_account_class TEXT NOT NULL DEFAULT 'external';

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_analytics_account_class_check
  CHECK (ucat_analytics_account_class IN ('external', 'internal_test'));

COMMENT ON COLUMN public.students.ucat_analytics_account_class IS
  'Product analytics population: external customer traffic or internal/test traffic excluded from acquisition, conversion, and retention reporting.';

-- Rebuild the current access facade so UCAT Web can identify the signed-in
-- person in PostHog without reading the students base table.
DROP VIEW public.vstudent_ucat_my_access;
CREATE VIEW public.vstudent_ucat_my_access
WITH (security_invoker = false)
AS
SELECT
  public.is_ucat_online_student() AS has_online_access,
  public.is_ucat_in_person_student() AS has_in_person_access,
  public.is_ucat_student() AS has_ucat_access,
  public.get_student_ucat_online_tier((SELECT public.current_student_id())) AS online_tier,
  public.is_ucat_online_quota_exempt((SELECT public.current_student_id())) AS is_quota_exempt,
  s.ucat_onboarding_completed_at,
  (
    s.ucat_unlimited_trial_consumed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_subscriptions ss
      WHERE ss.student_id = s.id
        AND ss.subject_id = public.get_ucat_subject_id()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ucat_referrals r
      WHERE r.referred_student_id = s.id
        AND r.gift_status = 'accepted'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ucat_referral_access_gifts ag
      WHERE ag.student_id = s.id
        AND ag.status IN ('available', 'checkout_pending', 'used')
    )
  ) AS unlimited_trial_eligible,
  s.ucat_signup_step,
  s.ucat_signup_completed_at,
  s.ucat_analytics_account_class,
  profile.test_year AS ucat_test_year,
  profile.test_date AS ucat_test_date
FROM public.students s
LEFT JOIN public.ucat_student_study_plan_profiles profile
  ON profile.student_id = s.id
WHERE s.id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_my_access FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_access IS
  'UCAT entitlements, signup progress, trial eligibility, test timing, and non-sensitive product analytics classification for the current student.';
