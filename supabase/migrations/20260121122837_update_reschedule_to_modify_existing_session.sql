-- Migration: Update reschedule_session to modify existing session instead of creating new one
-- Description:
--   - Change reschedule_session to update the existing session's time instead of creating a new session
--   - Update staff assignment if needed
--   - Remove the absence/rescheduled marking logic
--   - Return the original session_id instead of creating a new session

-- ========================
-- UPDATE RESCHEDULE_SESSION FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.reschedule_session(
  p_original_session_id UUID,
  p_student_id UUID,
  p_session_type public.session_type,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_subject_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_reservation_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid(),
  p_bypass_date_restrictions BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_staff_id UUID;
  v_available_staff_ids UUID[];
  v_reservation_record RECORD;
  v_created_by_staff_id UUID;
  v_original_session_type public.session_type;
  v_ts_now TIMESTAMPTZ := NOW();
  v_student_status TEXT;
  v_bypass_restrictions BOOLEAN;
  v_staff_type TEXT;
  v_existing_staff_id UUID;
  v_existing_staff_type TEXT;
BEGIN
  -- Validate student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  -- DISCONTINUED students cannot reschedule sessions
  IF v_student_status = 'DISCONTINUED' THEN
    RAISE EXCEPTION 'Discontinued students cannot reschedule sessions';
  END IF;
  
  -- TRIAL students can only reschedule TRIAL_SESSION
  IF v_student_status = 'TRIAL' AND p_session_type != 'TRIAL_SESSION' THEN
    RAISE EXCEPTION 'Trial students cannot reschedule % sessions. Convert to active first.', p_session_type;
  END IF;
  
  -- Determine if we should bypass date restrictions
  -- If p_bypass_date_restrictions is NULL, auto-detect admin status
  IF p_bypass_date_restrictions IS NULL THEN
    v_bypass_restrictions := public.is_adminstaff_active();
  ELSE
    v_bypass_restrictions := p_bypass_date_restrictions;
  END IF;
  
  -- Convert user_id (p_created_by) to staff.id for created_by fields
  -- If p_created_by is NULL or no staff found, set to NULL (allow NULL for created_by)
  IF p_created_by IS NOT NULL THEN
    SELECT id INTO v_created_by_staff_id
    FROM staff
    WHERE user_id = p_created_by
    LIMIT 1;
  END IF;

  -- Validate that session exists and student is enrolled
  SELECT s.type INTO v_original_session_type
  FROM sessions s
  JOIN sessions_students ss ON ss.session_id = s.id
  WHERE s.id = p_original_session_id
    AND ss.student_id = p_student_id
    AND ss.planned_absence = false;

  IF v_original_session_type IS NULL THEN
    RAISE EXCEPTION 'Original session not found, already marked as absence, or does not belong to student';
  END IF;

  -- Validate that original session type matches requested session type
  IF v_original_session_type != p_session_type THEN
    RAISE EXCEPTION 'Original session type (%) does not match requested session type (%)', v_original_session_type, p_session_type;
  END IF;

  -- Validate session type is reschedulable
  IF p_session_type NOT IN ('DRAFTING', 'TRIAL_SESSION', 'SUBSIDY_INTERVIEW') THEN
    RAISE EXCEPTION 'Session type % cannot be rescheduled', p_session_type;
  END IF;

  -- Validate subject_id for DRAFTING sessions
  IF p_session_type = 'DRAFTING' AND p_subject_id IS NULL THEN
    -- Try to get subject_id from original session
    SELECT subject_id INTO p_subject_id
    FROM sessions
    WHERE id = p_original_session_id;
    
    IF p_subject_id IS NULL THEN
      RAISE EXCEPTION 'Subject ID is required for drafting sessions';
    END IF;
  END IF;

  -- Validate that original session is in the future (unless bypassing restrictions)
  IF NOT v_bypass_restrictions THEN
    IF EXISTS (
      SELECT 1 FROM sessions 
      WHERE id = p_original_session_id 
      AND start_at <= NOW()
    ) THEN
      RAISE EXCEPTION 'Cannot reschedule a session that has already started or passed';
    END IF;
  END IF;

  -- Use p_staff_id if provided (highest priority)
  IF p_staff_id IS NOT NULL THEN
    v_assigned_staff_id := p_staff_id;
  END IF;

  -- Validate reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_reservation_record
    FROM slot_reservations
    WHERE id = p_reservation_id
      AND expires_at > NOW();
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reservation expired or not found';
    END IF;
    
    -- Validate slot matches reservation
    IF v_reservation_record.start_at != p_start_at OR v_reservation_record.end_at != p_end_at THEN
      RAISE EXCEPTION 'Slot does not match reservation';
    END IF;
    
    -- Use reserved staff if available (only if p_staff_id was not provided)
    IF v_assigned_staff_id IS NULL AND v_reservation_record.staff_id IS NOT NULL THEN
      v_assigned_staff_id := v_reservation_record.staff_id;
    END IF;
  END IF;

  -- Get available staff for slot if not assigned
  IF v_assigned_staff_id IS NULL THEN
    -- FIX: Convert to Adelaide timezone before extracting date
    SELECT available_staff_ids INTO v_available_staff_ids
    FROM get_available_slots(
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      p_session_type,
      p_subject_id,
      EXTRACT(EPOCH FROM (p_end_at - p_start_at))::INTEGER / 60,
      v_bypass_restrictions
    )
    WHERE start_at = p_start_at AND end_at = p_end_at
    LIMIT 1;
    
    -- If bypassing restrictions and no staff available, allow NULL staff (admin can assign manually later)
    -- Otherwise, require staff availability
    IF NOT v_bypass_restrictions THEN
      IF v_available_staff_ids IS NULL OR array_length(v_available_staff_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No staff available for this slot';
      END IF;
    END IF;
    
    -- Auto-assign staff if available
    IF v_available_staff_ids IS NOT NULL AND array_length(v_available_staff_ids, 1) > 0 THEN
      v_assigned_staff_id := assign_staff_to_booking(
        p_session_type,
        p_start_at,
        p_end_at,
        v_available_staff_ids,
        p_subject_id
      );
      
      IF v_assigned_staff_id IS NULL THEN
        RAISE EXCEPTION 'Failed to assign staff';
      END IF;
    END IF;
    -- If bypassing and no staff available, v_assigned_staff_id remains NULL (allowed for admin)
  END IF;

  -- Determine staff type based on session type
  v_staff_type := CASE 
    WHEN p_session_type = 'TRIAL_SESSION' THEN 'TRIAL_TUTOR'
    ELSE 'MAIN_TUTOR'
  END;

  -- Get existing staff assignment for this session
  SELECT ss.staff_id, ss.type INTO v_existing_staff_id, v_existing_staff_type
  FROM sessions_staff ss
  WHERE ss.session_id = p_original_session_id
    AND ss.planned_absence = false
  LIMIT 1;

  -- Update the existing session's time
  UPDATE sessions
  SET
    start_at = p_start_at,
    end_at = p_end_at,
    subject_id = COALESCE(p_subject_id, subject_id), -- Only update if provided
    updated_at = v_ts_now
  WHERE id = p_original_session_id;

  -- Update staff assignment if needed
  IF v_assigned_staff_id IS NOT NULL THEN
    -- If staff changed, update the assignment
    IF v_existing_staff_id IS NULL OR v_existing_staff_id != v_assigned_staff_id THEN
      -- Remove old staff assignment (if exists and not absent)
      IF v_existing_staff_id IS NOT NULL THEN
        UPDATE sessions_staff
        SET planned_absence = true,
            planned_absence_logged_at = v_ts_now,
            planned_absence_logged_by = v_created_by_staff_id,
            updated_at = v_ts_now
        WHERE session_id = p_original_session_id
          AND staff_id = v_existing_staff_id
          AND planned_absence = false;
      END IF;
      
      -- Add new staff assignment
      INSERT INTO sessions_staff (
        id,
        session_id,
        staff_id,
        type,
        created_by
      ) VALUES (
        gen_random_uuid(),
        p_original_session_id,
        v_assigned_staff_id,
        v_staff_type,
        v_created_by_staff_id
      )
      ON CONFLICT (session_id, staff_id) DO UPDATE
      SET planned_absence = false,
          planned_absence_logged_at = NULL,
          planned_absence_logged_by = NULL,
          type = v_staff_type,
          updated_at = v_ts_now;
    ELSE
      -- Same staff, just ensure type is correct
      IF v_existing_staff_type != v_staff_type THEN
        UPDATE sessions_staff
        SET type = v_staff_type,
            updated_at = v_ts_now
        WHERE session_id = p_original_session_id
          AND staff_id = v_assigned_staff_id
          AND planned_absence = false;
      END IF;
    END IF;
  ELSE
    -- No staff assigned - remove existing assignment if present
    IF v_existing_staff_id IS NOT NULL THEN
      UPDATE sessions_staff
      SET planned_absence = true,
          planned_absence_logged_at = v_ts_now,
          planned_absence_logged_by = v_created_by_staff_id,
          updated_at = v_ts_now
      WHERE session_id = p_original_session_id
        AND staff_id = v_existing_staff_id
        AND planned_absence = false;
    END IF;
  END IF;

  -- Delete reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM slot_reservations WHERE id = p_reservation_id;
  END IF;

  -- Return the original session_id (not a new one)
  RETURN p_original_session_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to reschedule session: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.reschedule_session IS 'Reschedule a session (DRAFTING, TRIAL_SESSION, or SUBSIDY_INTERVIEW) by updating the existing session time and staff assignment. Validates student status: DISCONTINUED cannot reschedule, TRIAL can only reschedule TRIAL_SESSION. Validates session type matches original session. Admins can bypass date restrictions via p_bypass_date_restrictions parameter (auto-detected if NULL). Returns the original session_id.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reschedule_session(UUID, UUID, public.session_type, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, BOOLEAN) TO authenticated;
