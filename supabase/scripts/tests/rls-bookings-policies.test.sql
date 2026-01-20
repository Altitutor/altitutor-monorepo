-- Tests for Bookings (slot_reservations) Table RLS Policies
-- These tests verify that RLS policies correctly restrict access to booking data
-- based on user roles (ADMINSTAFF, authenticated users for own reservations)

-- ========================
-- SETUP
-- ========================

-- Note: These tests require:
-- 1. Test database with RLS enabled on slot_reservations table
-- 2. Test users with different roles
-- 3. Test data in slot_reservations table

-- ========================
-- TEST: ADMINSTAFF Access to slot_reservations
-- ========================

-- Test 1: ADMINSTAFF can SELECT all slot_reservations
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-bookings@test.com',
    'Admin',
    'Bookings',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Create test reservation (requires student user_id)
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    (SELECT user_id FROM students WHERE id = v_test_student_id),
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM slot_reservations;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 1 PASSED: ADMINSTAFF can SELECT all slot_reservations';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: ADMINSTAFF could not SELECT slot_reservations';
  END IF;
  
  -- Cleanup
  DELETE FROM slot_reservations WHERE id = v_test_reservation_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 2: ADMINSTAFF can INSERT slot_reservations
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_new_reservation_id UUID;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-insert-booking@test.com',
    'Admin',
    'Insert',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test INSERT
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    (SELECT user_id FROM students WHERE id = v_test_student_id),
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_new_reservation_id;
  
  IF v_new_reservation_id IS NOT NULL THEN
    RAISE NOTICE '✓ Test 2 PASSED: ADMINSTAFF can INSERT slot_reservations';
    
    -- Cleanup
    DELETE FROM slot_reservations WHERE id = v_new_reservation_id;
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: ADMINSTAFF could not INSERT slot_reservation';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 3: ADMINSTAFF can UPDATE slot_reservations
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-update-booking@test.com',
    'Admin',
    'Update',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student and reservation
  v_test_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    (SELECT user_id FROM students WHERE id = v_test_student_id),
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test UPDATE
  UPDATE slot_reservations 
  SET status = 'CONFIRMED'
  WHERE id = v_test_reservation_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 1 THEN
    RAISE NOTICE '✓ Test 3 PASSED: ADMINSTAFF can UPDATE slot_reservations';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: ADMINSTAFF could not UPDATE slot_reservation';
  END IF;
  
  -- Cleanup
  DELETE FROM slot_reservations WHERE id = v_test_reservation_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 4: ADMINSTAFF can DELETE slot_reservations
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-delete-booking@test.com',
    'Admin',
    'Delete',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student and reservation
  v_test_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    (SELECT user_id FROM students WHERE id = v_test_student_id),
    NOW() + INTERVAL '4 days',
    NOW() + INTERVAL '4 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test DELETE
  DELETE FROM slot_reservations WHERE id = v_test_reservation_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 1 THEN
    RAISE NOTICE '✓ Test 4 PASSED: ADMINSTAFF can DELETE slot_reservations';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: ADMINSTAFF could not DELETE slot_reservation';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- ========================
-- TEST: Authenticated User Access to Own Reservations
-- ========================

-- Test 5: STUDENT can SELECT own reservations
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create test reservation for this student
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    v_student_user_id,
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT own reservations
  SELECT COUNT(*) INTO v_count 
  FROM slot_reservations 
  WHERE reserved_by = v_student_user_id;
  
  IF v_count = 1 THEN
    RAISE NOTICE '✓ Test 5 PASSED: STUDENT can SELECT own reservations';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: STUDENT could not SELECT own reservations (expected 1, got %)', v_count;
  END IF;
  
  -- Cleanup
  DELETE FROM slot_reservations WHERE id = v_test_reservation_id;
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 6: STUDENT cannot SELECT other users reservations
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_other_student_id UUID;
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student (the one making the query)
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create another student with reservation
  v_other_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    (SELECT user_id FROM students WHERE id = v_other_student_id),
    NOW() + INTERVAL '6 days',
    NOW() + INTERVAL '6 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set student context (for first student)
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT other user's reservation (should return 0)
  SELECT COUNT(*) INTO v_count 
  FROM slot_reservations 
  WHERE id = v_test_reservation_id;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✓ Test 6 PASSED: STUDENT cannot SELECT other users reservations';
  ELSE
    RAISE EXCEPTION 'Test 6 FAILED: STUDENT was able to SELECT other users reservation (expected 0, got %)', v_count;
  END IF;
  
  -- Cleanup
  DELETE FROM slot_reservations WHERE id = v_test_reservation_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM students WHERE id = v_other_student_id;
END $$;

-- Test 7: STUDENT can INSERT own reservations
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_new_reservation_id UUID;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test INSERT own reservation
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    v_student_user_id,
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_new_reservation_id;
  
  IF v_new_reservation_id IS NOT NULL THEN
    RAISE NOTICE '✓ Test 7 PASSED: STUDENT can INSERT own reservations';
    
    -- Cleanup
    DELETE FROM slot_reservations WHERE id = v_new_reservation_id;
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: STUDENT could not INSERT own reservation';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 8: STUDENT cannot INSERT reservations for other users
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_other_student_id UUID;
  v_test_student_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create another student
  v_other_student_id := test_create_student(gen_random_uuid());
  
  -- Set student context (for first student)
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test INSERT for other user (should fail)
  BEGIN
    INSERT INTO slot_reservations (
      id, reserved_by, start_time, end_time, status
    )
    VALUES (
      gen_random_uuid(),
      (SELECT user_id FROM students WHERE id = v_other_student_id),
      NOW() + INTERVAL '8 days',
      NOW() + INTERVAL '8 days 1 hour',
      'PENDING'
    );
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 8 PASSED: STUDENT cannot INSERT reservations for other users (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: STUDENT was able to INSERT reservation for other user (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM students WHERE id = v_other_student_id;
END $$;

-- Test 9: STUDENT can DELETE own reservations
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_test_reservation_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create test reservation
  INSERT INTO slot_reservations (
    id, reserved_by, start_time, end_time, status
  )
  VALUES (
    gen_random_uuid(),
    v_student_user_id,
    NOW() + INTERVAL '9 days',
    NOW() + INTERVAL '9 days 1 hour',
    'PENDING'
  )
  RETURNING id INTO v_test_reservation_id;
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test DELETE own reservation
  DELETE FROM slot_reservations 
  WHERE id = v_test_reservation_id 
    AND reserved_by = v_student_user_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 1 THEN
    RAISE NOTICE '✓ Test 9 PASSED: STUDENT can DELETE own reservations';
  ELSE
    RAISE EXCEPTION 'Test 9 FAILED: STUDENT could not DELETE own reservation';
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
  RAISE NOTICE 'Bookings (slot_reservations) RLS Policy Tests Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests passed! ✓';
END $$;
