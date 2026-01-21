-- Migration: Update Reconciliation Views for Trial Students
-- Description:
--  1. Update vadmin_reconciliation_students_without_payment_method to exclude TRIAL status students
--  2. Create new view vadmin_reconciliation_trial_students_not_signed_up for trial students who haven't signed up
-- Purpose: Separate trial students from payment method reconciliation and add dedicated view for follow-up

-- ================================================
-- UPDATE VIEW: STUDENTS WITHOUT PAYMENT METHOD
-- ================================================
-- Exclude TRIAL students from this view (they have their own section)

CREATE OR REPLACE VIEW public.vadmin_reconciliation_students_without_payment_method
WITH (security_invoker = false)
AS
SELECT 
  st.id AS student_id,
  st.first_name,
  st.last_name,
  st.email,
  st.phone,
  st.status AS student_status,
  -- Billing info
  sb.stripe_customer_id,
  sb.created_at AS billing_created_at,
  -- Metadata
  st.created_at,
  st.updated_at
FROM public.students st
LEFT JOIN public.students_billing sb ON sb.student_id = st.id
WHERE 
  st.status = 'CURRENT'  -- Only CURRENT students (exclude TRIAL)
  -- No payment methods exist for this student
  AND NOT EXISTS (
    SELECT 1 
    FROM public.student_payment_methods spm
    WHERE spm.student_id = st.id
  );

COMMENT ON VIEW public.vadmin_reconciliation_students_without_payment_method IS 
  'Admin view: CURRENT students without any payment methods on file (excludes TRIAL students)';

-- ================================================
-- NEW VIEW: TRIAL STUDENTS NOT SIGNED UP
-- ================================================
-- Trial students who haven't created an account (user_id IS NULL)

CREATE OR REPLACE VIEW public.vadmin_reconciliation_trial_students_not_signed_up
WITH (security_invoker = false)
AS
SELECT 
  st.id AS student_id,
  st.first_name,
  st.last_name,
  st.email,
  st.phone,
  st.status AS student_status,
  st.user_id,
  st.created_at,
  st.updated_at
FROM public.students st
WHERE 
  st.status = 'TRIAL'
  AND st.user_id IS NULL;  -- Haven't signed up yet

GRANT SELECT ON public.vadmin_reconciliation_trial_students_not_signed_up TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_trial_students_not_signed_up IS 
  'Admin view: Trial students who have not yet signed up (user_id IS NULL). Use for follow-up to encourage sign-up.';
