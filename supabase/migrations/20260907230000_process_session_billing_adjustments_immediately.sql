-- Process absence-driven billing adjustments immediately without turning the
-- scheduled billing runner into a general reconciliation pass.

CREATE OR REPLACE FUNCTION private.session_billing_cutoff_at(
  p_session_start_at timestamptz
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    (
      (p_session_start_at AT TIME ZONE 'Australia/Adelaide')::date - 1
    ) + time '21:00'
  ) AT TIME ZONE 'Australia/Adelaide';
$$;

REVOKE ALL ON FUNCTION private.session_billing_cutoff_at(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.session_billing_cutoff_at(timestamptz) IS
  'Returns the normal billing-runner cutoff: 9pm Adelaide on the day before a session.';

CREATE OR REPLACE FUNCTION public.enqueue_session_billing_adjustment(
  p_sessions_students_id uuid,
  p_created_by uuid,
  p_reason_category text,
  p_reason_note text DEFAULT NULL,
  p_depends_on_adjustment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_chargeable boolean;
  v_source_line public.invoice_items%ROWTYPE;
  v_source_credit public.credit_notes%ROWTYPE;
  v_kind public.session_billing_adjustment_kind;
  v_source_id uuid;
  v_idempotency_key text;
  v_adjustment_id uuid;
BEGIN
  IF p_reason_category NOT IN (
    'approved_absence', 'extended_absence', 'admin_discretion',
    'attendance_correction', 'late_enrolment', 'unplanned_attendance',
    'treatment_change', 'system_reconciliation'
  ) THEN
    RAISE EXCEPTION 'Invalid billing adjustment reason category: %', p_reason_category;
  END IF;

  PERFORM 1
  FROM public.sessions_students
  WHERE id = p_sessions_students_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session student assignment not found: %', p_sessions_students_id;
  END IF;

  v_is_chargeable := public.session_student_is_chargeable(p_sessions_students_id);

  SELECT ii.*
  INTO v_source_line
  FROM public.invoice_items ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE ii.sessions_students_id = p_sessions_students_id
    AND ii.line_kind IN ('session_charge', 'restoration_charge')
    AND ii.is_fee = false
    AND ii.is_subsidy = false
    AND ii.deleted_at IS NULL
    AND i.deleted_at IS NULL
    AND i.status IN ('draft', 'open', 'paid')
  ORDER BY ii.created_at DESC, ii.id DESC
  LIMIT 1;

  IF v_source_line.id IS NOT NULL THEN
    SELECT cn.*
    INTO v_source_credit
    FROM public.credit_notes cn
    WHERE cn.source_invoice_item_id = v_source_line.id
      AND cn.status <> 'void'
    ORDER BY cn.created_at DESC, cn.id DESC
    LIMIT 1;
  END IF;

  IF NOT v_is_chargeable AND v_source_line.id IS NOT NULL
     AND v_source_credit.id IS NULL AND v_source_line.amount_cents > 0 THEN
    v_kind := 'credit_note';
    v_source_id := v_source_line.id;
  ELSIF v_is_chargeable AND v_source_line.id IS NULL THEN
    v_kind := 'session_charge';
    v_source_id := p_sessions_students_id;
  ELSIF v_is_chargeable AND v_source_credit.id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.invoice_items restoration
       JOIN public.invoices restoration_invoice ON restoration_invoice.id = restoration.invoice_id
       WHERE restoration.restores_credit_note_id = v_source_credit.id
         AND restoration.deleted_at IS NULL
         AND restoration_invoice.deleted_at IS NULL
         AND restoration_invoice.status IN ('draft', 'open', 'paid')
     ) THEN
    v_kind := 'restoration_charge';
    v_source_id := v_source_credit.id;
  ELSE
    UPDATE public.session_billing_adjustments
    SET
      status = 'superseded',
      completed_at = now(),
      last_error = 'Superseded because the current session obligation is already satisfied'
    WHERE sessions_students_id = p_sessions_students_id
      AND status IN ('pending', 'retryable');

    RETURN NULL;
  END IF;

  v_idempotency_key := concat(
    'session-billing:', p_sessions_students_id::text, ':', v_kind::text, ':', v_source_id::text
  );

  UPDATE public.session_billing_adjustments
  SET
    status = 'superseded',
    completed_at = now(),
    last_error = 'Superseded by a newer session billing obligation'
  WHERE sessions_students_id = p_sessions_students_id
    AND status IN ('pending', 'retryable')
    AND idempotency_key <> v_idempotency_key;

  INSERT INTO public.session_billing_adjustments (
    sessions_students_id,
    kind,
    source_invoice_item_id,
    source_credit_note_id,
    depends_on_adjustment_id,
    amount_cents,
    currency,
    reason_category,
    reason_note,
    idempotency_key,
    created_by,
    next_attempt_at
  )
  VALUES (
    p_sessions_students_id,
    v_kind,
    CASE WHEN v_kind = 'credit_note' THEN v_source_line.id END,
    CASE WHEN v_kind = 'restoration_charge' THEN v_source_credit.id END,
    p_depends_on_adjustment_id,
    CASE
      WHEN v_kind = 'credit_note' THEN v_source_line.amount_cents + COALESCE((
        SELECT sum(fee.amount_cents)::integer
        FROM public.invoice_items fee
        WHERE fee.invoice_id = v_source_line.invoice_id
          AND fee.sessions_students_id = p_sessions_students_id
          AND fee.is_fee = true
          AND fee.deleted_at IS NULL
          AND v_source_line.line_kind = 'session_charge'
      ), 0)
      WHEN v_kind = 'restoration_charge' THEN v_source_line.amount_cents
      ELSE NULL
    END,
    CASE
      WHEN v_kind = 'credit_note' THEN COALESCE(
        (SELECT currency FROM public.invoices WHERE id = v_source_line.invoice_id),
        'AUD'
      )
      WHEN v_kind = 'restoration_charge' THEN v_source_credit.currency
      ELSE 'AUD'
    END,
    p_reason_category,
    NULLIF(trim(p_reason_note), ''),
    v_idempotency_key,
    p_created_by,
    CASE
      WHEN v_kind = 'session_charge' THEN GREATEST(
        now(),
        COALESCE(
          (
            SELECT private.session_billing_cutoff_at(s.start_at)
            FROM public.sessions s
            JOIN public.sessions_students ss ON ss.session_id = s.id
            WHERE ss.id = p_sessions_students_id
          ),
          now()
        )
      )
      ELSE now()
    END
  )
  ON CONFLICT (idempotency_key) DO UPDATE
  SET
    reason_note = COALESCE(EXCLUDED.reason_note, public.session_billing_adjustments.reason_note),
    depends_on_adjustment_id = COALESCE(
      EXCLUDED.depends_on_adjustment_id,
      public.session_billing_adjustments.depends_on_adjustment_id
    )
  RETURNING id INTO v_adjustment_id;

  RETURN v_adjustment_id;
END;
$$;

-- Preserve retry backoff, but align existing not-yet-attempted future charges
-- with the normal nightly billing window.
UPDATE public.session_billing_adjustments adjustment
SET
  next_attempt_at = GREATEST(now(), private.session_billing_cutoff_at(session.start_at)),
  updated_at = now()
FROM public.sessions_students assignment
JOIN public.sessions session ON session.id = assignment.session_id
WHERE adjustment.sessions_students_id = assignment.id
  AND adjustment.kind = 'session_charge'
  AND adjustment.status = 'pending'
  AND adjustment.attempt_count = 0;

CREATE OR REPLACE FUNCTION private.claim_session_billing_adjustments_matching(
  p_limit integer,
  p_adjustment_ids uuid[]
)
RETURNS SETOF public.session_billing_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.session_billing_adjustments
  SET
    status = 'retryable',
    next_attempt_at = now(),
    last_error = 'Recovered after the previous processing lease expired',
    updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '30 minutes'
    AND (p_adjustment_ids IS NULL OR id = ANY(p_adjustment_ids));

  RETURN QUERY
  WITH ready AS (
    SELECT adjustment.id
    FROM public.session_billing_adjustments adjustment
    LEFT JOIN public.session_billing_adjustments dependency
      ON dependency.id = adjustment.depends_on_adjustment_id
    WHERE adjustment.status IN ('pending', 'retryable')
      AND adjustment.next_attempt_at <= now()
      AND adjustment.attempt_count < adjustment.max_attempts
      AND (p_adjustment_ids IS NULL OR adjustment.id = ANY(p_adjustment_ids))
      AND (
        adjustment.depends_on_adjustment_id IS NULL
        OR dependency.status IN ('succeeded', 'superseded')
      )
    ORDER BY adjustment.created_at, adjustment.id
    FOR UPDATE OF adjustment SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.session_billing_adjustments adjustment
  SET
    status = 'processing',
    attempt_count = adjustment.attempt_count + 1,
    updated_at = now()
  FROM ready
  WHERE adjustment.id = ready.id
  RETURNING adjustment.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_session_billing_adjustments(p_limit integer DEFAULT 25)
RETURNS SETOF public.session_billing_adjustments
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM private.claim_session_billing_adjustments_matching(p_limit, NULL);
$$;

CREATE OR REPLACE FUNCTION public.claim_session_billing_adjustments_by_ids(
  p_adjustment_ids uuid[],
  p_limit integer DEFAULT 25
)
RETURNS SETOF public.session_billing_adjustments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_adjustment_ids IS NULL OR cardinality(p_adjustment_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.claim_session_billing_adjustments_matching(
    p_limit,
    p_adjustment_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION private.claim_session_billing_adjustments_matching(integer, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_session_billing_adjustments_by_ids(uuid[], integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_session_billing_adjustments_by_ids(uuid[], integer)
  TO service_role;

COMMENT ON FUNCTION public.claim_session_billing_adjustments_by_ids(uuid[], integer) IS
  'Claims only due adjustments from an explicitly requested set. Used for immediate command-scoped processing.';

CREATE OR REPLACE VIEW public.vadmin_reconciliation_session_billing_adjustments
WITH (security_invoker = true)
AS
SELECT
  adjustment.id AS adjustment_id,
  adjustment.sessions_students_id,
  ss.student_id,
  ss.session_id,
  s.start_at AS session_start_at,
  adjustment.kind,
  adjustment.status,
  adjustment.amount_cents,
  adjustment.currency,
  adjustment.reason_category,
  adjustment.reason_note,
  adjustment.attempt_count,
  adjustment.max_attempts,
  adjustment.next_attempt_at,
  adjustment.last_error,
  CASE
    WHEN adjustment.status = 'failed' THEN 'failed_adjustment'
    WHEN adjustment.depends_on_adjustment_id IS NOT NULL AND dependency.status = 'failed'
      THEN 'blocked_by_failed_dependency'
    WHEN adjustment.status = 'retryable' THEN 'retryable_adjustment'
    ELSE 'overdue_adjustment'
  END AS issue,
  adjustment.created_at,
  adjustment.updated_at
FROM public.session_billing_adjustments adjustment
JOIN public.sessions_students ss ON ss.id = adjustment.sessions_students_id
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.session_billing_adjustments dependency
  ON dependency.id = adjustment.depends_on_adjustment_id
WHERE adjustment.status = 'failed'
  OR adjustment.status = 'retryable'
  OR (
    adjustment.depends_on_adjustment_id IS NOT NULL
    AND dependency.status = 'failed'
    AND adjustment.status IN ('pending', 'processing')
  )
  OR (
    adjustment.status = 'pending'
    AND adjustment.next_attempt_at < now()
  )
  OR (
    adjustment.status = 'processing'
    AND adjustment.updated_at < now() - interval '30 minutes'
  );

GRANT SELECT ON public.vadmin_reconciliation_session_billing_adjustments TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_session_billing_adjustments IS
  'Exceptional session billing work only: retryable, overdue, blocked, or terminal adjustments.';

CREATE OR REPLACE FUNCTION public.log_student_absences_with_billing(
  operations jsonb,
  logged_by_staff_id uuid,
  reason_category text,
  reason_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_operation jsonb;
  v_original_adjustment_id uuid;
  v_original_adjustment_kind public.session_billing_adjustment_kind;
  v_replacement_adjustment_id uuid;
  v_adjustment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF COALESCE(auth.role(), 'service_role') <> 'service_role'
     AND NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Only active admin staff may log absences with billing changes'
      USING ERRCODE = '42501';
  END IF;

  FOR v_operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    IF v_operation->>'action' = 'reschedule' AND NOT EXISTS (
      SELECT 1
      FROM public.sessions_students original_assignment
      JOIN public.sessions original_session ON original_session.id = original_assignment.session_id
      LEFT JOIN public.classes original_class ON original_class.id = original_session.class_id
      JOIN public.sessions target_session
        ON target_session.id = (v_operation->>'target_session_id')::uuid
      LEFT JOIN public.classes target_class ON target_class.id = target_session.class_id
      WHERE original_assignment.id = (v_operation->>'original_sessions_students_id')::uuid
        AND original_assignment.student_id = (v_operation->>'student_id')::uuid
        AND COALESCE(target_session.subject_id, target_class.subject_id)
          = COALESCE(original_session.subject_id, original_class.subject_id)
        AND target_session.class_id IS DISTINCT FROM original_session.class_id
        AND target_session.start_at > now()
        AND target_session.status = 'ACTIVE'
        AND target_session.billing_type IS NOT NULL
        AND target_session.type <> 'TRIAL_SESSION'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Replacement session is not eligible for rescheduling',
        'operation', v_operation
      );
    END IF;
  END LOOP;

  v_result := public.log_student_absences(operations, logged_by_staff_id);

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN v_result;
  END IF;

  FOR v_operation IN SELECT * FROM jsonb_array_elements(v_result->'operations')
  LOOP
    v_original_adjustment_id := public.enqueue_session_billing_adjustment(
      (v_operation->>'original_sessions_students_id')::uuid,
      logged_by_staff_id,
      reason_category,
      reason_note
    );

    v_original_adjustment_kind := NULL;
    IF v_original_adjustment_id IS NOT NULL THEN
      v_adjustment_ids := array_append(v_adjustment_ids, v_original_adjustment_id);
      SELECT kind INTO v_original_adjustment_kind
      FROM public.session_billing_adjustments
      WHERE id = v_original_adjustment_id;
    END IF;

    IF v_operation->>'action' = 'reschedule' THEN
      v_replacement_adjustment_id := public.enqueue_session_billing_adjustment(
        (v_operation->>'new_sessions_students_id')::uuid,
        logged_by_staff_id,
        reason_category,
        reason_note,
        CASE
          WHEN v_original_adjustment_kind = 'credit_note' THEN v_original_adjustment_id
          ELSE NULL
        END
      );

      IF v_replacement_adjustment_id IS NOT NULL THEN
        v_adjustment_ids := array_append(v_adjustment_ids, v_replacement_adjustment_id);
      END IF;
    END IF;
  END LOOP;

  RETURN v_result || jsonb_build_object(
    'billing_adjustment_ids', to_jsonb(v_adjustment_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_student_absences_with_billing(jsonb, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_student_absences_with_billing(jsonb, uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.log_student_absences_with_billing(jsonb, uuid, text, text) IS
  'Atomically logs absence decisions and returns the exact durable billing adjustments for immediate processing.';
