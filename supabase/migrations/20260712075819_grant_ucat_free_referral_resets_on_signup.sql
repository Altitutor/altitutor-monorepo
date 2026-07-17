-- Free referral resets are granted in the same transaction as attribution.
-- There is intentionally no practice qualification threshold: acquiring a new
-- student is worth the negligible marginal cost of two quota resets.
CREATE OR REPLACE FUNCTION public.grant_ucat_free_referral_resets_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ucat_free_quota_reset_entitlements (
    student_id,
    expires_at,
    grant_source,
    referral_id
  )
  VALUES
    (NEW.referrer_student_id, now() + interval '30 days', 'referral', NEW.id),
    (NEW.referred_student_id, now() + interval '30 days', 'referral', NEW.id)
  ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

  UPDATE public.ucat_referrals
  SET free_qualified_at = now(), updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ucat_free_referral_resets_on_insert()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS grant_ucat_free_referral_resets_on_insert
  ON public.ucat_referrals;
CREATE TRIGGER grant_ucat_free_referral_resets_on_insert
AFTER INSERT ON public.ucat_referrals
FOR EACH ROW
EXECUTE FUNCTION public.grant_ucat_free_referral_resets_on_insert();

-- Apply the simpler rule to referrals captured before this migration. The
-- entitlement uniqueness index keeps the backfill idempotent.
INSERT INTO public.ucat_free_quota_reset_entitlements (
  student_id,
  expires_at,
  grant_source,
  referral_id
)
SELECT r.referrer_student_id, now() + interval '30 days', 'referral', r.id
FROM public.ucat_referrals r
WHERE r.free_qualified_at IS NULL AND r.rejected_at IS NULL
UNION ALL
SELECT r.referred_student_id, now() + interval '30 days', 'referral', r.id
FROM public.ucat_referrals r
WHERE r.free_qualified_at IS NULL AND r.rejected_at IS NULL
ON CONFLICT (referral_id, student_id) WHERE referral_id IS NOT NULL DO NOTHING;

UPDATE public.ucat_referrals
SET free_qualified_at = now(), updated_at = now()
WHERE free_qualified_at IS NULL AND rejected_at IS NULL;

DROP FUNCTION IF EXISTS public.maybe_qualify_ucat_free_referral(uuid);
