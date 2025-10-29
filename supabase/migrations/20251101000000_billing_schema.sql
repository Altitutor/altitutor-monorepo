-- Billing schema: subjects billing fields, subsidies, students_billing, payments
-- SAFE, idempotent where possible

-- ========================
-- ENUMS
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'billing_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.billing_type AS ENUM ('CLASS', 'EXAM_COURSE', 'DRAFTING');
  END IF;
END $$;

-- ========================
-- SUBJECTS BILLING FIELDS (aligns with decision 1a)
-- ========================
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS billing_type public.billing_type NOT NULL DEFAULT 'CLASS',
  ADD COLUMN IF NOT EXISTS session_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'AUD';

-- ========================
-- STUDENT SUBSIDIES (aligns with decision 2a)
-- ========================
CREATE TABLE IF NOT EXISTS public.student_subsidies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  billing_type public.billing_type NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_subsidies_effective_range_chk CHECK (
    effective_until IS NULL OR effective_until > effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_student_subsidies_student ON public.student_subsidies(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subsidies_subject ON public.student_subsidies(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subsidies_billing_type ON public.student_subsidies(billing_type);
CREATE INDEX IF NOT EXISTS idx_student_subsidies_effective_from ON public.student_subsidies(effective_from);

ALTER TABLE public.student_subsidies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to student_subsidies" ON public.student_subsidies;
CREATE POLICY "ADMINSTAFF full access to student_subsidies" ON public.student_subsidies
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP TRIGGER IF EXISTS set_updated_at_student_subsidies ON public.student_subsidies;
CREATE TRIGGER set_updated_at_student_subsidies
BEFORE UPDATE ON public.student_subsidies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- STUDENTS BILLING (Stripe references only)
-- ========================
CREATE TABLE IF NOT EXISTS public.students_billing (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  default_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_country TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.students_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to students_billing" ON public.students_billing;
CREATE POLICY "ADMINSTAFF full access to students_billing" ON public.students_billing
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP TRIGGER IF EXISTS set_updated_at_students_billing ON public.students_billing;
CREATE TRIGGER set_updated_at_students_billing
BEFORE UPDATE ON public.students_billing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- PAYMENTS (auditable per planned attendance)
-- ========================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessions_students_id UUID NOT NULL REFERENCES public.sessions_students(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed','refunded')),
  failure_code TEXT,
  failure_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  fee_cents INTEGER,
  net_cents INTEGER,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  charged_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- Prevent duplicate payments for the same planned attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_payments_sessions_students'
  ) THEN
    CREATE UNIQUE INDEX uq_payments_sessions_students ON public.payments(sessions_students_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_session ON public.payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_retry ON public.payments(status, retry_count);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to payments" ON public.payments;
CREATE POLICY "ADMINSTAFF full access to payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments;
CREATE TRIGGER set_updated_at_payments
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



