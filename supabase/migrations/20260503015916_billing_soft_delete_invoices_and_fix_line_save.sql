-- Migration: Soft-delete invoices / invoice_items + partial unique indexes ignoring deleted rows
-- Purpose:
--   - Release sessions_students unique slot after reconciliation archives void invoices (deleted_at)
--   - Exclude soft-deleted rows from uninvoiced / RPC / portal views
-- Session-runner billing: one invoice per sessions_students run (multiple invoices per student per
-- invoice_date are valid). Dedupe is enforced per sessions_students_id on invoice_items only.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.invoices.deleted_at IS
  'Soft-delete: retained for audit (stripe_invoice_id still lookup). Excluded from active billing UI.';
COMMENT ON COLUMN public.invoice_items.deleted_at IS
  'Soft-delete line item; releases invoice_items_sessions_students_unique when archived with invoice.';

-- Replace partial unique indexes (include deleted_at IS NULL)
DROP INDEX IF EXISTS public.invoice_items_sessions_students_unique;
DROP INDEX IF EXISTS public.idx_invoice_items_unique_session_charge;
DROP INDEX IF EXISTS public.uq_invoices_session_runner_student_invoice_date;

CREATE UNIQUE INDEX invoice_items_sessions_students_unique
  ON public.invoice_items (sessions_students_id)
  WHERE sessions_students_id IS NOT NULL
    AND is_fee = false
    AND is_subsidy = false
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX idx_invoice_items_unique_session_charge
  ON public.invoice_items (invoice_id, sessions_students_id)
  WHERE is_fee = false
    AND deleted_at IS NULL;

-- Session charges: one active line per sessions_students_id (invoice headers can repeat per student/date).

COMMENT ON INDEX public.invoice_items_sessions_students_unique IS
  'At most one active (non-deleted) session charge line per sessions_students_id.';
COMMENT ON INDEX public.idx_invoice_items_unique_session_charge IS
  'Duplicate session charge on same invoice prevented for active (non-deleted) rows.';

-- Billing RPC: ignore soft-deleted invoice / lines
CREATE OR REPLACE FUNCTION public.get_invoiced_sessions_students_ids(p_sessions_students_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ii.sessions_students_id
  FROM public.invoice_items ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE ii.sessions_students_id = ANY(p_sessions_students_ids)
    AND ii.is_fee = false
    AND ii.deleted_at IS NULL
    AND i.deleted_at IS NULL
    AND i.status IN ('draft', 'open', 'paid')
    AND i.billing_source = 'session_runner';
$$;

COMMENT ON FUNCTION public.get_invoiced_sessions_students_ids(uuid[]) IS
  'Returns sessions_students_ids already invoiced via session_runner (active invoices only). Ignores soft-deleted invoices/items.';

-- Admin uninvoiced reconciliation view
DROP VIEW IF EXISTS public.vadmin_reconciliation_uninvoiced_sessions;

CREATE VIEW public.vadmin_reconciliation_uninvoiced_sessions
WITH (security_invoker = false)
AS
SELECT
  ss.id AS sessions_students_id,
  ss.student_id,
  ss.session_id,
  ss.planned_absence,
  ss.is_rescheduled,
  ss.is_credited,
  ss.was_trial,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  s.billing_type,
  s.subject_id,
  sub.name AS subject_name,
  sub.long_name AS subject_long_name,
  TRIM(
    COALESCE(NULLIF(sub.long_name, ''), '') ||
    CASE
      WHEN sub.long_name IS NOT NULL AND sub.long_name != '' THEN ' ' ELSE ''
    END ||
    CASE
      WHEN s.start_at IS NOT NULL THEN
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'HH12:MI AM') || ' ' ||
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy FMDD Mon')
      ELSE ''
    END ||
    CASE
      WHEN s.type IS NOT NULL THEN ' ' || s.type::text
      ELSE ''
    END
  ) AS session_name,
  CASE
    WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
    ELSE false
  END AS is_extra,
  EXISTS (
    SELECT 1 FROM public.tutor_logs tl
    WHERE tl.session_id = s.id
  ) AS has_tutor_log,
  (
    SELECT tlsa.attended
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_attended,
  (
    SELECT tlsa.was_trial
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_was_trial,
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  ss.created_at,
  ss.updated_at
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ss.student_id
LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id
  AND cs.student_id = ss.student_id
  AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
WHERE
  s.start_at < NOW()
  AND s.billing_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoice_items ii
    INNER JOIN public.invoices inv ON inv.id = ii.invoice_id
    WHERE ii.sessions_students_id = ss.id
      AND ii.deleted_at IS NULL
      AND inv.deleted_at IS NULL
  )
  AND (
    ss.planned_absence = false
    OR (
      ss.planned_absence = true
      AND EXISTS (
        SELECT 1
        FROM public.tutor_logs tl
        JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
        WHERE tl.session_id = s.id
          AND tlsa.student_id = ss.student_id
          AND tlsa.attended = true
      )
    )
  )
  AND ss.was_trial = FALSE;

GRANT SELECT ON public.vadmin_reconciliation_uninvoiced_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_uninvoiced_sessions IS
  'Admin view: Past sessions without active invoice items (deleted_at IS NULL).';

-- Void-only reconciliation view
DROP VIEW IF EXISTS public.vadmin_reconciliation_void_invoice_sessions;

CREATE VIEW public.vadmin_reconciliation_void_invoice_sessions
WITH (security_invoker = false)
AS
SELECT
  ss.id AS sessions_students_id,
  ss.student_id,
  ss.session_id,
  ss.planned_absence,
  ss.is_rescheduled,
  ss.is_credited,
  ss.was_trial,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  s.billing_type,
  s.subject_id,
  sub.name AS subject_name,
  sub.long_name AS subject_long_name,
  TRIM(
    COALESCE(NULLIF(sub.long_name, ''), '') ||
    CASE
      WHEN sub.long_name IS NOT NULL AND sub.long_name != '' THEN ' ' ELSE ''
    END ||
    CASE
      WHEN s.start_at IS NOT NULL THEN
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'HH12:MI AM') || ' ' ||
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy FMDD Mon')
      ELSE ''
    END ||
    CASE
      WHEN s.type IS NOT NULL THEN ' ' || s.type::text
      ELSE ''
    END
  ) AS session_name,
  CASE
    WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
    ELSE false
  END AS is_extra,
  EXISTS (
    SELECT 1 FROM public.tutor_logs tl
    WHERE tl.session_id = s.id
  ) AS has_tutor_log,
  (
    SELECT tlsa.attended
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_attended,
  (
    SELECT tlsa.was_trial
    FROM public.tutor_logs tl
    JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
    WHERE tl.session_id = s.id
      AND tlsa.student_id = ss.student_id
    LIMIT 1
  ) AS actual_was_trial,
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  inv.id AS void_invoice_id,
  inv.invoice_date AS void_invoice_date,
  inv.stripe_invoice_number AS void_stripe_invoice_number,
  inv.voided_at AS void_invoice_voided_at,
  ss.created_at,
  ss.updated_at
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ss.student_id
LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id
  AND cs.student_id = ss.student_id
  AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
INNER JOIN LATERAL (
  SELECT inv_inner.*
  FROM public.invoice_items ii
  INNER JOIN public.invoices inv_inner ON inv_inner.id = ii.invoice_id
  WHERE ii.sessions_students_id = ss.id
    AND ii.deleted_at IS NULL
    AND inv_inner.deleted_at IS NULL
    AND inv_inner.status = 'void'
  ORDER BY inv_inner.voided_at DESC NULLS LAST, inv_inner.invoice_date DESC NULLS LAST, inv_inner.updated_at DESC
  LIMIT 1
) inv ON true
WHERE
  s.start_at < NOW()
  AND s.billing_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoice_items ii2
    INNER JOIN public.invoices inv2 ON inv2.id = ii2.invoice_id
    WHERE ii2.sessions_students_id = ss.id
      AND ii2.deleted_at IS NULL
      AND inv2.deleted_at IS NULL
      AND inv2.status IS DISTINCT FROM 'void'
  );

GRANT SELECT ON public.vadmin_reconciliation_void_invoice_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_void_invoice_sessions IS
  'Sessions whose active invoice_items sit only on void invoices; soft-deleted lines excluded.';

-- Student portal
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
  i.billing_source,
  i.student_subscription_id,
  COUNT(ii.id) AS item_count,
  SUM(CASE WHEN NOT ii.is_subsidy THEN ii.amount_cents ELSE 0 END) AS total_charges_cents,
  SUM(CASE WHEN ii.is_subsidy THEN ABS(ii.amount_cents) ELSE 0 END) AS total_subsidies_cents
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id AND ii.deleted_at IS NULL
WHERE i.student_id = public.current_student_id()
  AND i.deleted_at IS NULL
GROUP BY
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
  i.billing_source,
  i.student_subscription_id
ORDER BY i.invoice_date DESC, i.created_at DESC;

GRANT SELECT ON public.vstudent_invoices TO authenticated;

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
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum
FROM public.invoice_items ii
JOIN public.invoices i ON i.id = ii.invoice_id
LEFT JOIN public.sessions s ON s.id = ii.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE i.student_id = public.current_student_id()
  AND i.deleted_at IS NULL
  AND ii.deleted_at IS NULL
ORDER BY ii.created_at DESC;

GRANT SELECT ON public.vstudent_invoice_items TO authenticated;

COMMENT ON VIEW public.vstudent_invoices IS 'Student portal: non-deleted invoices only.';
COMMENT ON VIEW public.vstudent_invoice_items IS 'Student portal: non-deleted invoice lines only.';
