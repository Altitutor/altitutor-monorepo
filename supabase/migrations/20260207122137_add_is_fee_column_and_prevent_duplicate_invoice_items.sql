-- Migration: Add is_fee column and prevent duplicate invoice items
-- Description:
--   - Add is_fee column to invoice_items to distinguish fees from session charges
--   - Backfill existing fees by checking description pattern
--   - Create partial unique constraint to prevent duplicate session charges on active invoices
--   - Allow re-invoicing of voided/uncollectible sessions
--   - Allow fees to reuse the same sessions_students_id as session charges
-- Purpose: Prevent duplicate invoice items while allowing legitimate cases (fees, re-invoicing voided invoices)

-- Step 1: Add is_fee column to invoice_items (nullable first, then set default)
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS is_fee BOOLEAN;

-- Step 2: Backfill existing data - mark fees based on description pattern
-- Fees have descriptions like "Payment processing fee (X% + $Y)"
UPDATE public.invoice_items
SET is_fee = true
WHERE description LIKE 'Payment processing fee%'
AND is_fee IS NULL;

-- Step 3: Set all remaining items to false (session charges)
UPDATE public.invoice_items
SET is_fee = false
WHERE is_fee IS NULL;

-- Step 4: Make column NOT NULL with default
ALTER TABLE public.invoice_items
ALTER COLUMN is_fee SET NOT NULL,
ALTER COLUMN is_fee SET DEFAULT false;

-- Step 5: Create partial unique index to prevent duplicate session charges
-- This allows:
--   1. Fees to reuse the same sessions_students_id (is_fee = true)
--   2. Re-invoicing voided/uncollectible sessions (handled in application logic)
--   3. Prevents duplicate session charges on the same invoice
-- Note: We exclude fees from the constraint. The application logic in getInvoicedSessionsStudentsIds
-- handles excluding voided/uncollectible invoices when checking if a session can be re-invoiced.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_unique_session_charge
ON public.invoice_items (invoice_id, sessions_students_id)
WHERE is_fee = false;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_invoice_items_unique_session_charge IS 
  'Prevents duplicate session charges on active invoices. Allows fees (is_fee=true) and re-invoicing voided/uncollectible sessions.';
