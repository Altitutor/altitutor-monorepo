-- Migration: Drop session-runner (student_id, invoice_date) partial unique index
-- Description:
--   Index uq_invoices_session_runner_student_invoice_date enforced at most one
--   session_runner invoices row per (student_id, invoice_date).
--   Billing creates one Stripe invoice per sessions_students row (distinct stripe_invoice_id);
--   multiple sessions on the same Adelaide/calendar invoice_date therefore require multiple
--   Postgres rows. The partial unique caused insert 23505; saveInvoiceToDatabase returned null
--   after a mismatched refetch → void in Stripe without a corresponding DB row.
--
--   Stripe invoice identity remains unique via invoices.stripe_invoice_id (table constraint).
--   Session-level dedupe remains on invoice_items + RPC get_invoiced_sessions_students_ids.

DROP INDEX IF EXISTS public.uq_invoices_session_runner_student_invoice_date;
