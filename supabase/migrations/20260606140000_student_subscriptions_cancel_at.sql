-- Sync Stripe cancel-at-period-end onto student_subscriptions for student-facing UI.

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_subscriptions.cancel_at_period_end IS
  'Stripe cancel_at_period_end — access continues until cancel_at / current period end.';
COMMENT ON COLUMN public.student_subscriptions.cancel_at IS
  'When the subscription ends (Stripe cancel_at, or period end when cancel_at_period_end).';

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
  'Student view: own subscriptions only (includes cancel-at-period-end fields).';
