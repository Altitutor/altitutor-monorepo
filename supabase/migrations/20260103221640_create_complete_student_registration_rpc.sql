-- Migration: Create RPC function for atomic student registration completion
-- Description:
--   - Atomically completes student registration
--   - Updates student record, creates/updates parents, manages subjects
--   - Creates auth user account
--   - All operations succeed or all fail (transaction)

CREATE OR REPLACE FUNCTION public.complete_student_registration(
  -- Registration token
  p_token UUID,
  
  -- Student details
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_email TEXT,
  p_student_phone TEXT,
  p_school TEXT DEFAULT NULL,
  p_curriculum TEXT DEFAULT NULL,
  p_year_level INTEGER DEFAULT NULL,
  
  -- Availability
  p_availability_monday BOOLEAN DEFAULT FALSE,
  p_availability_tuesday BOOLEAN DEFAULT FALSE,
  p_availability_wednesday BOOLEAN DEFAULT FALSE,
  p_availability_thursday BOOLEAN DEFAULT FALSE,
  p_availability_friday BOOLEAN DEFAULT FALSE,
  p_availability_saturday_am BOOLEAN DEFAULT FALSE,
  p_availability_saturday_pm BOOLEAN DEFAULT FALSE,
  p_availability_sunday_am BOOLEAN DEFAULT FALSE,
  p_availability_sunday_pm BOOLEAN DEFAULT FALSE,
  
  -- Parents (JSON array)
  p_parents JSONB DEFAULT '[]'::JSONB,
  
  -- Subject IDs
  p_subject_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_student_record RECORD;
  v_parent_item JSONB;
  v_parent_id UUID;
  v_existing_parent_id UUID;
  v_subject_id UUID;
  v_availability_count INTEGER;
BEGIN
  -- Validate token and get student
  SELECT id, status, user_id INTO v_student_record
  FROM students
  WHERE invite_token = p_token
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired token'
    );
  END IF;
  
  v_student_id := v_student_record.id;
  
  -- Check if already registered
  IF v_student_record.user_id IS NOT NULL OR v_student_record.status = 'ACTIVE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student already registered',
      'already_registered', true
    );
  END IF;
  
  -- Validate at least one availability day is selected
  v_availability_count := 
    CASE WHEN p_availability_monday THEN 1 ELSE 0 END +
    CASE WHEN p_availability_tuesday THEN 1 ELSE 0 END +
    CASE WHEN p_availability_wednesday THEN 1 ELSE 0 END +
    CASE WHEN p_availability_thursday THEN 1 ELSE 0 END +
    CASE WHEN p_availability_friday THEN 1 ELSE 0 END +
    CASE WHEN p_availability_saturday_am THEN 1 ELSE 0 END +
    CASE WHEN p_availability_saturday_pm THEN 1 ELSE 0 END +
    CASE WHEN p_availability_sunday_am THEN 1 ELSE 0 END +
    CASE WHEN p_availability_sunday_pm THEN 1 ELSE 0 END;
  
  IF v_availability_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least one availability day must be selected'
    );
  END IF;
  
  -- Validate at least one parent with email and phone
  IF jsonb_array_length(p_parents) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least one parent with email and phone is required'
    );
  END IF;
  
  -- Check if at least one parent has both email and phone
  DECLARE
    v_has_valid_parent BOOLEAN := FALSE;
  BEGIN
    FOR v_parent_item IN SELECT * FROM jsonb_array_elements(p_parents)
    LOOP
      IF (v_parent_item->>'email') IS NOT NULL 
         AND (v_parent_item->>'email') != ''
         AND (v_parent_item->>'phone') IS NOT NULL 
         AND (v_parent_item->>'phone') != '' THEN
        v_has_valid_parent := TRUE;
        EXIT;
      END IF;
    END LOOP;
    
    IF NOT v_has_valid_parent THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'At least one parent must have both email and phone'
      );
    END IF;
  END;
  
  -- Start transaction (implicit in function)
  
  -- 1. Update student record
  UPDATE students
  SET
    first_name = p_student_first_name,
    last_name = p_student_last_name,
    email = p_student_email,
    phone = p_student_phone,
    school = p_school,
    curriculum = p_curriculum,
    year_level = p_year_level,
    availability_monday = p_availability_monday,
    availability_tuesday = p_availability_tuesday,
    availability_wednesday = p_availability_wednesday,
    availability_thursday = p_availability_thursday,
    availability_friday = p_availability_friday,
    availability_saturday_am = p_availability_saturday_am,
    availability_saturday_pm = p_availability_saturday_pm,
    availability_sunday_am = p_availability_sunday_am,
    availability_sunday_pm = p_availability_sunday_pm,
    status = 'ACTIVE',
    invite_token = NULL, -- Clear token after use
    updated_at = NOW()
  WHERE id = v_student_id;
  
  -- 2. Handle parents
  FOR v_parent_item IN SELECT * FROM jsonb_array_elements(p_parents)
  LOOP
    DECLARE
      v_parent_email TEXT := v_parent_item->>'email';
      v_parent_phone TEXT := v_parent_item->>'phone';
      v_parent_first_name TEXT := v_parent_item->>'first_name';
      v_parent_last_name TEXT := v_parent_item->>'last_name';
    BEGIN
      -- Skip if no email (required for linking)
      IF v_parent_email IS NULL OR v_parent_email = '' THEN
        CONTINUE;
      END IF;
      
      -- Check for existing parent by email
      SELECT id INTO v_existing_parent_id
      FROM parents
      WHERE LOWER(email) = LOWER(v_parent_email)
      LIMIT 1;
      
      IF v_existing_parent_id IS NOT NULL THEN
        -- Update existing parent
        UPDATE parents
        SET
          first_name = COALESCE(v_parent_first_name, first_name),
          last_name = COALESCE(v_parent_last_name, last_name),
          phone = COALESCE(v_parent_phone, phone),
          updated_at = NOW()
        WHERE id = v_existing_parent_id;
        
        v_parent_id := v_existing_parent_id;
      ELSE
        -- Create new parent
        INSERT INTO parents (id, first_name, last_name, email, phone)
        VALUES (
          gen_random_uuid(),
          v_parent_first_name,
          v_parent_last_name,
          v_parent_email,
          v_parent_phone
        )
        RETURNING id INTO v_parent_id;
      END IF;
      
      -- Link parent to student (if not already linked)
      INSERT INTO parents_students (parent_id, student_id)
      VALUES (v_parent_id, v_student_id)
      ON CONFLICT (parent_id, student_id) DO NOTHING;
    END;
  END LOOP;
  
  -- 3. Update subjects (remove all existing, then add new ones)
  -- Remove all existing subjects
  DELETE FROM students_subjects
  WHERE student_id = v_student_id;
  
  -- Add new subjects
  IF p_subject_ids IS NOT NULL AND array_length(p_subject_ids, 1) > 0 THEN
    FOREACH v_subject_id IN ARRAY p_subject_ids
    LOOP
      -- Verify subject exists
      IF EXISTS (SELECT 1 FROM subjects WHERE id = v_subject_id) THEN
        INSERT INTO students_subjects (student_id, subject_id)
        VALUES (v_student_id, v_subject_id)
        ON CONFLICT (student_id, subject_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  
  -- 4. Create auth user (this will be done by the API endpoint after this function)
  -- We return the student_id so the API can create the auth user and link it
  
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'message', 'Registration completed successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in case of exception
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Registration failed: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.complete_student_registration IS 'Atomically completes student registration: updates student record, manages parents and subjects, sets status to ACTIVE. Returns student_id for auth user creation.';
