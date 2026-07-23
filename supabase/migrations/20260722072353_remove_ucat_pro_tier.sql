-- Altitutor UCAT now has two product tiers: Free and Unlimited.
-- This project is pre-launch, so collapse any test/configuration remnants of
-- the retired Pro tier into Unlimited before tightening the schema.

UPDATE public.students
SET ucat_online_tier_override = 'force_unlimited'
WHERE ucat_online_tier_override = 'force_pro';

UPDATE public.student_subscriptions
SET plan_tier = 'unlimited',
    updated_at = now()
WHERE plan_tier = 'pro';

UPDATE public.ucat_referrals
SET referrer_tier_at_offer = 'unlimited'
WHERE referrer_tier_at_offer = 'pro';

UPDATE public.ucat_subscription_journey_events
SET plan_tier = 'unlimited'
WHERE plan_tier = 'pro';

DELETE FROM public.ucat_plan_prices
WHERE plan_tier = 'pro';

ALTER TABLE public.ucat_plan_prices
  DROP CONSTRAINT IF EXISTS ucat_plan_prices_plan_tier_check,
  ADD CONSTRAINT ucat_plan_prices_plan_tier_check
    CHECK (plan_tier = 'unlimited');

ALTER TABLE public.student_subscriptions
  DROP CONSTRAINT IF EXISTS student_subscriptions_plan_tier_check,
  ADD CONSTRAINT student_subscriptions_plan_tier_check
    CHECK (plan_tier IS NULL OR plan_tier = 'unlimited');

ALTER TABLE public.ucat_subscription_journey_events
  DROP CONSTRAINT IF EXISTS ucat_subscription_journey_events_plan_tier_check,
  ADD CONSTRAINT ucat_subscription_journey_events_plan_tier_check
    CHECK (plan_tier IS NULL OR plan_tier = 'unlimited');

ALTER TABLE public.ucat_referrals
  DROP CONSTRAINT IF EXISTS ucat_referrals_referrer_tier_at_offer_check,
  ADD CONSTRAINT ucat_referrals_referrer_tier_at_offer_check
    CHECK (referrer_tier_at_offer IN ('free', 'unlimited'));

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_ucat_online_tier_override_check,
  ADD CONSTRAINT students_ucat_online_tier_override_check
    CHECK (
      ucat_online_tier_override IN (
        'default',
        'force_free',
        'force_unlimited'
      )
    );

ALTER TABLE public.ucat_subscription_config
  DROP COLUMN IF EXISTS pro_stripe_product_id;

COMMENT ON TABLE public.ucat_plan_prices IS
  'List prices for UCAT Unlimited at each billing interval.';
COMMENT ON COLUMN public.ucat_plan_prices.plan_tier IS
  'Paid online tier. UCAT Unlimited is the sole paid platform tier.';
COMMENT ON COLUMN public.student_subscriptions.plan_tier IS
  'Paid UCAT platform tier. UCAT Unlimited is the sole paid tier.';
COMMENT ON COLUMN public.students.ucat_online_tier_override IS
  'Admin override: default (Stripe-derived), force_free, or force_unlimited.';
COMMENT ON FUNCTION public.is_ucat_online_student() IS
  'UCAT online product access: any authenticated student profile (UCAT Free or Unlimited). Gates public catalog reads.';

CREATE OR REPLACE FUNCTION public.prepare_ucat_referral_gift_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_tier text := 'free';
  v_interval text;
BEGIN
  SELECT
    CASE
      WHEN ss.status IN ('active', 'past_due')
        AND ss.plan_tier = 'unlimited'
      THEN 'unlimited'
      ELSE 'free'
    END,
    CASE
      WHEN ss.status IN ('active', 'past_due') THEN ss.billing_interval
      ELSE NULL
    END
  INTO v_tier, v_interval
  FROM public.student_subscriptions ss
  WHERE ss.student_id = NEW.referrer_student_id
    AND ss.subject_id = public.get_ucat_subject_id()
  LIMIT 1;

  NEW.referrer_tier_at_offer := coalesce(v_tier, 'free');
  NEW.referrer_billing_interval_at_offer := v_interval;
  NEW.gift_duration_interval := CASE
    WHEN v_interval IN ('month', 'year') THEN 'month'
    ELSE 'week'
  END;
  NEW.gift_status := 'pending';
  NEW.gift_expires_at := now() + interval '7 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_ucat_referral_gift_on_insert()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN EXISTS (
      SELECT 1
      FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status IN ('trialing', 'active', 'past_due')
    ) THEN 'unlimited'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id
    AND (
      s.user_id = (SELECT auth.uid())
      OR (SELECT auth.jwt() ->> 'role') = 'service_role'
    );
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_student_ucat_online_tier(uuid) IS
  'Returns Free or Unlimited for the requested student. Authenticated callers may only resolve their own student row; service-role callers may reconcile any row.';

CREATE OR REPLACE FUNCTION public.is_ucat_online_quota_exempt(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_student_ucat_online_tier(p_student_id) = 'unlimited';
$$;

REVOKE ALL ON FUNCTION public.is_ucat_online_quota_exempt(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ucat_online_quota_exempt(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_ucat_online_quota_exempt(uuid) IS
  'Returns true when a student has UCAT Unlimited access.';
