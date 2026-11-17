-- Absence commands temporarily attribute activity to their explicit actor. That
-- identity must never survive into another request on a pooled connection.
-- Keep each existing function body/ACL intact; fail rather than silently miss a
-- changed writer. Existing contaminated API sessions need separate recycling.
DO $migration$
DECLARE
  target regprocedure;
  definition text;
  old_setting constant text := 'set_config(''request.jwt.claim.sub'', logged_by_user_id::text, false)';
  new_setting constant text := 'set_config(''request.jwt.claim.sub'', logged_by_user_id::text, true)';
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'private.log_staff_absences_rows(jsonb,uuid)'::regprocedure,
    'private.undo_staff_absences_rows(jsonb,uuid)'::regprocedure,
    'private.log_student_absences_rows(jsonb,uuid)'::regprocedure,
    'private.undo_student_absences_rows(jsonb,uuid)'::regprocedure,
    'private.log_student_absences_self_rows(jsonb,uuid)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(target);
    IF (length(definition) - length(replace(definition, old_setting, ''))) <> length(old_setting) THEN
      RAISE EXCEPTION 'Expected exactly one session actor setting in %', target;
    END IF;
    EXECUTE replace(definition, old_setting, new_setting);
  END LOOP;
END;
$migration$;

-- Restore the caller even inside the same transaction, including nested calls
-- and exceptions. Row triggers still see the explicit actor during the command.
CREATE OR REPLACE FUNCTION private.run_absence_lifecycle_operation(
  operation_kind text, operation_function text, operations jsonb, actor_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  previous_actor text := current_setting('request.jwt.claim.sub', true);
  previous_operation text := current_setting('app.absence_lifecycle_operation', true);
  result jsonb;
  target_session record;
BEGIN
  IF operation_function IN ('log_staff_absences_rows', 'log_student_absences_rows', 'log_student_absences_self_rows')
     AND jsonb_typeof(operations) = 'array' THEN
    FOR target_session IN
      SELECT session.id, session.status, session.calendar_tombstone_until
      FROM public.sessions session
      WHERE session.id IN (
        SELECT assignment.session_id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions_students assignment
          ON assignment.id::text = operation->>'original_sessions_students_id'
        UNION
        SELECT assignment.session_id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions_staff assignment
          ON assignment.id::text = operation->>'original_sessions_staff_id'
        UNION
        SELECT replacement.id
        FROM jsonb_array_elements(operations) operation
        JOIN public.sessions replacement ON replacement.id::text = operation->>'target_session_id'
      )
      ORDER BY session.id FOR SHARE
    LOOP
      IF target_session.status <> 'ACTIVE' OR target_session.calendar_tombstone_until IS NOT NULL THEN
        RETURN jsonb_build_object('success', false,
          'error', 'Cannot change attendance for an inactive or cancelled session.');
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.absence_lifecycle_operation', operation_kind, true);
  EXECUTE format('SELECT private.%I($1, $2)', operation_function)
    INTO result USING operations, actor_id;
  PERFORM set_config('request.jwt.claim.sub', COALESCE(previous_actor, ''), true);
  PERFORM set_config('app.absence_lifecycle_operation', COALESCE(previous_operation, ''), true);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(previous_actor, ''), true);
  PERFORM set_config('app.absence_lifecycle_operation', COALESCE(previous_operation, ''), true);
  RAISE;
END;
$function$;
REVOKE ALL ON FUNCTION private.run_absence_lifecycle_operation(text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
