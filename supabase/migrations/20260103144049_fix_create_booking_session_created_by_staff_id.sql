-- Migration: Fix create_booking_session to convert user_id to staff.id for created_by
-- Description: The function receives p_created_by as auth.uid() (user UUID), but sessions_students.created_by
--              and sessions_staff.created_by reference staff(id), not staff(user_id).
--              This migration converts the user_id to staff.id before inserting.

CREATE OR REPLACE FUNCTION public.create_booking_session(
  p_session_type public.session_type,
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
  v_session_id UUID;
  v_assigned_staff_id UUID;
  v_available_staff_ids UUID[];
  v_reservation_record RECORD;
  v_created_by_staff_id UUID;
BEGIN
  -- Convert user_id (p_created_by) to staff.id for created_by fields
  -- If p_created_by is NULL or no staff found, set to NULL (allow NULL for created_by)
  IF p_created_by IS NOT NULL THEN
    SELECT id INTO v_created_by_staff_id
    FROM staff
    WHERE user_id = p_created_by
    LIMIT 1;
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
      p_session_type,
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
  
  -- Create session (sessions table doesn't have created_by column)
  INSERT INTO sessions (
    id,
    type,
    subject_id,
    start_at,
    end_at,
    status
  ) VALUES (
    gen_random_uuid(),
    p_session_type,
    p_subject_id,
    p_start_at,
    p_end_at,
    'ACTIVE'
  )
  RETURNING id INTO v_session_id;
  
  -- Link student (add created_by for auditability - use staff.id, not user_id)
  INSERT INTO sessions_students (
    id,
    session_id,
    student_id,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    p_student_id,
    v_created_by_staff_id
  );
  
  -- Link staff (created_by already included - use staff.id, not user_id)
  INSERT INTO sessions_staff (
    id,
    session_id,
    staff_id,
    type,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    v_assigned_staff_id,
    CASE 
      WHEN p_session_type = 'TRIAL_SESSION' THEN 'TRIAL_TUTOR'
      ELSE 'MAIN_TUTOR'
    END,
    v_created_by_staff_id
  );
  
  -- Delete reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM slot_reservations WHERE id = p_reservation_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION public.create_booking_session IS 'Create a booking session with automatic staff assignment and student/staff linking. Fixed to convert user_id to staff.id for created_by fields.';
