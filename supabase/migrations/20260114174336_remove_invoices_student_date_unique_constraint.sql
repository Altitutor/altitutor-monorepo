-- Migration: Remove unique constraint on invoices (student_id, invoice_date)
-- Description:
--   Removes the uq_invoices_student_date constraint to allow multiple invoices
--   per student per day. This enables the new billing approach where each session
--   gets its own invoice, even if multiple sessions occur on the same date.
--
--   The constraint was originally added to enforce "one invoice per student per day"
--   but with the change to process sessions individually, we need to allow multiple
--   invoices per student per day.

-- ================================================
-- DROP UNIQUE CONSTRAINT
-- ================================================

ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS uq_invoices_student_date;

-- ================================================
-- UPDATE TABLE COMMENT
-- ================================================

COMMENT ON TABLE public.invoices IS 'Invoices created for students. Multiple invoices per student per day are allowed (one per session).';
