-- Migration: Admin Payment Reconciliation Views
-- Description:
--  - Create vadmin_missing_payment_obligations view (sessions without any payment attempts)
--  - Create vadmin_failed_payment_attempts view (attempts that failed after max retries)
--  - Create vadmin_stuck_payment_attempts view (attempts stuck in pending/processing)
-- Purpose: Enable ADMINSTAFF to identify and follow up on payment issues

-- ================================================
-- VIEW 1: MISSING PAYMENT OBLIGATIONS
-- ================================================

-- Sessions that should have payment attempts but don't
CREATE OR REPLACE VIEW public.vadmin_missing_payment_obligations
AS
SELECT 
  ss.id AS sessions_students_id,
  ss.student_id,
  ss.session_id,
  ss.planned_absence,
  s.start_at AS session_start_at,
  s.type AS session_type,
  s.subject_id,
  sub.name AS subject_name,
  sub.session_fee_cents AS expected_amount_cents,
  sub.currency,
  -- Student billing status
  sb.stripe_customer_id,
  CASE 
    WHEN sb.stripe_customer_id IS NULL THEN 'NO_BILLING_ACCOUNT'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.student_payment_methods spm 
      WHERE spm.student_id = ss.student_id AND spm.is_default = true
    ) THEN 'NO_PAYMENT_METHOD'
    ELSE 'UNKNOWN'
  END AS skip_reason,
  -- Student contact info
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ss.student_id
LEFT JOIN public.students_billing sb ON sb.student_id = ss.student_id
WHERE 
  ss.planned_absence = false
  AND s.start_at < NOW()  -- Only past sessions
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_attempts pa 
    WHERE pa.sessions_students_id = ss.id
  )
  AND (sub.session_fee_cents > 0 OR sub.session_fee_cents IS NULL);

GRANT SELECT ON public.vadmin_missing_payment_obligations TO authenticated;

COMMENT ON VIEW public.vadmin_missing_payment_obligations IS 
  'Admin view: Sessions that should have been charged but have no payment attempts (for manual follow-up)';

-- ================================================
-- VIEW 2: FAILED PAYMENT ATTEMPTS NEEDING FOLLOW-UP
-- ================================================

-- Latest attempt per session that failed and exceeded retry limit
CREATE OR REPLACE VIEW public.vadmin_failed_payment_attempts
AS
WITH latest_attempts AS (
  SELECT DISTINCT ON (sessions_students_id)
    pa.*
  FROM public.payment_attempts pa
  ORDER BY pa.sessions_students_id, pa.attempt_number DESC
)
SELECT 
  la.id AS payment_attempt_id,
  la.sessions_students_id,
  la.student_id,
  la.session_id,
  la.attempt_number,
  la.amount_cents,
  la.currency,
  la.status,
  la.failure_code,
  la.failure_message,
  la.created_at,
  -- Session details
  s.start_at AS session_start_at,
  s.type AS session_type,
  sub.name AS subject_name,
  -- Student details
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  -- Billing details
  sb.stripe_customer_id,
  spm.card_brand,
  spm.card_last4,
  spm.card_exp_month,
  spm.card_exp_year
FROM latest_attempts la
JOIN public.sessions s ON s.id = la.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = la.student_id
LEFT JOIN public.students_billing sb ON sb.student_id = la.student_id
LEFT JOIN public.student_payment_methods spm ON spm.student_id = la.student_id AND spm.is_default = true
WHERE 
  la.status = 'failed'
  AND la.attempt_number >= 3;  -- Exceeded retry limit

GRANT SELECT ON public.vadmin_failed_payment_attempts TO authenticated;

COMMENT ON VIEW public.vadmin_failed_payment_attempts IS 
  'Admin view: Failed payment attempts that exceeded retry limit (need manual follow-up)';

-- ================================================
-- VIEW 3: STUCK PAYMENTS NEEDING RECONCILIATION
-- ================================================

-- Payments stuck in processing/pending for > 24 hours
CREATE OR REPLACE VIEW public.vadmin_stuck_payment_attempts
AS
WITH latest_attempts AS (
  SELECT DISTINCT ON (sessions_students_id)
    pa.*
  FROM public.payment_attempts pa
  ORDER BY pa.sessions_students_id, pa.attempt_number DESC
)
SELECT 
  la.id,
  la.sessions_students_id,
  la.student_id,
  la.session_id,
  la.attempt_number,
  la.amount_cents,
  la.currency,
  la.stripe_payment_intent_id,
  la.stripe_charge_id,
  la.status,
  la.failure_code,
  la.failure_message,
  la.created_at,
  la.updated_at,
  -- Session details
  s.start_at AS session_start_at,
  s.type AS session_type,
  sub.name AS subject_name,
  -- Student details
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email
FROM latest_attempts la
JOIN public.sessions s ON s.id = la.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = la.student_id
WHERE 
  la.status IN ('pending', 'processing')
  AND la.created_at < NOW() - INTERVAL '24 hours';

GRANT SELECT ON public.vadmin_stuck_payment_attempts TO authenticated;

COMMENT ON VIEW public.vadmin_stuck_payment_attempts IS 
  'Admin view: Payment attempts stuck in pending/processing for > 24 hours (need reconciliation with Stripe)';




