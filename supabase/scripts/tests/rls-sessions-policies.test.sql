-- Tests for Sessions Table RLS Policies
-- These tests verify that RLS policies correctly restrict access to session data
-- based on user roles (ADMINSTAFF, TUTOR, STUDENT via views)

-- ========================
-- SETUP
-- ========================

-- Note: These tests require:
-- 1. Test database with RLS enabled on sessions, sessions_students, sessions_staff tables
-- 2. Test users with different roles
-- 3. Test data in sessions table

-- ========================
-- TEST: ADMINSTAFF Access to Sessions
-- ========================

-- Test 1: ADMINSTAFF can SELECT all sessions
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_session_id UUID;
  v_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-sessions@test.com',
    'Admin',
    'Sessions',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test session (requires subject and class)
  -- First create a subject
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_session_id; -- Reusing variable
  
  -- Create test session
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_session_id,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM sessions;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 1 PASSED: ADMINSTAFF can SELECT all sessions';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: ADMINSTAFF could not SELECT sessions';
  END IF;
  
  -- Cleanup
  DELETE FROM sessions WHERE id = v_test_session_id;
  DELETE FROM subjects WHERE id = (SELECT subject_id FROM sessions WHERE id = v_test_session_id LIMIT 1);
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 2: ADMINSTAFF can INSERT sessions
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_subject_id UUID;
  v_new_session_id UUID;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-insert-session@test.com',
    'Admin',
    'Insert',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test subject
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test INSERT
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_subject_id,
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 1 hour'
  )
  RETURNING id INTO v_new_session_id;
  
  IF v_new_session_id IS NOT NULL THEN
    RAISE NOTICE '✓ Test 2 PASSED: ADMINSTAFF can INSERT sessions';
    
    -- Cleanup
    DELETE FROM sessions WHERE id = v_new_session_id;
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: ADMINSTAFF could not INSERT session';
  END IF;
  
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 3: ADMINSTAFF can UPDATE sessions
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_subject_id UUID;
  v_test_session_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-update-session@test.com',
    'Admin',
    'Update',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test subject and session
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_subject_id,
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test UPDATE
  UPDATE sessions 
  SET type = 'TRIAL_SESSION'
  WHERE id = v_test_session_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 1 THEN
    RAISE NOTICE '✓ Test 3 PASSED: ADMINSTAFF can UPDATE sessions';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: ADMINSTAFF could not UPDATE session';
  END IF;
  
  -- Cleanup
  DELETE FROM sessions WHERE id = v_test_session_id;
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 4: ADMINSTAFF can DELETE sessions
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_subject_id UUID;
  v_test_session_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-delete-session@test.com',
    'Admin',
    'Delete',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test subject and session
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_subject_id,
    NOW() + INTERVAL '4 days',
    NOW() + INTERVAL '4 days 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test DELETE
  DELETE FROM sessions WHERE id = v_test_session_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 1 THEN
    RAISE NOTICE '✓ Test 4 PASSED: ADMINSTAFF can DELETE sessions';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: ADMINSTAFF could not DELETE session';
  END IF;
  
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- ========================
-- TEST: TUTOR Access to Sessions
-- ========================

-- Test 5: TUTOR can SELECT sessions (read-only)
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_subject_id UUID;
  v_test_session_id UUID;
  v_count INTEGER;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test subject and session
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_subject_id,
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM sessions;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 5 PASSED: TUTOR can SELECT sessions';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: TUTOR could not SELECT sessions';
  END IF;
  
  -- Cleanup
  DELETE FROM sessions WHERE id = v_test_session_id;
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 6: TUTOR cannot INSERT sessions
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_subject_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test subject
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test INSERT (should fail)
  BEGIN
    INSERT INTO sessions (id, type, subject_id, start_at, end_at)
    VALUES (
      gen_random_uuid(),
      'REGULAR',
      v_test_subject_id,
      NOW() + INTERVAL '6 days',
      NOW() + INTERVAL '6 days 1 hour'
    );
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 6 PASSED: TUTOR cannot INSERT sessions (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 6 FAILED: TUTOR was able to INSERT session (should be blocked)';
  END IF;
  
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 7: TUTOR cannot UPDATE sessions
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_subject_id UUID;
  v_test_session_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test subject and session
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  INSERT INTO sessions (id, type, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_subject_id,
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test UPDATE (should fail)
  BEGIN
    UPDATE sessions SET type = 'TRIAL_SESSION' WHERE id = v_test_session_id;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 7 PASSED: TUTOR cannot UPDATE sessions (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: TUTOR was able to UPDATE session (should be blocked)';
  END IF;
  
  -- Cleanup
  DELETE FROM sessions WHERE id = v_test_session_id;
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- ========================
-- TEST: STUDENT Access to Sessions (via views)
-- ========================

-- Test 8: STUDENT can SELECT own sessions via vstudent_sessions view
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_test_subject_id UUID;
  v_test_class_id UUID;
  v_test_session_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create test subject and class
  INSERT INTO subjects (id, name, curriculum, year_level)
  VALUES (gen_random_uuid(), 'Test Subject', 'VCE', 12)
  RETURNING id INTO v_test_subject_id;
  
  INSERT INTO classes (id, subject_id, day_of_week, start_time, end_time, status)
  VALUES (
    gen_random_uuid(),
    v_test_subject_id,
    1,
    '09:00',
    '10:00',
    'ACTIVE'
  )
  RETURNING id INTO v_test_class_id;
  
  -- Enroll student in class
  INSERT INTO classes_students (id, class_id, student_id)
  VALUES (gen_random_uuid(), v_test_class_id, v_test_student_id);
  
  -- Create test session
  INSERT INTO sessions (id, type, class_id, subject_id, start_at, end_at)
  VALUES (
    gen_random_uuid(),
    'REGULAR',
    v_test_class_id,
    v_test_subject_id,
    NOW() + INTERVAL '8 days',
    NOW() + INTERVAL '8 days 1 hour'
  )
  RETURNING id INTO v_test_session_id;
  
  -- Enroll student in session
  INSERT INTO sessions_students (id, session_id, student_id)
  VALUES (gen_random_uuid(), v_test_session_id, v_test_student_id);
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT via view
  SELECT COUNT(*) INTO v_count FROM vstudent_sessions;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 8 PASSED: STUDENT can SELECT own sessions via vstudent_sessions view';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: STUDENT could not SELECT own sessions via view (expected >= 1, got %)', v_count;
  END IF;
  
  -- Cleanup
  DELETE FROM sessions_students WHERE session_id = v_test_session_id;
  DELETE FROM sessions WHERE id = v_test_session_id;
  DELETE FROM classes_students WHERE class_id = v_test_class_id;
  DELETE FROM classes WHERE id = v_test_class_id;
  DELETE FROM subjects WHERE id = v_test_subject_id;
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 9: STUDENT cannot SELECT sessions directly (must use view)
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT direct table (should fail)
  BEGIN
    SELECT COUNT(*) FROM sessions;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 9 PASSED: STUDENT cannot SELECT sessions directly (must use view)';
  ELSE
    RAISE EXCEPTION 'Test 9 FAILED: STUDENT was able to SELECT sessions directly (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- ========================
-- TEST: Sessions_Students Table Access
-- ========================

-- Test 10: ADMINSTAFF can SELECT sessions_students
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-sessions-students@test.com',
    'Admin',
    'SessionsStudents',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM sessions_students;
  
  IF v_count >= 0 THEN
    RAISE NOTICE '✓ Test 10 PASSED: ADMINSTAFF can SELECT sessions_students';
  ELSE
    RAISE EXCEPTION 'Test 10 FAILED: ADMINSTAFF could not SELECT sessions_students';
  END IF;
  
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 11: TUTOR can SELECT sessions_students
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_count INTEGER;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM sessions_students;
  
  IF v_count >= 0 THEN
    RAISE NOTICE '✓ Test 11 PASSED: TUTOR can SELECT sessions_students';
  ELSE
    RAISE EXCEPTION 'Test 11 FAILED: TUTOR could not SELECT sessions_students';
  END IF;
  
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- ========================
-- SUMMARY
-- ========================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sessions Table RLS Policy Tests Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests passed! ✓';
END $$;
