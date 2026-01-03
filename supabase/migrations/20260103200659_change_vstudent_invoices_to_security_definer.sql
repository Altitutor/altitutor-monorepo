-- Migration: Change vstudent_invoices and vstudent_invoice_items to use security_invoker = false
-- Description:
--  Change vstudent_invoices and vstudent_invoice_items views from security_invoker = on
--  to security_invoker = false. This allows the views to use security definer functions
--  like current_student_id() with proper permissions. The views call security definer
--  functions internally, so security_invoker = false ensures they execute with the
--  definer's permissions when calling those functions.

-- ================================================
-- UPDATE VSTUDENT_INVOICES VIEW
-- ================================================
-- Note: Using DROP/CREATE instead of CREATE OR REPLACE because
-- PostgreSQL cannot change security options with CREATE OR REPLACE

DROP VIEW IF EXISTS public.vstudent_invoices;

CREATE VIEW public.vstudent_invoices
WITH (security_invoker = false)
AS
SELECT 
  i.id,
  i.student_id,
  i.stripe_invoice_id,
  i.stripe_invoice_number,
  i.invoice_date,
  i.amount_due_cents,
  i.amount_paid_cents,
  i.currency,
  i.status,
  i.receipt_url,
  i.hosted_invoice_url,
  i.invoice_pdf,
  i.created_at,
  i.paid_at,
  i.finalized_at,
  -- Aggregate invoice items summary
  COUNT(ii.id) AS item_count,
  SUM(CASE WHEN NOT ii.is_subsidy THEN ii.amount_cents ELSE 0 END) AS total_charges_cents,
  SUM(CASE WHEN ii.is_subsidy THEN ABS(ii.amount_cents) ELSE 0 END) AS total_subsidies_cents
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
WHERE i.student_id = public.current_student_id()
GROUP BY i.id, i.student_id, i.stripe_invoice_id, i.stripe_invoice_number, i.invoice_date,
         i.amount_due_cents, i.amount_paid_cents, i.currency, i.status, i.receipt_url,
         i.hosted_invoice_url, i.invoice_pdf, i.created_at, i.paid_at, i.finalized_at
ORDER BY i.invoice_date DESC, i.created_at DESC;

GRANT SELECT ON public.vstudent_invoices TO authenticated;

-- ================================================
-- UPDATE VSTUDENT_INVOICE_ITEMS VIEW
-- ================================================

DROP VIEW IF EXISTS public.vstudent_invoice_items;

CREATE VIEW public.vstudent_invoice_items
WITH (security_invoker = false)
AS
SELECT 
  ii.id,
  ii.invoice_id,
  ii.sessions_students_id,
  ii.amount_cents,
  ii.description,
  ii.is_subsidy,
  ii.session_id,
  ii.student_id,
  ii.created_at,
  -- Join session details
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  -- Join subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum
FROM public.invoice_items ii
JOIN public.invoices i ON i.id = ii.invoice_id
JOIN public.sessions s ON s.id = ii.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE i.student_id = public.current_student_id()
ORDER BY ii.created_at DESC;

GRANT SELECT ON public.vstudent_invoice_items TO authenticated;

COMMENT ON VIEW public.vstudent_invoices IS 'Student portal view: Own invoices with aggregated item summaries (uses security_invoker = false to work with security definer functions)';
COMMENT ON VIEW public.vstudent_invoice_items IS 'Student portal view: Invoice items (sessions) for own invoices (uses security_invoker = false to work with security definer functions)';
