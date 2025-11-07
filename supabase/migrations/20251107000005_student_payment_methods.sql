-- Migration: Student Payment Methods - Support Multiple Cards Per Student
-- Description:
--  - Create student_payment_methods table for multiple cards per student
--  - Migrate existing payment method data from students_billing
--  - Simplify students_billing to only store stripe_customer_id
--  - Update vstudent_billing view to show all payment methods

-- ================================================
-- CREATE STUDENT_PAYMENT_METHODS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.student_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  card_brand TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  card_exp_month INTEGER NOT NULL CHECK (card_exp_month >= 1 AND card_exp_month <= 12),
  card_exp_year INTEGER NOT NULL CHECK (card_exp_year >= 2024),
  card_country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure only one default payment method per student
  CONSTRAINT one_default_per_student EXCLUDE (student_id WITH =) WHERE (is_default = true)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_payment_methods_student_id ON public.student_payment_methods(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payment_methods_is_default ON public.student_payment_methods(student_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_student_payment_methods_stripe_pm_id ON public.student_payment_methods(stripe_payment_method_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_student_payment_methods ON public.student_payment_methods;
CREATE TRIGGER set_updated_at_student_payment_methods
BEFORE UPDATE ON public.student_payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies
ALTER TABLE public.student_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_payment_methods" ON public.student_payment_methods;
CREATE POLICY "ADMINSTAFF full access to student_payment_methods" ON public.student_payment_methods
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ================================================
-- MIGRATE EXISTING DATA FROM STUDENTS_BILLING
-- ================================================

-- Copy existing payment methods to new table (only if they have a payment method)
INSERT INTO public.student_payment_methods (
  student_id,
  stripe_payment_method_id,
  is_default,
  card_brand,
  card_last4,
  card_exp_month,
  card_exp_year,
  card_country,
  created_at,
  updated_at
)
SELECT
  student_id,
  default_payment_method_id,
  true, -- Set as default since it was their only payment method
  COALESCE(card_brand, 'unknown'),
  COALESCE(card_last4, '0000'),
  1, -- Default month (we don't have this data)
  EXTRACT(YEAR FROM NOW())::INTEGER + 5, -- Default to 5 years from now
  card_country,
  created_at,
  updated_at
FROM public.students_billing
WHERE default_payment_method_id IS NOT NULL
ON CONFLICT (stripe_payment_method_id) DO NOTHING;

-- ================================================
-- DROP OLD VSTUDENT_BILLING VIEW
-- (Must drop first before we can drop columns it depends on)
-- ================================================

DROP VIEW IF EXISTS public.vstudent_billing CASCADE;

-- ================================================
-- SIMPLIFY STUDENTS_BILLING TABLE
-- ================================================

-- Drop the columns we no longer need (payment method details moved to student_payment_methods)
ALTER TABLE public.students_billing
  DROP COLUMN IF EXISTS default_payment_method_id,
  DROP COLUMN IF EXISTS card_brand,
  DROP COLUMN IF EXISTS card_last4,
  DROP COLUMN IF EXISTS card_country,
  DROP COLUMN IF EXISTS verified_at;

-- ================================================
-- CREATE NEW VSTUDENT_BILLING VIEW
-- ================================================

-- Create new view with payment methods as JSON array
CREATE VIEW public.vstudent_billing
AS
SELECT 
  sb.student_id,
  sb.stripe_customer_id,
  sb.created_at,
  sb.updated_at,
  -- Aggregate all payment methods as JSON array
  (
    SELECT json_agg(
      json_build_object(
        'id', spm.id,
        'stripe_payment_method_id', spm.stripe_payment_method_id,
        'is_default', spm.is_default,
        'card_brand', spm.card_brand,
        'card_last4', spm.card_last4,
        'card_exp_month', spm.card_exp_month,
        'card_exp_year', spm.card_exp_year,
        'card_country', spm.card_country,
        'created_at', spm.created_at
      ) ORDER BY spm.is_default DESC, spm.created_at DESC
    )
    FROM public.student_payment_methods spm
    WHERE spm.student_id = sb.student_id
  ) AS payment_methods,
  -- Also include the default payment method separately for convenience
  (
    SELECT json_build_object(
      'id', spm.id,
      'stripe_payment_method_id', spm.stripe_payment_method_id,
      'card_brand', spm.card_brand,
      'card_last4', spm.card_last4,
      'card_exp_month', spm.card_exp_month,
      'card_exp_year', spm.card_exp_year,
      'card_country', spm.card_country
    )
    FROM public.student_payment_methods spm
    WHERE spm.student_id = sb.student_id AND spm.is_default = true
  ) AS default_payment_method
FROM public.students_billing sb
WHERE sb.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_billing TO authenticated;

COMMENT ON VIEW public.vstudent_billing IS 'Student view: Own billing information with all payment methods';

-- ================================================
-- HELPER COMMENTS
-- ================================================

COMMENT ON TABLE public.student_payment_methods IS 'Stores multiple payment methods per student with default indicator';
COMMENT ON COLUMN public.student_payment_methods.is_default IS 'Only one payment method can be default per student (enforced by EXCLUDE constraint)';
COMMENT ON TABLE public.students_billing IS 'Simplified to store only Stripe customer ID per student';

