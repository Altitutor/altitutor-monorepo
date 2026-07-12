-- Failed recurring payments remain Stripe-owned: past_due is the temporary
-- recovery window, while unpaid/canceled are terminal for paid UCAT access.
-- These fields only mirror the current recovery invoice for clear UI and
-- out-of-order-safe webhook handling; they do not run a second retry clock.

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS billing_recovery_invoice_id text,
  ADD COLUMN IF NOT EXISTS billing_recovery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_recovery_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_recovery_failure_code text,
  ADD COLUMN IF NOT EXISTS billing_recovery_requires_action boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.student_subscriptions.billing_recovery_invoice_id IS
  'Stripe invoice currently undergoing payment recovery. Cleared only when that same invoice is paid.';
COMMENT ON COLUMN public.student_subscriptions.billing_recovery_started_at IS
  'First observed failure/action-required time for the current recovery invoice.';
COMMENT ON COLUMN public.student_subscriptions.billing_recovery_next_attempt_at IS
  'Informational Stripe next_payment_attempt time; Stripe remains retry authority.';
COMMENT ON COLUMN public.student_subscriptions.billing_recovery_failure_code IS
  'Machine-readable Stripe failure or finalization code for support and student-safe UI selection.';
COMMENT ON COLUMN public.student_subscriptions.billing_recovery_requires_action IS
  'Whether the current invoice requires customer authentication rather than a replacement payment method.';

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
RETURNS text
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
        AND ss.status IN ('active', 'past_due')
        AND ss.plan_tier = 'pro'
    ) THEN 'pro'
    WHEN EXISTS (
      SELECT 1 FROM public.student_subscriptions ss
      WHERE ss.student_id = p_student_id
        AND ss.subject_id = public.get_ucat_subject_id()
        AND ss.status IN ('active', 'past_due')
    ) THEN 'unlimited'
    ELSE 'free'
  END
  FROM public.students s
  WHERE s.id = p_student_id;
$$;

COMMENT ON FUNCTION public.get_student_ucat_online_tier(uuid) IS
  'Resolves UCAT access. past_due retains paid access while Stripe retries; unpaid and canceled resolve to Free.';

REVOKE ALL ON FUNCTION public.get_student_ucat_online_tier(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_online_tier(uuid)
  TO service_role;

-- Expose only student-safe recovery state. The underlying table RLS owns the
-- row boundary, so this view should run with the caller's permissions.
DROP VIEW IF EXISTS public.vstudent_subscriptions;
CREATE VIEW public.vstudent_subscriptions
WITH (security_invoker = true)
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
  ss.billing_recovery_invoice_id,
  ss.billing_recovery_started_at,
  ss.billing_recovery_next_attempt_at,
  ss.billing_recovery_requires_action,
  ss.created_at,
  ss.updated_at
FROM public.student_subscriptions ss
WHERE ss.student_id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_subscriptions TO authenticated;

COMMENT ON VIEW public.vstudent_subscriptions IS
  'Student view: own subscriptions including safe failed-billing recovery state.';
