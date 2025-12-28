-- Migration: Add dispute support to payment_attempts
-- Description:
--   - Add dispute-related columns to payment_attempts table
--   - Update status constraint to include 'disputed' status
--   - Add indexes for dispute queries

-- ========================
-- ADD DISPUTE COLUMNS
-- ========================

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS dispute_id TEXT,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT CHECK (dispute_status IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost')),
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS dispute_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS dispute_currency TEXT,
  ADD COLUMN IF NOT EXISTS dispute_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;

-- ========================
-- UPDATE STATUS CONSTRAINT
-- ========================

-- Drop old constraint
ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

-- Add new constraint with 'disputed' status
ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_status_check 
  CHECK (status IN ('pending','processing','succeeded','failed','refunded','disputed','skipped'));

-- ========================
-- ADD INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_payment_attempts_dispute_id ON public.payment_attempts(dispute_id) WHERE dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_dispute_status ON public.payment_attempts(dispute_status) WHERE dispute_status IS NOT NULL;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON COLUMN public.payment_attempts.dispute_id IS 'Stripe dispute ID (e.g., dp_xxx)';
COMMENT ON COLUMN public.payment_attempts.dispute_status IS 'Current status of the dispute from Stripe';
COMMENT ON COLUMN public.payment_attempts.dispute_reason IS 'Reason for the dispute (e.g., fraudulent, product_unacceptable)';
COMMENT ON COLUMN public.payment_attempts.dispute_amount_cents IS 'Amount being disputed in cents';
COMMENT ON COLUMN public.payment_attempts.dispute_resolved_at IS 'Timestamp when dispute was resolved (won or lost)';

