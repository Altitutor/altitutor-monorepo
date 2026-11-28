-- Apple billing identities are deliberately separate from Stripe subscriptions.
CREATE TABLE public.ucat_apple_accounts (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE RESTRICT,
  account_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ucat_apple_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_apple_accounts FROM anon, authenticated;
GRANT SELECT, INSERT ON public.ucat_apple_accounts TO service_role;

CREATE FUNCTION public.ensure_ucat_apple_account(p_student_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student unavailable';
  END IF;
  INSERT INTO public.ucat_apple_accounts(student_id) VALUES(p_student_id)
    ON CONFLICT (student_id) DO NOTHING;
  SELECT account_token INTO STRICT v_token FROM public.ucat_apple_accounts WHERE student_id = p_student_id;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_ucat_apple_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_ucat_apple_account(uuid) TO service_role;
COMMENT ON TABLE public.ucat_apple_accounts IS 'Durable Apple purchase binding. Account deletion does not transfer a subscription to another Student.';

CREATE TABLE public.ucat_apple_subscriptions (
  environment text NOT NULL CHECK (environment IN ('Production','Sandbox')),
  original_transaction_id text NOT NULL CHECK (original_transaction_id ~ '^[0-9]+$'),
  account_token uuid NOT NULL REFERENCES public.ucat_apple_accounts(account_token) ON DELETE RESTRICT,
  transaction_id text NOT NULL CHECK (transaction_id ~ '^[0-9]+$'),
  product_id text NOT NULL CHECK (product_id IN ('com.altitutor.ucat.unlimited.weekly','com.altitutor.ucat.unlimited.monthly')),
  status integer NOT NULL CHECK (status BETWEEN 1 AND 5),
  access_until timestamptz,
  signed_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  last_checked_at timestamptz,
  sandbox_authorized boolean NOT NULL DEFAULT false,
  PRIMARY KEY(environment,original_transaction_id)
);
CREATE INDEX ucat_apple_subscription_account_idx ON public.ucat_apple_subscriptions(account_token);
ALTER TABLE public.ucat_apple_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_apple_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ucat_apple_subscriptions TO service_role;

CREATE FUNCTION public.record_ucat_apple_subscription(p_snapshot jsonb, p_observed_at timestamptz, p_allow_sandbox boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_token uuid := (p_snapshot->>'accountToken')::uuid; v_rows integer;
BEGIN
  PERFORM 1 FROM public.students WHERE id=(SELECT student_id FROM public.ucat_apple_accounts WHERE account_token=v_token) FOR UPDATE;
  -- A transaction's original account binding is immutable across restores.
  IF EXISTS (SELECT 1 FROM public.ucat_apple_subscriptions WHERE environment = p_snapshot->>'environment'
    AND original_transaction_id = p_snapshot->>'originalTransactionId' AND account_token <> v_token) THEN
    RAISE EXCEPTION 'Apple purchase belongs to another account';
  END IF;
  INSERT INTO public.ucat_apple_subscriptions(environment,original_transaction_id,account_token,transaction_id,product_id,status,access_until,signed_at,observed_at,sandbox_authorized)
  VALUES(p_snapshot->>'environment',p_snapshot->>'originalTransactionId',v_token,p_snapshot->>'transactionId',p_snapshot->>'productId',
    (p_snapshot->>'status')::integer,(p_snapshot->>'accessUntil')::timestamptz,(p_snapshot->>'signedAt')::timestamptz,p_observed_at,p_allow_sandbox)
  ON CONFLICT(environment,original_transaction_id) DO UPDATE SET
    transaction_id = EXCLUDED.transaction_id, product_id = EXCLUDED.product_id, status = EXCLUDED.status,
    access_until = EXCLUDED.access_until, signed_at = EXCLUDED.signed_at, observed_at = EXCLUDED.observed_at,
    sandbox_authorized = EXCLUDED.sandbox_authorized
  WHERE public.ucat_apple_subscriptions.account_token = EXCLUDED.account_token
    AND (public.ucat_apple_subscriptions.signed_at < EXCLUDED.signed_at
      OR (public.ucat_apple_subscriptions.signed_at = EXCLUDED.signed_at
        AND public.ucat_apple_subscriptions.observed_at < EXCLUDED.observed_at));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  -- A competing initial insert may have bound this transaction while we waited.
  IF v_rows = 0 AND EXISTS (SELECT 1 FROM public.ucat_apple_subscriptions WHERE environment = p_snapshot->>'environment'
    AND original_transaction_id = p_snapshot->>'originalTransactionId' AND account_token <> v_token) THEN
    RAISE EXCEPTION 'Apple purchase belongs to another account';
  END IF;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ucat_apple_subscription(jsonb,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ucat_apple_subscription(jsonb,timestamptz,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.student_subscriptions ss WHERE ss.student_id = p_student_id
      AND ss.subject_id = public.get_ucat_subject_id() AND ss.status IN ('trialing','active','past_due')) THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.ucat_apple_accounts aa JOIN public.ucat_apple_subscriptions aps USING(account_token) WHERE aa.student_id=p_student_id AND aps.access_until > now() AND aps.status IN (1,4) AND (aps.environment='Production' OR aps.sandbox_authorized)) THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.ucat_founder_redemptions r WHERE r.student_id = p_student_id
      AND r.stripe_subscription_id IS NULL AND r.kind = 'access_pass' AND r.status = 'redeemed' AND r.access_ends_at > now()) THEN 'unlimited'
    ELSE 'free' END
  FROM public.students s WHERE s.id = p_student_id AND s.deleted_at IS NULL
    AND (s.user_id = (SELECT auth.uid()) OR (SELECT auth.jwt() ->> 'role') = 'service_role');
$function$;
-- Definer facade is intentional: Students have no base-table grants. Keep the
-- caller ownership predicate inside the barrier, as with other vstudent views.
CREATE VIEW public.vstudent_ucat_apple_subscriptions WITH (security_barrier=true) AS
SELECT aps.environment, aps.product_id, aps.status, aps.access_until
FROM public.ucat_apple_subscriptions aps
JOIN public.ucat_apple_accounts aa USING(account_token)
JOIN public.students s ON s.id=aa.student_id
WHERE s.user_id=(SELECT auth.uid()) AND s.deleted_at IS NULL;
REVOKE ALL ON public.vstudent_ucat_apple_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_apple_subscriptions TO authenticated, service_role;

CREATE FUNCTION public.has_managed_ucat_apple_subscription(p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.ucat_apple_accounts aa JOIN public.ucat_apple_subscriptions aps USING(account_token)
    WHERE aa.student_id=p_student_id AND aps.status IN (1,3,4)
    AND (aps.status=3 OR aps.access_until>now()) AND (aps.environment='Production' OR aps.sandbox_authorized));
$$;
REVOKE ALL ON FUNCTION public.has_managed_ucat_apple_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_managed_ucat_apple_subscription(uuid) TO service_role;

CREATE FUNCTION public.prepare_ucat_apple_purchase(p_student_id uuid,p_product_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_override text;
BEGIN
  SELECT ucat_online_tier_override INTO v_override FROM public.students WHERE id=p_student_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student unavailable'; END IF;
  IF p_product_id NOT IN ('com.altitutor.ucat.unlimited.weekly','com.altitutor.ucat.unlimited.monthly') THEN RAISE EXCEPTION 'Unknown Apple product'; END IF;
  IF EXISTS(SELECT 1 FROM public.student_subscriptions WHERE student_id=p_student_id AND subject_id=public.get_ucat_subject_id()
    AND status IN ('trialing','active','past_due','unpaid','incomplete','paused')) OR public.has_managed_ucat_apple_subscription(p_student_id) THEN
    RAISE EXCEPTION 'You already have a subscription.';
  END IF;
  IF v_override<>'default' OR public.get_student_ucat_online_tier(p_student_id)<>'free' THEN RAISE EXCEPTION 'Your account already has managed access.'; END IF;
  PERFORM public.reserve_ucat_checkout(p_student_id,'apple:' || p_product_id,false);
  RETURN public.ensure_ucat_apple_account(p_student_id);
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_ucat_apple_purchase(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_ucat_apple_purchase(uuid,text) TO service_role;

CREATE FUNCTION public.release_ucat_apple_checkout(p_student_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  DELETE FROM public.ucat_checkout_holds WHERE student_id=p_student_id AND selection_key LIKE 'apple:%' AND checkout_session_id IS NULL;
$$;
REVOKE ALL ON FUNCTION public.release_ucat_apple_checkout(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ucat_apple_checkout(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ucat_checkout(p_student_id uuid, p_selection_key text, p_referral boolean DEFAULT false)
RETURNS public.ucat_checkout_holds LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE hold public.ucat_checkout_holds; consumed boolean;
BEGIN
  SELECT ucat_unlimited_trial_consumed_at IS NOT NULL INTO consumed FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found.'; END IF;
  IF EXISTS (SELECT 1 FROM public.student_subscriptions WHERE student_id = p_student_id
    AND subject_id = public.get_ucat_subject_id() AND status IN ('trialing','active','past_due','unpaid','incomplete','paused')) THEN
    RAISE EXCEPTION 'You already have a subscription.';
  END IF;
  IF public.has_managed_ucat_apple_subscription(p_student_id) THEN RAISE EXCEPTION 'You already have an Apple subscription.'; END IF;
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

CREATE OR REPLACE VIEW public.vstudent_ucat_apple_subscriptions WITH (security_barrier=true) AS
SELECT aps.environment, aps.product_id, aps.status, aps.access_until
FROM public.ucat_apple_subscriptions aps
JOIN public.ucat_apple_accounts aa USING(account_token)
JOIN public.students s ON s.id=aa.student_id
WHERE s.user_id=(SELECT auth.uid()) AND s.deleted_at IS NULL
  AND (aps.environment='Production' OR aps.sandbox_authorized);

CREATE FUNCTION public.release_confirmed_ucat_apple_checkout()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.status IN (1,4) AND NEW.access_until>now() AND (NEW.environment='Production' OR NEW.sandbox_authorized) THEN
    PERFORM public.release_ucat_apple_checkout((SELECT student_id FROM public.ucat_apple_accounts WHERE account_token=NEW.account_token));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_confirmed_ucat_apple_checkout() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER release_confirmed_ucat_apple_checkout AFTER INSERT OR UPDATE ON public.ucat_apple_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.release_confirmed_ucat_apple_checkout();
