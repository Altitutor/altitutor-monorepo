-- Session-runner billing creates one invoice per sessions_students row; the same student can have
-- multiple invoices sharing invoice_date (different Stripe invoices). Do not enforce uniqueness on
-- (student_id, invoice_date).
--
-- Drops uq_invoices_session_runner_student_invoice_date if present (e.g. dev applied an earlier
-- revision of 20260503015916 that created it, or legacy state). Idempotent.

DROP INDEX IF EXISTS public.uq_invoices_session_runner_student_invoice_date;
