-- Migration: Add subject_ids parameter to create_public_trial_booking function
-- Description:
--   - Add p_subject_ids parameter to accept array of subject UUIDs
--   - Assign subjects to student after student creation
--   - Allows public trial bookings to assign subjects during booking

-- Drop the old function signature first (without p_subject_ids)
DROP FUNCTION IF EXISTS public.create_public_trial_booking(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_public_trial_booking(
  -- Student details (required)
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_email TEXT,
  p_student_phone TEXT,
  p_curriculum TEXT, -- SACE, IB, PRESACE, PRIMARY
  
  -- Session details (required)
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  
  -- Optional parameters (must come after required)
  p_year_level INTEGER DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_parent_first_name TEXT DEFAULT NULL,
  p_parent_last_name TEXT DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_student_id UUID;
  v_existing_parent_id UUID;
  v_parent_id UUID;
  v_student_id UUID;
  v_session_id UUID;
  v_subject_id UUID;
  v_result JSONB;
BEGIN
  -- Check if student exists by email (case-insensitive)
  SELECT id INTO v_existing_student_id
  FROM students
  WHERE LOWER(email) = LOWER(p_student_email)
  LIMIT 1;
  
  -- If student exists, raise exception (will be caught by API)
  IF v_existing_student_id IS NOT NULL THEN
    RAISE EXCEPTION 'STUDENT_EXISTS' USING 
      ERRCODE = 'P0001',
      MESSAGE = 'Student with this email already exists';
  END IF;
  
  -- If parent email provided, check for existing parent
  IF p_parent_email IS NOT NULL THEN
    SELECT id INTO v_existing_parent_id
    FROM parents
    WHERE LOWER(email) = LOWER(p_parent_email)
    LIMIT 1;
    
    IF v_existing_parent_id IS NOT NULL THEN
      -- Use existing parent (don't update)
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
      VALUES (v_student_id, v_subject_id, NULL)
      ON CONFLICT (student_id, subject_id) DO NOTHING;
    END LOOP;
  END IF;
  
  -- Create session using existing function
  v_session_id := create_booking_session(
    p_session_type := 'TRIAL_SESSION',
    p_student_id := v_student_id,
    p_start_at := p_start_at,
    p_end_at := p_end_at,
    p_subject_id := NULL,
    p_staff_id := NULL,
    p_reservation_id := NULL,
    p_created_by := NULL
  );
  
  -- Return result
  v_result := jsonb_build_object(
    'session_id', v_session_id,
    'student_id', v_student_id,
    'parent_linked', v_parent_id IS NOT NULL AND v_existing_parent_id IS NOT NULL
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_public_trial_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID[], TEXT, TEXT, TEXT, TEXT) IS 'Create a public trial session booking. Blocks if student email already exists. Links to existing parent if email matches. Assigns subjects if provided.';
