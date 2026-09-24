-- Treat swaps, reschedules, and credits as domain actions rather than exposing
-- their implementation-row mutations as separate lifecycle events.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.log_staff_absences(jsonb, uuid)
  RENAME TO log_staff_absences_rows;
ALTER FUNCTION public.undo_staff_absences(jsonb, uuid)
  RENAME TO undo_staff_absences_rows;
ALTER FUNCTION public.log_student_absences(jsonb, uuid)
  RENAME TO log_student_absences_rows;
ALTER FUNCTION public.undo_student_absences(jsonb, uuid)
  RENAME TO undo_student_absences_rows;
ALTER FUNCTION public.log_student_absences_self(jsonb, uuid)
  RENAME TO log_student_absences_self_rows;

ALTER FUNCTION public.log_staff_absences_rows(jsonb, uuid) SET SCHEMA private;
ALTER FUNCTION public.undo_staff_absences_rows(jsonb, uuid) SET SCHEMA private;
ALTER FUNCTION public.log_student_absences_rows(jsonb, uuid) SET SCHEMA private;
ALTER FUNCTION public.undo_student_absences_rows(jsonb, uuid) SET SCHEMA private;
ALTER FUNCTION public.log_student_absences_self_rows(jsonb, uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.run_absence_lifecycle_operation(
  operation_kind text,
  operation_function text,
  operations jsonb,
  actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  previous_operation text := current_setting('app.absence_lifecycle_operation', true);
  result jsonb;
BEGIN
  PERFORM set_config('app.absence_lifecycle_operation', operation_kind, true);
  EXECUTE format('SELECT private.%I($1, $2)', operation_function)
    INTO result
    USING operations, actor_id;
  PERFORM set_config(
    'app.absence_lifecycle_operation',
    COALESCE(previous_operation, ''),
    true
  );
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.absence_lifecycle_operation',
    COALESCE(previous_operation, ''),
    true
  );
  RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_staff_absences(operations jsonb, logged_by_staff_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT private.run_absence_lifecycle_operation(
    'staff_absence',
    'log_staff_absences_rows',
    operations,
    logged_by_staff_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.undo_staff_absences(operations jsonb, logged_by_staff_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT private.run_absence_lifecycle_operation(
    'staff_absence',
    'undo_staff_absences_rows',
    operations,
    logged_by_staff_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.log_student_absences(operations jsonb, logged_by_staff_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT private.run_absence_lifecycle_operation(
    'student_absence',
    'log_student_absences_rows',
    operations,
    logged_by_staff_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.undo_student_absences(operations jsonb, logged_by_staff_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT private.run_absence_lifecycle_operation(
    'student_absence',
    'undo_student_absences_rows',
    operations,
    logged_by_staff_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.log_student_absences_self(operations jsonb, logged_by_student_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT private.run_absence_lifecycle_operation(
    'student_absence',
    'log_student_absences_self_rows',
    operations,
    logged_by_student_id
  );
$function$;

REVOKE ALL ON FUNCTION private.run_absence_lifecycle_operation(text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.log_staff_absences_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.undo_staff_absences_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.log_student_absences_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.undo_student_absences_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.log_student_absences_self_rows(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_staff_absences(jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_staff_absences(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_staff_absences(jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_staff_absences(jsonb, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.log_student_absences(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_student_absences(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_student_absences(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_student_absences(jsonb, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.log_student_absences_self(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_student_absences_self(jsonb, uuid) TO authenticated, service_role;

-- Preserve the outcomes of production automations that previously matched the
-- helper row events now hidden by the composite lifecycle boundary.
UPDATE public.automation_rules
SET event_names = ARRAY(
  SELECT DISTINCT event_name
  FROM unnest(event_names || ARRAY[
    'session.student_rescheduled',
    'session.student_credited'
  ]) AS event_name
)
WHERE name IN (
  'Notify student when an absence is logged',
  'Notify session staff when a student absence is logged'
)
  AND trigger_kind = 'EVENT';

UPDATE public.automation_rules
SET event_names = ARRAY(
  SELECT DISTINCT event_name
  FROM unnest(event_names || ARRAY['session.staff_swapped']) AS event_name
)
WHERE name = 'Notify staff when directly assigned to a session'
  AND trigger_kind = 'EVENT';

UPDATE public.automation_rules
SET event_names = ARRAY(
  SELECT DISTINCT event_name
  FROM unnest(event_names || ARRAY['session.staff_swap_reversed']) AS event_name
)
WHERE name = 'Notify staff when directly removed from a session'
  AND trigger_kind = 'EVENT';

CREATE OR REPLACE FUNCTION public.capture_session_staff_domain_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  workflow text := NULLIF(current_setting('app.absence_lifecycle_operation', true), '');
  assignment_source text := NULLIF(current_setting('app.sessions_staff_assignment_source', true), '');
  session_id_value uuid := COALESCE(NEW.session_id, OLD.session_id);
  staff_id_value uuid := COALESCE(NEW.staff_id, OLD.staff_id);
  actor_id uuid := public.current_staff_id();
  replacement_assignment_id uuid;
  replacement_staff_id uuid;
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
    'session', jsonb_build_object(
      'type', session_row.type,
      'status', session_row.status,
      'start_at', session_row.start_at
    )
  );
  entities := jsonb_build_array(
    public.domain_event_entity('session', session_id_value, 'subject'),
    public.domain_event_entity('staff', staff_id_value, 'related')
  );

  IF TG_OP = 'INSERT' THEN
    IF workflow IS NULL
      AND assignment_source IS DISTINCT FROM 'class_staff_sync'
      AND current_setting('app.class_schedule_apply', true) IS DISTINCT FROM 'true' THEN
      PERFORM public.record_domain_event(
        'session.staff_added', 'session', session_id_value, entities, payload,
        COALESCE(NEW.created_at, now()), actor_id, NULL,
        'session-staff:' || NEW.id::text || ':added'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF workflow IS NULL
      AND assignment_source IS DISTINCT FROM 'class_staff_sync'
      AND EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id_value)
      AND EXISTS (SELECT 1 FROM public.staff WHERE id = staff_id_value) THEN
      PERFORM public.record_domain_event(
        'session.staff_removed', 'session', session_id_value, entities, payload,
        now(), actor_id, NULL, 'session-staff:' || OLD.id::text || ':removed'
      );
    END IF;
    RETURN OLD;
  END IF;

  IF COALESCE(OLD.is_swapped, false) IS DISTINCT FROM COALESCE(NEW.is_swapped, false) THEN
    replacement_assignment_id := COALESCE(
      NEW.swapped_sessions_staff_id,
      OLD.swapped_sessions_staff_id
    );
    SELECT assignment.staff_id
    INTO replacement_staff_id
    FROM public.sessions_staff AS assignment
    WHERE assignment.id = replacement_assignment_id;

    entities := jsonb_build_array(
      public.domain_event_entity('session', session_id_value, 'subject'),
      public.domain_event_entity('staff', staff_id_value, 'staff_out'),
      public.domain_event_entity('staff', replacement_staff_id, 'staff_in')
    );
    PERFORM public.record_domain_event(
      CASE WHEN NEW.is_swapped
        THEN 'session.staff_swapped'
        ELSE 'session.staff_swap_reversed'
      END,
      'session', session_id_value, entities,
      payload || jsonb_build_object(
        'swapped_session_staff_id', replacement_assignment_id
      ),
      now(), actor_id
    );
  ELSIF COALESCE(OLD.planned_absence, false) IS DISTINCT FROM
        COALESCE(NEW.planned_absence, false) THEN
    PERFORM public.record_domain_event(
      CASE WHEN NEW.planned_absence
        THEN 'session.staff_absence_recorded'
        ELSE 'session.staff_absence_cleared'
      END,
      'session', session_id_value, entities,
      payload || jsonb_build_object('planned_absence', NEW.planned_absence),
      now(), COALESCE(NEW.planned_absence_logged_by, actor_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;

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

REVOKE ALL ON FUNCTION public.capture_session_staff_domain_event()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_session_student_domain_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS domain_event_capture_sessions_staff ON public.sessions_staff;
CREATE TRIGGER domain_event_capture_sessions_staff
AFTER INSERT OR UPDATE OR DELETE ON public.sessions_staff
FOR EACH ROW EXECUTE FUNCTION public.capture_session_staff_domain_event();

DROP TRIGGER IF EXISTS domain_event_capture_sessions_students ON public.sessions_students;
CREATE TRIGGER domain_event_capture_sessions_students
AFTER INSERT OR UPDATE OR DELETE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.capture_session_student_domain_event();

COMMENT ON FUNCTION public.capture_session_staff_domain_event() IS
  'Records one lifecycle event for a staff swap/reversal and hides its helper row mutations.';
COMMENT ON FUNCTION public.capture_session_student_domain_event() IS
  'Records one lifecycle event for a student reschedule/credit/reversal and hides its helper row mutations.';
