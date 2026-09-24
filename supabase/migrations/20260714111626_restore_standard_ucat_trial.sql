-- Restore a short, configurable UCAT Unlimited trial for first-time students
-- who do not use a referral access gift. Referral and trial eligibility is
-- enforced by the trusted checkout route; this remains the admin-editable
-- duration and 0 continues to disable the standard trial.

UPDATE public.ucat_subscription_config
SET trial_days = 5,
    updated_at = now();

ALTER TABLE public.ucat_subscription_config
  DROP CONSTRAINT IF EXISTS ucat_subscription_config_trial_days_check;

ALTER TABLE public.ucat_subscription_config
  ADD CONSTRAINT ucat_subscription_config_trial_days_check
  CHECK (trial_days BETWEEN 0 AND 730);

COMMENT ON COLUMN public.ucat_subscription_config.trial_days IS
  'Standard UCAT Unlimited trial length for eligible first-time students without a referral access gift. Set to 0 to disable; editable in Admin Web.';

-- The referral-only rollout removed this trigger. Restore it so creating the
-- Stripe-backed trial permanently consumes the one-time standard trial.
DROP TRIGGER IF EXISTS trg_mark_ucat_unlimited_trial_consumed
  ON public.student_subscriptions;

CREATE TRIGGER trg_mark_ucat_unlimited_trial_consumed
  AFTER INSERT ON public.student_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_ucat_unlimited_trial_consumed();

-- Restore the eligibility signal used by UCAT Web. Checkout remains the
-- authority and repeats these checks immediately before creating the session.
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
  s.ucat_signup_completed_at
FROM public.students s
WHERE s.id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_access IS
  'UCAT entitlements, signup progress, and standard trial eligibility. Checkout is authoritative for referral and subscription race checks.';
