-- Migration: Add subtotal_cents and total_cents to invoices table
-- Description:
--   - Add subtotal_cents: Total before discounts/credits (Stripe invoice.subtotal)
--   - Add total_cents: Total after discounts but before customer balance credits (Stripe invoice.total)
--   - Add amount_paid_from_balance_cents: Amount paid from customer balance (calculated)
-- Purpose: Track invoice amounts before credit balance application for proper reconciliation

-- ================================================
-- ADD COLUMNS TO INVOICES TABLE
-- ================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS total_cents INTEGER,
  ADD COLUMN IF NOT EXISTS amount_paid_from_balance_cents INTEGER DEFAULT 0 CHECK (amount_paid_from_balance_cents >= 0);

-- Add comments
COMMENT ON COLUMN public.invoices.subtotal_cents IS 'Invoice subtotal before discounts/credits (Stripe invoice.subtotal)';
COMMENT ON COLUMN public.invoices.total_cents IS 'Invoice total after discounts but before customer balance credits (Stripe invoice.total)';
COMMENT ON COLUMN public.invoices.amount_paid_from_balance_cents IS 'Amount paid from customer balance (total_cents - amount_due_cents)';

-- ================================================
-- UPDATE EXISTING INVOICES (if possible)
-- ================================================
-- Note: We cannot backfill subtotal/total for existing invoices without querying Stripe
-- This will be handled by the reconciliation function

-- ================================================
-- CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_invoices_total_cents ON public.invoices(total_cents) WHERE total_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_subtotal_cents ON public.invoices(subtotal_cents) WHERE subtotal_cents IS NOT NULL;
