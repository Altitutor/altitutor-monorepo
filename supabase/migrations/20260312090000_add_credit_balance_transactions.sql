-- Migration: Add credit_balance_transactions table
-- Description:
--   - Create credit_balance_transactions ledger table for Stripe billing credits
--   - Store both credit and debit movements against credit grants
--   - Add RLS policies for ADMINSTAFF

-- ================================================
-- CREATE CREDIT_BALANCE_TRANSACTIONS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.credit_balance_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_credit_balance_transaction_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_credit_grant_id TEXT NOT NULL,
  stripe_invoice_id TEXT,
  stripe_invoice_line_item_id TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  debit_type TEXT,
  credit_type TEXT,
  description TEXT,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw JSONB NOT NULL
);

-- ================================================
-- CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_credit_balance_tx_customer_id
  ON public.credit_balance_transactions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_credit_balance_tx_invoice_id
  ON public.credit_balance_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS idx_credit_balance_tx_credit_note_id
  ON public.credit_balance_transactions(credit_note_id);

CREATE INDEX IF NOT EXISTS idx_credit_balance_tx_effective_at
  ON public.credit_balance_transactions(effective_at);

-- ================================================
-- TRIGGERS
-- ================================================

DROP TRIGGER IF EXISTS set_updated_at_credit_balance_transactions ON public.credit_balance_transactions;
CREATE TRIGGER set_updated_at_credit_balance_transactions
BEFORE UPDATE ON public.credit_balance_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ================================================
-- ENABLE RLS
-- ================================================

ALTER TABLE public.credit_balance_transactions ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS POLICIES
-- ================================================

DROP POLICY IF EXISTS "ADMINSTAFF full access to credit_balance_transactions" ON public.credit_balance_transactions;
CREATE POLICY "ADMINSTAFF full access to credit_balance_transactions" ON public.credit_balance_transactions
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.credit_balance_transactions IS 'Ledger of Stripe billing credit balance transactions (credits and debits) for customer balances';

