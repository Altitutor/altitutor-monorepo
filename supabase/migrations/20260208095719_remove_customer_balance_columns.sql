-- Migration: Remove customer_balance columns from students_billing table
-- Description:
--   - Remove customer_balance_cents: No longer caching Stripe customer balance
--   - Remove customer_balance_currency: No longer caching currency
--   - Remove customer_balance_updated_at: No longer tracking sync timestamp
--   - Remove index on customer_balance_cents
-- Purpose: Fetch customer balance on-demand from Stripe as single source of truth

-- ================================================
-- DROP INDEX
-- ================================================

DROP INDEX IF EXISTS public.idx_students_billing_customer_balance;

-- ================================================
-- REMOVE COLUMNS FROM STUDENTS_BILLING TABLE
-- ================================================

ALTER TABLE public.students_billing
  DROP COLUMN IF EXISTS customer_balance_cents,
  DROP COLUMN IF EXISTS customer_balance_currency,
  DROP COLUMN IF EXISTS customer_balance_updated_at;
