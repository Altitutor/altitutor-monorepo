-- Credit notes are inserted by Stripe webhooks / billing-runner (service role),
-- so current_staff_id() is empty. Attribute the event from Stripe metadata or
-- the session billing adjustment that caused it, and keep the staff-facing why.

CREATE OR REPLACE FUNCTION public.credit_note_lifecycle_event_payload(
  row_data JSONB,
  adjustment_reason_category TEXT,
  adjustment_reason_note TEXT
)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'credit_note_id', row_data->'id',
    'credit_note_type', CASE
      WHEN COALESCE((row_data->>'refund_amount_cents')::BIGINT, 0) > 0 THEN 'refund'
      WHEN COALESCE((row_data->>'credit_amount_cents')::BIGINT, 0) > 0 THEN 'credit'
      WHEN COALESCE((row_data->>'out_of_band_amount_cents')::BIGINT, 0) > 0 THEN 'out_of_band'
      ELSE COALESCE(row_data->>'reason', 'adjustment')
    END,
    'amount_cents', row_data->'amount_cents',
    'currency', row_data->'currency',
    'reason', row_data->'reason',
    'memo', NULLIF(row_data->'metadata'->>'memo', ''),
    'internal_note', NULLIF(row_data->'metadata'->>'internal_note', ''),
    'reason_category', COALESCE(
      NULLIF(row_data->'metadata'->>'reason_category', ''),
      NULLIF(adjustment_reason_category, '')
    ),
    'reason_note', COALESCE(
      NULLIF(row_data->'metadata'->>'reason_note', ''),
      NULLIF(adjustment_reason_note, '')
    ),
    'billing_adjustment_id', row_data->'billing_adjustment_id'
  ));
$function$;

REVOKE ALL ON FUNCTION public.credit_note_lifecycle_event_payload(JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_lifecycle_event_payload(JSONB, TEXT, TEXT)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.capture_credit_note_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
<<capture>>
DECLARE
  old_row JSONB := '{}'::JSONB;
  new_row JSONB := '{}'::JSONB;
  row_id UUID;
  actor_id UUID;
  invoice_id UUID;
  student_id UUID;
  adjustment_id UUID;
  adjustment_created_by UUID;
  adjustment_reason_category TEXT;
  adjustment_reason_note TEXT;
  metadata JSONB := '{}'::JSONB;
  entities JSONB := '[]'::JSONB;
  payload JSONB := '{}'::JSONB;
  invoice_number TEXT;
  metadata_actor_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_id := COALESCE(NULLIF(new_row->>'id', '')::UUID, NULLIF(old_row->>'id', '')::UUID);
  invoice_id := COALESCE(NULLIF(new_row->>'invoice_id', '')::UUID, NULLIF(old_row->>'invoice_id', '')::UUID);
  metadata := COALESCE(new_row->'metadata', old_row->'metadata', '{}'::JSONB);
  IF jsonb_typeof(metadata) <> 'object' THEN
    metadata := '{}'::JSONB;
  END IF;

  adjustment_id := COALESCE(
    NULLIF(new_row->>'billing_adjustment_id', '')::UUID,
    NULLIF(old_row->>'billing_adjustment_id', '')::UUID
  );
  IF adjustment_id IS NOT NULL THEN
    SELECT
      adjustment.created_by,
      adjustment.reason_category,
      adjustment.reason_note
    INTO
      adjustment_created_by,
      adjustment_reason_category,
      adjustment_reason_note
    FROM public.session_billing_adjustments AS adjustment
    WHERE adjustment.id = capture.adjustment_id;
  END IF;

  BEGIN
    metadata_actor_id := NULLIF(BTRIM(metadata->>'created_by_staff_id'), '')::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      metadata_actor_id := NULL;
  END;

  actor_id := COALESCE(
    metadata_actor_id,
    adjustment_created_by,
    public.current_staff_id()
  );

  SELECT invoice.student_id, invoice.stripe_invoice_number
  INTO student_id, invoice_number
  FROM public.invoices AS invoice
  WHERE invoice.id = capture.invoice_id;

  entities := jsonb_build_array(
    public.domain_event_entity('invoice', invoice_id, 'subject', invoice_number),
    public.domain_event_entity('student', student_id, 'related')
  );
  payload := public.credit_note_lifecycle_event_payload(
    CASE WHEN TG_OP = 'DELETE' THEN old_row ELSE new_row END,
    adjustment_reason_category,
    adjustment_reason_note
  );

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_domain_event(
      'invoice.credit_note_added', 'invoice', invoice_id, entities, payload,
      COALESCE(NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
      actor_id, NULL, 'credit-note:' || row_id::TEXT || ':added', 'billing'
    );
  ELSIF TG_OP = 'UPDATE'
    AND old_row->'voided_at' = 'null'::JSONB AND new_row->'voided_at' <> 'null'::JSONB THEN
    PERFORM public.record_domain_event(
      'invoice.credit_note_voided', 'invoice', invoice_id, entities, payload,
      COALESCE(NULLIF(new_row->>'voided_at', '')::TIMESTAMPTZ, NOW()),
      actor_id, NULL, 'credit-note:' || row_id::TEXT || ':voided', 'billing'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_credit_note_domain_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS domain_event_capture_credit_notes ON public.credit_notes;
CREATE TRIGGER domain_event_capture_credit_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.capture_credit_note_domain_event();

WITH resolved AS (
  SELECT
    event.id AS event_id,
    COALESCE(
      CASE
        WHEN credit_note.metadata->>'created_by_staff_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (credit_note.metadata->>'created_by_staff_id')::UUID
      END,
      adjustment.created_by
    ) AS actor_id,
    public.credit_note_lifecycle_event_payload(
      to_jsonb(credit_note),
      adjustment.reason_category,
      adjustment.reason_note
    ) AS next_payload,
    NULLIF(BTRIM(CONCAT_WS(' ', staff.first_name, staff.last_name)), '') AS actor_name
  FROM public.domain_events event
  JOIN public.credit_notes credit_note
    ON credit_note.id = (event.payload->>'credit_note_id')::UUID
  LEFT JOIN public.session_billing_adjustments adjustment
    ON adjustment.id = credit_note.billing_adjustment_id
  LEFT JOIN public.staff staff
    ON staff.id = COALESCE(
      CASE
        WHEN credit_note.metadata->>'created_by_staff_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (credit_note.metadata->>'created_by_staff_id')::UUID
      END,
      adjustment.created_by
    )
  WHERE event.event_name IN ('invoice.credit_note_added', 'invoice.credit_note_voided')
    AND event.payload->>'credit_note_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
UPDATE public.domain_events event
SET
  actor_staff_id = COALESCE(event.actor_staff_id, resolved.actor_id),
  payload = event.payload || resolved.next_payload || jsonb_build_object(
    'display',
    COALESCE(event.payload->'display', '{}'::JSONB)
      || jsonb_strip_nulls(jsonb_build_object('actor_name', resolved.actor_name))
  )
FROM resolved
WHERE event.id = resolved.event_id;
