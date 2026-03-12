-- Migration: Add credit note settlement fields
-- Description:
--   - Track how a credit note's excess amount is settled:
--     * refund_amount_cents       -> refunded to payment method
--     * credit_amount_cents       -> credited to customer balance
--     * out_of_band_amount_cents  -> settled externally (out of band)
--   - Mirrors Stripe credit note fields refund_amount, credit_amount, out_of_band_amount.

-- ================================================
-- 1. ALTER credit_notes TABLE
-- ================================================

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS refund_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS credit_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS out_of_band_amount_cents BIGINT;

COMMENT ON COLUMN public.credit_notes.refund_amount_cents IS 'Portion of credit note applied as a refund to the original charge (Stripe refund_amount).';
COMMENT ON COLUMN public.credit_notes.credit_amount_cents IS 'Portion of credit note applied as a customer balance credit (Stripe credit_amount).';
COMMENT ON COLUMN public.credit_notes.out_of_band_amount_cents IS 'Portion of credit note settled externally, outside Stripe (Stripe out_of_band_amount).';

