-- Append-only financial adjustments for session billing.
--
-- Existing sessions_students absence flags remain the write model for this release.
-- These functions provide one canonical interpretation and a durable, idempotent
-- queue for the Stripe side effects that follow from a change in obligation.

CREATE TYPE public.session_billing_adjustment_kind AS ENUM (
  'credit_note',
  'session_charge',
  'restoration_charge'
);

CREATE TYPE public.session_billing_adjustment_status AS ENUM (
  'pending',
  'processing',
  'retryable',
  'succeeded',
  'failed',
  'superseded'
);

ALTER TABLE public.invoice_items
  ADD COLUMN line_kind text,
  ADD COLUMN restores_credit_note_id uuid,
  ADD COLUMN billing_adjustment_id uuid;

UPDATE public.invoice_items
SET line_kind = 'session_charge'
WHERE sessions_students_id IS NOT NULL
  AND is_fee = false
  AND is_subsidy = false;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_line_kind_check
    CHECK (line_kind IS NULL OR line_kind IN ('session_charge', 'restoration_charge')),
  ADD CONSTRAINT invoice_items_restoration_shape_check
    CHECK (
      (line_kind = 'restoration_charge' AND restores_credit_note_id IS NOT NULL)
      OR (line_kind IS DISTINCT FROM 'restoration_charge' AND restores_credit_note_id IS NULL)
    );

ALTER TABLE public.credit_notes
  ADD COLUMN source_invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
  ADD COLUMN billing_adjustment_id uuid;

CREATE TABLE public.session_billing_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessions_students_id uuid NOT NULL
    REFERENCES public.sessions_students(id) ON DELETE RESTRICT,
  kind public.session_billing_adjustment_kind NOT NULL,
  status public.session_billing_adjustment_status NOT NULL DEFAULT 'pending',
  source_invoice_item_id uuid
    REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
  source_credit_note_id uuid
    REFERENCES public.credit_notes(id) ON DELETE RESTRICT,
  depends_on_adjustment_id uuid
    REFERENCES public.session_billing_adjustments(id) ON DELETE RESTRICT,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  currency text NOT NULL DEFAULT 'AUD',
  reason_category text NOT NULL CHECK (reason_category IN (
    'approved_absence',
    'extended_absence',
    'admin_discretion',
    'attendance_correction',
    'late_enrolment',
    'unplanned_attendance',
    'treatment_change',
    'system_reconciliation'
  )),
  reason_note text,
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT session_billing_adjustments_source_shape_check CHECK (
    (kind = 'credit_note' AND source_invoice_item_id IS NOT NULL AND source_credit_note_id IS NULL)
    OR (kind = 'session_charge' AND source_invoice_item_id IS NULL AND source_credit_note_id IS NULL)
    OR (kind = 'restoration_charge' AND source_invoice_item_id IS NULL AND source_credit_note_id IS NOT NULL)
  ),
  CONSTRAINT session_billing_adjustments_not_self_dependent_check
    CHECK (depends_on_adjustment_id IS NULL OR depends_on_adjustment_id <> id)
);

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_restores_credit_note_id_fkey
    FOREIGN KEY (restores_credit_note_id) REFERENCES public.credit_notes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoice_items_billing_adjustment_id_fkey
    FOREIGN KEY (billing_adjustment_id) REFERENCES public.session_billing_adjustments(id) ON DELETE RESTRICT;

ALTER TABLE public.credit_notes
  ADD CONSTRAINT credit_notes_billing_adjustment_id_fkey
    FOREIGN KEY (billing_adjustment_id) REFERENCES public.session_billing_adjustments(id) ON DELETE RESTRICT;

DROP INDEX IF EXISTS public.invoice_items_sessions_students_unique;
DROP INDEX IF EXISTS public.idx_invoice_items_unique_session_charge;

CREATE UNIQUE INDEX invoice_items_original_session_charge_unique
  ON public.invoice_items (sessions_students_id)
  WHERE sessions_students_id IS NOT NULL
    AND line_kind = 'session_charge'
    AND is_fee = false
    AND is_subsidy = false
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX invoice_items_restored_credit_unique
  ON public.invoice_items (restores_credit_note_id)
  WHERE restores_credit_note_id IS NOT NULL
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX invoice_items_invoice_session_kind_unique
  ON public.invoice_items (invoice_id, sessions_students_id, line_kind)
  WHERE is_fee = false
    AND is_subsidy = false
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX credit_notes_source_invoice_item_unique
  ON public.credit_notes (source_invoice_item_id)
  WHERE source_invoice_item_id IS NOT NULL
    AND status <> 'void';

CREATE UNIQUE INDEX credit_notes_billing_adjustment_unique
  ON public.credit_notes (billing_adjustment_id)
  WHERE billing_adjustment_id IS NOT NULL;

CREATE UNIQUE INDEX invoice_items_billing_adjustment_unique
  ON public.invoice_items (billing_adjustment_id)
  WHERE billing_adjustment_id IS NOT NULL;

CREATE INDEX session_billing_adjustments_ready_idx
  ON public.session_billing_adjustments (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retryable');

CREATE INDEX session_billing_adjustments_session_idx
  ON public.session_billing_adjustments (sessions_students_id, created_at DESC);

ALTER TABLE public.session_billing_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.session_billing_adjustments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_billing_adjustments TO authenticated;
GRANT ALL ON TABLE public.session_billing_adjustments TO service_role;

CREATE POLICY "ADMINSTAFF full access to session billing adjustments"
  ON public.session_billing_adjustments
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE TRIGGER set_updated_at_session_billing_adjustments
BEFORE UPDATE ON public.session_billing_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.derive_session_absence_billing_treatment(
  p_planned_absence boolean,
  p_is_credited boolean,
  p_is_rescheduled boolean
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_is_credited AND p_is_rescheduled THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A session cannot be both credited and rescheduled';
  END IF;

  IF NOT p_planned_absence THEN
    RETURN 'none';
  ELSIF p_is_credited THEN
    RETURN 'credit';
  ELSIF p_is_rescheduled THEN
    RETURN 'replacement';
  END IF;

  RETURN 'charge';
END;
$$;

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
    s.billing_type
  INTO
    v_session_id,
    v_student_id,
    v_planned_absence,
    v_is_credited,
    v_is_rescheduled,
    v_was_trial,
    v_billing_type
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

  RETURN v_billing_type IS NOT NULL
    AND NOT (v_was_trial OR v_actual_was_trial)
    AND (
      v_attended
      OR NOT v_planned_absence
      OR v_treatment = 'charge'
    );
END;
$$;

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
      WHEN v_kind = 'credit_note' THEN COALESCE((SELECT currency FROM public.invoices WHERE id = v_source_line.invoice_id), 'AUD')
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
          (SELECT start_at - interval '1 day' FROM public.sessions s
           JOIN public.sessions_students ss ON ss.session_id = s.id
           WHERE ss.id = p_sessions_students_id),
          now()
        )
      )
      ELSE now()
    END
  )
  ON CONFLICT (idempotency_key) DO UPDATE
  SET
    reason_note = COALESCE(EXCLUDED.reason_note, public.session_billing_adjustments.reason_note),
    depends_on_adjustment_id = COALESCE(EXCLUDED.depends_on_adjustment_id, public.session_billing_adjustments.depends_on_adjustment_id)
  RETURNING id INTO v_adjustment_id;

  RETURN v_adjustment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_session_billing_adjustments(p_limit integer DEFAULT 25)
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
    AND updated_at < now() - interval '30 minutes';

  RETURN QUERY
  WITH ready AS (
    SELECT adjustment.id
    FROM public.session_billing_adjustments adjustment
    LEFT JOIN public.session_billing_adjustments dependency
      ON dependency.id = adjustment.depends_on_adjustment_id
    WHERE adjustment.status IN ('pending', 'retryable')
      AND adjustment.next_attempt_at <= now()
      AND adjustment.attempt_count < adjustment.max_attempts
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

CREATE OR REPLACE FUNCTION public.fail_session_billing_adjustment(
  p_adjustment_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.session_billing_adjustments
  SET
    status = CASE
      WHEN attempt_count >= max_attempts THEN 'failed'::public.session_billing_adjustment_status
      ELSE 'retryable'::public.session_billing_adjustment_status
    END,
    next_attempt_at = now() + make_interval(mins => LEAST(1440, 15 * (2 ^ LEAST(attempt_count, 6)))::integer),
    last_error = left(p_error, 4000),
    completed_at = CASE WHEN attempt_count >= max_attempts THEN now() ELSE NULL END
  WHERE id = p_adjustment_id
    AND status = 'processing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processing billing adjustment not found: %', p_adjustment_id;
  END IF;
END;
$$;

CREATE VIEW public.vadmin_reconciliation_session_billing_adjustments
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
    WHEN adjustment.status IN ('pending', 'retryable') AND adjustment.next_attempt_at < now()
      THEN 'overdue_adjustment'
    ELSE 'pending_adjustment'
  END AS issue,
  adjustment.created_at,
  adjustment.updated_at
FROM public.session_billing_adjustments adjustment
JOIN public.sessions_students ss ON ss.id = adjustment.sessions_students_id
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.session_billing_adjustments dependency
  ON dependency.id = adjustment.depends_on_adjustment_id
WHERE adjustment.status NOT IN ('succeeded', 'superseded');

GRANT SELECT ON public.vadmin_reconciliation_session_billing_adjustments TO authenticated;
REVOKE ALL ON FUNCTION public.derive_session_absence_billing_treatment(boolean, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.session_student_is_chargeable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_session_billing_adjustment(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_session_billing_adjustments(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_session_billing_adjustment(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.derive_session_absence_billing_treatment(boolean, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.session_student_is_chargeable(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_session_billing_adjustment(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_session_billing_adjustments(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_session_billing_adjustment(uuid, text) TO service_role;

COMMENT ON TABLE public.session_billing_adjustments IS
  'Durable, idempotent queue and audit record for session credit notes and append-only charges.';
COMMENT ON FUNCTION public.session_student_is_chargeable(uuid) IS
  'Canonical rule: billable, non-trial sessions are charged unless a planned absence has credit/replacement treatment; actual attendance overrides the treatment.';
COMMENT ON FUNCTION public.enqueue_session_billing_adjustment(uuid, uuid, text, text, uuid) IS
  'Re-evaluates current obligation and enqueues only the missing append-only financial operation. Safe to call repeatedly.';
COMMENT ON VIEW public.vadmin_reconciliation_session_billing_adjustments IS
  'Financial reconciliation work queue for pending, retryable, blocked, and terminal session billing adjustments.';

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
      SELECT kind INTO v_original_adjustment_kind
      FROM public.session_billing_adjustments
      WHERE id = v_original_adjustment_id;
    END IF;

    IF v_operation->>'action' = 'reschedule' THEN
      PERFORM public.enqueue_session_billing_adjustment(
        (v_operation->>'new_sessions_students_id')::uuid,
        logged_by_staff_id,
        reason_category,
        reason_note,
        CASE
          WHEN v_original_adjustment_kind = 'credit_note' THEN v_original_adjustment_id
          ELSE NULL
        END
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_student_absences_with_billing(
  operations jsonb,
  logged_by_staff_id uuid,
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
BEGIN
  IF COALESCE(auth.role(), 'service_role') <> 'service_role'
     AND NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Only active admin staff may undo absences with billing changes'
      USING ERRCODE = '42501';
  END IF;

  v_result := public.undo_student_absences(operations, logged_by_staff_id);

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN v_result;
  END IF;

  FOR v_operation IN SELECT * FROM jsonb_array_elements(v_result->'operations')
  LOOP
    PERFORM public.enqueue_session_billing_adjustment(
      (v_operation->>'original_sessions_students_id')::uuid,
      logged_by_staff_id,
      'treatment_change',
      reason_note
    );
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_billing_after_attendance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance public.tutor_logs_student_attendance%ROWTYPE;
  v_session_id uuid;
  v_sessions_students_id uuid;
BEGIN
  v_attendance := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  SELECT session_id INTO v_session_id
  FROM public.tutor_logs
  WHERE id = v_attendance.tutor_log_id;

  FOR v_sessions_students_id IN
    SELECT ss.id
    FROM public.sessions_students ss
    WHERE ss.session_id = v_session_id
      AND ss.student_id = v_attendance.student_id
  LOOP
    PERFORM public.enqueue_session_billing_adjustment(
      v_sessions_students_id,
      v_attendance.created_by,
      'attendance_correction',
      'Attendance was created, corrected, or removed'
    );
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER enqueue_billing_after_attendance_change
AFTER INSERT OR UPDATE OF attended, was_trial OR DELETE
ON public.tutor_logs_student_attendance
FOR EACH ROW EXECUTE FUNCTION public.enqueue_billing_after_attendance_change();

CREATE OR REPLACE FUNCTION public.enqueue_billing_for_late_session_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = NEW.session_id
      AND s.start_at <= now()
  ) THEN
    PERFORM public.enqueue_session_billing_adjustment(
      NEW.id,
      NEW.created_by,
      'late_enrolment',
      'Student was added after the session billing cutoff'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enqueue_billing_for_late_session_student
AFTER INSERT ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.enqueue_billing_for_late_session_student();

REVOKE ALL ON FUNCTION public.enqueue_billing_after_attendance_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_billing_for_late_session_student() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.log_student_absences_with_billing(jsonb, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_student_absences_with_billing(jsonb, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_student_absences(jsonb, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.undo_student_absences(jsonb, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.log_student_absences(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_student_absences(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_student_absences_with_billing(jsonb, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_student_absences_with_billing(jsonb, uuid, text) TO authenticated, service_role;

-- Replacement eligibility remains policy-neutral: availability and billing facts
-- are enforced here, while capacity remains a warning returned as studentCount.
CREATE OR REPLACE FUNCTION public.get_available_reschedule_sessions(
  p_original_session_id uuid,
  p_student_id uuid,
  p_date_range_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_session record;
  v_subject_id uuid;
  v_original_class_id uuid;
  v_original_start_at timestamptz;
  v_now timestamptz := now();
  v_start_date timestamptz;
  v_end_date timestamptz;
  v_effective_start_date timestamptz;
  v_session record;
  v_session_array jsonb := '[]'::jsonb;
  v_enrolled_session_ids uuid[];
  v_student_count integer;
BEGIN
  SELECT s.id, s.start_at, s.class_id, COALESCE(s.subject_id, c.subject_id) AS subject_id
  INTO v_original_session
  FROM public.sessions s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = p_original_session_id;

  IF NOT FOUND OR v_original_session.subject_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_subject_id := v_original_session.subject_id;
  v_original_class_id := v_original_session.class_id;
  v_original_start_at := v_original_session.start_at;
  v_start_date := v_original_start_at - (p_date_range_days || ' days')::interval;
  v_end_date := v_original_start_at + (p_date_range_days || ' days')::interval;
  v_effective_start_date := greatest(v_start_date, v_now);

  SELECT array_agg(session_id)
  INTO v_enrolled_session_ids
  FROM public.sessions_students
  WHERE student_id = p_student_id;

  v_enrolled_session_ids := COALESCE(v_enrolled_session_ids, ARRAY[]::uuid[]);

  FOR v_session IN
    SELECT
      s.id, s.start_at, s.end_at, s.class_id, s.type, s.status, s.subject_id,
      s.billing_type, s.room, s.short_name, s.long_name, s.created_at, s.updated_at,
      jsonb_build_object(
        'id', c.id, 'day_of_week', c.day_of_week, 'start_time', c.start_time,
        'end_time', c.end_time, 'room', c.room, 'level', c.level,
        'status', c.status, 'subject_id', c.subject_id, 'short_name', c.short_name,
        'long_name', c.long_name, 'created_at', c.created_at, 'updated_at', c.updated_at
      ) AS class,
      jsonb_build_object(
        'id', sub.id, 'name', sub.name, 'short_name', sub.short_name,
        'long_name', sub.long_name, 'curriculum', sub.curriculum,
        'discipline', sub.discipline, 'level', sub.level, 'color', sub.color,
        'year_level', sub.year_level, 'created_at', sub.created_at, 'updated_at', sub.updated_at
      ) AS subject
    FROM public.sessions s
    JOIN public.classes c ON c.id = s.class_id
    JOIN public.subjects sub ON sub.id = COALESCE(s.subject_id, c.subject_id)
    WHERE COALESCE(s.subject_id, c.subject_id) = v_subject_id
      AND s.class_id IS DISTINCT FROM v_original_class_id
      AND s.start_at >= v_effective_start_date
      AND s.start_at <= v_end_date
      AND s.id <> ALL(v_enrolled_session_ids)
      AND s.status = 'ACTIVE'
      AND s.billing_type IS NOT NULL
      AND s.type <> 'TRIAL_SESSION'
    ORDER BY s.start_at
  LOOP
    SELECT count(*) INTO v_student_count
    FROM public.sessions_students
    WHERE session_id = v_session.id
      AND planned_absence = false;

    v_session_array := v_session_array || jsonb_build_array(jsonb_build_object(
      'id', v_session.id, 'start_at', v_session.start_at, 'end_at', v_session.end_at,
      'class_id', v_session.class_id, 'type', v_session.type, 'status', v_session.status,
      'subject_id', v_session.subject_id, 'billing_type', v_session.billing_type,
      'room', v_session.room, 'short_name', v_session.short_name,
      'long_name', v_session.long_name, 'created_at', v_session.created_at,
      'updated_at', v_session.updated_at, 'class', v_session.class,
      'subject', v_session.subject, 'studentCount', COALESCE(v_student_count, 0)
    ));
  END LOOP;

  RETURN v_session_array;
EXCEPTION WHEN OTHERS THEN
  RETURN '[]'::jsonb;
END;
$$;

COMMENT ON FUNCTION public.get_available_reschedule_sessions(uuid, uuid, integer) IS
  'Returns active, billable, non-trial replacement sessions for the same subject and a different class. Capacity is returned as studentCount but does not block selection.';
