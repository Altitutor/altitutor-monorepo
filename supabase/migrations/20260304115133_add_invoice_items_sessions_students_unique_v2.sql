-- Migration: Add unique index on invoice_items.sessions_students_id (v2)
-- Description:
--   - Enforce at most one non-fee, non-subsidy invoice_items row per
--     sessions_students_id, regardless of invoice.
--   - This runs after the fix_invoice_duplicates migration to ensure that
--     historical duplicates have been cleaned up before the index is created.

create unique index if not exists invoice_items_sessions_students_unique
  on public.invoice_items (sessions_students_id)
  where
    sessions_students_id is not null
    and is_fee = false
    and is_subsidy = false;

