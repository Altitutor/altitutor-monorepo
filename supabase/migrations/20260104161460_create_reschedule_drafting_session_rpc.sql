-- Migration: Create reschedule_drafting_session RPC function
-- Description: Allows students to reschedule a drafting session by creating a new drafting session
--              and marking the original session as an absence atomically.

CREATE OR REPLACE FUNCTION public.reschedule_drafting_session(
  p_original_session_id UUID,
  p_student_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_subject_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_reservation_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_session_id UUID;
  v_assigned_staff_id UUID;
  v_available_staff_ids UUID[];
  v_reservation_record RECORD;
  v_created_by_staff_id UUID;
  v_original_ss_id UUID;
  v_new_ss_id UUID;
  v_original_session_type public.session_type;
  v_ts_now TIMESTAMPTZ := NOW();
BEGIN
  -- Convert user_id (p_created_by) to staff.id for created_by fields
  -- If p_created_by is NULL or no staff found, set to NULL (allow NULL for created_by)
  IF p_created_by IS NOT NULL THEN
    SELECT id INTO v_created_by_staff_id
    FROM staff
    WHERE user_id = p_created_by
    LIMIT 1;
  END IF;

  -- Validate that student can only reschedule their own sessions
  -- Get the original sessions_students record
  SELECT ss.id, s.type INTO v_original_ss_id, v_original_session_type
  FROM sessions_students ss
  JOIN sessions s ON s.id = ss.session_id
  WHERE ss.session_id = p_original_session_id
    AND ss.student_id = p_student_id
    AND ss.planned_absence = false;

  IF v_original_ss_id IS NULL THEN
    RAISE EXCEPTION 'Original session not found, already marked as absence, or does not belong to student';
  END IF;

  -- Validate that original session is a DRAFTING session
  IF v_original_session_type != 'DRAFTING' THEN
    RAISE EXCEPTION 'Original session must be a DRAFTING session';
  END IF;

  -- Validate that original session is in the future
  IF EXISTS (
    SELECT 1 FROM sessions 
    WHERE id = p_original_session_id 
    AND start_at <= NOW()
  ) THEN
    RAISE EXCEPTION 'Cannot reschedule a session that has already started or passed';
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
    SELECT available_staff_ids INTO v_available_staff_ids
    FROM get_available_slots(
      p_start_at::DATE,
      p_start_at::DATE,
      'DRAFTING'::public.session_type,
      p_subject_id,
      EXTRACT(EPOCH FROM (p_end_at - p_start_at))::INTEGER / 60
    )
    WHERE start_at = p_start_at AND end_at = p_end_at
    LIMIT 1;
    
    IF v_available_staff_ids IS NULL OR array_length(v_available_staff_ids, 1) = 0 THEN
      RAISE EXCEPTION 'No staff available for this slot';
    END IF;
    
    -- Auto-assign staff
    v_assigned_staff_id := assign_staff_to_booking(
      'DRAFTING'::public.session_type,
      p_start_at,
      p_end_at,
      v_available_staff_ids,
      p_subject_id
    );
    
    IF v_assigned_staff_id IS NULL THEN
      RAISE EXCEPTION 'Failed to assign staff';
    END IF;
  END IF;

  -- Create new drafting session
  INSERT INTO sessions (
    id,
    type,
    subject_id,
    start_at,
    end_at,
    status
  ) VALUES (
    gen_random_uuid(),
    'DRAFTING',
    p_subject_id,
    p_start_at,
    p_end_at,
    'ACTIVE'
  )
  RETURNING id INTO v_new_session_id;

  -- Link student to new session
  v_new_ss_id := gen_random_uuid();
  INSERT INTO sessions_students (
    id,
    session_id,
    student_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_new_ss_id,
    v_new_session_id,
    p_student_id,
    v_created_by_staff_id,
    v_ts_now,
    v_ts_now
  );

  -- Link staff to new session
  INSERT INTO sessions_staff (
    id,
    session_id,
    staff_id,
    type,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_new_session_id,
    v_assigned_staff_id,
    'MAIN_TUTOR',
    v_created_by_staff_id
  );

  -- Mark original session as absence and link to new session
  UPDATE sessions_students
  SET
    planned_absence = true,
    planned_absence_logged_at = v_ts_now,
    planned_absence_logged_by = NULL,  -- Students don't have staff_id, so set to NULL
    is_rescheduled = true,
    rescheduled_at = v_ts_now,
    rescheduled_sessions_students_id = v_new_ss_id,
    is_credited = false,  -- Explicitly set to false to satisfy constraint
    updated_at = v_ts_now
  WHERE id = v_original_ss_id;

  -- Delete reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM slot_reservations WHERE id = p_reservation_id;
  END IF;

  RETURN v_new_session_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to reschedule drafting session: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.reschedule_drafting_session IS 'Reschedule a drafting session by creating a new drafting session and marking the original session as an absence atomically. Only works for DRAFTING sessions that belong to the student and are in the future.';

