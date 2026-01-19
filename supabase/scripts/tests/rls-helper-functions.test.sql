-- Tests for RLS Helper Functions
-- These tests verify that RLS helper functions work correctly with different user contexts
-- Run these tests against a test database instance

-- ========================
-- SETUP
-- ========================

-- Note: These tests require:
-- 1. Test database with RLS helper functions installed
-- 2. Ability to set JWT claims (via test_set_role function)
-- 3. Test users in staff/students tables

-- ========================
-- TEST: user_role() function
-- ========================

-- Test 1: user_role() returns ADMINSTAFF when claim is set
DO $$
DECLARE
  v_result TEXT;
BEGIN
  PERFORM test_set_role('ADMINSTAFF');
  SELECT public.user_role() INTO v_result;
  
  IF v_result = 'ADMINSTAFF' THEN
    RAISE NOTICE '✓ Test 1 PASSED: user_role() returns ADMINSTAFF';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: Expected ADMINSTAFF, got %', v_result;
  END IF;
END $$;

-- Test 2: user_role() returns TUTOR when claim is set
DO $$
DECLARE
  v_result TEXT;
BEGIN
  PERFORM test_set_role('TUTOR');
  SELECT public.user_role() INTO v_result;
  
  IF v_result = 'TUTOR' THEN
    RAISE NOTICE '✓ Test 2 PASSED: user_role() returns TUTOR';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: Expected TUTOR, got %', v_result;
  END IF;
END $$;

-- Test 3: user_role() returns STUDENT when claim is set
DO $$
DECLARE
  v_result TEXT;
BEGIN
  PERFORM test_set_role('STUDENT');
  SELECT public.user_role() INTO v_result;
  
  IF v_result = 'STUDENT' THEN
    RAISE NOTICE '✓ Test 3 PASSED: user_role() returns STUDENT';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: Expected STUDENT, got %', v_result;
  END IF;
END $$;

-- Test 4: user_role() defaults to 'student' when no claim is set
DO $$
DECLARE
  v_result TEXT;
BEGIN
  -- Clear JWT claims (but don't reset role - that causes errors)
  PERFORM set_config('request.jwt.claims', '{}'::text, true);
  SELECT public.user_role() INTO v_result;
  
  IF v_result = 'student' THEN
    RAISE NOTICE '✓ Test 4 PASSED: user_role() defaults to student';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: Expected student, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: is_adminstaff() function
-- ========================

-- Test 5: is_adminstaff() returns true when ADMINSTAFF record exists
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Create test admin staff (creates auth user and staff record)
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test function (checks database, not just JWT)
  SELECT public.is_adminstaff() INTO v_result;
  
  IF v_result = true THEN
    RAISE NOTICE '✓ Test 5 PASSED: is_adminstaff() returns true when ADMINSTAFF record exists';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: Expected true, got %', v_result;
  END IF;
  
  -- Cleanup (skip auth.users - permission issues)
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 6: is_adminstaff() returns false for TUTOR role
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  PERFORM test_set_role('TUTOR');
  SELECT public.is_adminstaff() INTO v_result;
  
  IF v_result = false THEN
    RAISE NOTICE '✓ Test 6 PASSED: is_adminstaff() returns false for TUTOR';
  ELSE
    RAISE EXCEPTION 'Test 6 FAILED: Expected false, got %', v_result;
  END IF;
END $$;

-- Test 7: is_adminstaff() returns false for STUDENT role
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  PERFORM test_set_role('STUDENT');
  SELECT public.is_adminstaff() INTO v_result;
  
  IF v_result = false THEN
    RAISE NOTICE '✓ Test 7 PASSED: is_adminstaff() returns false for STUDENT';
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: Expected false, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: is_tutor() function
-- ========================

-- Test 8: is_tutor() returns true when TUTOR record exists
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Create test tutor (creates auth user and staff record)
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test function (checks database, not just JWT)
  SELECT public.is_tutor() INTO v_result;
  
  IF v_result = true THEN
    RAISE NOTICE '✓ Test 8 PASSED: is_tutor() returns true when TUTOR record exists';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: Expected true, got %', v_result;
  END IF;
  
  -- Cleanup (skip auth.users - permission issues)
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 9: is_tutor() returns false for ADMINSTAFF role
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  PERFORM test_set_role('ADMINSTAFF');
  SELECT public.is_tutor() INTO v_result;
  
  IF v_result = false THEN
    RAISE NOTICE '✓ Test 9 PASSED: is_tutor() returns false for ADMINSTAFF';
  ELSE
    RAISE EXCEPTION 'Test 9 FAILED: Expected false, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: is_student() function
-- ========================

-- Test 10: is_student() returns true when student record exists
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Create test student (creates auth user and student record)
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test function (checks database, not just JWT)
  SELECT public.is_student() INTO v_result;
  
  IF v_result = true THEN
    RAISE NOTICE '✓ Test 10 PASSED: is_student() returns true when student record exists';
  ELSE
    RAISE EXCEPTION 'Test 10 FAILED: Expected true, got %', v_result;
  END IF;
  
  -- Cleanup (skip auth.users - permission issues when running as postgres)
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 11: is_student() returns false for ADMINSTAFF role
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  PERFORM test_set_role('ADMINSTAFF');
  SELECT public.is_student() INTO v_result;
  
  IF v_result = false THEN
    RAISE NOTICE '✓ Test 11 PASSED: is_student() returns false for ADMINSTAFF';
  ELSE
    RAISE EXCEPTION 'Test 11 FAILED: Expected false, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: is_staff() function
-- ========================

-- Test 12: is_staff() returns true when ADMINSTAFF record exists
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Create test admin staff (creates auth user and staff record)
  v_admin_staff_id := test_create_admin_staff(v_admin_user_id);
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test function (checks database, not just JWT)
  SELECT public.is_staff() INTO v_result;
  
  IF v_result = true THEN
    RAISE NOTICE '✓ Test 12 PASSED: is_staff() returns true when ADMINSTAFF record exists';
  ELSE
    RAISE EXCEPTION 'Test 12 FAILED: Expected true, got %', v_result;
  END IF;
  
  -- Cleanup (skip auth.users - permission issues when running as postgres)
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 13: is_staff() returns true when TUTOR record exists
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Create test tutor (creates auth user and staff record)
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test function (checks database, not just JWT)
  SELECT public.is_staff() INTO v_result;
  
  IF v_result = true THEN
    RAISE NOTICE '✓ Test 13 PASSED: is_staff() returns true when TUTOR record exists';
  ELSE
    RAISE EXCEPTION 'Test 13 FAILED: Expected true, got %', v_result;
  END IF;
  
  -- Cleanup (skip auth.users - permission issues when running as postgres)
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- Test 14: is_staff() returns false for STUDENT role
DO $$
DECLARE
  v_result BOOLEAN;
BEGIN
  PERFORM test_set_role('STUDENT');
  SELECT public.is_staff() INTO v_result;
  
  IF v_result = false THEN
    RAISE NOTICE '✓ Test 14 PASSED: is_staff() returns false for STUDENT';
  ELSE
    RAISE EXCEPTION 'Test 14 FAILED: Expected false, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: current_staff_id() function
-- ========================

-- Test 15: current_staff_id() returns correct ID when staff exists
DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_staff_id UUID;
  v_result UUID;
BEGIN
  -- Create test staff
  v_staff_id := test_create_admin_staff(v_test_user_id);
  
  -- Set user context
  PERFORM test_set_user_context('ADMINSTAFF', v_test_user_id);
  
  -- Test function
  SELECT public.current_staff_id() INTO v_result;
  
  IF v_result = v_staff_id THEN
    RAISE NOTICE '✓ Test 15 PASSED: current_staff_id() returns correct ID';
  ELSE
    RAISE EXCEPTION 'Test 15 FAILED: Expected %, got %', v_staff_id, v_result;
  END IF;
  
  -- Cleanup
  DELETE FROM staff WHERE id = v_staff_id;
END $$;

-- Test 16: current_staff_id() returns NULL when no staff exists
DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_result UUID;
BEGIN
  -- Set user context (but no staff record)
  PERFORM test_set_user_context('ADMINSTAFF', v_test_user_id);
  
  -- Test function
  SELECT public.current_staff_id() INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE NOTICE '✓ Test 16 PASSED: current_staff_id() returns NULL when no staff exists';
  ELSE
    RAISE EXCEPTION 'Test 16 FAILED: Expected NULL, got %', v_result;
  END IF;
END $$;

-- ========================
-- TEST: current_student_id() function
-- ========================

-- Test 17: current_student_id() returns correct ID when student exists
DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_student_id UUID;
  v_result UUID;
BEGIN
  -- Create test student
  v_student_id := test_create_student(v_test_user_id);
  
  -- Set user context
  PERFORM test_set_user_context('STUDENT', v_test_user_id);
  
  -- Test function
  SELECT public.current_student_id() INTO v_result;
  
  IF v_result = v_student_id THEN
    RAISE NOTICE '✓ Test 17 PASSED: current_student_id() returns correct ID';
  ELSE
    RAISE EXCEPTION 'Test 17 FAILED: Expected %, got %', v_student_id, v_result;
  END IF;
  
  -- Cleanup
  DELETE FROM students WHERE id = v_student_id;
END $$;

-- Test 18: current_student_id() returns NULL when no student exists
DO $$
DECLARE
  v_test_user_id UUID := gen_random_uuid();
  v_result UUID;
BEGIN
  -- Set user context (but no student record)
  PERFORM test_set_user_context('STUDENT', v_test_user_id);
  
  -- Test function
  SELECT public.current_student_id() INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE NOTICE '✓ Test 18 PASSED: current_student_id() returns NULL when no student exists';
  ELSE
    RAISE EXCEPTION 'Test 18 FAILED: Expected NULL, got %', v_result;
  END IF;
END $$;

-- ========================
-- SUMMARY
-- ========================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Helper Functions Tests Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests passed! ✓';
END $$;
