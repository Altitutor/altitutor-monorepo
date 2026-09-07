-- Process absence-driven billing adjustments immediately without turning the
-- scheduled billing runner into a general reconciliation pass.

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
