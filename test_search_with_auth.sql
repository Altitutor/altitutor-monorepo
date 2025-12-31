-- Test search functions with proper authentication setup
-- First, let's create a test admin user and authenticate

-- Step 1: Create a test admin user in auth.users
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Check if test user already exists
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test-admin@test.com';
  
  IF test_user_id IS NULL THEN
    -- Create test user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test-admin@test.com',
      crypt('test-password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '',
      ''
    ) RETURNING id INTO test_user_id;
  END IF;
  
  -- Ensure there's a staff record for this user
  IF NOT EXISTS (SELECT 1 FROM staff WHERE user_id = test_user_id) THEN
    INSERT INTO staff (user_id, first_name, last_name, role, status, email)
    VALUES (test_user_id, 'Test', 'Admin', 'ADMINSTAFF', 'ACTIVE', 'test-admin@test.com');
  ELSE
    -- Update existing staff to be ADMINSTAFF and ACTIVE
    UPDATE staff 
    SET role = 'ADMINSTAFF', status = 'ACTIVE'
    WHERE user_id = test_user_id;
  END IF;
  
  -- Set the auth context for this session
  PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
END $$;

-- Now set auth.uid() to return our test user
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'test-admin@test.com';
  -- Use a workaround: create a function that returns our test user ID
  -- Actually, let's just test the functions directly by temporarily modifying the security check
END $$;

-- Alternative: Test functions by directly calling them with SECURITY DEFINER
-- Since they're SECURITY DEFINER, they run with the privileges of the function owner
-- Let's test if we can call them directly

-- Test 1: Student search - exact match
SELECT '=== Test 1: Student exact match "Alice" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count
FROM (
  SELECT search_students_admin('Alice', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Actually, let's check if we can bypass by testing the function logic directly
-- Let's see what data exists and test the search logic manually first



