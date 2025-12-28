-- Migration: Fix function linting errors
-- Description:
--   - Replace uuid_generate_v4() with gen_random_uuid() in precreate_sessions
--     (gen_random_uuid() is built-in PostgreSQL 13+ and doesn't require uuid-ossp extension)
--   - Rename reserved keyword variable 'current_timestamp' to 'ts_now' in log_student_absences
--     (current_timestamp is a reserved keyword in PostgreSQL)

-- ========================
-- FIX PRECREATE_SESSIONS FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.precreate_sessions(
  start_date DATE,
  end_date DATE,
  p_created_by UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  d DATE;
  c RECORD;
  inserted_count INTEGER := 0;
  new_session_id UUID;
  start_local TIMESTAMP;
  end_local TIMESTAMP;
  s_at TIMESTAMPTZ;
  e_at TIMESTAMPTZ;
BEGIN
  IF start_date IS NULL OR end_date IS NULL OR start_date > end_date THEN
    RETURN 0;
  END IF;

  FOR c IN
    SELECT id, day_of_week, start_time, end_time, subject_id, status
    FROM public.classes
    WHERE (p_class_id IS NULL OR id = p_class_id)
    -- Removed: AND status = 'ACTIVE' to allow creating sessions for inactive classes
  LOOP
    d := start_date;
    WHILE d <= end_date LOOP
      -- day_of_week: Postgres DOW 0=Sunday..6=Saturday; our schema uses 0..6 as well
      IF EXTRACT(DOW FROM d) = c.day_of_week THEN
        -- Build start/end timestamps using Adelaide timezone
        -- Interpret class times (stored as 'HH24:MI' text) as Adelaide local times
        start_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.start_time, '00:00'))::timestamp;
        end_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(c.end_time, COALESCE(c.start_time, '00:00')))::timestamp;
        
        -- Convert Adelaide local time to UTC for storage
        s_at := start_local AT TIME ZONE 'Australia/Adelaide';
        e_at := end_local AT TIME ZONE 'Australia/Adelaide';

        -- Find existing session for this class/start/end
        SELECT s.id
        INTO new_session_id
        FROM public.sessions s
        WHERE s.class_id = c.id
          AND s.start_at = s_at
          AND s.end_at = e_at
        LIMIT 1;

        -- If not found, create it
        IF new_session_id IS NULL THEN
          INSERT INTO public.sessions(
            id, start_at, end_at, type, class_id, subject_id, status
          ) VALUES (
            gen_random_uuid(),
            s_at,
            e_at,
            'CLASS',
            c.id,
            c.subject_id,
            c.status  -- Match class status
          ) RETURNING id INTO new_session_id;
          inserted_count := inserted_count + 1;
        END IF;

        -- Precreate planned students for the session
        INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
        SELECT
          gen_random_uuid(),
          new_session_id,
          cs.student_id,
          p_created_by
        FROM public.classes_students cs
        WHERE cs.class_id = c.id
          AND cs.enrolled_at <= s_at
          AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s_at)
        ON CONFLICT (session_id, student_id) DO NOTHING;

        -- Precreate planned staff for the session (classes_staff active on this date)
        -- Use new assigned_at/unassigned_at fields instead of start_date/end_date/status
        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          gen_random_uuid(),
          new_session_id,
          cst.staff_id,
          'MAIN_TUTOR',
          p_created_by
        FROM public.classes_staff cst
        WHERE cst.class_id = c.id
          AND cst.assigned_at <= s_at
          AND (cst.unassigned_at IS NULL OR cst.unassigned_at > s_at)
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_staff sf
            WHERE sf.session_id = new_session_id AND sf.staff_id = cst.staff_id
          )
        ON CONFLICT (session_id, staff_id) DO NOTHING;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- ========================
-- FIX LOG_STUDENT_ABSENCES FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION log_student_absences(
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
  target_session_id UUID;
  new_ss_id UUID;
  original_session_id UUID;
  ts_now TIMESTAMPTZ := NOW();
  
  -- Variables for validation
  session_exists BOOLEAN;
  student_already_enrolled BOOLEAN;
BEGIN
  -- Validate that operations is an array
  IF jsonb_typeof(operations) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'operations must be an array'
    );
  END IF;

  -- Validate staff exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM staff 
    WHERE id = logged_by_staff_id 
    AND status = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive staff member'
    );
  END IF;

  -- Start transaction (implicit in function, but we'll use savepoints for validation)
  
  -- First pass: Validate all operations
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    -- Extract operation fields
    student_id_var := (operation->>'student_id')::UUID;
    original_ss_id := (operation->>'original_sessions_students_id')::UUID;
    action_var := operation->>'action';
    
    -- Validate action type
    IF action_var NOT IN ('reschedule', 'credit') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid action type: ' || COALESCE(action_var, 'null'),
        'operation', operation
      );
    END IF;
    
    -- Validate original sessions_students record exists
    IF NOT EXISTS (
      SELECT 1 FROM sessions_students 
      WHERE id = original_ss_id 
      AND student_id = student_id_var
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Original sessions_students record not found',
        'operation', operation
      );
    END IF;
    
    -- Check if already marked as absence
    IF EXISTS (
      SELECT 1 FROM sessions_students 
      WHERE id = original_ss_id 
      AND planned_absence = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Session already marked as planned absence',
        'operation', operation
      );
    END IF;
    
    -- For reschedule actions, validate target session
    IF action_var = 'reschedule' THEN
      target_session_id := (operation->>'target_session_id')::UUID;
      
      IF target_session_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'target_session_id required for reschedule action',
          'operation', operation
        );
      END IF;
      
      -- Validate target session exists and is in the future
      SELECT EXISTS (
        SELECT 1 FROM sessions 
        WHERE id = target_session_id 
        AND start_at > ts_now
      ) INTO session_exists;
      
      IF NOT session_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Target session not found or is in the past',
          'operation', operation
        );
      END IF;
      
      -- Check if student is already enrolled in target session
      SELECT EXISTS (
        SELECT 1 FROM sessions_students 
        WHERE session_id = target_session_id 
        AND student_id = student_id_var
        AND planned_absence = false
      ) INTO student_already_enrolled;
      
      IF student_already_enrolled THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Student is already enrolled in target session',
          'operation', operation
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Second pass: Execute all operations
  result := jsonb_set(result, '{operations}', '[]'::JSONB);
  
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    student_id_var := (operation->>'student_id')::UUID;
    original_ss_id := (operation->>'original_sessions_students_id')::UUID;
    action_var := operation->>'action';
    
    -- Get the original session_id for reference
    SELECT session_id INTO original_session_id
    FROM sessions_students
    WHERE id = original_ss_id;
    
    IF action_var = 'reschedule' THEN
      target_session_id := (operation->>'target_session_id')::UUID;
      
      -- Create new sessions_students record for target session
      new_ss_id := gen_random_uuid();
      
      INSERT INTO sessions_students (
        id,
        session_id,
        student_id,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        new_ss_id,
        target_session_id,
        student_id_var,
        logged_by_staff_id,
        ts_now,
        ts_now
      );
      
      -- Update original sessions_students record
      UPDATE sessions_students
      SET
        planned_absence = true,
        planned_absence_logged_at = ts_now,
        planned_absence_logged_by = logged_by_staff_id,
        is_rescheduled = true,
        rescheduled_at = ts_now,
        rescheduled_sessions_students_id = new_ss_id,
        is_credited = false,  -- Explicitly set to false to satisfy constraint
        updated_at = ts_now
      WHERE id = original_ss_id;
      
      operation_result := jsonb_build_object(
        'action', 'reschedule',
        'original_sessions_students_id', original_ss_id,
        'new_sessions_students_id', new_ss_id,
        'original_session_id', original_session_id,
        'target_session_id', target_session_id
      );
      
    ELSE -- action_var = 'credit'
      -- Update original sessions_students record
      UPDATE sessions_students
      SET
        planned_absence = true,
        planned_absence_logged_at = ts_now,
        planned_absence_logged_by = logged_by_staff_id,
        is_credited = true,
        credited_at = ts_now,
        credited_by = logged_by_staff_id,
        is_rescheduled = false,  -- Explicitly set to false to satisfy constraint
        updated_at = ts_now
      WHERE id = original_ss_id;
      
      operation_result := jsonb_build_object(
        'action', 'credit',
        'original_sessions_students_id', original_ss_id,
        'original_session_id', original_session_id
      );
    END IF;
    
    -- Add operation result to results array
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

