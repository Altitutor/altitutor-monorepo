-- UCAT Accountability Pricing launch settings and refer-a-friend rewards.

-- Keep UCAT Pro's configured fixed premium above Unlimited while changing the
-- launch prices. Yearly remains configured for future use but is not offered.
DO $$
DECLARE
  v_interval text;
  v_target_cents integer;
  v_existing_unlimited integer;
  v_existing_pro integer;
  v_pro_premium integer;
BEGIN
  FOR v_interval, v_target_cents IN
    SELECT * FROM (VALUES ('week'::text, 1500), ('month'::text, 4000)) AS targets(interval_name, target_cents)
  LOOP
    SELECT base_price_cents
      INTO v_existing_unlimited
      FROM public.ucat_plan_prices
      WHERE plan_tier = 'unlimited' AND billing_interval = v_interval;

    SELECT base_price_cents
      INTO v_existing_pro
      FROM public.ucat_plan_prices
      WHERE plan_tier = 'pro' AND billing_interval = v_interval;

    v_pro_premium := GREATEST(
      COALESCE(v_existing_pro, v_target_cents) - COALESCE(v_existing_unlimited, v_target_cents),
      0
    );

    UPDATE public.ucat_plan_prices
    SET base_price_cents = v_target_cents,
        updated_at = now()
    WHERE plan_tier = 'unlimited' AND billing_interval = v_interval;

    IF v_existing_pro IS NOT NULL AND v_existing_pro > 0 THEN
      UPDATE public.ucat_plan_prices
      SET base_price_cents = v_target_cents + v_pro_premium,
          updated_at = now()
      WHERE plan_tier = 'pro' AND billing_interval = v_interval;
    END IF;
  END LOOP;
END $$;

UPDATE public.ucat_subscription_config
SET min_questions_per_day = 10,
    updated_at = now();

INSERT INTO public.ucat_practice_day_discount_config (
  billing_interval,
  discount_per_day_cents,
  max_discounts_per_period
)
VALUES
  ('week', 100, 5),
  ('month', 100, 22)
ON CONFLICT (billing_interval) DO UPDATE
SET discount_per_day_cents = EXCLUDED.discount_per_day_cents,
    max_discounts_per_period = EXCLUDED.max_discounts_per_period,
    updated_at = now();

UPDATE public.ucat_plan_prices
SET checkout_enabled = false,
    updated_at = now()
WHERE billing_interval = 'year';

-- Only questions with a response actually submitted qualify. Merely viewed,
-- unanswered, and timed-out questions remain submitted for scoring/history but
-- do not count toward Accountability Pricing.
CREATE OR REPLACE FUNCTION public.count_submitted_attempts_today(
  p_student_id uuid,
  p_timezone text DEFAULT 'Australia/Adelaide'
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM public.student_question_attempts sqa
  WHERE sqa.student_id = p_student_id
    AND sqa.is_submitted = true
    AND (
      sqa.question_answer_option_id IS NOT NULL
      OR sqa.answer_snapshot IS NOT NULL
    )
    AND (sqa.attempted_at AT TIME ZONE p_timezone)::date =
        (now() AT TIME ZONE p_timezone)::date;
$$;

REVOKE ALL ON FUNCTION public.count_submitted_attempts_today(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_submitted_attempts_today(uuid, text) TO service_role;

ALTER TABLE public.student_payment_methods
  ADD COLUMN IF NOT EXISTS card_fingerprint text;

COMMENT ON COLUMN public.student_payment_methods.card_fingerprint IS
  'Server-only Stripe card fingerprint used to reject paid self-referrals. Not a card number.';

CREATE INDEX IF NOT EXISTS idx_student_payment_methods_card_fingerprint
  ON public.student_payment_methods(card_fingerprint)
  WHERE card_fingerprint IS NOT NULL;

CREATE TABLE public.ucat_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucat_referral_codes_code_format CHECK (code ~ '^[A-Z0-9]{8,16}$')
);

CREATE TABLE public.ucat_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.ucat_referral_codes(id) ON DELETE RESTRICT,
  referrer_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  referred_student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  free_qualified_at timestamptz,
  paid_qualified_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  referred_checkout_session_id text,
  referred_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucat_referrals_not_self CHECK (referrer_student_id <> referred_student_id),
  CONSTRAINT ucat_referrals_rejection_consistent CHECK (
    (rejected_at IS NULL AND rejection_reason IS NULL)
    OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE INDEX idx_ucat_referrals_referrer
  ON public.ucat_referrals(referrer_student_id, created_at DESC);
CREATE INDEX idx_ucat_referrals_paid_pending
  ON public.ucat_referrals(referred_student_id)
  WHERE paid_qualified_at IS NULL AND rejected_at IS NULL;

CREATE TABLE public.ucat_referral_bill_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.ucat_referrals(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'applied', 'redeemed', 'revoked')),
  stripe_subscription_id text,
  stripe_invoice_id text,
  applied_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_id, student_id),
  CONSTRAINT ucat_referral_bill_rewards_redeemed_consistent CHECK (
    (status <> 'redeemed') OR (redeemed_at IS NOT NULL AND stripe_invoice_id IS NOT NULL)
  )
);

CREATE INDEX idx_ucat_referral_bill_rewards_student_status
  ON public.ucat_referral_bill_rewards(student_id, status, created_at);
CREATE UNIQUE INDEX idx_ucat_referral_bill_rewards_one_applied_per_subscription
  ON public.ucat_referral_bill_rewards(stripe_subscription_id)
  WHERE status = 'applied';

ALTER TABLE public.ucat_free_quota_reset_entitlements
  ADD COLUMN IF NOT EXISTS grant_source text NOT NULL DEFAULT 'admin'
    CHECK (grant_source IN ('admin', 'promotion', 'referral')),
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.ucat_referrals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_ucat_free_quota_reset_referral_student
  ON public.ucat_free_quota_reset_entitlements(referral_id, student_id)
  WHERE referral_id IS NOT NULL;

ALTER TABLE public.ucat_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_referral_bill_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own UCAT referral code"
  ON public.ucat_referral_codes
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

CREATE POLICY "Students read participating UCAT referrals"
  ON public.ucat_referrals
  FOR SELECT TO authenticated
  USING (
    referrer_student_id = (SELECT public.current_student_id())
    OR referred_student_id = (SELECT public.current_student_id())
  );

CREATE POLICY "Students read own UCAT referral bill rewards"
  ON public.ucat_referral_bill_rewards
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

GRANT SELECT ON public.ucat_referral_codes TO authenticated;
GRANT SELECT ON public.ucat_referrals TO authenticated;
GRANT SELECT ON public.ucat_referral_bill_rewards TO authenticated;

COMMENT ON TABLE public.ucat_referral_codes IS
  'One stable share code per UCAT student.';
COMMENT ON TABLE public.ucat_referrals IS
  'Immutable attribution from one new UCAT student to one referring student, with separate Free and paid qualification milestones.';
COMMENT ON TABLE public.ucat_referral_bill_rewards IS
  'One queued free-bill entitlement for each participant in a paid-qualified referral. At most one is applied to a subscription invoice at a time.';

CREATE OR REPLACE FUNCTION public.maybe_qualify_ucat_free_referral(
  p_referred_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_referral public.ucat_referrals%ROWTYPE;
  v_timezone text;
  v_qualifying_days integer;
BEGIN
  SELECT * INTO v_referral
  FROM public.ucat_referrals
  WHERE referred_student_id = p_referred_student_id
    AND free_qualified_at IS NULL
    AND rejected_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR now() > v_referral.created_at + interval '14 days' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(timezone, 'Australia/Adelaide')
  INTO v_timezone
  FROM public.students
  WHERE id = p_referred_student_id;

  SELECT count(*)::integer
  INTO v_qualifying_days
  FROM (
    SELECT (sqa.attempted_at AT TIME ZONE v_timezone)::date AS practice_date
    FROM public.student_question_attempts sqa
    WHERE sqa.student_id = p_referred_student_id
      AND sqa.attempted_at >= v_referral.created_at
      AND sqa.is_submitted = true
      AND (
        sqa.question_answer_option_id IS NOT NULL
        OR sqa.answer_snapshot IS NOT NULL
      )
    GROUP BY (sqa.attempted_at AT TIME ZONE v_timezone)::date
    HAVING count(*) >= 10
  ) qualifying_dates;

  IF v_qualifying_days < 2 THEN
    RETURN false;
  END IF;

  UPDATE public.ucat_referrals
  SET free_qualified_at = now(), updated_at = now()
  WHERE id = v_referral.id;

  INSERT INTO public.ucat_free_quota_reset_entitlements (
    student_id,
    expires_at,
    grant_source,
    referral_id
  )
  VALUES
    (v_referral.referrer_student_id, now() + interval '30 days', 'referral', v_referral.id),
    (v_referral.referred_student_id, now() + interval '30 days', 'referral', v_referral.id)
  ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.qualify_ucat_paid_referral(
  p_referred_student_id uuid,
  p_checkout_session_id text,
  p_subscription_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_referral public.ucat_referrals%ROWTYPE;
BEGIN
  SELECT * INTO v_referral
  FROM public.ucat_referrals
  WHERE referred_student_id = p_referred_student_id
    AND paid_qualified_at IS NULL
    AND rejected_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.ucat_referrals
  SET paid_qualified_at = now(),
      referred_checkout_session_id = nullif(p_checkout_session_id, ''),
      referred_subscription_id = p_subscription_id,
      updated_at = now()
  WHERE id = v_referral.id;

  INSERT INTO public.ucat_referral_bill_rewards (referral_id, student_id)
  VALUES
    (v_referral.id, v_referral.referrer_student_id),
    (v_referral.id, v_referral.referred_student_id)
  ON CONFLICT (referral_id, student_id) DO NOTHING;

  RETURN v_referral.id;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_qualify_ucat_free_referral(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qualify_ucat_paid_referral(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_qualify_ucat_free_referral(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.qualify_ucat_paid_referral(uuid, text, text) TO service_role;
