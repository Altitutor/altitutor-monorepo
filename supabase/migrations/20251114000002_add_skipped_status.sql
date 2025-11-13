-- Migration: Add 'skipped' status to payment_attempts
-- Description: Allow payment_attempts to track zero-amount sessions and other skipped obligations
-- This ensures complete audit trail - no sessions slip through without a record

-- ================================================
-- UPDATE STATUS CHECK CONSTRAINT
-- ================================================

-- Drop the old constraint
ALTER TABLE public.payment_attempts 
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

-- Add new constraint with 'skipped' status
ALTER TABLE public.payment_attempts 
  ADD CONSTRAINT payment_attempts_status_check 
  CHECK (status IN ('pending','processing','succeeded','failed','refunded','skipped'));

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON COLUMN public.payment_attempts.status IS 
  'Payment attempt status: pending (created, not charged), processing (charged, awaiting webhook), succeeded (paid), failed (declined/error), refunded (refunded), skipped (zero amount or other reason to skip)';

