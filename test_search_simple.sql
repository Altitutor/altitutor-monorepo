-- Simple test script for search functions
SET ROLE authenticated;
SET request.jwt.claims = '{"role": "authenticated", "user_role": "ADMINSTAFF"}'::jsonb;

-- Test 1: Student search exact match
SELECT 'Test 1: Student exact match "John"' as test;
SELECT jsonb_pretty(search_students_admin('John', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 5, 0));

-- Test 2: Student search fuzzy match
SELECT 'Test 2: Student fuzzy match "Jhon" (typo)' as test;
SELECT jsonb_pretty(search_students_admin('Jhon', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 5, 0));

-- Test 3: Staff search exact match
SELECT 'Test 3: Staff exact match "Jane"' as test;
SELECT jsonb_pretty(search_staff_admin('Jane', ARRAY['ACTIVE']::TEXT[], false, 5, 0));

-- Test 4: Staff search fuzzy match
SELECT 'Test 4: Staff fuzzy match "Jne" (typo)' as test;
SELECT jsonb_pretty(search_staff_admin('Jne', ARRAY['ACTIVE']::TEXT[], false, 5, 0));

-- Test 5: Session search exact match
SELECT 'Test 5: Session exact match "John"' as test;
SELECT jsonb_pretty(search_sessions_admin('John', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 3, 0));

-- Test 6: Session search fuzzy match
SELECT 'Test 6: Session fuzzy match "Jhon" (typo)' as test;
SELECT jsonb_pretty(search_sessions_admin('Jhon', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 3, 0));

-- Test 7: Verify fuzzy pattern function
SELECT 'Test 7: Fuzzy pattern generation' as test;
SELECT build_fuzzy_like('john') as pattern1, build_fuzzy_like('J.O.H.N') as pattern2;

-- Test 8: Count results
SELECT 'Test 8: Result counts' as test;
SELECT 
  'Exact "John"' as search_type,
  (search_students_admin('John', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0)->>'total')::int as count
UNION ALL
SELECT 
  'Fuzzy "Jhon"' as search_type,
  (search_students_admin('Jhon', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0)->>'total')::int as count;

