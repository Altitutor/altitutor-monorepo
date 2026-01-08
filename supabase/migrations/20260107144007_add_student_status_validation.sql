-- Migration: Add student status validation for enrollment and booking
-- Description:
--   - Create enroll_student_in_class RPC with status validation
--   - Add status validation to create_booking_session
--   - Add status validation to reschedule_drafting_session
--   - Create discontinue_student RPC function
--   - Create re_enroll_student RPC function

-- ========================
-- ENROLLMENT RPC FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.enroll_student_in_class(
  p_class_id UUID,
  p_student_id UUID,
  p_enrolled_at TIMESTAMPTZ,
  p_enrolled_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id UUID;
  v_student_status TEXT;
BEGIN
  -- Check student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  IF v_student_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Student must be active to enrol in a class';
  END IF;
  
  -- Create enrollment
  INSERT INTO classes_students (
    id,
    class_id,
    student_id,
    enrolled_at,
    enrolled_by
  ) VALUES (
    gen_random_uuid(),
    p_class_id,
    p_student_id,
    p_enrolled_at,
    p_enrolled_by
  )
  RETURNING id INTO v_enrollment_id;
  
  RETURN v_enrollment_id;
END;
$$;

COMMENT ON FUNCTION public.enroll_student_in_class IS 'Enroll a student in a class with status validation. Only ACTIVE students can be enrolled.';

GRANT EXECUTE ON FUNCTION public.enroll_student_in_class TO authenticated;

-- ========================
-- UPDATE CREATE_BOOKING_SESSION
-- ========================

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
  v_student_status TEXT;
BEGIN
  -- Validate student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  -- DISCONTINUED students cannot book any sessions
  IF v_student_status = 'DISCONTINUED' THEN
    RAISE EXCEPTION 'Discontinued students cannot book sessions';
  END IF;
  
  -- TRIAL students can only book TRIAL_SESSION
  IF v_student_status = 'TRIAL' AND p_session_type != 'TRIAL_SESSION' THEN
    RAISE EXCEPTION 'Trial students cannot book % sessions. Convert to active first.', p_session_type;
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
    
    -- Use reserved staff if available
    IF v_reservation_record.staff_id IS NOT NULL THEN
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
  
  -- Create session
  INSERT INTO sessions (
    id,
    type,
    subject_id,
    start_at,
    end_at,
    status,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_session_type,
    p_subject_id,
    p_start_at,
    p_end_at,
    'SCHEDULED',
    p_created_by
  )
  RETURNING id INTO v_session_id;
  
  -- Link student
  INSERT INTO sessions_students (
    id,
    session_id,
    student_id
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    p_student_id
  );
  
  -- Link staff
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
    p_created_by
  );
  
  -- Delete reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM slot_reservations WHERE id = p_reservation_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION public.create_booking_session IS 'Create a booking session with automatic staff assignment and student/staff linking. Validates student status: DISCONTINUED cannot book, TRIAL can only book TRIAL_SESSION.';

-- ========================
-- UPDATE RESCHEDULE_DRAFTING_SESSION
-- ========================

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
  v_student_status TEXT;
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
  
  -- TRIAL students cannot reschedule drafting sessions (they can only have TRIAL_SESSION)
  IF v_student_status = 'TRIAL' THEN
    RAISE EXCEPTION 'Trial students cannot reschedule drafting sessions. Convert to active first.';
  END IF;
  
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

COMMENT ON FUNCTION public.reschedule_drafting_session IS 'Reschedule a drafting session by creating a new drafting session and marking the original session as an absence atomically. Validates student status: DISCONTINUED and TRIAL students cannot reschedule drafting sessions.';

-- ========================
-- DISCONTINUE STUDENT FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.discontinue_student(
  p_student_id UUID,
  p_discontinued_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_status TEXT;
  v_active_enrollments_count INTEGER;
  v_future_non_class_sessions_count INTEGER;
  v_future_sessions JSONB;
BEGIN
  -- Get current student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;
  
  -- Check if student is already discontinued
  IF v_student_status = 'DISCONTINUED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student is already discontinued'
    );
  END IF;
  
  -- Check for active class enrollments
  SELECT COUNT(*) INTO v_active_enrollments_count
  FROM classes_students
  WHERE student_id = p_student_id
    AND unenrolled_at IS NULL;
  
  IF v_active_enrollments_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unenroll student from classes first'
    );
  END IF;
  
  -- Check for future sessions that should block discontinue
  -- Allow only: class sessions from past enrollments where unenrolled_at IS NOT NULL AND unenrolled_at > session.start_at
  -- Block: all non-class sessions, class sessions from active enrollments, class sessions after unenroll date
  SELECT COUNT(*) INTO v_future_non_class_sessions_count
  FROM sessions_students ss
  JOIN sessions s ON s.id = ss.session_id
  LEFT JOIN classes_students cs ON cs.class_id = s.class_id 
    AND cs.student_id = ss.student_id
    AND cs.enrolled_at <= s.start_at
    AND cs.unenrolled_at IS NOT NULL
    AND cs.unenrolled_at > s.start_at  -- Session is within past enrollment period
  WHERE ss.student_id = p_student_id
    AND s.start_at > NOW()
    AND NOT (
      -- Only allow class sessions from past enrollments with unenrolled_at > session.start_at
      s.type = 'CLASS' 
      AND cs.id IS NOT NULL
    );
  
  IF v_future_non_class_sessions_count > 0 THEN
    -- Get list of future sessions for error message
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'type', s.type,
        'start_at', s.start_at,
        'subject_id', s.subject_id
      )
    ) INTO v_future_sessions
    FROM sessions_students ss
    JOIN sessions s ON s.id = ss.session_id
    LEFT JOIN classes_students cs ON cs.class_id = s.class_id 
      AND cs.student_id = ss.student_id
      AND cs.enrolled_at <= s.start_at
      AND cs.unenrolled_at IS NOT NULL
      AND cs.unenrolled_at > s.start_at
    WHERE ss.student_id = p_student_id
      AND s.start_at > NOW()
      AND NOT (
        s.type = 'CLASS' 
        AND cs.id IS NOT NULL
      );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student has future sessions',
      'sessions', COALESCE(v_future_sessions, '[]'::jsonb)
    );
  END IF;
  
  -- Update student status to DISCONTINUED
  UPDATE students
  SET status = 'DISCONTINUED',
      updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student discontinued successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.discontinue_student IS 'Discontinue a student. Blocks if student has active class enrollments or future non-class sessions. Allows future class sessions from past enrollments with unenroll dates.';

GRANT EXECUTE ON FUNCTION public.discontinue_student TO authenticated;

-- ========================
-- RE-ENROLL STUDENT FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.re_enroll_student(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_status TEXT;
BEGIN
  -- Get current student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;
  
  -- Check if student is discontinued
  IF v_student_status != 'DISCONTINUED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student is not discontinued'
    );
  END IF;
  
  -- Update student status to ACTIVE
  UPDATE students
  SET status = 'ACTIVE',
      updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student re-enrolled successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.re_enroll_student IS 'Re-enroll a discontinued student by changing status back to ACTIVE.';

GRANT EXECUTE ON FUNCTION public.re_enroll_student TO authenticated;

