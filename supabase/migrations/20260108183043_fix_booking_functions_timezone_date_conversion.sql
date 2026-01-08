-- Migration: Fix timezone date conversion in booking functions
-- Description: The booking functions were using p_start_at::DATE which extracts the UTC date,
--              but get_available_slots expects dates in Adelaide timezone. This caused "No staff available"
--              errors when booking slots that cross UTC date boundaries (e.g., Sunday 9am Adelaide = Saturday UTC).
--              Now converts timestamps to Adelaide timezone before extracting dates.

-- ========================
-- FIX CREATE_BOOKING_SESSION
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
  v_created_by_staff_id UUID;
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
    -- FIX: Convert to Adelaide timezone before extracting date
    SELECT available_staff_ids INTO v_available_staff_ids
    FROM get_available_slots(
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
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
  
  -- Link student (add created_by for auditability)
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
  
  -- Link staff (created_by already included)
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

COMMENT ON FUNCTION public.create_booking_session IS 'Create a booking session with automatic staff assignment and student/staff linking. Validates student status: DISCONTINUED cannot book, TRIAL can only book TRIAL_SESSION. Uses p_staff_id when provided (highest priority), otherwise uses reservation staff_id, otherwise auto-assigns. Fixed to use Adelaide timezone for date conversion.';

-- ========================
-- FIX RESCHEDULE_DRAFTING_SESSION
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
    -- FIX: Convert to Adelaide timezone before extracting date
    SELECT available_staff_ids INTO v_available_staff_ids
    FROM get_available_slots(
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
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

COMMENT ON FUNCTION public.reschedule_drafting_session IS 'Reschedule a drafting session by creating a new drafting session and marking the original session as an absence atomically. Validates student status: DISCONTINUED and TRIAL students cannot reschedule drafting sessions. Fixed to use Adelaide timezone for date conversion.';

-- ========================
-- FIX CREATE_ADMIN_TRIAL_BOOKING
-- ========================

CREATE OR REPLACE FUNCTION public.create_admin_trial_booking(
  -- Student details (required)
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_phone TEXT,
  
  -- Session details (required)
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  
  -- Admin details (required)
  p_created_by UUID, -- user_id of the admin creating the booking
  
  -- Optional student details
  p_student_email TEXT DEFAULT NULL,
  p_curriculum TEXT DEFAULT NULL, -- SACE, IB, PRESACE, PRIMARY
  p_year_level INTEGER DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  
  -- Optional parent details
  p_skip_parent_details BOOLEAN DEFAULT TRUE,
  p_parent_first_name TEXT DEFAULT NULL,
  p_parent_last_name TEXT DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  
  -- Optional session details
  p_staff_id UUID DEFAULT NULL -- Manual staff assignment (if not provided, will try to auto-assign)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_parent_id UUID;
  v_parent_id UUID;
  v_student_id UUID;
  v_session_id UUID;
  v_assigned_staff_id UUID;
  v_created_by_staff_id UUID;
  v_available_staff_ids UUID[];
  v_subject_id UUID;
  v_result JSONB;
BEGIN
  -- Convert user_id (p_created_by) to staff.id for created_by fields
  IF p_created_by IS NOT NULL THEN
    SELECT id INTO v_created_by_staff_id
    FROM staff
    WHERE user_id = p_created_by
    LIMIT 1;
    
    IF v_created_by_staff_id IS NULL THEN
      RAISE EXCEPTION 'Admin staff not found for user_id: %', p_created_by;
    END IF;
  ELSE
    RAISE EXCEPTION 'p_created_by is required';
  END IF;
  
  -- Handle parent creation/linking if not skipping parent details
  IF NOT p_skip_parent_details AND p_parent_email IS NOT NULL THEN
    -- Check for existing parent by email
    SELECT id INTO v_existing_parent_id
    FROM parents
    WHERE LOWER(email) = LOWER(p_parent_email)
    LIMIT 1;
    
    IF v_existing_parent_id IS NOT NULL THEN
      -- Use existing parent
      v_parent_id := v_existing_parent_id;
    ELSE
      -- Create new parent
      INSERT INTO parents (id, first_name, last_name, email, phone)
      VALUES (
        gen_random_uuid(),
        p_parent_first_name,
        p_parent_last_name,
        p_parent_email,
        p_parent_phone
      )
      RETURNING id INTO v_parent_id;
    END IF;
  END IF;
  
  -- Create new student
  INSERT INTO students (
    id,
    first_name,
    last_name,
    email,
    phone,
    curriculum,
    year_level,
    status,
    user_id
  ) VALUES (
    gen_random_uuid(),
    p_student_first_name,
    p_student_last_name,
    p_student_email,
    p_student_phone,
    p_curriculum,
    p_year_level,
    'TRIAL',
    NULL
  )
  RETURNING id INTO v_student_id;
  
  -- Link parent to student (if parent exists)
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO parents_students (parent_id, student_id)
    VALUES (v_parent_id, v_student_id)
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END IF;
  
  -- Assign subjects to student if provided
  IF p_subject_ids IS NOT NULL AND array_length(p_subject_ids, 1) > 0 THEN
    FOREACH v_subject_id IN ARRAY p_subject_ids
    LOOP
      INSERT INTO students_subjects (student_id, subject_id, created_by)
      VALUES (v_student_id, v_subject_id, v_created_by_staff_id)
      ON CONFLICT (student_id, subject_id) DO NOTHING;
    END LOOP;
  END IF;
  
  -- Determine staff assignment for session
  -- Use p_staff_id if provided (manual assignment)
  IF p_staff_id IS NOT NULL THEN
    v_assigned_staff_id := p_staff_id;
  ELSE
    -- Try to auto-assign staff (but allow past bookings, so don't fail if no availability)
    BEGIN
      -- FIX: Convert to Adelaide timezone before extracting date
      SELECT available_staff_ids INTO v_available_staff_ids
      FROM get_available_slots(
        (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
        (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
        'TRIAL_SESSION'::public.session_type,
        NULL, -- No subject for trial sessions
        EXTRACT(EPOCH FROM (p_end_at - p_start_at))::INTEGER / 60
      )
      WHERE start_at = p_start_at AND end_at = p_end_at
      LIMIT 1;
      
      IF v_available_staff_ids IS NOT NULL AND array_length(v_available_staff_ids, 1) > 0 THEN
        -- Auto-assign staff
        v_assigned_staff_id := assign_staff_to_booking(
          'TRIAL_SESSION'::public.session_type,
          p_start_at,
          p_end_at,
          v_available_staff_ids,
          NULL -- No subject for trial sessions
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If auto-assignment fails (e.g., past booking), allow NULL staff
        -- Admin can assign manually later if needed
        v_assigned_staff_id := NULL;
    END;
  END IF;
  
  -- Create session directly (allows past bookings, no availability restrictions)
  INSERT INTO sessions (
    id,
    type,
    subject_id,
    start_at,
    end_at,
    status
  ) VALUES (
    gen_random_uuid(),
    'TRIAL_SESSION',
    NULL, -- Trial sessions don't have subjects
    p_start_at,
    p_end_at,
    'ACTIVE'
  )
  RETURNING id INTO v_session_id;
  
  -- Link student (with created_by for auditability)
  INSERT INTO sessions_students (
    id,
    session_id,
    student_id,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    v_student_id,
    v_created_by_staff_id
  );
  
  -- Link staff (if assigned)
  IF v_assigned_staff_id IS NOT NULL THEN
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
      'TRIAL_TUTOR',
      v_created_by_staff_id
    );
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'session_id', v_session_id,
    'student_id', v_student_id,
    'staff_assigned', v_assigned_staff_id IS NOT NULL,
    'parent_linked', v_parent_id IS NOT NULL AND v_existing_parent_id IS NOT NULL
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_admin_trial_booking IS 'Create an admin trial session booking atomically. Creates student, parent (if provided), assigns subjects, and creates session. Allows past bookings and supports manual staff assignment. Fixed to use Adelaide timezone for date conversion.';

