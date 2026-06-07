-- UCAT three-tier pricing: Free / Unlimited / Pro with ucat_plan_prices (tier × interval)

-- ========================
-- 1) ucat_plan_prices
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_plan_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('unlimited', 'pro')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('week', 'month', 'year')),
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_tier, billing_interval)
);

COMMENT ON TABLE public.ucat_plan_prices IS 'List prices for UCAT Unlimited and Pro at each billing interval.';
COMMENT ON COLUMN public.ucat_plan_prices.plan_tier IS 'Paid online tier: unlimited (online only) or pro (+ human support).';
COMMENT ON COLUMN public.ucat_plan_prices.billing_interval IS 'Stripe billing cadence: week, month, or year.';

ALTER TABLE public.ucat_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_plan_prices" ON public.ucat_plan_prices;
CREATE POLICY "ADMINSTAFF full access to ucat_plan_prices" ON public.ucat_plan_prices
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Authenticated read ucat_plan_prices" ON public.ucat_plan_prices;
CREATE POLICY "Authenticated read ucat_plan_prices" ON public.ucat_plan_prices
  FOR SELECT TO authenticated
  USING (true);

-- ========================
-- 2) Config: Stripe product IDs per tier; seed plan prices from legacy columns
-- ========================
ALTER TABLE public.ucat_subscription_config
  ADD COLUMN IF NOT EXISTS unlimited_stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS pro_stripe_product_id TEXT;

-- Seed Unlimited weekly/monthly from existing singleton (greenfield; maps old "Pro" product to Unlimited)
INSERT INTO public.ucat_plan_prices (plan_tier, billing_interval, base_price_cents, stripe_price_id)
SELECT 'unlimited', 'week', c.base_price_cents, c.stripe_price_id
FROM public.ucat_subscription_config c
ORDER BY c.created_at ASC
LIMIT 1
ON CONFLICT (plan_tier, billing_interval) DO NOTHING;

INSERT INTO public.ucat_plan_prices (plan_tier, billing_interval, base_price_cents, stripe_price_id)
SELECT
  'unlimited',
  'month',
  COALESCE(c.monthly_base_price_cents, c.base_price_cents * 4),
  c.monthly_stripe_price_id
FROM public.ucat_subscription_config c
ORDER BY c.created_at ASC
LIMIT 1
ON CONFLICT (plan_tier, billing_interval) DO NOTHING;

-- Placeholder rows for Pro and yearly (admin configures prices + Stripe IDs)
INSERT INTO public.ucat_plan_prices (plan_tier, billing_interval, base_price_cents, stripe_price_id)
VALUES
  ('pro', 'week', 0, NULL),
  ('pro', 'month', 0, NULL),
  ('pro', 'year', 0, NULL),
  ('unlimited', 'year', 0, NULL)
ON CONFLICT (plan_tier, billing_interval) DO NOTHING;

UPDATE public.ucat_subscription_config c
SET unlimited_stripe_product_id = COALESCE(c.unlimited_stripe_product_id, c.stripe_product_id)
WHERE c.stripe_product_id IS NOT NULL;

-- Drop legacy per-interval price columns (now in ucat_plan_prices)
ALTER TABLE public.ucat_subscription_config
  DROP COLUMN IF EXISTS base_price_cents,
  DROP COLUMN IF EXISTS monthly_base_price_cents,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS monthly_stripe_price_id,
  DROP COLUMN IF EXISTS stripe_product_id;

-- billing_interval on singleton is unused; keep column for now to avoid breaking unknown refs

-- ========================
-- 3) student_subscriptions: subscribed tier + interval
-- ========================
ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier TEXT CHECK (plan_tier IS NULL OR plan_tier IN ('unlimited', 'pro')),
  ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (
    billing_interval IS NULL OR billing_interval IN ('week', 'month', 'year')
  );

COMMENT ON COLUMN public.student_subscriptions.plan_tier IS 'Paid UCAT tier the student is subscribed to (unlimited or pro).';
COMMENT ON COLUMN public.student_subscriptions.billing_interval IS 'Billing cadence for the active UCAT subscription.';

-- ========================
-- 4) Rename unlimited trial column; expand tier overrides
-- ========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'ucat_pro_trial_consumed_at'
  ) THEN
    ALTER TABLE public.students
      RENAME COLUMN ucat_pro_trial_consumed_at TO ucat_unlimited_trial_consumed_at;
  END IF;
END $$;

COMMENT ON COLUMN public.students.ucat_unlimited_trial_consumed_at IS
  'Set when an Unlimited trial subscription (trialing) is first created; prevents second trial.';

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_ucat_online_tier_override_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_online_tier_override_check
  CHECK (ucat_online_tier_override IN ('default', 'force_free', 'force_unlimited', 'force_pro'));

COMMENT ON COLUMN public.students.ucat_online_tier_override IS
  'Admin override: default (Stripe-derived), force_free, force_unlimited, force_pro.';

-- ========================
-- 5) Online tier resolution
-- ========================
CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN s.ucat_online_tier_override = 'force_pro' THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'trialing'
    ) THEN 'unlimited_trial'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'active'
        AND ss.plan_tier = 'pro'
    ) THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status = 'active'
    ) THEN 'unlimited'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id;
$$;

CREATE OR REPLACE FUNCTION public.is_ucat_online_quota_exempt(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_student_ucat_online_tier(p_student_id) IN (
    'unlimited', 'unlimited_trial', 'pro'
  );
$$;

-- ========================
-- 7) Unlimited trial consumed trigger
-- ========================
CREATE OR REPLACE FUNCTION public.mark_ucat_unlimited_trial_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'trialing'
     AND NEW.subject_id = public.get_ucat_subject_id()
     AND TG_OP = 'INSERT' THEN
    UPDATE public.students
    SET ucat_unlimited_trial_consumed_at = COALESCE(ucat_unlimited_trial_consumed_at, NOW())
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_ucat_pro_trial_consumed ON public.student_subscriptions;
DROP TRIGGER IF EXISTS trg_mark_ucat_unlimited_trial_consumed ON public.student_subscriptions;
CREATE TRIGGER trg_mark_ucat_unlimited_trial_consumed
  AFTER INSERT ON public.student_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_ucat_unlimited_trial_consumed();

-- ========================
-- 8) vstudent_ucat_my_access
-- ========================
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
  ) AS unlimited_trial_eligible
WHERE (SELECT public.current_student_id()) IS NOT NULL;

GRANT SELECT ON public.vstudent_ucat_my_access TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_my_access IS
  'UCAT entitlements: online tier (free/unlimited_trial/unlimited/pro), quota exemption, onboarding and trial eligibility.';

-- ========================
-- 9) vstudent_subscriptions — expose plan tier + interval
-- ========================
DROP VIEW IF EXISTS public.vstudent_subscriptions;
CREATE VIEW public.vstudent_subscriptions
WITH (security_invoker = false)
AS
SELECT
  ss.id,
  ss.student_id,
  ss.subject_id,
  ss.stripe_subscription_id,
  ss.stripe_price_id,
  ss.stripe_product_id,
  ss.plan_tier,
  ss.billing_interval,
  ss.status,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.cancel_at,
  ss.created_at,
  ss.updated_at
FROM public.student_subscriptions ss
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_subscriptions TO authenticated;

COMMENT ON VIEW public.vstudent_subscriptions IS
  'Student view: own subscriptions only (includes plan tier, billing interval, cancel-at-period-end).';
