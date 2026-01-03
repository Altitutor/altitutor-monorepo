-- Migration: Add log_student_absences_self RPC function for students to log their own absences
-- This function allows students to log absences for themselves with reschedule action only
-- All operations are performed atomically within a transaction

CREATE OR REPLACE FUNCTION log_student_absences_self(
  operations JSONB,
  logged_by_student_id UUID
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

  -- Validate student exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM students 
    WHERE id = logged_by_student_id 
    AND status = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive student'
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
    
    -- Validate that student can only log absences for themselves
    IF student_id_var != logged_by_student_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Students can only log absences for themselves',
        'operation', operation
      );
    END IF;
    
    -- Validate action type (only reschedule allowed for students)
    IF action_var != 'reschedule' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid action type: only "reschedule" is allowed for students',
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
    
    -- Validate target session (required for reschedule)
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
    
    -- Only reschedule action (validated above)
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
      NULL,  -- Students don't have staff_id, so set to NULL
      ts_now,
      ts_now
    );
    
    -- Update original sessions_students record
    UPDATE sessions_students
    SET
      planned_absence = true,
      planned_absence_logged_at = ts_now,
      planned_absence_logged_by = NULL,  -- Students don't have staff_id, so set to NULL
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

-- Grant execute permission to authenticated users (RLS policies will handle authorization)
GRANT EXECUTE ON FUNCTION log_student_absences_self(JSONB, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION log_student_absences_self IS 
'Allows students to log their own absences with reschedule action only.
Validates that students can only log absences for themselves.
All operations are validated before executing any changes.
Returns success status with operation results or error details.';
