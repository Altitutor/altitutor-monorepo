-- Tests for Students Table RLS Policies
-- These tests verify that RLS policies correctly restrict access to student data
-- based on user roles (ADMINSTAFF, TUTOR, STUDENT)

-- ========================
-- SETUP
-- ========================

-- Note: These tests require:
-- 1. Test database with RLS enabled on students table
-- 2. Test users with different roles
-- 3. Test data in students table

-- ========================
-- TEST: ADMINSTAFF Access to Students
-- ========================

-- Test 1: ADMINSTAFF can SELECT all students
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_count INTEGER;
BEGIN
  -- Create admin staff
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM students;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 1 PASSED: ADMINSTAFF can SELECT all students';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: ADMINSTAFF could not SELECT students';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 2: ADMINSTAFF can INSERT students
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_new_student_id UUID;
BEGIN
  -- Create admin staff
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test INSERT
  INSERT INTO students (id, user_id, email, first_name, last_name)
  VALUES (gen_random_uuid(), gen_random_uuid(), 'new-student@test.com', 'New', 'Student')
  RETURNING id INTO v_new_student_id;
  
  IF v_new_student_id IS NOT NULL THEN
    RAISE NOTICE '✓ Test 2 PASSED: ADMINSTAFF can INSERT students';
    
    -- Cleanup
    DELETE FROM students WHERE id = v_new_student_id;
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: ADMINSTAFF could not INSERT student';
  END IF;
  
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 3: ADMINSTAFF can UPDATE students
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Create admin staff
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test UPDATE
  UPDATE students 
  SET first_name = 'Updated'
  WHERE id = v_test_student_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 1 THEN
    RAISE NOTICE '✓ Test 3 PASSED: ADMINSTAFF can UPDATE students';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: ADMINSTAFF could not UPDATE student';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 4: ADMINSTAFF can DELETE students
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Create admin staff
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test DELETE
  DELETE FROM students WHERE id = v_test_student_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 1 THEN
    RAISE NOTICE '✓ Test 4 PASSED: ADMINSTAFF can DELETE students';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: ADMINSTAFF could not DELETE student';
  END IF;
  
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- ========================
-- TEST: TUTOR Access to Students
-- ========================

-- Test 5: TUTOR can SELECT students (read-only access)
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_student_id UUID;
  v_count INTEGER;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM students;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 5 PASSED: TUTOR can SELECT students';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: TUTOR could not SELECT students';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 6: TUTOR cannot INSERT students
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test INSERT (should fail)
  BEGIN
    INSERT INTO students (id, user_id, email, first_name, last_name)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'tutor-insert@test.com', 'Tutor', 'Insert');
    
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 6 PASSED: TUTOR cannot INSERT students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 6 FAILED: TUTOR was able to INSERT student (should be blocked)';
  END IF;
  
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 7: TUTOR cannot UPDATE students
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_student_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test UPDATE (should fail)
  BEGIN
    UPDATE students SET first_name = 'Updated' WHERE id = v_test_student_id;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 7 PASSED: TUTOR cannot UPDATE students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: TUTOR was able to UPDATE student (should be blocked)';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 8: TUTOR cannot DELETE students
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_student_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test student (with status)
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test DELETE (should fail)
  BEGIN
    DELETE FROM students WHERE id = v_test_student_id;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 8 PASSED: TUTOR cannot DELETE students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: TUTOR was able to DELETE student (should be blocked)';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- ========================
-- TEST: STUDENT Access to Students
-- ========================

-- Test 9: STUDENT can SELECT own student record
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT own record
  SELECT COUNT(*) INTO v_count 
  FROM students 
  WHERE id = v_test_student_id;
  
  IF v_count = 1 THEN
    RAISE NOTICE '✓ Test 9 PASSED: STUDENT can SELECT own student record';
  ELSE
    RAISE EXCEPTION 'Test 9 FAILED: STUDENT could not SELECT own record';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 10: STUDENT cannot SELECT other students' records
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_other_student_id UUID;
  v_test_student_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student (the one making the query)
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create another student (should not be accessible)
  v_other_student_id := test_create_student(gen_random_uuid());
  
  -- Set student context (for first student)
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT other student's record (should return 0)
  SELECT COUNT(*) INTO v_count 
  FROM students 
  WHERE id = v_other_student_id;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✓ Test 10 PASSED: STUDENT cannot SELECT other students records';
  ELSE
    RAISE EXCEPTION 'Test 10 FAILED: STUDENT was able to SELECT other student record (should be blocked)';
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM students WHERE id = v_other_student_id;
END $$;

-- Test 11: STUDENT cannot INSERT students
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
  
  -- Test INSERT (should fail)
  BEGIN
    INSERT INTO students (id, user_id, email, first_name, last_name)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'student-insert@test.com', 'Student', 'Insert');
    
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 11 PASSED: STUDENT cannot INSERT students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 11 FAILED: STUDENT was able to INSERT student (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 12: STUDENT cannot UPDATE students
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
  
  -- Test UPDATE (should fail)
  BEGIN
    UPDATE students SET first_name = 'Updated' WHERE id = v_test_student_id;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 12 PASSED: STUDENT cannot UPDATE students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 12 FAILED: STUDENT was able to UPDATE student (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 13: STUDENT cannot DELETE students
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
  
  -- Test DELETE (should fail)
  BEGIN
    DELETE FROM students WHERE id = v_test_student_id;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 13 PASSED: STUDENT cannot DELETE students (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 13 FAILED: STUDENT was able to DELETE student (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- ========================
-- SUMMARY
-- ========================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Students Table RLS Policy Tests Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests passed! ✓';
END $$;
