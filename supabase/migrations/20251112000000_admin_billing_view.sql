-- Migration: Admin Billing View for Billing Runner
-- Description: Create a view that joins students_billing with student_payment_methods
-- for efficient querying in billing-runner function

-- ================================================
-- CREATE ADMIN BILLING VIEW
-- ================================================

CREATE OR REPLACE VIEW public.vadmin_billing_with_payment_methods
AS
SELECT 
  sb.student_id,
  sb.stripe_customer_id,
  sb.created_at AS billing_created_at,
  sb.updated_at AS billing_updated_at,
  -- Default payment method details
  spm.stripe_payment_method_id,
  spm.card_country,
  spm.card_brand,
  spm.card_last4,
  spm.card_exp_month,
  spm.card_exp_year,
  spm.is_default,
  spm.created_at AS payment_method_created_at
FROM public.students_billing sb
LEFT JOIN public.student_payment_methods spm 
  ON sb.student_id = spm.student_id 
  AND spm.is_default = true;

-- Grant access to authenticated users (RLS will filter by admin status)
GRANT SELECT ON public.vadmin_billing_with_payment_methods TO authenticated;

COMMENT ON VIEW public.vadmin_billing_with_payment_methods IS 
  'Admin view: Billing info with default payment method for billing-runner function';

-- ================================================
-- INDEXES (if needed for performance)
-- ================================================
-- Note: Indexes on underlying tables should be sufficient
-- Indexes already exist:
-- - idx_student_payment_methods_student_id
-- - idx_student_payment_methods_is_default


