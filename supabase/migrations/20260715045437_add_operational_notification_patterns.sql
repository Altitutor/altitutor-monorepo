-- Operational notification patterns for staff assignments, student absences,
-- and overdue invoices.

-- Tag the sessions_staff rows produced by class assignment synchronisation so
-- their activity events remain auditable without sending one notification per
-- generated session.
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sessions_affected INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_staff_assignment_source', true);
BEGIN
  PERFORM set_config('app.sessions_staff_assignment_source', 'class_staff_sync', true);

  BEGIN
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT
      gen_random_uuid(),
      s.id,
      NEW.staff_id,
      'MAIN_TUTOR',
      NEW.assigned_by
    FROM public.sessions s
    WHERE s.class_id = NEW.class_id
      AND s.start_at >= NEW.assigned_at
    ON CONFLICT (session_id, staff_id) DO NOTHING;

    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
    RAISE;
  END;

  PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
  RAISE NOTICE 'Assigned staff % to % sessions starting from %',
    NEW.staff_id, sessions_affected, NEW.assigned_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_unassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sessions_affected INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_staff_assignment_source', true);
BEGIN
  IF OLD.unassigned_at IS NULL AND NEW.unassigned_at IS NOT NULL THEN
    PERFORM set_config('app.sessions_staff_assignment_source', 'class_staff_sync', true);

    BEGIN
      DELETE FROM public.sessions_staff ss
      USING public.sessions s
      WHERE ss.session_id = s.id
        AND ss.staff_id = NEW.staff_id
        AND s.class_id = NEW.class_id
        AND s.start_at >= NEW.unassigned_at
        AND ss.is_swapped = FALSE
        AND ss.planned_absence = FALSE;

      GET DIAGNOSTICS sessions_affected = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
      RAISE;
    END;

    PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
    RAISE NOTICE 'Removed staff % from % sessions starting from %',
      NEW.staff_id, sessions_affected, NEW.unassigned_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sessions_removed INTEGER := 0;
  sessions_added INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_staff_assignment_source', true);
BEGIN
  IF OLD.assigned_at IS DISTINCT FROM NEW.assigned_at THEN
    PERFORM set_config('app.sessions_staff_assignment_source', 'class_staff_sync', true);

    BEGIN
      DELETE FROM public.sessions_staff ss
      USING public.sessions s
      WHERE ss.session_id = s.id
        AND ss.staff_id = NEW.staff_id
        AND s.class_id = NEW.class_id
        AND s.start_at < NEW.assigned_at
        AND s.start_at >= OLD.assigned_at
        AND ss.is_swapped = FALSE
        AND ss.planned_absence = FALSE;

      GET DIAGNOSTICS sessions_removed = ROW_COUNT;

      INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
      SELECT
        gen_random_uuid(),
        s.id,
        NEW.staff_id,
        'MAIN_TUTOR',
        NEW.assigned_by
      FROM public.sessions s
      WHERE s.class_id = NEW.class_id
        AND s.start_at >= NEW.assigned_at
        AND s.start_at < OLD.assigned_at
      ON CONFLICT (session_id, staff_id) DO NOTHING;

      GET DIAGNOSTICS sessions_added = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
      RAISE;
    END;

    PERFORM set_config('app.sessions_staff_assignment_source', COALESCE(previous_source, ''), true);
    RAISE NOTICE 'Assignment date updated: removed from % sessions, added to % sessions',
      sessions_removed, sessions_added;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_staff');
  v_field_name TEXT;
  v_event_type TEXT;
  v_session_name TEXT;
  v_assignment_source TEXT := NULLIF(
    current_setting('app.sessions_staff_assignment_source', true),
    ''
  );
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_staff_id := NEW.staff_id;
  ELSE
    -- Keep the activity FK null during session cascades. The session identity
    -- and label live in metadata so direct removals still render usefully.
    v_session_id := NULL;
    v_staff_id := OLD.staff_id;

    SELECT COALESCE(NULLIF(trim(s.long_name), ''), NULLIF(trim(s.short_name), ''))
    INTO v_session_name
    FROM public.sessions s
    WHERE s.id = OLD.session_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF NOT v_field_name = ANY(v_excluded_fields)
         AND (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
        v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_field_name,
            'new', to_jsonb(NEW)->v_field_name
          )
        );
      END IF;
    END LOOP;

    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.log_activity_event(
    p_entity_type := 'sessions_staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_strip_nulls(jsonb_build_object(
      'operation', TG_OP,
      'table', 'sessions_staff',
      'assignment_source', v_assignment_source,
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END,
      'session_name', CASE WHEN TG_OP = 'DELETE' THEN v_session_name ELSE NULL END
    )),
    p_staff_id := v_staff_id,
    p_session_id := v_session_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Seed the event-driven rules. They remain editable in admin-web while the
-- defaults and delivery semantics stay source controlled.
DO $$
DECLARE
  rule_config RECORD;
  v_rule_id UUID;
BEGIN
  FOR rule_config IN
    SELECT *
    FROM jsonb_to_recordset($rules$
      [
        {
          "name": "Notify staff when assigned to a class",
          "description": "Notifies a staff member when they are assigned to a class.",
          "entity_type": "classes_staff",
          "event_types": ["CREATED"],
          "conditions": null,
          "action_config": {
            "notification_type": "STAFF_CLASS_ASSIGNED",
            "app_scope": "staff_web",
            "title": "Class assigned",
            "body": "{class_name}",
            "action_url": "/classes",
            "recipients": {"type": "single"}
          }
        },
        {
          "name": "Notify staff when removed from a class",
          "description": "Notifies a staff member when their active class assignment ends.",
          "entity_type": "classes_staff",
          "event_types": ["UPDATED"],
          "conditions": {"field": "unassigned_at", "operator": "changed_from", "value": null},
          "action_config": {
            "notification_type": "STAFF_CLASS_REMOVED",
            "app_scope": "staff_web",
            "title": "Class assignment removed",
            "body": "{class_name}",
            "action_url": "/classes",
            "recipients": {"type": "single"}
          }
        },
        {
          "name": "Notify staff when directly assigned to a session",
          "description": "Notifies a staff member about a direct session assignment, excluding class-generated assignments.",
          "entity_type": "sessions_staff",
          "event_types": ["CREATED"],
          "conditions": {"field": "activity.metadata.assignment_source", "operator": "not_equals", "value": "class_staff_sync"},
          "action_config": {
            "notification_type": "STAFF_SESSION_ASSIGNED",
            "app_scope": "staff_web",
            "title": "Session assigned",
            "body": "{session_name}",
            "action_url": "/classes",
            "recipients": {"type": "single"}
          }
        },
        {
          "name": "Notify staff when directly removed from a session",
          "description": "Notifies a staff member about a direct session removal, excluding class-generated removals.",
          "entity_type": "sessions_staff",
          "event_types": ["DELETED"],
          "conditions": {"field": "activity.metadata.assignment_source", "operator": "not_equals", "value": "class_staff_sync"},
          "action_config": {
            "notification_type": "STAFF_SESSION_REMOVED",
            "app_scope": "staff_web",
            "title": "Session assignment removed",
            "body": "{session_name}",
            "action_url": "/classes",
            "recipients": {"type": "single"}
          }
        },
        {
          "name": "Notify session staff when a student absence is logged",
          "description": "Notifies every staff member assigned to the session when a student absence is recorded.",
          "entity_type": "sessions_students",
          "event_types": ["UPDATED"],
          "conditions": {"field": "planned_absence", "operator": "changed_from_to", "old_value": false, "new_value": true},
          "action_config": {
            "notification_type": "SESSION_STUDENT_ABSENCE_LOGGED",
            "app_scope": "staff_web",
            "title": "{student_name} will be absent",
            "body": "{session_name}",
            "action_url": "/classes",
            "recipients": {"type": "session_staff"}
          }
        },
        {
          "name": "Notify student when an absence is logged",
          "description": "Notifies the affected student when their absence is recorded.",
          "entity_type": "sessions_students",
          "event_types": ["UPDATED"],
          "conditions": {"field": "planned_absence", "operator": "changed_from_to", "old_value": false, "new_value": true},
          "action_config": {
            "notification_type": "STUDENT_ABSENCE_LOGGED",
            "app_scope": "student_web",
            "title": "Absence recorded",
            "body": "{session_name}",
            "action_url": "/classes",
            "recipients": {"type": "single"}
          }
        }
      ]
    $rules$::JSONB) AS x(
      name TEXT,
      description TEXT,
      entity_type TEXT,
      event_types JSONB,
      conditions JSONB,
      action_config JSONB
    )
  LOOP
    SELECT id
    INTO v_rule_id
    FROM public.automation_rules
    WHERE name = rule_config.name
    ORDER BY created_at
    LIMIT 1;

    IF v_rule_id IS NULL THEN
      INSERT INTO public.automation_rules (
        name,
        description,
        entity_type,
        event_types,
        conditions,
        enabled,
        priority
      )
      VALUES (
        rule_config.name,
        rule_config.description,
        rule_config.entity_type,
        ARRAY(SELECT jsonb_array_elements_text(rule_config.event_types)),
        rule_config.conditions,
        TRUE,
        0
      )
      RETURNING id INTO v_rule_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.automation_actions
      WHERE rule_id = v_rule_id
        AND action_type = 'CREATE_NOTIFICATION'
        AND action_config->>'notification_type' = rule_config.action_config->>'notification_type'
    ) THEN
      INSERT INTO public.automation_actions (
        rule_id,
        action_type,
        action_config,
        order_index
      )
      VALUES (
        v_rule_id,
        'CREATE_NOTIFICATION',
        rule_config.action_config,
        0
      );
    END IF;

    v_rule_id := NULL;
  END LOOP;
END;
$$;

-- Overdue is a time transition rather than a row update. Match the existing
-- student billing UI definition: an open, unpaid invoice dated before today in
-- Australia/Adelaide. The stable dedupe key creates exactly one notification
-- per invoice even though the detector runs hourly.
CREATE OR REPLACE FUNCTION public.notify_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH inserted AS (
    INSERT INTO public.notifications (
      student_id,
      notification_type,
      app_scope,
      title,
      body,
      action_url,
      metadata,
      dedupe_key
    )
    SELECT
      i.student_id,
      'INVOICE_OVERDUE',
      'student_web',
      'Invoice overdue',
      COALESCE('Invoice ' || NULLIF(i.stripe_invoice_number, ''), 'An invoice')
        || ' for $' || to_char(i.amount_due_cents / 100.0, 'FM999999990.00')
        || ' is overdue.',
      '/billing',
      jsonb_build_object('invoice_id', i.id),
      'invoice:overdue:' || i.id::TEXT
    FROM public.invoices i
    WHERE i.status = 'open'
      AND i.paid_at IS NULL
      AND i.deleted_at IS NULL
      AND i.amount_due_cents > 0
      AND i.invoice_date < (now() AT TIME ZONE 'Australia/Adelaide')::DATE
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_overdue_invoices() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_overdue_invoices() FROM anon;
REVOKE ALL ON FUNCTION public.notify_overdue_invoices() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_overdue_invoices() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-overdue-invoices') THEN
      PERFORM cron.unschedule('notify-overdue-invoices');
    END IF;

    PERFORM cron.schedule(
      'notify-overdue-invoices',
      '5 * * * *',
      'SELECT public.notify_overdue_invoices();'
    );
  ELSE
    RAISE NOTICE 'pg_cron is unavailable; notify-overdue-invoices was not scheduled.';
  END IF;
END;
$$;
