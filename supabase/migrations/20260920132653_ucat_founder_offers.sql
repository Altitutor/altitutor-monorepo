-- Founder offers are immutable commercial terms; disabling prevents new claims.
CREATE TABLE public.ucat_founder_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^F-[A-Z0-9-]{3,40}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  campaign text NOT NULL CHECK (length(btrim(campaign)) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK (kind IN ('access_pass', 'discount')),
  duration_unit text CHECK (duration_unit IN ('week', 'month')),
  duration_count integer CHECK (duration_count BETWEEN 1 AND 24),
  percent_off integer CHECK (percent_off BETWEEN 1 AND 100),
  max_redemptions integer CHECK (max_redemptions > 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.staff(id),
  CHECK ((kind = 'access_pass' AND duration_unit IS NOT NULL AND duration_count IS NOT NULL AND percent_off IS NULL)
      OR (kind = 'discount' AND percent_off IS NOT NULL AND duration_unit IS NULL AND duration_count IS NULL))
);
CREATE TABLE public.ucat_founder_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.ucat_founder_offers(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  kind text NOT NULL CHECK (kind IN ('access_pass', 'discount')),
  status text NOT NULL CHECK (status IN ('reserved', 'redeemed', 'expired')),
  billing_interval text CHECK (billing_interval IN ('week', 'month', 'year')),
  checkout_session_id text UNIQUE,
  stripe_subscription_id text,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  access_ends_at timestamptz,
  CHECK (kind <> 'access_pass' OR (status = 'redeemed' AND access_ends_at > redeemed_at))
);
CREATE INDEX ucat_founder_redemptions_offer_idx ON public.ucat_founder_redemptions(offer_id, status);
CREATE UNIQUE INDEX ucat_founder_redemptions_student_kind_idx
  ON public.ucat_founder_redemptions(student_id, kind) WHERE status IN ('reserved', 'redeemed');
CREATE INDEX ucat_founder_redemptions_subscription_idx ON public.ucat_founder_redemptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
ALTER TABLE public.ucat_founder_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_founder_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_founder_offers, public.ucat_founder_redemptions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.ucat_founder_offers TO authenticated;
GRANT UPDATE(active) ON public.ucat_founder_offers TO authenticated;
GRANT SELECT ON public.ucat_founder_redemptions TO authenticated;
GRANT ALL ON public.ucat_founder_offers, public.ucat_founder_redemptions TO service_role;
CREATE POLICY founder_offers_admin ON public.ucat_founder_offers FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
-- Defence in depth: the local test seed grants all table privileges broadly.
-- Commercial terms stay immutable even when table-level UPDATE is inherited.
CREATE FUNCTION public.protect_ucat_founder_offer_terms() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user <> 'postgres' AND (to_jsonb(NEW) - 'active') IS DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
    RAISE EXCEPTION 'Offer terms are immutable; create a new code.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_ucat_founder_offer_terms() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_ucat_founder_offer_terms BEFORE UPDATE ON public.ucat_founder_offers
  FOR EACH ROW EXECUTE FUNCTION public.protect_ucat_founder_offer_terms();
CREATE POLICY founder_redemptions_admin ON public.ucat_founder_redemptions FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

-- One open checkout per student also excludes concurrent no-card pass claims.
CREATE TABLE public.ucat_checkout_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id),
  selection_key text NOT NULL,
  suppress_trial boolean NOT NULL DEFAULT false,
  checkout_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ucat_checkout_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_checkout_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ucat_checkout_holds TO service_role;
CREATE FUNCTION public.reserve_ucat_checkout(p_student_id uuid, p_selection_key text, p_referral boolean DEFAULT false)
RETURNS public.ucat_checkout_holds LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE hold public.ucat_checkout_holds; consumed boolean;
BEGIN
  SELECT ucat_unlimited_trial_consumed_at IS NOT NULL INTO consumed FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found.'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_subscriptions WHERE student_id = p_student_id
    AND subject_id = public.get_ucat_subject_id() AND status IN ('trialing','active','past_due','unpaid','incomplete','paused')) THEN
    RAISE EXCEPTION 'You already have a subscription.';
  END IF;
  IF p_referral AND EXISTS (SELECT 1 FROM public.ucat_founder_redemptions WHERE student_id = p_student_id AND kind = 'access_pass' AND status = 'redeemed') THEN
    RAISE EXCEPTION 'Referral gifts cannot be combined with your access pass.';
  END IF;
  SELECT * INTO hold FROM public.ucat_checkout_holds WHERE student_id = p_student_id;
  IF FOUND THEN
    IF hold.selection_key <> p_selection_key THEN RAISE EXCEPTION 'Cancel your open checkout before changing your selection.'; END IF;
    RETURN hold;
  END IF;
  INSERT INTO public.ucat_checkout_holds(student_id, selection_key, suppress_trial)
    VALUES (p_student_id, p_selection_key, consumed) RETURNING * INTO hold;
  RETURN hold;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ucat_checkout(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ucat_checkout(uuid,text,boolean) TO service_role;

-- Called only by authenticated server routes using the service client. Serialize
-- both the student and offer so retries, competing codes and the last slot agree.
CREATE FUNCTION public.claim_ucat_founder_offer(p_student_id uuid, p_code text, p_billing_interval text DEFAULT NULL)
RETURNS public.ucat_founder_redemptions
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  offer public.ucat_founder_offers;
  claim public.ucat_founder_redemptions;
  student public.students;
BEGIN
  SELECT * INTO STRICT student FROM public.students WHERE id = p_student_id FOR UPDATE;
  SELECT * INTO offer FROM public.ucat_founder_offers WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invitation code is not available.'; END IF;
  SELECT * INTO claim FROM public.ucat_founder_redemptions
    WHERE student_id = p_student_id AND kind = offer.kind AND status IN ('reserved', 'redeemed');
  IF FOUND THEN
    IF claim.offer_id = offer.id AND (offer.kind = 'access_pass' OR (claim.status = 'reserved' AND claim.billing_interval = p_billing_interval)) THEN
      RETURN claim;
    END IF;
    RAISE EXCEPTION 'You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.';
  END IF;
  IF NOT offer.active OR offer.expires_at <= now() THEN RAISE EXCEPTION 'This invitation code has expired or been disabled.'; END IF;
  IF offer.max_redemptions IS NOT NULL AND (SELECT count(*) FROM public.ucat_founder_redemptions
      WHERE offer_id = offer.id AND status IN ('reserved', 'redeemed')) >= offer.max_redemptions THEN
    RAISE EXCEPTION 'All places for this invitation have been claimed. Please try again later.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.student_subscriptions WHERE student_id = p_student_id
      AND subject_id = public.get_ucat_subject_id() AND status IN ('trialing','active','past_due','unpaid','incomplete','paused')) THEN
    RAISE EXCEPTION 'Founder offers cannot be applied to an existing subscription.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ucat_referrals WHERE referred_student_id = p_student_id
      AND gift_status = 'checkout_pending') THEN
    RAISE EXCEPTION 'Please finish or cancel your referral checkout first.';
  END IF;
  IF offer.kind = 'access_pass' THEN
    IF EXISTS (SELECT 1 FROM public.ucat_checkout_holds WHERE student_id = p_student_id) THEN
      RAISE EXCEPTION 'Cancel your open checkout before starting a free access pass.';
    END IF;
    IF student.ucat_online_tier_override <> 'default' THEN RAISE EXCEPTION 'Your account already has an access override.'; END IF;
    IF student.ucat_unlimited_trial_consumed_at IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.ucat_referrals WHERE referred_student_id = p_student_id AND gift_status = 'accepted'
    ) OR EXISTS (
      SELECT 1 FROM public.ucat_referral_access_gifts WHERE student_id = p_student_id AND status IN ('available','checkout_pending','used')
    ) THEN RAISE EXCEPTION 'Free access offers cannot be combined with a previous trial or referral gift.'; END IF;
    INSERT INTO public.ucat_founder_redemptions(offer_id, student_id, kind, status, redeemed_at, access_ends_at)
      VALUES (offer.id, p_student_id, offer.kind, 'redeemed', now(),
        now() + CASE WHEN offer.duration_unit = 'week' THEN make_interval(weeks => offer.duration_count)
                    ELSE make_interval(months => offer.duration_count) END) RETURNING * INTO claim;
    UPDATE public.students SET ucat_unlimited_trial_consumed_at = now() WHERE id = p_student_id;
  ELSE
    IF p_billing_interval IS NULL OR p_billing_interval NOT IN ('week','month','year') THEN RAISE EXCEPTION 'Choose a billing interval.'; END IF;
    INSERT INTO public.ucat_founder_redemptions(offer_id, student_id, kind, status, billing_interval)
      VALUES (offer.id, p_student_id, offer.kind, 'reserved', p_billing_interval) RETURNING * INTO claim;
  END IF;
  -- Choosing a founder offer replaces an unaccepted acquisition gift, while
  -- retaining its referral attribution. It does not grant rejection rewards.
  WITH replaced AS (
    UPDATE public.ucat_referrals SET gift_status = 'expired', updated_at = now()
      WHERE referred_student_id = p_student_id AND gift_status = 'pending' RETURNING id
  ) UPDATE public.notifications n SET resolved_at = coalesce(n.resolved_at, now()), updated_at = now()
      FROM replaced r WHERE n.dedupe_key = 'ucat:referral:gift:' || r.id::text || ':recipient';
  RETURN claim;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ucat_founder_offer(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ucat_founder_offer(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.student_subscriptions ss WHERE ss.student_id = p_student_id
      AND ss.subject_id = public.get_ucat_subject_id() AND ss.status IN ('trialing','active','past_due')) THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.ucat_founder_redemptions r WHERE r.student_id = p_student_id
      AND r.kind = 'access_pass' AND r.status = 'redeemed' AND r.access_ends_at > now()) THEN 'unlimited'
    ELSE 'free' END
  FROM public.students s WHERE s.id = p_student_id
    AND (s.user_id = (SELECT auth.uid()) OR (SELECT auth.jwt() ->> 'role') = 'service_role');
$$;
REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid) TO authenticated, service_role;
