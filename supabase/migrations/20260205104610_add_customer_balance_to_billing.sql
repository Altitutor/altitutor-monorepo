-- Migration: Add customer_balance_cents to students_billing table
-- Description:
--   - Add customer_balance_cents: Current Stripe customer balance (can be negative for credit)
--   - Add customer_balance_currency: Currency for the balance
--   - Add customer_balance_updated_at: Last time balance was synced from Stripe
-- Purpose: Track Stripe customer balance to understand credit usage on invoices

-- ================================================
-- ADD COLUMNS TO STUDENTS_BILLING TABLE
-- ================================================

ALTER TABLE public.students_billing
  ADD COLUMN IF NOT EXISTS customer_balance_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_balance_currency TEXT DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS customer_balance_updated_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.students_billing.customer_balance_cents IS 'Current Stripe customer balance in cents (negative = credit balance, positive = amount owed)';
COMMENT ON COLUMN public.students_billing.customer_balance_currency IS 'Currency for customer balance';
COMMENT ON COLUMN public.students_billing.customer_balance_updated_at IS 'Last time customer balance was synced from Stripe';

-- ================================================
-- CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_students_billing_customer_balance ON public.students_billing(customer_balance_cents) WHERE customer_balance_cents != 0;
