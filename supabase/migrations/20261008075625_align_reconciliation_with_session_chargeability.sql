-- Use one value-only policy for workers and AdminWeb reconciliation. This
-- function reads no tables and grants no access to session/student records.
CREATE FUNCTION public.session_billing_obligation_is_chargeable(
  p_session_active boolean,
  p_billing_type public.billing_type,
  p_was_trial boolean,
  p_actual_was_trial boolean,
  p_attended boolean,
  p_planned_absence boolean,
  p_absence_billing_treatment text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p_session_active AND p_billing_type IS NOT NULL
    AND NOT (p_was_trial OR p_actual_was_trial)
    AND (p_attended OR NOT p_planned_absence OR p_absence_billing_treatment = 'charge');
$$;

REVOKE ALL ON FUNCTION public.session_billing_obligation_is_chargeable(
  boolean, public.billing_type, boolean, boolean, boolean, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_billing_obligation_is_chargeable(
  boolean, public.billing_type, boolean, boolean, boolean, boolean, text
) TO authenticated, service_role;
COMMENT ON FUNCTION public.session_billing_obligation_is_chargeable(
  boolean, public.billing_type, boolean, boolean, boolean, boolean, text
) IS 'Value-only chargeability policy shared by the service-only session lookup and admin reconciliation. Reads no protected data.';

-- Cancelled timetable occurrences are calendar history, never billable lessons.
CREATE OR REPLACE FUNCTION public.session_student_is_chargeable(
  p_sessions_students_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_student_id uuid;
  v_planned_absence boolean;
  v_is_credited boolean;
  v_is_rescheduled boolean;
  v_was_trial boolean;
  v_billing_type public.billing_type;
  v_session_active boolean;
  v_attended boolean;
  v_actual_was_trial boolean;
  v_treatment text;
BEGIN
  SELECT
    ss.session_id,
    ss.student_id,
    ss.planned_absence,
    ss.is_credited,
    ss.is_rescheduled,
    ss.was_trial,
    s.billing_type,
    s.status = 'ACTIVE' AND s.calendar_tombstone_until IS NULL
  INTO
    v_session_id,
    v_student_id,
    v_planned_absence,
    v_is_credited,
    v_is_rescheduled,
    v_was_trial,
    v_billing_type,
    v_session_active
  FROM public.sessions_students ss
  JOIN public.sessions s ON s.id = ss.session_id
  WHERE ss.id = p_sessions_students_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session student assignment not found: %', p_sessions_students_id;
  END IF;

  SELECT
    COALESCE(bool_or(tlsa.attended), false),
    COALESCE(bool_or(tlsa.was_trial), false)
  INTO v_attended, v_actual_was_trial
  FROM public.tutor_logs tl
  JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
  WHERE tl.session_id = v_session_id
    AND tlsa.student_id = v_student_id;

  v_treatment := public.derive_session_absence_billing_treatment(
    v_planned_absence,
    v_is_credited,
    v_is_rescheduled
  );

  RETURN public.session_billing_obligation_is_chargeable(
    v_session_active, v_billing_type, v_was_trial, v_actual_was_trial,
    v_attended, v_planned_absence, v_treatment
  );
END;
$$;

CREATE OR REPLACE VIEW public.vadmin_reconciliation_uninvoiced_sessions
WITH (security_invoker = true)
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
  attendance.actual_attended,
  attendance.actual_was_trial,
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
LEFT JOIN LATERAL (
  SELECT bool_or(tlsa.attended) AS actual_attended,
    bool_or(tlsa.was_trial) AS actual_was_trial
  FROM public.tutor_logs tl
  JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
  WHERE tl.session_id = s.id AND tlsa.student_id = ss.student_id
) attendance ON true
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
  AND public.session_billing_obligation_is_chargeable(
    s.status = 'ACTIVE' AND s.calendar_tombstone_until IS NULL,
    s.billing_type, ss.was_trial,
    COALESCE(attendance.actual_was_trial, false),
    COALESCE(attendance.actual_attended, false), ss.planned_absence,
    public.derive_session_absence_billing_treatment(
      ss.planned_absence, ss.is_credited, ss.is_rescheduled
    )
  )
  -- Billing-single rejects these assignments; their existing adjustment is the
  -- actionable financial-reconciliation item, not another Invoice button.
  AND NOT EXISTS (
    SELECT 1 FROM public.session_billing_adjustments adjustment
    WHERE adjustment.sessions_students_id = ss.id
      AND adjustment.status IN ('pending', 'processing', 'retryable', 'failed')
  );

REVOKE ALL ON public.vadmin_reconciliation_uninvoiced_sessions FROM PUBLIC, anon;
GRANT SELECT ON public.vadmin_reconciliation_uninvoiced_sessions TO authenticated, service_role;
COMMENT ON VIEW public.vadmin_reconciliation_uninvoiced_sessions IS
  'Admin reconciliation: past chargeable assignments using the billing policy, excluding assignments controlled by unresolved adjustments. Caller RLS applies.';

CREATE OR REPLACE VIEW public.vadmin_reconciliation_void_invoice_sessions
WITH (security_invoker = true)
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
  s.short_name AS session_short_name,
  CASE
    WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
    ELSE false
  END AS is_extra,
  EXISTS (
    SELECT 1 FROM public.tutor_logs tl
    WHERE tl.session_id = s.id
  ) AS has_tutor_log,
  attendance.actual_attended,
  attendance.actual_was_trial,
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  inv.id AS void_invoice_id,
  inv.invoice_date AS void_invoice_date,
  inv.stripe_invoice_id AS void_stripe_invoice_id,
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
LEFT JOIN LATERAL (
  SELECT bool_or(tlsa.attended) AS actual_attended,
    bool_or(tlsa.was_trial) AS actual_was_trial
  FROM public.tutor_logs tl
  JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
  WHERE tl.session_id = s.id AND tlsa.student_id = ss.student_id
) attendance ON true
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
  )
  AND public.session_billing_obligation_is_chargeable(
    s.status = 'ACTIVE' AND s.calendar_tombstone_until IS NULL,
    s.billing_type, ss.was_trial,
    COALESCE(attendance.actual_was_trial, false),
    COALESCE(attendance.actual_attended, false), ss.planned_absence,
    public.derive_session_absence_billing_treatment(
      ss.planned_absence, ss.is_credited, ss.is_rescheduled
    )
  )
  -- Billing-single rejects these assignments; their existing adjustment is the
  -- actionable financial-reconciliation item, not another Invoice button.
  AND NOT EXISTS (
    SELECT 1 FROM public.session_billing_adjustments adjustment
    WHERE adjustment.sessions_students_id = ss.id
      AND adjustment.status IN ('pending', 'processing', 'retryable', 'failed')
  );

REVOKE ALL ON public.vadmin_reconciliation_void_invoice_sessions FROM PUBLIC, anon;
GRANT SELECT ON public.vadmin_reconciliation_void_invoice_sessions TO authenticated, service_role;
COMMENT ON VIEW public.vadmin_reconciliation_void_invoice_sessions IS
  'Admin reconciliation: past chargeable assignments using the billing policy, excluding assignments controlled by unresolved adjustments. Caller RLS applies.';

