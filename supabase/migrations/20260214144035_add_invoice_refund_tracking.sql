-- Migration: Add invoice refund tracking
-- Description:
--   - Add is_refunded and refunded_at columns to invoices table
--   - Track when charges are refunded (via charge.refunded webhook)
--   - Enables displaying "Paid (Refunded)" status in UI
-- Purpose: Track direct charge refunds (separate from credit notes) for invoice status display

-- ================================================
-- ADD REFUND COLUMNS TO INVOICES TABLE
-- ================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN public.invoices.is_refunded IS 'Whether the charge for this invoice has been refunded directly (not via credit note)';
COMMENT ON COLUMN public.invoices.refunded_at IS 'Timestamp when the charge was refunded (for direct refunds, not credit notes)';

-- ================================================
-- CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_invoices_is_refunded ON public.invoices(is_refunded) WHERE is_refunded = true;

-- ================================================
-- NOTES
-- ================================================
-- This migration tracks direct charge refunds (when someone refunds a charge directly from Stripe Dashboard)
-- Credit notes are tracked separately in the credit_notes table
-- Both will be displayed in the invoice UI to show complete refund/credit information
