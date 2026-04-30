-- Migration: Admin reconciliation — session lines only on void invoices
-- Description:
--   Billable past sessions_students rows that still have invoice_items only on void
--   invoices (no active re-invoice). Omits lines that have been re-billed.
-- Purpose: Surfaces work that may need a new invoice after a void.

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
      AND inv2.status IS DISTINCT FROM 'void'
  );

GRANT SELECT ON public.vadmin_reconciliation_void_invoice_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_void_invoice_sessions IS
  'Admin reconciliation: past billable session lines whose invoice_items are only on void invoices (not re-invoiced). One row per sessions_students; void_* columns refer to the latest void invoice touching that line.';
