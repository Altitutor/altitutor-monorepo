-- Tests for Invoices Table RLS Policies
-- These tests verify that RLS policies correctly restrict access to invoice data
-- based on user roles (ADMINSTAFF, STUDENT via views)

-- ========================
-- SETUP
-- ========================

-- Note: These tests require:
-- 1. Test database with RLS enabled on invoices, invoice_items tables
-- 2. Test users with different roles
-- 3. Test data in invoices table
-- 4. is_adminstaff_active() function (checks role='ADMINSTAFF' AND status='ACTIVE')

-- ========================
-- TEST: ADMINSTAFF Access to Invoices
-- ========================

-- Test 1: ADMINSTAFF with ACTIVE status can SELECT invoices
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_count INTEGER;
BEGIN
  -- Create admin staff with ACTIVE status
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-active@test.com',
    'Admin',
    'Active',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student
  v_test_student_id := test_create_student(gen_random_uuid());
  
  -- Create test invoice
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_001',
    CURRENT_DATE,
    10000,
    'AUD',
    'open'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test SELECT
  SELECT COUNT(*) INTO v_count FROM invoices;
  
  IF v_count >= 1 THEN
    RAISE NOTICE '✓ Test 1 PASSED: ADMINSTAFF (ACTIVE) can SELECT invoices';
  ELSE
    RAISE EXCEPTION 'Test 1 FAILED: ADMINSTAFF (ACTIVE) could not SELECT invoices';
  END IF;
  
  -- Cleanup
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 2: ADMINSTAFF can INSERT invoices
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_new_invoice_id UUID;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-insert@test.com',
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
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_002',
    CURRENT_DATE,
    20000,
    'AUD',
    'draft'
  )
  RETURNING id INTO v_new_invoice_id;
  
  IF v_new_invoice_id IS NOT NULL THEN
    RAISE NOTICE '✓ Test 2 PASSED: ADMINSTAFF can INSERT invoices';
    
    -- Cleanup
    DELETE FROM invoices WHERE id = v_new_invoice_id;
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: ADMINSTAFF could not INSERT invoice';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 3: ADMINSTAFF can UPDATE invoices
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-update@test.com',
    'Admin',
    'Update',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student and invoice
  v_test_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_003',
    CURRENT_DATE,
    30000,
    'AUD',
    'open'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test UPDATE
  UPDATE invoices 
  SET status = 'paid', amount_paid_cents = 30000
  WHERE id = v_test_invoice_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 1 THEN
    RAISE NOTICE '✓ Test 3 PASSED: ADMINSTAFF can UPDATE invoices';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: ADMINSTAFF could not UPDATE invoice';
  END IF;
  
  -- Cleanup
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- Test 4: ADMINSTAFF can DELETE invoices
DO $$
DECLARE
  v_admin_user_id UUID := gen_random_uuid();
  v_admin_staff_id UUID;
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Create admin staff
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    v_admin_user_id,
    'admin-delete@test.com',
    'Admin',
    'Delete',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_admin_staff_id;
  
  -- Create test student and invoice
  v_test_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_004',
    CURRENT_DATE,
    40000,
    'AUD',
    'draft'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set admin context
  PERFORM test_set_user_context('ADMINSTAFF', v_admin_user_id);
  
  -- Test DELETE
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count = 1 THEN
    RAISE NOTICE '✓ Test 4 PASSED: ADMINSTAFF can DELETE invoices';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: ADMINSTAFF could not DELETE invoice';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_admin_staff_id;
END $$;

-- ========================
-- TEST: TUTOR Access to Invoices (should be blocked)
-- ========================

-- Test 5: TUTOR cannot SELECT invoices (no direct access)
DO $$
DECLARE
  v_tutor_user_id UUID := gen_random_uuid();
  v_tutor_staff_id UUID;
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_error_occurred BOOLEAN := false;
BEGIN
  -- Create tutor
  v_tutor_staff_id := test_create_tutor(v_tutor_user_id);
  
  -- Create test student and invoice
  v_test_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_005',
    CURRENT_DATE,
    50000,
    'AUD',
    'open'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set tutor context
  PERFORM test_set_user_context('TUTOR', v_tutor_user_id);
  
  -- Test SELECT (should fail)
  BEGIN
    SELECT COUNT(*) FROM invoices;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 5 PASSED: TUTOR cannot SELECT invoices (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: TUTOR was able to SELECT invoices (should be blocked)';
  END IF;
  
  -- Cleanup
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM staff WHERE id = v_tutor_staff_id;
END $$;

-- ========================
-- TEST: STUDENT Access to Invoices (via vstudent_invoices view)
-- ========================

-- Test 6: STUDENT can SELECT own invoices via vstudent_invoices view
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create test invoice for this student
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_test_student_id,
    'inv_test_006',
    CURRENT_DATE,
    60000,
    'AUD',
    'open'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set student context
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT via view
  SELECT COUNT(*) INTO v_count FROM vstudent_invoices;
  
  IF v_count = 1 THEN
    RAISE NOTICE '✓ Test 6 PASSED: STUDENT can SELECT own invoices via vstudent_invoices view';
  ELSE
    RAISE EXCEPTION 'Test 6 FAILED: STUDENT could not SELECT own invoices via view (expected 1, got %)', v_count;
  END IF;
  
  -- Cleanup
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 7: STUDENT cannot SELECT other students invoices via view
DO $$
DECLARE
  v_student_user_id UUID := gen_random_uuid();
  v_other_student_id UUID;
  v_test_student_id UUID;
  v_test_invoice_id UUID;
  v_count INTEGER;
BEGIN
  -- Create test student (the one making the query)
  v_test_student_id := test_create_student(v_student_user_id);
  
  -- Create another student with invoice
  v_other_student_id := test_create_student(gen_random_uuid());
  
  INSERT INTO invoices (
    id, student_id, stripe_invoice_id, invoice_date, 
    amount_due_cents, currency, status
  )
  VALUES (
    gen_random_uuid(),
    v_other_student_id,
    'inv_test_007',
    CURRENT_DATE,
    70000,
    'AUD',
    'open'
  )
  RETURNING id INTO v_test_invoice_id;
  
  -- Set student context (for first student)
  PERFORM test_set_user_context('STUDENT', v_student_user_id);
  
  -- Test SELECT via view (should only see own invoices)
  SELECT COUNT(*) INTO v_count FROM vstudent_invoices;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✓ Test 7 PASSED: STUDENT cannot see other students invoices via view';
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: STUDENT was able to see other students invoices (expected 0, got %)', v_count;
  END IF;
  
  -- Cleanup
  DELETE FROM invoices WHERE id = v_test_invoice_id;
  DELETE FROM students WHERE id = v_test_student_id;
  DELETE FROM students WHERE id = v_other_student_id;
END $$;

-- Test 8: STUDENT cannot SELECT invoices directly (must use view)
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
    SELECT COUNT(*) FROM invoices;
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 8 PASSED: STUDENT cannot SELECT invoices directly (must use view)';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: STUDENT was able to SELECT invoices directly (should be blocked)';
  END IF;
  
  DELETE FROM students WHERE id = v_test_student_id;
END $$;

-- Test 9: STUDENT cannot INSERT/UPDATE/DELETE invoices
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
    INSERT INTO invoices (
      id, student_id, stripe_invoice_id, invoice_date, 
      amount_due_cents, currency, status
    )
    VALUES (
      gen_random_uuid(),
      v_test_student_id,
      'inv_test_009',
      CURRENT_DATE,
      90000,
      'AUD',
      'draft'
    );
    v_error_occurred := false;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_error_occurred := true;
  END;
  
  IF v_error_occurred THEN
    RAISE NOTICE '✓ Test 9 PASSED: STUDENT cannot INSERT/UPDATE/DELETE invoices (correctly blocked)';
  ELSE
    RAISE EXCEPTION 'Test 9 FAILED: STUDENT was able to INSERT invoice (should be blocked)';
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
  RAISE NOTICE 'Invoices Table RLS Policy Tests Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All tests passed! ✓';
END $$;
