-- Free-time invitations now reserve a card-backed subscription checkout.
-- Historical redeemed no-card passes retain their original access entitlement.
DO $$ DECLARE constraint_name text; BEGIN
  SELECT conname INTO STRICT constraint_name FROM pg_constraint
    WHERE conrelid = 'public.ucat_founder_redemptions'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%access_ends_at%';
  EXECUTE format('ALTER TABLE public.ucat_founder_redemptions DROP CONSTRAINT %I', constraint_name);
END $$;
ALTER TABLE public.ucat_founder_redemptions ADD CONSTRAINT founder_access_redemption_dates
  CHECK (kind <> 'access_pass' OR status <> 'redeemed' OR
    (redeemed_at IS NOT NULL AND access_ends_at IS NOT NULL AND access_ends_at > redeemed_at));

CREATE OR REPLACE FUNCTION public.claim_ucat_founder_offer(p_student_id uuid, p_code text, p_billing_interval text DEFAULT NULL)
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
    IF claim.offer_id = offer.id AND (claim.status = 'reserved' AND claim.billing_interval = p_billing_interval) THEN
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
    IF student.ucat_online_tier_override <> 'default' THEN RAISE EXCEPTION 'Your account already has an access override.'; END IF;
    IF student.ucat_unlimited_trial_consumed_at IS NOT NULL OR EXISTS (
      SELECT 1 FROM public.ucat_referrals WHERE referred_student_id = p_student_id AND gift_status = 'accepted'
    ) OR EXISTS (
      SELECT 1 FROM public.ucat_referral_access_gifts WHERE student_id = p_student_id AND status IN ('available','checkout_pending','used')
    ) THEN RAISE EXCEPTION 'Free access offers cannot be combined with a previous trial or referral gift.'; END IF;
  END IF;
  IF p_billing_interval IS NULL OR p_billing_interval NOT IN ('week','month','year') THEN RAISE EXCEPTION 'Choose a billing interval.'; END IF;
  INSERT INTO public.ucat_founder_redemptions(offer_id, student_id, kind, status, billing_interval)
    VALUES (offer.id, p_student_id, offer.kind, 'reserved', p_billing_interval) RETURNING * INTO claim;
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
      AND r.stripe_subscription_id IS NULL AND r.kind = 'access_pass' AND r.status = 'redeemed' AND r.access_ends_at > now()) THEN 'unlimited'
    ELSE 'free' END
  FROM public.students s WHERE s.id = p_student_id
    AND (s.user_id = (SELECT auth.uid()) OR (SELECT auth.jwt() ->> 'role') = 'service_role');
$$;
REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid) TO authenticated, service_role;
