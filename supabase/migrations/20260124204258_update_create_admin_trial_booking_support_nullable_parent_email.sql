-- Migration: Update create_admin_trial_booking to support nullable parent email
-- Description:
--   - Allow creating parents without email (if name or phone is provided)
--   - Maintain backward compatibility with existing behavior
--   - Support finding existing parents by phone when email is not provided
--   - Create parent if at least one of: name or phone is provided (not just email)

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
  v_has_parent_name BOOLEAN;
  v_has_parent_phone BOOLEAN;
  v_has_parent_email BOOLEAN;
  v_has_parent_details BOOLEAN;
  v_found_parent_first_name TEXT;
  v_found_parent_last_name TEXT;
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
  
  -- Check if we have parent details to work with
  v_has_parent_name := (p_parent_first_name IS NOT NULL AND TRIM(p_parent_first_name) != '') OR
                       (p_parent_last_name IS NOT NULL AND TRIM(p_parent_last_name) != '');
  v_has_parent_phone := p_parent_phone IS NOT NULL AND TRIM(p_parent_phone) != '';
  v_has_parent_email := p_parent_email IS NOT NULL AND TRIM(p_parent_email) != '';
  v_has_parent_details := v_has_parent_name OR v_has_parent_phone OR v_has_parent_email;
  
  -- Handle parent creation/linking if not skipping parent details and we have some parent info
  IF NOT p_skip_parent_details AND v_has_parent_details THEN
    -- Try to find existing parent
    IF v_has_parent_email THEN
      -- Search by email (case-insensitive)
      SELECT id INTO v_existing_parent_id
      FROM parents
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_parent_email))
      LIMIT 1;
    ELSIF v_has_parent_phone THEN
      -- Search by phone (exact match)
      SELECT id INTO v_existing_parent_id
      FROM parents
      WHERE phone = TRIM(p_parent_phone)
      LIMIT 1;
      
      -- If found by phone and we have names, optionally verify name match
      -- (This is a best-effort match - we'll use the parent if found)
      IF v_existing_parent_id IS NOT NULL AND v_has_parent_name THEN
        -- Verify name matches (case-insensitive, partial match allowed)
        SELECT first_name, last_name INTO v_found_parent_first_name, v_found_parent_last_name
        FROM parents
        WHERE id = v_existing_parent_id;
        
        -- If names don't match reasonably, don't use this parent
        -- (This prevents linking wrong parent when phone matches but name doesn't)
        IF (p_parent_first_name IS NOT NULL AND TRIM(p_parent_first_name) != '' AND
            v_found_parent_first_name IS NOT NULL AND
            LOWER(TRIM(v_found_parent_first_name)) != LOWER(TRIM(p_parent_first_name))) OR
           (p_parent_last_name IS NOT NULL AND TRIM(p_parent_last_name) != '' AND
            v_found_parent_last_name IS NOT NULL AND
            LOWER(TRIM(v_found_parent_last_name)) != LOWER(TRIM(p_parent_last_name))) THEN
          -- Name mismatch - don't use this parent, create new one
          v_existing_parent_id := NULL;
        END IF;
      END IF;
    END IF;
    
    IF v_existing_parent_id IS NOT NULL THEN
      -- Use existing parent
      v_parent_id := v_existing_parent_id;
    ELSE
      -- Create new parent (email can be NULL)
      INSERT INTO parents (id, first_name, last_name, email, phone)
      VALUES (
        gen_random_uuid(),
        COALESCE(NULLIF(TRIM(p_parent_first_name), ''), ''),
        COALESCE(NULLIF(TRIM(p_parent_last_name), ''), ''),
        CASE WHEN v_has_parent_email THEN TRIM(p_parent_email) ELSE NULL END,
        CASE WHEN v_has_parent_phone THEN TRIM(p_parent_phone) ELSE NULL END
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
    'parent_linked', v_parent_id IS NOT NULL
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_admin_trial_booking IS 'Create an admin trial session booking atomically. Creates student, parent (if provided - supports nullable email), assigns subjects, and creates session. Allows past bookings and supports manual staff assignment. Fixed to use Adelaide timezone for date conversion. Supports creating parents with name/phone only (no email required).';

-- Grant execute permission to authenticated users (admin staff only via RLS)
GRANT EXECUTE ON FUNCTION public.create_admin_trial_booking TO authenticated;
