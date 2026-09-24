-- Invoice lifecycle events should carry how payment was settled (card vs credit
-- balance) so admin activity can show that split without a separate snapshot.

CREATE OR REPLACE FUNCTION public.invoice_lifecycle_event_payload(row_data JSONB)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $function$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'amount_due_cents', row_data->'amount_due_cents',
    'amount_paid_cents', row_data->'amount_paid_cents',
    'amount_paid_from_balance_cents', row_data->'amount_paid_from_balance_cents',
    'amount_paid_from_card_cents', to_jsonb(
      GREATEST(
        0::BIGINT,
        COALESCE((row_data->>'amount_paid_cents')::BIGINT, 0)
        - COALESCE((row_data->>'amount_paid_from_balance_cents')::BIGINT, 0)
      )
    ),
    'currency', row_data->'currency',
    'status', row_data->'status'
  ));
$function$;

REVOKE ALL ON FUNCTION public.invoice_lifecycle_event_payload(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_lifecycle_event_payload(JSONB)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.capture_invoice_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  old_row JSONB := '{}'::JSONB;
  new_row JSONB := '{}'::JSONB;
  row_id UUID;
  actor_id UUID;
  invoice_id UUID;
  student_id UUID;
  entities JSONB := '[]'::JSONB;
  payload JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_id := COALESCE(NULLIF(new_row->>'id', '')::UUID, NULLIF(old_row->>'id', '')::UUID);
  actor_id := public.current_staff_id();

  invoice_id := row_id;
  student_id := COALESCE(NULLIF(new_row->>'student_id', '')::UUID, NULLIF(old_row->>'student_id', '')::UUID);
  entities := jsonb_build_array(
    public.domain_event_entity('invoice', invoice_id, 'subject', COALESCE(new_row->>'stripe_invoice_number', old_row->>'stripe_invoice_number')),
    public.domain_event_entity('student', student_id, 'related')
  );
  payload := public.invoice_lifecycle_event_payload(
    CASE WHEN TG_OP = 'DELETE' THEN old_row ELSE new_row END
  );

  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_domain_event(
      'invoice.issued', 'invoice', invoice_id, entities, payload,
      COALESCE(NULLIF(new_row->>'finalized_at', '')::TIMESTAMPTZ, NULLIF(new_row->>'created_at', '')::TIMESTAMPTZ, NOW()),
      actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':issued', 'billing'
    );
    IF LOWER(COALESCE(new_row->>'status', '')) = 'paid' OR new_row->'paid_at' <> 'null'::JSONB THEN
      PERFORM public.record_domain_event(
        'invoice.paid', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'paid_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':paid', 'billing'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (old_row->'paid_at' = 'null'::JSONB AND new_row->'paid_at' <> 'null'::JSONB)
      OR (LOWER(COALESCE(old_row->>'status', '')) <> 'paid' AND LOWER(COALESCE(new_row->>'status', '')) = 'paid') THEN
      PERFORM public.record_domain_event(
        'invoice.paid', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'paid_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':paid', 'billing'
      );
    END IF;
    IF LOWER(COALESCE(old_row->>'status', '')) IS DISTINCT FROM LOWER(COALESCE(new_row->>'status', ''))
      AND LOWER(COALESCE(new_row->>'status', '')) IN ('payment_failed', 'uncollectible') THEN
      PERFORM public.record_domain_event(
        'invoice.payment_failed', 'invoice', invoice_id, entities, payload,
        NOW(), actor_id, NULL, NULL, 'billing'
      );
    END IF;
    IF (old_row->'voided_at' = 'null'::JSONB AND new_row->'voided_at' <> 'null'::JSONB)
      OR (LOWER(COALESCE(old_row->>'status', '')) <> 'void' AND LOWER(COALESCE(new_row->>'status', '')) = 'void') THEN
      PERFORM public.record_domain_event(
        'invoice.voided', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'voided_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':voided', 'billing'
      );
    END IF;
    IF COALESCE((old_row->>'is_refunded')::BOOLEAN, FALSE) = FALSE
      AND COALESCE((new_row->>'is_refunded')::BOOLEAN, FALSE) = TRUE THEN
      PERFORM public.record_domain_event(
        'invoice.refunded', 'invoice', invoice_id, entities, payload,
        COALESCE(NULLIF(new_row->>'refunded_at', '')::TIMESTAMPTZ, NOW()),
        actor_id, NULL, 'invoice:' || invoice_id::TEXT || ':refunded', 'billing'
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_invoice_domain_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS domain_event_capture_invoices ON public.invoices;
CREATE TRIGGER domain_event_capture_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.capture_invoice_domain_event();

UPDATE public.domain_events event
SET payload = event.payload || public.invoice_lifecycle_event_payload(to_jsonb(invoice))
FROM public.invoices invoice
WHERE event.subject_type = 'invoice'
  AND event.subject_id = invoice.id
  AND event.event_name = 'invoice.paid';
