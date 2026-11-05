-- The trial booking command creates students, parents, sessions and staff
-- assignments. Only the active AdminStaff caller may do that, and the recorded
-- actor has to be that caller.
-- DEV-343

CREATE OR REPLACE FUNCTION public.create_admin_trial_booking(
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_phone TEXT,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_created_by UUID,
  p_student_email TEXT DEFAULT NULL,
  p_curriculum TEXT DEFAULT NULL,
  p_year_level INTEGER DEFAULT NULL,
  p_subject_ids UUID[] DEFAULT NULL,
  p_skip_parent_details BOOLEAN DEFAULT TRUE,
  p_parent_first_name TEXT DEFAULT NULL,
  p_parent_last_name TEXT DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL
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
  IF NOT public.is_adminstaff_active() OR p_created_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE = '42501';
  END IF;

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

  v_has_parent_name := (p_parent_first_name IS NOT NULL AND TRIM(p_parent_first_name) != '') OR
                       (p_parent_last_name IS NOT NULL AND TRIM(p_parent_last_name) != '');
  v_has_parent_phone := p_parent_phone IS NOT NULL AND TRIM(p_parent_phone) != '';
  v_has_parent_email := p_parent_email IS NOT NULL AND TRIM(p_parent_email) != '';
  v_has_parent_details := v_has_parent_name OR v_has_parent_phone OR v_has_parent_email;

  IF NOT p_skip_parent_details AND v_has_parent_details THEN
    IF v_has_parent_email THEN
      SELECT id INTO v_existing_parent_id
      FROM parents
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_parent_email))
      LIMIT 1;
    ELSIF v_has_parent_phone THEN
      SELECT id INTO v_existing_parent_id
      FROM parents
      WHERE phone = TRIM(p_parent_phone)
      LIMIT 1;

      IF v_existing_parent_id IS NOT NULL AND v_has_parent_name THEN
        SELECT first_name, last_name INTO v_found_parent_first_name, v_found_parent_last_name
        FROM parents
        WHERE id = v_existing_parent_id;

        IF (p_parent_first_name IS NOT NULL AND TRIM(p_parent_first_name) != '' AND
            v_found_parent_first_name IS NOT NULL AND
            LOWER(TRIM(v_found_parent_first_name)) != LOWER(TRIM(p_parent_first_name))) OR
           (p_parent_last_name IS NOT NULL AND TRIM(p_parent_last_name) != '' AND
            v_found_parent_last_name IS NOT NULL AND
            LOWER(TRIM(v_found_parent_last_name)) != LOWER(TRIM(p_parent_last_name))) THEN
          v_existing_parent_id := NULL;
        END IF;
      END IF;
    END IF;

    IF v_existing_parent_id IS NOT NULL THEN
      v_parent_id := v_existing_parent_id;
    ELSE
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

  IF v_parent_id IS NOT NULL THEN
    INSERT INTO parents_students (parent_id, student_id)
    VALUES (v_parent_id, v_student_id)
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END IF;

  IF p_subject_ids IS NOT NULL AND array_length(p_subject_ids, 1) > 0 THEN
    FOREACH v_subject_id IN ARRAY p_subject_ids
    LOOP
      INSERT INTO students_subjects (student_id, subject_id, created_by)
      VALUES (v_student_id, v_subject_id, v_created_by_staff_id)
      ON CONFLICT (student_id, subject_id) DO NOTHING;
    END LOOP;
  END IF;

  IF p_staff_id IS NOT NULL THEN
    v_assigned_staff_id := p_staff_id;
  ELSE
    BEGIN
      SELECT available_staff_ids INTO v_available_staff_ids
      FROM get_available_slots(
        (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
        (p_start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
        'TRIAL_SESSION'::public.session_type,
        NULL,
        EXTRACT(EPOCH FROM (p_end_at - p_start_at))::INTEGER / 60
      )
      WHERE start_at = p_start_at AND end_at = p_end_at
      LIMIT 1;

      IF v_available_staff_ids IS NOT NULL AND array_length(v_available_staff_ids, 1) > 0 THEN
        v_assigned_staff_id := assign_staff_to_booking(
          'TRIAL_SESSION'::public.session_type,
          p_start_at,
          p_end_at,
          v_available_staff_ids,
          NULL
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_assigned_staff_id := NULL;
    END;
  END IF;

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
    NULL,
    p_start_at,
    p_end_at,
    'ACTIVE'
  )
  RETURNING id INTO v_session_id;

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

  IF v_parent_id IS NOT NULL THEN
    INSERT INTO sessions_parents (session_id, parent_id, created_by)
    VALUES (v_session_id, v_parent_id, v_created_by_staff_id)
    ON CONFLICT (session_id, parent_id) DO NOTHING;
  END IF;

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

  v_result := jsonb_build_object(
    'session_id', v_session_id,
    'student_id', v_student_id,
    'staff_assigned', v_assigned_staff_id IS NOT NULL,
    'parent_linked', v_parent_id IS NOT NULL
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_admin_trial_booking IS
  'Creates an admin trial booking. The caller must be active AdminStaff and p_created_by must be that caller.';

GRANT EXECUTE ON FUNCTION public.create_admin_trial_booking TO authenticated;
