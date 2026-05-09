-- Migration: Add student-scoped views for subscriptions and slot reservations
-- Description:
--   Provide student-web read access via vstudent_* views instead of direct base-table reads.

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
  ss.created_at,
  ss.updated_at
FROM public.student_subscriptions ss
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_subscriptions TO authenticated;

COMMENT ON VIEW public.vstudent_subscriptions IS
  'Student view: own subscriptions only.';

DROP VIEW IF EXISTS public.vstudent_slot_reservations;
CREATE VIEW public.vstudent_slot_reservations
WITH (security_invoker = false)
AS
SELECT
  sr.id,
  sr.start_at,
  sr.end_at,
  sr.subject_id,
  sr.staff_id,
  sr.reserved_by,
  sr.expires_at,
  sr.created_at,
  sr.session_type
FROM public.slot_reservations sr
WHERE sr.reserved_by = auth.uid();

GRANT SELECT ON public.vstudent_slot_reservations TO authenticated;

COMMENT ON VIEW public.vstudent_slot_reservations IS
  'Student view: own slot reservations only.';
