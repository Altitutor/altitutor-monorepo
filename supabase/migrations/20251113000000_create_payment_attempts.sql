-- Migration: Replace payments table with payment_attempts
-- Description: 
--  - Create payment_attempts table to track all payment retry attempts
--  - Migrate existing payments data (all as attempt_number: 1)
--  - Create vstudent_payment_attempts view for student portal
--  - Create helper RPC function for latest attempts query

-- ================================================
-- CREATE PAYMENT_ATTEMPTS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessions_students_id UUID NOT NULL REFERENCES public.sessions_students(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  
  -- Pricing
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  
  -- Status and failure tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed','refunded')),
  failure_code TEXT,  -- NEW: Stripe error code
  failure_message TEXT,
  
  -- Financial reconciliation
  fee_cents INTEGER,
  net_cents INTEGER,
  receipt_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  charged_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Ensure one attempt per (session_student, attempt_number)
  CONSTRAINT uq_payment_attempts_session_attempt UNIQUE (sessions_students_id, attempt_number)
);

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_payment_attempts_sessions_students ON public.payment_attempts(sessions_students_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_student ON public.payment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_session ON public.payment_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_pi ON public.payment_attempts(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);

-- ================================================
-- TRIGGERS
-- ================================================

DROP TRIGGER IF EXISTS set_updated_at_payment_attempts ON public.payment_attempts;
CREATE TRIGGER set_updated_at_payment_attempts
BEFORE UPDATE ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to payment_attempts" ON public.payment_attempts;
CREATE POLICY "ADMINSTAFF full access to payment_attempts" ON public.payment_attempts
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ================================================
-- DATA MIGRATION FROM PAYMENTS TABLE
-- ================================================

-- Migrate existing payments to payment_attempts (all as attempt_number: 1)
-- Note: payments table doesn't have updated_at column, so we use created_at for both
INSERT INTO public.payment_attempts (
  sessions_students_id, 
  student_id, 
  session_id, 
  attempt_number,
  amount_cents, 
  currency, 
  stripe_payment_intent_id, 
  stripe_charge_id,
  status, 
  failure_code, 
  failure_message,
  fee_cents, 
  net_cents, 
  receipt_url,
  created_at, 
  updated_at, 
  charged_at, 
  refunded_at
)
SELECT 
  sessions_students_id, 
  student_id, 
  session_id, 
  1 AS attempt_number,
  amount_cents, 
  currency, 
  stripe_payment_intent_id, 
  stripe_charge_id,
  status, 
  NULL AS failure_code,  -- Old payments table doesn't have this
  failure_message,
  fee_cents, 
  net_cents, 
  receipt_url,
  created_at, 
  created_at AS updated_at,  -- payments table doesn't have updated_at, use created_at
  charged_at, 
  refunded_at
FROM public.payments
ON CONFLICT (sessions_students_id, attempt_number) DO NOTHING;

-- ================================================
-- CREATE VSTUDENT_PAYMENT_ATTEMPTS VIEW
-- ================================================

CREATE OR REPLACE VIEW public.vstudent_payment_attempts
WITH (security_invoker = on)
AS
SELECT 
  pa.id,
  pa.sessions_students_id,
  pa.session_id,
  pa.attempt_number,
  pa.amount_cents,
  pa.currency,
  pa.status,
  pa.failure_message,  -- Hide failure_code from students
  pa.receipt_url,
  pa.created_at,
  pa.charged_at,
  pa.refunded_at,
  -- Join session details
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  -- Join subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum
FROM public.payment_attempts pa
JOIN public.sessions s ON s.id = pa.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE pa.student_id = public.current_student_id()
ORDER BY pa.created_at DESC;

GRANT SELECT ON public.vstudent_payment_attempts TO authenticated;

-- ================================================
-- HELPER RPC FUNCTION
-- ================================================

-- Helper function to get latest attempt per session for a student
CREATE OR REPLACE FUNCTION public.get_latest_payment_attempts_by_student(p_student_id UUID)
RETURNS TABLE (
  id UUID,
  sessions_students_id UUID,
  student_id UUID,
  session_id UUID,
  attempt_number INTEGER,
  amount_cents INTEGER,
  currency TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  status TEXT,
  failure_code TEXT,
  failure_message TEXT,
  fee_cents INTEGER,
  net_cents INTEGER,
  receipt_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  charged_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
) AS $$
  SELECT DISTINCT ON (pa.sessions_students_id)
    pa.id,
    pa.sessions_students_id,
    pa.student_id,
    pa.session_id,
    pa.attempt_number,
    pa.amount_cents,
    pa.currency,
    pa.stripe_payment_intent_id,
    pa.stripe_charge_id,
    pa.status,
    pa.failure_code,
    pa.failure_message,
    pa.fee_cents,
    pa.net_cents,
    pa.receipt_url,
    pa.created_at,
    pa.updated_at,
    pa.charged_at,
    pa.refunded_at
  FROM public.payment_attempts pa
  WHERE pa.student_id = p_student_id
  ORDER BY pa.sessions_students_id, pa.attempt_number DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_latest_payment_attempts_by_student TO authenticated;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.payment_attempts IS 'Tracks all payment attempts including retries. Replaces single payments table.';
COMMENT ON COLUMN public.payment_attempts.attempt_number IS 'Increments with each retry (1 = first attempt, 2 = first retry, etc.)';
COMMENT ON COLUMN public.payment_attempts.failure_code IS 'Stripe error code for debugging (e.g., card_declined, insufficient_funds)';
COMMENT ON VIEW public.vstudent_payment_attempts IS 'Student view: Own payment attempts with session details';
COMMENT ON FUNCTION public.get_latest_payment_attempts_by_student IS 'Returns the latest payment attempt per session for a student';

