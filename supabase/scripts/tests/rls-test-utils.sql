-- RLS Test Utilities
-- Helper functions and setup for testing RLS policies
-- These utilities help create test contexts and verify RLS behavior

-- ========================
-- TEST SETUP FUNCTIONS
-- ========================

/**
 * Set JWT claims for testing (simulates user role)
 * Usage: SELECT set_test_role('ADMINSTAFF');
 */
CREATE OR REPLACE FUNCTION test_set_role(role_name TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('user_role', role_name)::text, true);
END;
$$ LANGUAGE plpgsql;

/**
 * Set auth.uid() for testing
 * Usage: SELECT set_test_user_id('uuid-here');
 */
CREATE OR REPLACE FUNCTION test_set_user_id(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', 
    json_build_object(
      'user_role', COALESCE(current_setting('request.jwt.claims', true)::json->>'user_role', 'STUDENT'),
      'sub', user_uuid::text
    )::text, 
    true
  );
END;
$$ LANGUAGE plpgsql;

/**
 * Set both role and user ID for testing
 * Usage: SELECT test_set_user_context('ADMINSTAFF', 'uuid-here');
 * Note: This sets JWT claims including 'sub' which auth.uid() reads from
 * Also switches to authenticated role to enforce RLS
 */
CREATE OR REPLACE FUNCTION test_set_user_context(role_name TEXT, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Switch to authenticated role to enforce RLS (postgres superuser bypasses RLS)
  PERFORM set_config('role', 'authenticated', true);
  
  -- Set JWT claims with both role and sub (user ID)
  -- auth.uid() reads from the 'sub' claim in the JWT
  PERFORM set_config('request.jwt.claims', 
    json_build_object(
      'user_role', role_name,
      'sub', user_uuid::text,
      'user_id', user_uuid::text  -- Some functions may check this too
    )::text, 
    true
  );
END;
$$ LANGUAGE plpgsql;

/**
 * Reset test context (clear JWT claims)
 * Note: Role reset is handled by switching back to postgres in test blocks
 */
CREATE OR REPLACE FUNCTION test_reset_context()
RETURNS VOID AS $$
BEGIN
  -- Clear JWT claims
  PERFORM set_config('request.jwt.claims', '{}'::text, true);
END;
$$ LANGUAGE plpgsql;

-- ========================
-- TEST ASSERTION FUNCTIONS
-- ========================

/**
 * Assert that a query succeeds (no RLS blocking)
 * Returns true if query executes without permission error
 */
CREATE OR REPLACE FUNCTION test_assert_access_allowed(
  test_query TEXT,
  OUT success BOOLEAN,
  OUT error_message TEXT
)
RETURNS RECORD AS $$
DECLARE
  v_error TEXT;
BEGIN
  BEGIN
    EXECUTE test_query;
    success := true;
    error_message := NULL;
  EXCEPTION
    WHEN insufficient_privilege THEN
      success := false;
      error_message := 'Permission denied';
    WHEN OTHERS THEN
      success := false;
      error_message := SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

/**
 * Assert that a query is blocked by RLS
 * Returns true if query fails with permission error
 */
CREATE OR REPLACE FUNCTION test_assert_access_denied(
  test_query TEXT,
  OUT success BOOLEAN,
  OUT error_message TEXT
)
RETURNS RECORD AS $$
DECLARE
  v_error TEXT;
BEGIN
  BEGIN
    EXECUTE test_query;
    success := false;
    error_message := 'Expected permission denied but query succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      success := true;
      error_message := NULL;
    WHEN OTHERS THEN
      success := false;
      error_message := SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- TEST DATA HELPERS
-- ========================

/**
 * Create a test admin staff user
 * Returns the created staff ID
 * Note: Creates minimal auth.users entry if it doesn't exist
 */
CREATE OR REPLACE FUNCTION test_create_admin_staff(
  test_user_id UUID DEFAULT gen_random_uuid(),
  test_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_staff_id UUID;
  v_unique_email TEXT;
BEGIN
  -- Always use unique email based on user_id to avoid conflicts
  v_unique_email := COALESCE(test_email, 'test-admin-' || replace(test_user_id::text, '-', '') || '@test.local');
  
  -- Create auth user if it doesn't exist (minimal entry for testing)
  -- Handle conflicts gracefully
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
    VALUES (
      test_user_id,
      v_unique_email,
      crypt('test-password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{}',
      '{}',
      false,
      'authenticated'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists (by id or email), that's fine - continue
      NULL;
  END;
  
  -- Create staff record
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    test_user_id,
    v_unique_email,
    'Test',
    'Admin',
    'ADMINSTAFF',
    'ACTIVE'
  )
  RETURNING id INTO v_staff_id;
  
  RETURN v_staff_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Create a test tutor user
 * Returns the created staff ID
 * Note: Creates minimal auth.users entry if it doesn't exist
 */
CREATE OR REPLACE FUNCTION test_create_tutor(
  test_user_id UUID DEFAULT gen_random_uuid(),
  test_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_staff_id UUID;
  v_unique_email TEXT;
BEGIN
  -- Always use unique email based on user_id to avoid conflicts
  v_unique_email := COALESCE(test_email, 'test-tutor-' || replace(test_user_id::text, '-', '') || '@test.local');
  
  -- Create auth user if it doesn't exist (minimal entry for testing)
  -- Handle conflicts gracefully
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
    VALUES (
      test_user_id,
      v_unique_email,
      crypt('test-password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{}',
      '{}',
      false,
      'authenticated'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists (by id or email), that's fine - continue
      NULL;
  END;
  
  INSERT INTO staff (id, user_id, email, first_name, last_name, role, status)
  VALUES (
    gen_random_uuid(),
    test_user_id,
    v_unique_email,
    'Test',
    'Tutor',
    'TUTOR',
    'ACTIVE'
  )
  RETURNING id INTO v_staff_id;
  
  RETURN v_staff_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Create a test student user
 * Returns the created student ID
 * Note: Creates minimal auth.users entry if it doesn't exist
 */
CREATE OR REPLACE FUNCTION test_create_student(
  test_user_id UUID DEFAULT gen_random_uuid(),
  test_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_student_id UUID;
  v_unique_email TEXT;
BEGIN
  -- Always use unique email based on user_id to avoid conflicts
  v_unique_email := COALESCE(test_email, 'test-student-' || replace(test_user_id::text, '-', '') || '@test.local');
  
  -- Create auth user if it doesn't exist (minimal entry for testing)
  -- Handle conflicts gracefully
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
    VALUES (
      test_user_id,
      v_unique_email,
      crypt('test-password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{}',
      '{}',
      false,
      'authenticated'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists (by id or email), that's fine - continue
      NULL;
  END;
  
  INSERT INTO students (id, user_id, email, first_name, last_name, status)
  VALUES (
    gen_random_uuid(),
    test_user_id,
    v_unique_email,
    'Test',
    'Student',
    'ACTIVE'  -- status is required (NOT NULL)
  )
  RETURNING id INTO v_student_id;
  
  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- CLEANUP FUNCTIONS
-- ========================

/**
 * Clean up test data (call in test teardown)
 */
CREATE OR REPLACE FUNCTION test_cleanup()
RETURNS VOID AS $$
BEGIN
  -- Reset context
  PERFORM test_reset_context();
  
  -- Note: In real tests, you'd delete test data here
  -- For safety, we'll leave cleanup to explicit test transactions
END;
$$ LANGUAGE plpgsql;
