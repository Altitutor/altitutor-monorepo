-- Replace the generic UCAT trial with explicit, seven-day referral gift
-- offers. Gifts always start UCAT Unlimited; Pro is never gifted.

UPDATE public.ucat_subscription_config
SET trial_days = 0,
    updated_at = now();

DROP TRIGGER IF EXISTS grant_ucat_free_referral_resets_on_insert
  ON public.ucat_referrals;
DROP FUNCTION IF EXISTS public.grant_ucat_free_referral_resets_on_insert();

ALTER TABLE public.ucat_referrals
  ADD COLUMN referrer_tier_at_offer text NOT NULL DEFAULT 'free',
  ADD COLUMN referrer_billing_interval_at_offer text,
  ADD COLUMN gift_duration_interval text NOT NULL DEFAULT 'week',
  ADD COLUMN gift_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN gift_expires_at timestamptz,
  ADD COLUMN gift_accepted_at timestamptz;

ALTER TABLE public.ucat_referrals
  ADD CONSTRAINT ucat_referrals_referrer_tier_at_offer_check
    CHECK (referrer_tier_at_offer IN ('free', 'unlimited', 'pro')),
  ADD CONSTRAINT ucat_referrals_referrer_interval_at_offer_check
    CHECK (
      referrer_billing_interval_at_offer IS NULL
      OR referrer_billing_interval_at_offer IN ('week', 'month', 'year')
    ),
  ADD CONSTRAINT ucat_referrals_gift_duration_check
    CHECK (gift_duration_interval IN ('week', 'month')),
  ADD CONSTRAINT ucat_referrals_gift_status_check
    CHECK (
      gift_status IN (
        'pending',
        'checkout_pending',
        'accepted',
        'rejected',
        'expired',
        'invalid'
      )
    );

-- Existing referral rows used the superseded immediate-reset/trial model.
-- Keep their attribution and historical rewards, but do not re-offer them.
UPDATE public.ucat_referrals
SET gift_status = 'expired',
    gift_expires_at = created_at,
    updated_at = now()
WHERE gift_expires_at IS NULL;

ALTER TABLE public.ucat_referrals
  ALTER COLUMN gift_expires_at SET NOT NULL;

CREATE INDEX idx_ucat_referrals_referred_pending_gift
  ON public.ucat_referrals(referred_student_id, gift_expires_at)
  WHERE gift_status IN ('pending', 'checkout_pending');

ALTER TABLE public.ucat_referral_bill_rewards
  ADD COLUMN reward_type text NOT NULL DEFAULT 'full_bill'
    CHECK (reward_type IN ('full_bill', 'fixed_credit')),
  ADD COLUMN amount_off_cents integer
    CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  ADD CONSTRAINT ucat_referral_bill_rewards_amount_consistent CHECK (
    (reward_type = 'full_bill' AND amount_off_cents IS NULL)
    OR (reward_type = 'fixed_credit' AND amount_off_cents IS NOT NULL)
  );

CREATE TABLE public.ucat_referral_access_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.ucat_referrals(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  duration_interval text NOT NULL CHECK (duration_interval IN ('week', 'month')),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'checkout_pending', 'used', 'revoked')),
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_id, student_id),
  CONSTRAINT ucat_referral_access_gifts_used_consistent CHECK (
    status <> 'used'
    OR (
      used_at IS NOT NULL
      AND stripe_checkout_session_id IS NOT NULL
      AND stripe_subscription_id IS NOT NULL
    )
  )
);

CREATE INDEX idx_ucat_referral_access_gifts_student_status
  ON public.ucat_referral_access_gifts(student_id, status, created_at);

ALTER TABLE public.ucat_referral_access_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own UCAT referral access gifts"
  ON public.ucat_referral_access_gifts
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

GRANT SELECT ON public.ucat_referral_access_gifts TO authenticated;

COMMENT ON TABLE public.ucat_referral_access_gifts IS
  'Claimable UCAT Unlimited weeks or months earned by Free referrers. These are never Pro gifts.';

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
        AND ss.plan_tier IN ('unlimited', 'pro')
      THEN ss.plan_tier
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

CREATE TRIGGER prepare_ucat_referral_gift_on_insert
BEFORE INSERT ON public.ucat_referrals
FOR EACH ROW
EXECUTE FUNCTION public.prepare_ucat_referral_gift_on_insert();

CREATE OR REPLACE FUNCTION public.notify_ucat_referral_gift_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_referrer_name text;
  v_duration_label text;
BEGIN
  SELECT coalesce(nullif(trim(s.first_name), ''), 'A friend')
  INTO v_referrer_name
  FROM public.students s
  WHERE s.id = NEW.referrer_student_id;

  v_duration_label := CASE
    WHEN NEW.gift_duration_interval = 'month' THEN 'month'
    ELSE 'week'
  END;

  INSERT INTO public.notifications (
    student_id,
    notification_type,
    app_scope,
    title,
    body,
    action_url,
    metadata,
    dedupe_key,
    priority,
    expires_at
  )
  VALUES (
    NEW.referred_student_id,
    'ucat.referral.gift_pending',
    'ucat_web',
    v_referrer_name || ' sent you a gift',
    v_referrer_name || ' has gifted you one free ' || v_duration_label ||
      ' of UCAT Unlimited. Accept or reject it within 7 days.',
    '/settings/plan/referrals?gift=' || NEW.id::text,
    jsonb_build_object(
      'referral_id', NEW.id,
      'gift_duration', NEW.gift_duration_interval,
      'referrer_name', v_referrer_name,
      'action_label', 'Review gift',
      'action_required', true,
      'dismissible', false
    ),
    'ucat:referral:gift:' || NEW.id::text || ':recipient',
    'important',
    NEW.gift_expires_at
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_referral_gift_on_insert()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_ucat_referral_gift_on_insert
AFTER INSERT ON public.ucat_referrals
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_referral_gift_on_insert();

CREATE OR REPLACE FUNCTION public.expire_ucat_referral_gifts()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.ucat_referrals r
    SET gift_status = 'expired', updated_at = now()
    WHERE r.gift_status IN ('pending', 'checkout_pending')
      AND r.gift_expires_at <= now()
    RETURNING r.id
  )
  UPDATE public.notifications n
  SET resolved_at = coalesce(n.resolved_at, now()), updated_at = now()
  FROM expired e
  WHERE n.dedupe_key = 'ucat:referral:gift:' || e.id::text || ':recipient';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_ucat_referral_gifts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_ucat_referral_gifts() TO service_role;

CREATE OR REPLACE FUNCTION public.reject_ucat_referral_gift(
  p_referral_id uuid,
  p_referred_student_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_referral public.ucat_referrals%ROWTYPE;
BEGIN
  SELECT * INTO v_referral
  FROM public.ucat_referrals r
  WHERE r.id = p_referral_id
    AND r.referred_student_id = p_referred_student_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_referral.gift_status NOT IN ('pending', 'checkout_pending')
    OR v_referral.gift_expires_at <= now()
  THEN
    RETURN false;
  END IF;

  UPDATE public.ucat_referrals
  SET gift_status = 'rejected',
      rejected_at = now(),
      rejection_reason = 'declined_by_recipient',
      updated_at = now()
  WHERE id = v_referral.id;

  UPDATE public.notifications
  SET resolved_at = now(), updated_at = now()
  WHERE dedupe_key = 'ucat:referral:gift:' || v_referral.id::text || ':recipient'
    AND resolved_at IS NULL;

  INSERT INTO public.ucat_free_quota_reset_entitlements (
    student_id,
    expires_at,
    grant_source,
    referral_id
  )
  VALUES (
    v_referral.referred_student_id,
    now() + interval '30 days',
    'referral',
    v_referral.id
  )
  ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

  INSERT INTO public.notifications (
    student_id, notification_type, app_scope, title, body, action_url,
    metadata, dedupe_key
  )
  VALUES (
    v_referral.referred_student_id,
    'ucat.referral.gift_rejected_reset',
    'ucat_web',
    'Your Free quota reset is ready',
    'You declined the referral gift, so we added a quota reset for UCAT Free.',
    '/settings/plan',
    jsonb_build_object('referral_id', v_referral.id, 'reward', 'free_quota_reset'),
    'ucat:referral:gift:' || v_referral.id::text || ':recipient-reset'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  IF v_referral.referrer_tier_at_offer = 'free' THEN
    INSERT INTO public.ucat_free_quota_reset_entitlements (
      student_id,
      expires_at,
      grant_source,
      referral_id
    )
    VALUES (
      v_referral.referrer_student_id,
      now() + interval '30 days',
      'referral',
      v_referral.id
    )
    ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

    INSERT INTO public.notifications (
      student_id, notification_type, app_scope, title, body, action_url,
      metadata, dedupe_key
    )
    VALUES (
      v_referral.referrer_student_id,
      'ucat.referral.free_rejection_reset',
      'ucat_web',
      'You received a Free quota reset',
      'Your friend continued with UCAT Free, so you both received a quota reset.',
      '/settings/plan/referrals',
      jsonb_build_object('referral_id', v_referral.id, 'reward', 'free_quota_reset'),
      'ucat:referral:gift:' || v_referral.id::text || ':referrer-reset'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_ucat_referral_gift(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ucat_referral_gift(uuid, uuid)
  TO service_role;

-- Called only after Checkout completion and Stripe customer/card validation.
CREATE OR REPLACE FUNCTION public.qualify_ucat_paid_referral(
  p_referred_student_id uuid,
  p_checkout_session_id text,
  p_subscription_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_referral public.ucat_referrals%ROWTYPE;
  v_annual_credit_cents integer;
BEGIN
  SELECT * INTO v_referral
  FROM public.ucat_referrals r
  WHERE r.referred_student_id = p_referred_student_id
    AND r.gift_status = 'checkout_pending'
    AND r.gift_expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.ucat_referrals
  SET gift_status = 'accepted',
      gift_accepted_at = now(),
      paid_qualified_at = now(),
      referred_checkout_session_id = nullif(p_checkout_session_id, ''),
      referred_subscription_id = p_subscription_id,
      updated_at = now()
  WHERE id = v_referral.id;

  UPDATE public.notifications
  SET resolved_at = now(), updated_at = now()
  WHERE dedupe_key = 'ucat:referral:gift:' || v_referral.id::text || ':recipient'
    AND resolved_at IS NULL;

  IF v_referral.referrer_tier_at_offer = 'free' THEN
    INSERT INTO public.ucat_referral_access_gifts (
      referral_id,
      student_id,
      duration_interval
    )
    VALUES (
      v_referral.id,
      v_referral.referrer_student_id,
      v_referral.gift_duration_interval
    )
    ON CONFLICT (referral_id, student_id) DO NOTHING;
  ELSE
    IF v_referral.referrer_billing_interval_at_offer = 'year' THEN
      SELECT greatest(round(p.base_price_cents / 12.0)::integer, 1)
      INTO v_annual_credit_cents
      FROM public.ucat_plan_prices p
      WHERE p.plan_tier = v_referral.referrer_tier_at_offer
        AND p.billing_interval = 'year';
    END IF;

    INSERT INTO public.ucat_referral_bill_rewards (
      referral_id,
      student_id,
      reward_type,
      amount_off_cents
    )
    VALUES (
      v_referral.id,
      v_referral.referrer_student_id,
      CASE
        WHEN v_referral.referrer_billing_interval_at_offer = 'year'
        THEN 'fixed_credit'
        ELSE 'full_bill'
      END,
      CASE
        WHEN v_referral.referrer_billing_interval_at_offer = 'year'
        THEN coalesce(v_annual_credit_cents, 1)
        ELSE NULL
      END
    )
    ON CONFLICT (referral_id, student_id) DO NOTHING;
  END IF;

  RETURN v_referral.id;
END;
$$;

REVOKE ALL ON FUNCTION public.qualify_ucat_paid_referral(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qualify_ucat_paid_referral(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.notify_ucat_referral_access_gift_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_duration_label text;
BEGIN
  v_duration_label := CASE WHEN NEW.duration_interval = 'month' THEN 'month' ELSE 'week' END;
  INSERT INTO public.notifications (
    student_id, notification_type, app_scope, title, body, action_url,
    metadata, dedupe_key, priority
  )
  VALUES (
    NEW.student_id,
    'ucat.referral.access_gift_earned',
    'ucat_web',
    'You earned a free ' || v_duration_label || ' of UCAT Unlimited',
    'Your friend accepted your gift. Start your free ' || v_duration_label ||
      ' whenever you are ready.',
    '/checkout?tier=unlimited&interval=' || NEW.duration_interval ||
      '&context=referral_gift&gift=' || NEW.id::text,
    jsonb_build_object(
      'referral_id', NEW.referral_id,
      'access_gift_id', NEW.id,
      'gift_duration', NEW.duration_interval,
      'action_label', 'Start gift'
    ),
    'ucat:referral:access-gift:' || NEW.id::text,
    'important'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_referral_access_gift_on_insert()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_ucat_referral_access_gift_on_insert
AFTER INSERT ON public.ucat_referral_access_gifts
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_referral_access_gift_on_insert();

CREATE OR REPLACE FUNCTION public.notify_ucat_referral_free_bill_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.reward_type = 'fixed_credit' THEN
    INSERT INTO public.notifications (
      student_id, notification_type, app_scope, title, body, action_url,
      metadata, dedupe_key, priority
    )
    VALUES (
      NEW.student_id,
      'ucat.referral.billing_credit_earned',
      'ucat_web',
      'You earned a referral credit',
      'Your friend accepted your UCAT Unlimited gift. A one-month-equivalent credit will be applied to your next annual bill.',
      '/settings/plan/referrals',
      jsonb_build_object(
        'referral_id', NEW.referral_id,
        'bill_reward_id', NEW.id,
        'amount_off_cents', NEW.amount_off_cents
      ),
      'ucat:referral:free-bill:' || NEW.id::text,
      'important'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    student_id, notification_type, app_scope, title, body, action_url,
    metadata, dedupe_key, priority
  )
  VALUES (
    NEW.student_id,
    'ucat.referral.free_bill_earned',
    'ucat_web',
    'Your next bill is free',
    'Your friend accepted your UCAT Unlimited gift. This reward will be applied automatically at renewal.',
    '/settings/plan/referrals',
    jsonb_build_object('referral_id', NEW.referral_id, 'bill_reward_id', NEW.id),
    'ucat:referral:free-bill:' || NEW.id::text,
    'important'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_referral_free_bill_on_insert()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.ucat_referrals IS
  'Immutable referral attribution plus one seven-day UCAT Unlimited gift offer for the referred student.';
COMMENT ON TABLE public.ucat_referral_bill_rewards IS
  'Queued free-renewal rewards earned only by paid referrers after a recipient accepts their Unlimited gift.';

DROP TRIGGER IF EXISTS trg_mark_ucat_unlimited_trial_consumed
  ON public.student_subscriptions;

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
    WHEN s.ucat_online_tier_override = 'force_pro' THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status IN ('active', 'past_due')
        AND ss.plan_tier = 'pro'
    ) THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        -- Legacy trialing rows retain Unlimited access until Stripe advances
        -- them, but the product no longer exposes a separate trial tier.
        AND ss.status IN ('trialing', 'active', 'past_due')
    ) THEN 'unlimited'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id
    AND (
      (SELECT auth.uid()) IS NULL
      OR s.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid)
  TO authenticated, service_role;

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
  false AS unlimited_trial_eligible,
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
  'UCAT entitlements: online tier, quota exemption, plan onboarding, and signup wizard progress. Generic trial eligibility is retired.';
