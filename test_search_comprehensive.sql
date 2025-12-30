-- Comprehensive test using actual database data
-- Set up admin role
SET ROLE authenticated;

-- Test 1: Student search - exact match on first name
SELECT '=== Test 1: Student exact match "Alice" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'first_name') as first_result_name
FROM (
  SELECT search_students_admin('Alice', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 2: Student search - exact match on last name
SELECT '=== Test 2: Student exact match "Williams" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'last_name') as first_result_name
FROM (
  SELECT search_students_admin('Williams', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 3: Student search - fuzzy match (typo in first name)
SELECT '=== Test 3: Student fuzzy match "Alce" (typo for Alice) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'first_name') as first_result_name
FROM (
  SELECT search_students_admin('Alce', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 4: Student search - fuzzy match (spaced characters)
SELECT '=== Test 4: Student fuzzy match "A.L.I.C.E" (spaced) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'first_name') as first_result_name
FROM (
  SELECT search_students_admin('A.L.I.C.E', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 5: Student search - fuzzy match on last name
SELECT '=== Test 5: Student fuzzy match "Wlams" (typo for Williams) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'last_name') as first_result_name
FROM (
  SELECT search_students_admin('Wlams', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 6: Staff search - exact match on first name
SELECT '=== Test 6: Staff exact match "Jane" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as staff_count,
  (result->'staff'->0->>'first_name') as first_result_name
FROM (
  SELECT search_staff_admin('Jane', ARRAY['ACTIVE']::TEXT[], false, 10, 0) as result
) t;

-- Test 7: Staff search - exact match on last name
SELECT '=== Test 7: Staff exact match "Smith" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as staff_count,
  (result->'staff'->0->>'last_name') as first_result_name
FROM (
  SELECT search_staff_admin('Smith', ARRAY['ACTIVE']::TEXT[], false, 10, 0) as result
) t;

-- Test 8: Staff search - fuzzy match (typo)
SELECT '=== Test 8: Staff fuzzy match "Jne" (typo for Jane) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as staff_count,
  (result->'staff'->0->>'first_name') as first_result_name
FROM (
  SELECT search_staff_admin('Jne', ARRAY['ACTIVE']::TEXT[], false, 10, 0) as result
) t;

-- Test 9: Staff search - fuzzy match (spaced)
SELECT '=== Test 9: Staff fuzzy match "J.A.N.E" (spaced) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as staff_count,
  (result->'staff'->0->>'first_name') as first_result_name
FROM (
  SELECT search_staff_admin('J.A.N.E', ARRAY['ACTIVE']::TEXT[], false, 10, 0) as result
) t;

-- Test 10: Staff search - fuzzy match on last name
SELECT '=== Test 10: Staff fuzzy match "Smth" (typo for Smith) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as staff_count,
  (result->'staff'->0->>'last_name') as first_result_name
FROM (
  SELECT search_staff_admin('Smth', ARRAY['ACTIVE']::TEXT[], false, 10, 0) as result
) t;

-- Test 11: Session search - exact match on student name
SELECT '=== Test 11: Session exact match "Alice" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as session_count
FROM (
  SELECT search_sessions_admin('Alice', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result
) t;

-- Test 12: Session search - fuzzy match on student name
SELECT '=== Test 12: Session fuzzy match "Alce" (typo for Alice) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as session_count
FROM (
  SELECT search_sessions_admin('Alce', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result
) t;

-- Test 13: Session search - exact match on staff name
SELECT '=== Test 13: Session exact match "Jane" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as session_count
FROM (
  SELECT search_sessions_admin('Jane', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result
) t;

-- Test 14: Session search - fuzzy match on staff name
SELECT '=== Test 14: Session fuzzy match "Jne" (typo for Jane) ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as session_count
FROM (
  SELECT search_sessions_admin('Jne', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result
) t;

-- Test 15: Verify fuzzy pattern function works correctly
SELECT '=== Test 15: Fuzzy pattern generation ===' as test;
SELECT 
  'john' as input,
  build_fuzzy_like('john') as pattern,
  'Should be: %j%o%h%n%' as expected;

SELECT 
  'J.O.H.N' as input,
  build_fuzzy_like('J.O.H.N') as pattern,
  'Should be: %J%O%H%N%' as expected;

SELECT 
  'IB MATH' as input,
  build_fuzzy_like('IB MATH') as pattern,
  'Should be: %I%B%M%A%T%H%' as expected;

-- Test 16: Edge case - empty string
SELECT '=== Test 16: Empty string search ===' as test;
SELECT 
  (result->>'total')::int as total
FROM (
  SELECT search_students_admin('', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 17: Edge case - NULL search
SELECT '=== Test 17: NULL search ===' as test;
SELECT 
  (result->>'total')::int as total
FROM (
  SELECT search_students_admin(NULL, ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 18: Edge case - single character
SELECT '=== Test 18: Single character search "A" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count
FROM (
  SELECT search_students_admin('A', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

-- Test 19: Compare exact vs fuzzy results
SELECT '=== Test 19: Exact vs Fuzzy comparison ===' as test;
SELECT 
  'Exact: "Alice"' as search_type,
  (result->>'total')::int as result_count
FROM (
  SELECT search_students_admin('Alice', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0) as result
) t
UNION ALL
SELECT 
  'Fuzzy: "Alce"' as search_type,
  (result->>'total')::int as result_count
FROM (
  SELECT search_students_admin('Alce', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0) as result
) t;

-- Test 20: Full name search
SELECT '=== Test 20: Full name search "Alice Williams" ===' as test;
SELECT 
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as student_count,
  (result->'students'->0->>'first_name') || ' ' || (result->'students'->0->>'last_name') as full_name
FROM (
  SELECT search_students_admin('Alice Williams', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0) as result
) t;

SELECT '=== All tests completed ===' as test;


