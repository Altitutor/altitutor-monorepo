-- Migration: Migrate from Payment Intents to Invoices
-- Description:
--   - Create invoices, invoice_items, and credit_notes tables
--   - Migrate dispute fields from payment_attempts to invoices
--   - Drop payment_attempts table and related views/functions
--   - Create vstudent_invoices view for student portal
--   - Add RLS policies and indexes

-- ================================================
-- CREATE INVOICES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_invoice_number TEXT,
  invoice_date DATE NOT NULL,
  amount_due_cents INTEGER NOT NULL CHECK (amount_due_cents >= 0),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'disputed')),
  collection_method TEXT CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
  auto_advance BOOLEAN DEFAULT true,
  fee_cents INTEGER,
  net_cents INTEGER,
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  receipt_url TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  finalized_at TIMESTAMPTZ,
  -- Dispute fields (migrated from payment_attempts)
  dispute_id TEXT,
  dispute_status TEXT CHECK (dispute_status IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost')),
  dispute_reason TEXT,
  dispute_amount_cents INTEGER,
  dispute_currency TEXT,
  dispute_created_at TIMESTAMPTZ,
  dispute_updated_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  -- Constraints
  CONSTRAINT uq_invoices_student_date UNIQUE (student_id, invoice_date)
);

-- ================================================
-- CREATE INVOICE_ITEMS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sessions_students_id UUID NOT NULL REFERENCES public.sessions_students(id) ON DELETE CASCADE,
  stripe_invoice_item_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  is_subsidy BOOLEAN NOT NULL DEFAULT false,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- CREATE CREDIT_NOTES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  stripe_credit_note_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'void', 'applied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ,
  metadata JSONB
);

-- ================================================
-- CREATE INDEXES
-- ================================================

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_student_id ON public.invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON public.invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_charge_id ON public.invoices(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_dispute_id ON public.invoices(dispute_id) WHERE dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_dispute_status ON public.invoices(dispute_status) WHERE dispute_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_student_date ON public.invoices(student_id, invoice_date);

-- Invoice items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_sessions_students_id ON public.invoice_items(sessions_students_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_stripe_invoice_item_id ON public.invoice_items(stripe_invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_session_id ON public.invoice_items(session_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_student_id ON public.invoice_items(student_id);

-- Credit notes indexes
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_stripe_credit_note_id ON public.credit_notes(stripe_credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON public.credit_notes(status);

-- ================================================
-- CREATE TRIGGERS
-- ================================================

-- Updated_at trigger for invoices
DROP TRIGGER IF EXISTS set_updated_at_invoices ON public.invoices;
CREATE TRIGGER set_updated_at_invoices
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Updated_at trigger for credit_notes
DROP TRIGGER IF EXISTS set_updated_at_credit_notes ON public.credit_notes;
CREATE TRIGGER set_updated_at_credit_notes
BEFORE UPDATE ON public.credit_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ================================================
-- ENABLE RLS
-- ================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- ================================================
-- CREATE RLS POLICIES
-- ================================================

-- Invoices RLS policies
DROP POLICY IF EXISTS "ADMINSTAFF full access to invoices" ON public.invoices;
CREATE POLICY "ADMINSTAFF full access to invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Invoice items RLS policies
DROP POLICY IF EXISTS "ADMINSTAFF full access to invoice_items" ON public.invoice_items;
CREATE POLICY "ADMINSTAFF full access to invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Credit notes RLS policies
DROP POLICY IF EXISTS "ADMINSTAFF full access to credit_notes" ON public.credit_notes;
CREATE POLICY "ADMINSTAFF full access to credit_notes" ON public.credit_notes
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ================================================
-- CREATE VSTUDENT_INVOICES VIEW
-- ================================================

CREATE OR REPLACE VIEW public.vstudent_invoices
WITH (security_invoker = on)
AS
SELECT 
  i.id,
  i.student_id,
  i.stripe_invoice_id,
  i.stripe_invoice_number,
  i.invoice_date,
  i.amount_due_cents,
  i.amount_paid_cents,
  i.currency,
  i.status,
  i.receipt_url,
  i.hosted_invoice_url,
  i.invoice_pdf,
  i.created_at,
  i.paid_at,
  i.finalized_at,
  -- Aggregate invoice items summary
  COUNT(ii.id) AS item_count,
  SUM(CASE WHEN NOT ii.is_subsidy THEN ii.amount_cents ELSE 0 END) AS total_charges_cents,
  SUM(CASE WHEN ii.is_subsidy THEN ABS(ii.amount_cents) ELSE 0 END) AS total_subsidies_cents
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
WHERE i.student_id = public.current_student_id()
GROUP BY i.id, i.student_id, i.stripe_invoice_id, i.stripe_invoice_number, i.invoice_date,
         i.amount_due_cents, i.amount_paid_cents, i.currency, i.status, i.receipt_url,
         i.hosted_invoice_url, i.invoice_pdf, i.created_at, i.paid_at, i.finalized_at
ORDER BY i.invoice_date DESC, i.created_at DESC;

GRANT SELECT ON public.vstudent_invoices TO authenticated;

-- ================================================
-- CREATE VSTUDENT_INVOICE_ITEMS VIEW
-- ================================================

CREATE OR REPLACE VIEW public.vstudent_invoice_items
WITH (security_invoker = on)
AS
SELECT 
  ii.id,
  ii.invoice_id,
  ii.sessions_students_id,
  ii.amount_cents,
  ii.description,
  ii.is_subsidy,
  ii.session_id,
  ii.student_id,
  ii.created_at,
  -- Join session details
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  -- Join subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum
FROM public.invoice_items ii
JOIN public.invoices i ON i.id = ii.invoice_id
JOIN public.sessions s ON s.id = ii.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE i.student_id = public.current_student_id()
ORDER BY ii.created_at DESC;

GRANT SELECT ON public.vstudent_invoice_items TO authenticated;

-- ================================================
-- DROP OLD TABLES AND VIEWS
-- ================================================

-- Drop views that depend on payment_attempts
DROP VIEW IF EXISTS public.vstudent_payment_attempts CASCADE;
DROP VIEW IF EXISTS public.vadmin_missing_payment_obligations CASCADE;
DROP VIEW IF EXISTS public.vadmin_failed_payment_attempts CASCADE;
DROP VIEW IF EXISTS public.vadmin_stuck_payment_attempts CASCADE;

-- Drop function that depends on payment_attempts
DROP FUNCTION IF EXISTS public.get_latest_payment_attempts_by_student(UUID) CASCADE;

-- Drop payment_attempts table (no production data, safe to drop)
DROP TABLE IF EXISTS public.payment_attempts CASCADE;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.invoices IS 'Invoices created for students, one per student per billing day';
COMMENT ON TABLE public.invoice_items IS 'Individual line items (sessions) within invoices';
COMMENT ON TABLE public.credit_notes IS 'Credit notes (refunds) issued for invoices';
COMMENT ON COLUMN public.invoices.stripe_charge_id IS 'CRITICAL: Stripe charge ID for dispute tracking';
COMMENT ON COLUMN public.invoices.dispute_id IS 'Stripe dispute ID (e.g., dp_xxx)';
COMMENT ON COLUMN public.invoices.dispute_status IS 'Current status of the dispute from Stripe';
COMMENT ON COLUMN public.invoice_items.is_subsidy IS 'Flag to identify subsidy items (negative amounts)';
COMMENT ON COLUMN public.invoices.stripe_invoice_id IS 'Unique Stripe invoice ID';
COMMENT ON CONSTRAINT uq_invoices_student_date ON public.invoices IS 'CRITICAL: Prevents duplicate invoices per student per day';
COMMENT ON VIEW public.vstudent_invoices IS 'Student portal view: Own invoices with aggregated item summaries';
COMMENT ON VIEW public.vstudent_invoice_items IS 'Student portal view: Invoice items (sessions) for own invoices';

