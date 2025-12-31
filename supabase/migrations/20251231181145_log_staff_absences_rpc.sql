-- Migration: Add log_staff_absences RPC function for atomic absence logging
-- This function handles logging staff absences with swap or log-only actions
-- All operations are performed atomically within a transaction

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
  
  -- Variables for validation
  replacement_staff_exists BOOLEAN;
  replacement_already_assigned BOOLEAN;
BEGIN
  -- Check ADMINSTAFF access
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only ADMINSTAFF can log staff absences'
    );
  END IF;

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

-- Grant execute permission to authenticated users (RLS policies will handle authorization)
GRANT EXECUTE ON FUNCTION log_staff_absences(JSONB, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION log_staff_absences IS 
'Atomically logs staff absences with swap or log-only actions. 
Validates all operations before executing any changes.
Returns success status with operation results or error details.
Only ADMINSTAFF can execute this function.';

