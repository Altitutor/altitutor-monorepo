-- Snapshot absence context separately from completed credit notes. This helper is
-- trigger-internal; keep it in the existing non-exposed private schema.
CREATE OR REPLACE FUNCTION private.absence_activity_billing_context(assignment_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  invoice_status TEXT;
BEGIN
  IF public.session_student_is_chargeable(assignment_id) THEN RETURN 'chargeable'; END IF;
  SELECT invoice.status INTO invoice_status
  FROM public.invoice_items item
  JOIN public.invoices invoice ON invoice.id = item.invoice_id
  WHERE item.sessions_students_id = assignment_id
    AND item.line_kind IN ('session_charge', 'restoration_charge')
    AND NOT item.is_fee AND NOT item.is_subsidy
    AND item.amount_cents > 0 AND item.deleted_at IS NULL
    AND invoice.deleted_at IS NULL AND invoice.status IN ('draft', 'open', 'paid')
  ORDER BY item.created_at DESC, item.id DESC LIMIT 1;
  RETURN CASE invoice_status
    WHEN 'paid' THEN 'paid_invoice'
    WHEN 'open' THEN 'unpaid_invoice'
    WHEN 'draft' THEN 'draft_invoice'
    ELSE 'not_invoiced'
  END;
END;
$function$;
REVOKE ALL ON FUNCTION private.absence_activity_billing_context(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.absence_activity_billing_context(UUID) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.capture_session_student_domain_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  workflow text := NULLIF(current_setting('app.absence_lifecycle_operation', true), '');
  assignment_source text := NULLIF(current_setting('app.sessions_student_assignment_source', true), '');
  session_id_value uuid := COALESCE(NEW.session_id, OLD.session_id);
  student_id_value uuid := COALESCE(NEW.student_id, OLD.student_id);
  actor_id uuid := public.current_staff_id();
  replacement_assignment_id uuid;
  replacement_session_id uuid;
  entities jsonb;
  payload jsonb;
  session_row record;
BEGIN
  SELECT session.start_at, session.type::text AS type, session.status,
    session.class_id, session.long_name, session.short_name
  INTO session_row
  FROM public.sessions AS session
  WHERE session.id = session_id_value;

  payload := jsonb_build_object(
    'assignment_source', assignment_source,
    'absence_billing_context', CASE WHEN TG_OP = 'UPDATE' THEN private.absence_activity_billing_context(NEW.id) ELSE NULL END,
    'session', jsonb_build_object(
      'type', session_row.type,
      'status', session_row.status,
      'start_at', session_row.start_at
    )
  );
  entities := jsonb_build_array(
    public.domain_event_entity('session', session_id_value, 'subject'),
    public.domain_event_entity('student', student_id_value, 'related')
  );

  IF TG_OP = 'INSERT' THEN
    IF workflow IS NULL
      AND assignment_source IS DISTINCT FROM 'class_student_sync'
      AND current_setting('app.class_schedule_apply', true) IS DISTINCT FROM 'true' THEN
      PERFORM public.record_domain_event(
        'session.student_added', 'session', session_id_value, entities, payload,
        COALESCE(NEW.created_at, now()), actor_id, NULL,
        'session-student:' || NEW.id::text || ':added'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF workflow IS NULL
      AND assignment_source IS DISTINCT FROM 'class_student_sync'
      AND EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id_value)
      AND EXISTS (SELECT 1 FROM public.students WHERE id = student_id_value) THEN
      PERFORM public.record_domain_event(
        'session.student_removed', 'session', session_id_value, entities, payload,
        now(), actor_id, NULL, 'session-student:' || OLD.id::text || ':removed'
      );
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD.is_rescheduled, false) IS DISTINCT FROM
     COALESCE(NEW.is_rescheduled, false) THEN
    replacement_assignment_id := COALESCE(
      NEW.rescheduled_sessions_students_id,
      OLD.rescheduled_sessions_students_id
    );
    SELECT assignment.session_id
    INTO replacement_session_id
    FROM public.sessions_students AS assignment
    WHERE assignment.id = replacement_assignment_id;

    entities := jsonb_build_array(
      public.domain_event_entity('session', session_id_value, 'session_from'),
      public.domain_event_entity('session', replacement_session_id, 'session_to'),
      public.domain_event_entity('student', student_id_value, 'related')
    );
    PERFORM public.record_domain_event(
      CASE WHEN NEW.is_rescheduled
        THEN 'session.student_rescheduled'
        ELSE 'session.student_reschedule_reversed'
      END,
      'session', session_id_value, entities,
      payload || jsonb_build_object(
        'rescheduled_session_student_id', replacement_assignment_id
      ),
      now(), actor_id
    );
  ELSIF COALESCE(OLD.is_credited, false) IS DISTINCT FROM
        COALESCE(NEW.is_credited, false) THEN
    PERFORM public.record_domain_event(
      CASE WHEN NEW.is_credited
        THEN 'session.student_credited'
        ELSE 'session.student_credit_reversed'
      END,
      'session', session_id_value, entities,
      payload || jsonb_build_object('credited', NEW.is_credited),
      now(), COALESCE(NEW.credited_by, actor_id)
    );
  ELSIF COALESCE(OLD.planned_absence, false) IS DISTINCT FROM
        COALESCE(NEW.planned_absence, false) THEN
    PERFORM public.record_domain_event(
      CASE WHEN NEW.planned_absence
        THEN 'session.student_absence_recorded'
        ELSE 'session.student_absence_cleared'
      END,
      'session', session_id_value, entities,
      payload || jsonb_build_object('planned_absence', NEW.planned_absence),
      now(), COALESCE(NEW.planned_absence_logged_by, actor_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_session_student_domain_event() FROM PUBLIC, anon, authenticated;

-- amount_paid is already the customer payment, separate from applied account credit.
-- Use a rail-neutral name: this numeric fact alone does not prove a card payment.
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
    'amount_paid_by_customer_cents', row_data->'amount_paid_cents',
    -- Retain the legacy path for saved automation conditions. This alias does
    -- not establish the payment rail; amount_paid already excludes account credit.
    'amount_paid_from_card_cents', row_data->'amount_paid_cents',
    'currency', row_data->'currency',
    'status', row_data->'status'
  ));
$function$;
REVOKE ALL ON FUNCTION public.invoice_lifecycle_event_payload(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_lifecycle_event_payload(JSONB) TO service_role, postgres;
