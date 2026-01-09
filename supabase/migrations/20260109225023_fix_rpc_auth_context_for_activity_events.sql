-- Migration: Fix auth context in RPC functions for activity events
-- Description: Set auth context (request.jwt.claim.sub) in SECURITY DEFINER RPC functions
--              that update tables with activity triggers, so that performed_by is correctly
--              captured in activity_events table instead of showing "Unknown"
-- Author: AI Assistant
-- Date: 2026-01-09
-- Related Issue: Activity events showing "Unknown" for performed_by

-- ========================
-- FIX log_student_absences
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
  current_timestamp TIMESTAMPTZ := NOW();
  logged_by_user_id UUID;
  
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

  -- Validate staff exists and is active, and get user_id
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

  -- Set auth context so activity triggers can capture performed_by correctly
  PERFORM set_config('request.jwt.claim.sub', logged_by_user_id::text, false);

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
        AND start_at > current_timestamp
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
        current_timestamp,
        current_timestamp
      );
      
      -- Update original sessions_students record
      UPDATE sessions_students
      SET
        planned_absence = true,
        planned_absence_logged_at = current_timestamp,
        planned_absence_logged_by = logged_by_staff_id,
        is_rescheduled = true,
        rescheduled_at = current_timestamp,
        rescheduled_sessions_students_id = new_ss_id,
        is_credited = false,  -- Explicitly set to false to satisfy constraint
        updated_at = current_timestamp
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
        planned_absence_logged_at = current_timestamp,
        planned_absence_logged_by = logged_by_staff_id,
        is_credited = true,
        credited_at = current_timestamp,
        credited_by = logged_by_staff_id,
        is_rescheduled = false,  -- Explicitly set to false to satisfy constraint
        updated_at = current_timestamp
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

-- ========================
-- FIX log_student_absences_self
-- ========================

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
  logged_by_user_id UUID;
  
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

  -- Validate student exists and is active, and get user_id
  SELECT user_id INTO logged_by_user_id
  FROM students 
  WHERE id = logged_by_student_id 
  AND status = 'ACTIVE';
  
  IF logged_by_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive student'
    );
  END IF;

  -- Set auth context so activity triggers can capture performed_by correctly
  -- Note: For students, performed_by will still be NULL since current_staff_id() 
  -- looks up staff by user_id, but setting auth context ensures consistency
  PERFORM set_config('request.jwt.claim.sub', logged_by_user_id::text, false);

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

-- ========================
-- FIX log_staff_absences
-- ========================

CREATE OR REPLACE FUNCTION log_staff_absences(
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
  replacement_staff_id UUID;
  new_sf_id UUID;
  original_session_id UUID;
  original_type TEXT;
  ts_now TIMESTAMPTZ := NOW();
  logged_by_user_id UUID;
  
  -- Variables for validation
  replacement_staff_exists BOOLEAN;
  replacement_already_assigned BOOLEAN;
BEGIN
  -- Validate that operations is an array
  IF jsonb_typeof(operations) != 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'operations must be an array'
    );
  END IF;

  -- Validate staff exists and is active, and get user_id
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

  -- Set auth context so activity triggers can capture performed_by correctly
  -- Must be set before is_adminstaff_active() check since it uses auth.uid()
  PERFORM set_config('request.jwt.claim.sub', logged_by_user_id::text, false);

  -- Check ADMINSTAFF access (after setting auth context)
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only ADMINSTAFF can log staff absences'
    );
  END IF;

  -- First pass: Validate all operations
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    -- Extract operation fields
    staff_id_var := (operation->>'staff_id')::UUID;
    original_sf_id := (operation->>'original_sessions_staff_id')::UUID;
    action_var := operation->>'action';
    
    -- Validate action type
    IF action_var NOT IN ('swap', 'log') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid action type: ' || COALESCE(action_var, 'null'),
        'operation', operation
      );
    END IF;
    
    -- Validate original sessions_staff record exists
    IF NOT EXISTS (
      SELECT 1 FROM sessions_staff 
      WHERE id = original_sf_id 
      AND staff_id = staff_id_var
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Original sessions_staff record not found',
        'operation', operation
      );
    END IF;
    
    -- Check if already marked as absence
    IF EXISTS (
      SELECT 1 FROM sessions_staff 
      WHERE id = original_sf_id 
      AND planned_absence = true
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Session already marked as planned absence',
        'operation', operation
      );
    END IF;
    
    -- For swap actions, validate replacement staff
    IF action_var = 'swap' THEN
      replacement_staff_id := (operation->>'replacement_staff_id')::UUID;
      
      IF replacement_staff_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'replacement_staff_id required for swap action',
          'operation', operation
        );
      END IF;
      
      -- Validate replacement staff exists and is active
      SELECT EXISTS (
        SELECT 1 FROM staff 
        WHERE id = replacement_staff_id 
        AND status = 'ACTIVE'
      ) INTO replacement_staff_exists;
      
      IF NOT replacement_staff_exists THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Replacement staff not found or inactive',
          'operation', operation
        );
      END IF;
      
      -- Check if replacement staff is the same as original staff
      IF replacement_staff_id = staff_id_var THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Replacement staff cannot be the same as original staff',
          'operation', operation
        );
      END IF;
      
      -- Get session_id from original sessions_staff record
      SELECT session_id INTO original_session_id
      FROM sessions_staff
      WHERE id = original_sf_id;
      
      -- Check if replacement staff is already assigned to this session
      SELECT EXISTS (
        SELECT 1 FROM sessions_staff 
        WHERE session_id = original_session_id 
        AND staff_id = replacement_staff_id
        AND planned_absence = false
      ) INTO replacement_already_assigned;
      
      IF replacement_already_assigned THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Replacement staff is already assigned to this session',
          'operation', operation
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Second pass: Execute all operations
  result := jsonb_set(result, '{operations}', '[]'::JSONB);
  
  FOR operation IN SELECT * FROM jsonb_array_elements(operations)
  LOOP
    staff_id_var := (operation->>'staff_id')::UUID;
    original_sf_id := (operation->>'original_sessions_staff_id')::UUID;
    action_var := operation->>'action';
    
    -- Get the original session_id and type for reference
    SELECT session_id, type INTO original_session_id, original_type
    FROM sessions_staff
    WHERE id = original_sf_id;
    
    IF action_var = 'swap' THEN
      replacement_staff_id := (operation->>'replacement_staff_id')::UUID;
      
      -- Create new sessions_staff record for replacement staff
      new_sf_id := gen_random_uuid();
      
      INSERT INTO sessions_staff (
        id,
        session_id,
        staff_id,
        type,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        new_sf_id,
        original_session_id,
        replacement_staff_id,
        original_type,
        logged_by_staff_id,
        ts_now,
        ts_now
      );
      
      -- Update original sessions_staff record
      UPDATE sessions_staff
      SET
        planned_absence = true,
        planned_absence_logged_at = ts_now,
        planned_absence_logged_by = logged_by_staff_id,
        is_swapped = true,
        swapped_sessions_staff_id = new_sf_id,
        swapped_at = ts_now,
        updated_at = ts_now
      WHERE id = original_sf_id;
      
      operation_result := jsonb_build_object(
        'action', 'swap',
        'original_sessions_staff_id', original_sf_id,
        'new_sessions_staff_id', new_sf_id,
        'original_session_id', original_session_id,
        'replacement_staff_id', replacement_staff_id
      );
      
    ELSE -- action_var = 'log'
      -- Update original sessions_staff record (log absence only, no swap)
      UPDATE sessions_staff
      SET
        planned_absence = true,
        planned_absence_logged_at = ts_now,
        planned_absence_logged_by = logged_by_staff_id,
        is_swapped = false,
        swapped_sessions_staff_id = NULL,
        swapped_at = NULL,
        updated_at = ts_now
      WHERE id = original_sf_id;
      
      operation_result := jsonb_build_object(
        'action', 'log',
        'original_sessions_staff_id', original_sf_id,
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

-- ========================
-- FIX create_tutor_log
-- ========================

CREATE OR REPLACE FUNCTION create_tutor_log(
  p_session_id UUID,
  p_created_by UUID,
  p_staff_attendance JSONB DEFAULT '[]'::JSONB,
  p_student_attendance JSONB DEFAULT '[]'::JSONB,
  p_topics JSONB DEFAULT '[]'::JSONB,
  p_topic_files JSONB DEFAULT '[]'::JSONB,
  p_notes JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_topic_id UUID;
  v_topic_file_id UUID;
  v_staff_attendance_item JSONB;
  v_student_attendance_item JSONB;
  v_topic_item JSONB;
  v_topic_file_item JSONB;
  v_note_item JSONB;
  v_student_id UUID;
  v_created_by_user_id UUID;
BEGIN
  -- Validate that session exists
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session does not exist'
    );
  END IF;

  -- Validate that staff exists and is active, and get user_id
  SELECT user_id INTO v_created_by_user_id
  FROM staff 
  WHERE id = p_created_by 
  AND status = 'ACTIVE';
  
  IF v_created_by_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive staff member'
    );
  END IF;

  -- Set auth context so activity triggers can capture performed_by correctly
  PERFORM set_config('request.jwt.claim.sub', v_created_by_user_id::text, false);

  -- Check if tutor log already exists for this session
  IF EXISTS (SELECT 1 FROM tutor_logs WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tutor log already exists for this session'
    );
  END IF;

  -- Start transaction (implicit in function)
  
  -- 1. Create the tutor log
  INSERT INTO tutor_logs (id, session_id, created_by)
  VALUES (gen_random_uuid(), p_session_id, p_created_by)
  RETURNING id INTO v_tutor_log_id;

  -- 2. Create staff attendance records
  FOR v_staff_attendance_item IN SELECT * FROM jsonb_array_elements(p_staff_attendance)
  LOOP
    INSERT INTO tutor_logs_staff_attendance (
      id,
      tutor_log_id,
      staff_id,
      attended,
      type
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_staff_attendance_item->>'staffId')::UUID,
      (v_staff_attendance_item->>'attended')::BOOLEAN,
      v_staff_attendance_item->>'type'
    )
    ON CONFLICT (tutor_log_id, staff_id) DO NOTHING;
  END LOOP;

  -- 3. Create student attendance records
  FOR v_student_attendance_item IN SELECT * FROM jsonb_array_elements(p_student_attendance)
  LOOP
    INSERT INTO tutor_logs_student_attendance (
      id,
      tutor_log_id,
      student_id,
      attended,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_student_attendance_item->>'studentId')::UUID,
      (v_student_attendance_item->>'attended')::BOOLEAN,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  -- 4. Create topic records and topic-student links
  FOR v_topic_item IN SELECT * FROM jsonb_array_elements(p_topics)
  LOOP
    -- Insert topic record
    INSERT INTO tutor_logs_topics (
      id,
      tutor_log_id,
      topic_id,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_item->>'topicId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topic_id) DO UPDATE SET id = tutor_logs_topics.id
    RETURNING id INTO v_topic_id;

    -- If no return (shouldn't happen with DO UPDATE), get existing record
    IF v_topic_id IS NULL THEN
      SELECT id INTO v_topic_id
      FROM tutor_logs_topics
      WHERE tutor_log_id = v_tutor_log_id
      AND topic_id = (v_topic_item->>'topicId')::UUID;
    END IF;

    -- Insert topic-student links
    FOR v_student_id IN 
      SELECT value::text::UUID 
      FROM jsonb_array_elements_text(v_topic_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_students (
        id,
        tutor_logs_topics_id,
        student_id,
        created_by
      )
      VALUES (
        gen_random_uuid(),
        v_topic_id,
        v_student_id,
        p_created_by
      )
      ON CONFLICT (tutor_logs_topics_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 5. Create topic file records and topic file-student links
  FOR v_topic_file_item IN SELECT * FROM jsonb_array_elements(p_topic_files)
  LOOP
    -- Insert topic file record
    INSERT INTO tutor_logs_topics_files (
      id,
      tutor_log_id,
      topics_files_id,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_file_item->>'topicsFilesId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topics_files_id) DO UPDATE SET id = tutor_logs_topics_files.id
    RETURNING id INTO v_topic_file_id;

    -- If no return (shouldn't happen with DO UPDATE), get existing record
    IF v_topic_file_id IS NULL THEN
      SELECT id INTO v_topic_file_id
      FROM tutor_logs_topics_files
      WHERE tutor_log_id = v_tutor_log_id
      AND topics_files_id = (v_topic_file_item->>'topicsFilesId')::UUID;
    END IF;

    -- Insert topic file-student links
    FOR v_student_id IN 
      SELECT value::text::UUID 
      FROM jsonb_array_elements_text(v_topic_file_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_files_students (
        id,
        tutor_logs_topics_files_id,
        student_id,
        created_by
      )
      VALUES (
        gen_random_uuid(),
        v_topic_file_id,
        v_student_id,
        p_created_by
      )
      ON CONFLICT (tutor_logs_topics_files_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 6. Create notes
  FOR v_note_item IN SELECT value FROM jsonb_array_elements_text(p_notes)
  LOOP
    INSERT INTO notes (
      id,
      target_type,
      target_id,
      note,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      'tutor_logs',
      v_tutor_log_id,
      v_note_item,
      p_created_by
    );
  END LOOP;

  -- Return success with tutor log ID
  RETURN jsonb_build_object(
    'success', true,
    'tutor_log_id', v_tutor_log_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION log_student_absences IS 
'Atomically logs student absences with reschedule or credit actions. 
Validates all operations before executing any changes.
Returns success status with operation results or error details.
Sets auth context so activity triggers can capture performed_by correctly.';

COMMENT ON FUNCTION log_student_absences_self IS 
'Allows students to log their own absences with reschedule action only.
Validates that students can only log absences for themselves.
All operations are validated before executing any changes.
Returns success status with operation results or error details.
Sets auth context for consistency (performed_by will be NULL for student actions).';

COMMENT ON FUNCTION log_staff_absences IS 
'Atomically logs staff absences with swap or log-only actions. 
Validates all operations before executing any changes.
Returns success status with operation results or error details.
Only ADMINSTAFF can execute this function.
Sets auth context so activity triggers can capture performed_by correctly.';

COMMENT ON FUNCTION create_tutor_log IS 
'Atomically creates a tutor log with all related records (staff attendance, student attendance, topics, topic files, notes).
All operations are performed within a single transaction - either all succeed or all fail.
Returns success status with tutor log ID or error details.
Sets auth context so activity triggers can capture performed_by correctly.';

