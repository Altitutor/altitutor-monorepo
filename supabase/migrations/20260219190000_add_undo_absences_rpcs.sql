-- Migration: Add undo RPCs for student and staff absence logging
-- Description:
--   - Adds undo_student_absences(JSONB, UUID)
--   - Adds undo_staff_absences(JSONB, UUID)
--   - Reverts logged absence actions atomically with validation and downstream guards

-- ========================
-- undo_student_absences
-- ========================

CREATE OR REPLACE FUNCTION undo_student_absences(
  operations JSONB,
  logged_by_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  operation JSONB;
  result JSONB := '{"success": true, "operations": []}'::JSONB;
  operation_result JSONB;

  student_id_var UUID;
  original_ss_id UUID;
  action_var TEXT;

  logged_by_user_id UUID;
  ts_now TIMESTAMPTZ := NOW();

  original_exists BOOLEAN;
  original_planned_absence BOOLEAN;
  original_is_credited BOOLEAN;
  original_is_rescheduled BOOLEAN;
  linked_rescheduled_ss_id UUID;

  linked_invoice_exists BOOLEAN;
  linked_attendance_exists BOOLEAN;
BEGIN
  IF jsonb_typeof(operations) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'operations must be an array'
    );
  END IF;

  SELECT user_id INTO logged_by_user_id
  FROM staff
  WHERE id = logged_by_staff_id
  AND status = 'ACTIVE';

  IF logged_by_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive staff member'
    );
  END IF;

  PERFORM set_config('request.jwt.claim.sub', logged_by_user_id::text, false);

  -- First pass: validate all operations
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    student_id_var := (operation->>'student_id')::UUID;
    original_ss_id := (operation->>'original_sessions_students_id')::UUID;
    action_var := operation->>'action';

    IF action_var NOT IN ('credit', 'reschedule') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid action type: ' || COALESCE(action_var, 'null'),
        'operation', operation
      );
    END IF;

    SELECT
      TRUE,
      ss.planned_absence,
      ss.is_credited,
      ss.is_rescheduled,
      ss.rescheduled_sessions_students_id
    INTO
      original_exists,
      original_planned_absence,
      original_is_credited,
      original_is_rescheduled,
      linked_rescheduled_ss_id
    FROM sessions_students ss
    WHERE ss.id = original_ss_id
      AND ss.student_id = student_id_var;

    IF NOT COALESCE(original_exists, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Original sessions_students record not found',
        'operation', operation
      );
    END IF;

    IF NOT COALESCE(original_planned_absence, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Session is not marked as planned absence',
        'operation', operation
      );
    END IF;

    IF action_var = 'credit' THEN
      IF NOT COALESCE(original_is_credited, FALSE) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Session is not in credited state',
          'operation', operation
        );
      END IF;
    END IF;

    IF action_var = 'reschedule' THEN
      IF NOT COALESCE(original_is_rescheduled, FALSE) OR linked_rescheduled_ss_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Session is not in rescheduled state',
          'operation', operation
        );
      END IF;

      -- Guard: block undo if linked rescheduled record has invoice items
      SELECT EXISTS (
        SELECT 1
        FROM invoice_items ii
        WHERE ii.sessions_students_id = linked_rescheduled_ss_id
      ) INTO linked_invoice_exists;

      IF linked_invoice_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot undo reschedule: linked session already has invoice items',
          'operation', operation
        );
      END IF;

      -- Guard: block undo if linked rescheduled session already has attendance logged
      SELECT EXISTS (
        SELECT 1
        FROM sessions_students linked_ss
        JOIN tutor_logs tl
          ON tl.session_id = linked_ss.session_id
        JOIN tutor_logs_student_attendance tlsa
          ON tlsa.tutor_log_id = tl.id
         AND tlsa.student_id = linked_ss.student_id
        WHERE linked_ss.id = linked_rescheduled_ss_id
      ) INTO linked_attendance_exists;

      IF linked_attendance_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot undo reschedule: linked session already has attendance logged',
          'operation', operation
        );
      END IF;
    END IF;
  END LOOP;

  -- Second pass: execute all operations
  result := jsonb_set(result, '{operations}', '[]'::JSONB);

  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    student_id_var := (operation->>'student_id')::UUID;
    original_ss_id := (operation->>'original_sessions_students_id')::UUID;
    action_var := operation->>'action';

    SELECT ss.rescheduled_sessions_students_id
    INTO linked_rescheduled_ss_id
    FROM sessions_students ss
    WHERE ss.id = original_ss_id;

    UPDATE sessions_students
    SET
      planned_absence = false,
      planned_absence_logged_at = NULL,
      planned_absence_logged_by = NULL,
      is_credited = false,
      credited_at = NULL,
      credited_by = NULL,
      is_rescheduled = false,
      rescheduled_at = NULL,
      rescheduled_sessions_students_id = NULL,
      updated_at = ts_now
    WHERE id = original_ss_id;

    IF action_var = 'reschedule' AND linked_rescheduled_ss_id IS NOT NULL THEN
      DELETE FROM sessions_students
      WHERE id = linked_rescheduled_ss_id;
    END IF;

    operation_result := jsonb_build_object(
      'action', action_var,
      'original_sessions_students_id', original_ss_id,
      'removed_rescheduled_sessions_students_id',
      CASE
        WHEN action_var = 'reschedule' THEN linked_rescheduled_ss_id
        ELSE NULL
      END
    );

    result := jsonb_set(
      result,
      '{operations}',
      (result->'operations') || operation_result
    );
  END LOOP;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION undo_student_absences(JSONB, UUID) TO authenticated;

COMMENT ON FUNCTION undo_student_absences IS
  'Atomically undo student absence actions (credit/reschedule) with validation and downstream safety checks.';

-- ========================
-- undo_staff_absences
-- ========================

CREATE OR REPLACE FUNCTION undo_staff_absences(
  operations JSONB,
  logged_by_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operation JSONB;
  result JSONB := '{"success": true, "operations": []}'::JSONB;
  operation_result JSONB;

  staff_id_var UUID;
  original_sf_id UUID;
  action_var TEXT;

  logged_by_user_id UUID;
  ts_now TIMESTAMPTZ := NOW();

  original_exists BOOLEAN;
  original_planned_absence BOOLEAN;
  original_is_swapped BOOLEAN;
  linked_swapped_sf_id UUID;

  linked_attendance_exists BOOLEAN;
BEGIN
  IF jsonb_typeof(operations) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'operations must be an array'
    );
  END IF;

  SELECT user_id INTO logged_by_user_id
  FROM staff
  WHERE id = logged_by_staff_id
  AND status = 'ACTIVE';

  IF logged_by_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive staff member'
    );
  END IF;

  PERFORM set_config('request.jwt.claim.sub', logged_by_user_id::text, false);

  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only ADMINSTAFF can undo staff absences'
    );
  END IF;

  -- First pass: validate all operations
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    staff_id_var := (operation->>'staff_id')::UUID;
    original_sf_id := (operation->>'original_sessions_staff_id')::UUID;
    action_var := operation->>'action';

    IF action_var NOT IN ('log', 'swap') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid action type: ' || COALESCE(action_var, 'null'),
        'operation', operation
      );
    END IF;

    SELECT
      TRUE,
      sf.planned_absence,
      sf.is_swapped,
      sf.swapped_sessions_staff_id
    INTO
      original_exists,
      original_planned_absence,
      original_is_swapped,
      linked_swapped_sf_id
    FROM sessions_staff sf
    WHERE sf.id = original_sf_id
      AND sf.staff_id = staff_id_var;

    IF NOT COALESCE(original_exists, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Original sessions_staff record not found',
        'operation', operation
      );
    END IF;

    IF NOT COALESCE(original_planned_absence, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Session is not marked as planned absence',
        'operation', operation
      );
    END IF;

    IF action_var = 'log' AND COALESCE(original_is_swapped, FALSE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Session is in swapped state, use swap action for undo',
        'operation', operation
      );
    END IF;

    IF action_var = 'swap' THEN
      IF NOT COALESCE(original_is_swapped, FALSE) OR linked_swapped_sf_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Session is not in swapped state',
          'operation', operation
        );
      END IF;

      -- Guard: block undo if swapped staff already has attendance logged
      SELECT EXISTS (
        SELECT 1
        FROM sessions_staff linked_sf
        JOIN tutor_logs tl
          ON tl.session_id = linked_sf.session_id
        JOIN tutor_logs_staff_attendance tlsf
          ON tlsf.tutor_log_id = tl.id
         AND tlsf.staff_id = linked_sf.staff_id
        WHERE linked_sf.id = linked_swapped_sf_id
      ) INTO linked_attendance_exists;

      IF linked_attendance_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot undo swap: replacement staff attendance already logged',
          'operation', operation
        );
      END IF;
    END IF;
  END LOOP;

  -- Second pass: execute all operations
  result := jsonb_set(result, '{operations}', '[]'::JSONB);

  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    staff_id_var := (operation->>'staff_id')::UUID;
    original_sf_id := (operation->>'original_sessions_staff_id')::UUID;
    action_var := operation->>'action';

    SELECT sf.swapped_sessions_staff_id
    INTO linked_swapped_sf_id
    FROM sessions_staff sf
    WHERE sf.id = original_sf_id;

    UPDATE sessions_staff
    SET
      planned_absence = false,
      planned_absence_logged_at = NULL,
      planned_absence_logged_by = NULL,
      is_swapped = false,
      swapped_sessions_staff_id = NULL,
      swapped_at = NULL,
      updated_at = ts_now
    WHERE id = original_sf_id;

    IF action_var = 'swap' AND linked_swapped_sf_id IS NOT NULL THEN
      DELETE FROM sessions_staff
      WHERE id = linked_swapped_sf_id;
    END IF;

    operation_result := jsonb_build_object(
      'action', action_var,
      'original_sessions_staff_id', original_sf_id,
      'removed_swapped_sessions_staff_id',
      CASE
        WHEN action_var = 'swap' THEN linked_swapped_sf_id
        ELSE NULL
      END
    );

    result := jsonb_set(
      result,
      '{operations}',
      (result->'operations') || operation_result
    );
  END LOOP;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION undo_staff_absences(JSONB, UUID) TO authenticated;

COMMENT ON FUNCTION undo_staff_absences IS
  'Atomically undo staff absence actions (log/swap) with validation and downstream safety checks.';
