-- Keep the exact first Stripe request across changes to invoice state and
-- reconciliation metadata. Existing attempted work is deliberately not backfilled.
ALTER TABLE public.session_billing_adjustments
  ADD COLUMN stripe_credit_note_command jsonb,
  ADD COLUMN stripe_credit_note_requested_at timestamptz,
  ADD COLUMN stripe_credit_note_request_version smallint,
  ADD CONSTRAINT session_billing_credit_note_request_version CHECK (
    stripe_credit_note_request_version IS NULL OR stripe_credit_note_request_version = 1
  ),
  ADD CONSTRAINT session_billing_credit_note_command_shape CHECK (
    (stripe_credit_note_command IS NULL AND stripe_credit_note_requested_at IS NULL)
    OR (
      stripe_credit_note_command IS NOT NULL
      AND stripe_credit_note_requested_at IS NOT NULL
      AND kind = 'credit_note'
      AND stripe_credit_note_request_version IS NOT DISTINCT FROM 1
      AND jsonb_typeof(stripe_credit_note_command) = 'object'
      AND jsonb_typeof(stripe_credit_note_command -> 'params') IS NOT DISTINCT FROM 'object'
      AND (stripe_credit_note_command ->> 'idempotencyKey') IS NOT DISTINCT FROM idempotency_key
      AND (stripe_credit_note_command ->> 'sourceInvoiceItemId') IS NOT DISTINCT FROM source_invoice_item_id::text
      AND jsonb_typeof(stripe_credit_note_command -> 'invoiceId') IS NOT DISTINCT FROM 'string'
      AND jsonb_typeof(stripe_credit_note_command -> 'studentId') IS NOT DISTINCT FROM 'string'
    )
  );

CREATE FUNCTION private.preserve_session_credit_note_command()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.stripe_credit_note_request_version IS NOT NULL
     AND NEW.stripe_credit_note_request_version IS DISTINCT FROM OLD.stripe_credit_note_request_version THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'The Stripe credit note request protocol version is immutable';
  END IF;

  IF NEW.stripe_credit_note_request_version IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.stripe_credit_note_request_version IS NULL)
     AND (NEW.kind <> 'credit_note' OR NEW.status <> 'processing' OR NEW.attempt_count <> 1
          OR (TG_OP = 'UPDATE' AND OLD.attempt_count <> 1)) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'The Stripe credit note request protocol requires a first processing attempt';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.stripe_credit_note_command IS NOT NULL THEN
    IF NEW.stripe_credit_note_command IS DISTINCT FROM OLD.stripe_credit_note_command
       OR NEW.stripe_credit_note_requested_at IS DISTINCT FROM OLD.stripe_credit_note_requested_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'A saved Stripe credit note command and request timestamp are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stripe_credit_note_command IS NULL THEN
    IF NEW.stripe_credit_note_requested_at IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'A Stripe credit note request timestamp requires a saved command';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.kind <> 'credit_note' OR NEW.status <> 'processing' OR NEW.attempt_count < 1
     OR NEW.stripe_credit_note_request_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'A Stripe credit note command requires opted-in processing work';
  END IF;

  NEW.stripe_credit_note_requested_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_session_credit_note_command
BEFORE INSERT OR UPDATE ON public.session_billing_adjustments
FOR EACH ROW
EXECUTE FUNCTION private.preserve_session_credit_note_command();

REVOKE ALL ON FUNCTION private.preserve_session_credit_note_command()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.session_billing_adjustments.stripe_credit_note_command IS
  'Immutable first Stripe credit note request with its local invoice, student, and source-line context; saved before calling Stripe. Legacy attempted rows remain null and require reconciliation.';
COMMENT ON COLUMN public.session_billing_adjustments.stripe_credit_note_requested_at IS
  'Database-recorded first request preparation time. Paired with the immutable command; bounds safe idempotent replay.';
COMMENT ON COLUMN public.session_billing_adjustments.stripe_credit_note_request_version IS
  'Version 1 records worker opt-in to save-before-send on the first claimed attempt. Null remains unknown across rolling deployments and cannot opt in after the first attempt.';


-- An already-prepared request may have reached Stripe despite a lost response.
-- Reconcile it first; recording the credit then restores changed obligations.
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
      AND status IN ('pending', 'retryable')
      AND stripe_credit_note_command IS NULL;

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
      AND stripe_credit_note_command IS NULL
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
