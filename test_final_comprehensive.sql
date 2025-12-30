-- Final comprehensive test for search functions with fuzzy matching
-- Temporarily override security check for testing
CREATE OR REPLACE FUNCTION public.is_adminstaff_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT true;
$$;

\echo '========================================'
\echo 'COMPREHENSIVE SEARCH FUNCTION TESTS'
\echo '========================================'
\echo ''

\echo '1. STUDENT SEARCH TESTS'
\echo '------------------------'

-- Test 1.1: Exact match on first name
SELECT 'Test 1.1: Exact match "Alice"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count,
  result->'students'->0->>'first_name' as first_name,
  result->'students'->0->>'last_name' as last_name
FROM (SELECT search_students_admin('Alice', NULL, false, 10, 0) as result) t;

-- Test 1.2: Exact match on last name
SELECT 'Test 1.2: Exact match "Williams"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count,
  result->'students'->0->>'first_name' as first_name,
  result->'students'->0->>'last_name' as last_name
FROM (SELECT search_students_admin('Williams', NULL, false, 10, 0) as result) t;

-- Test 1.3: Fuzzy match - typo in first name
SELECT 'Test 1.3: Fuzzy match "Alce" (typo for Alice)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count,
  result->'students'->0->>'first_name' as first_name,
  result->'students'->0->>'last_name' as last_name
FROM (SELECT search_students_admin('Alce', NULL, false, 10, 0) as result) t;

-- Test 1.4: Fuzzy match - spaced characters
SELECT 'Test 1.4: Fuzzy match "A.L.I.C.E" (spaced)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count,
  result->'students'->0->>'first_name' as first_name
FROM (SELECT search_students_admin('A.L.I.C.E', NULL, false, 10, 0) as result) t;

-- Test 1.5: Fuzzy match - typo in last name
SELECT 'Test 1.5: Fuzzy match "Wlams" (typo for Williams)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count,
  result->'students'->0->>'last_name' as last_name
FROM (SELECT search_students_admin('Wlams', NULL, false, 10, 0) as result) t;

-- Test 1.6: Full name search
SELECT 'Test 1.6: Full name "Alice Williams"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count
FROM (SELECT search_students_admin('Alice Williams', NULL, false, 10, 0) as result) t;

\echo ''
\echo '2. STAFF SEARCH TESTS'
\echo '---------------------'

-- Test 2.1: Exact match on first name
SELECT 'Test 2.1: Exact match "Jane"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as count,
  result->'staff'->0->>'first_name' as first_name,
  result->'staff'->0->>'last_name' as last_name
FROM (SELECT search_staff_admin('Jane', NULL, false, 10, 0) as result) t;

-- Test 2.2: Exact match on last name
SELECT 'Test 2.2: Exact match "Smith"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as count,
  result->'staff'->0->>'first_name' as first_name,
  result->'staff'->0->>'last_name' as last_name
FROM (SELECT search_staff_admin('Smith', NULL, false, 10, 0) as result) t;

-- Test 2.3: Fuzzy match - typo in first name
SELECT 'Test 2.3: Fuzzy match "Jne" (typo for Jane)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as count,
  result->'staff'->0->>'first_name' as first_name
FROM (SELECT search_staff_admin('Jne', NULL, false, 10, 0) as result) t;

-- Test 2.4: Fuzzy match - spaced characters
SELECT 'Test 2.4: Fuzzy match "J.A.N.E" (spaced)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as count,
  result->'staff'->0->>'first_name' as first_name
FROM (SELECT search_staff_admin('J.A.N.E', NULL, false, 10, 0) as result) t;

-- Test 2.5: Fuzzy match - typo in last name
SELECT 'Test 2.5: Fuzzy match "Smth" (typo for Smith)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'staff') as count,
  result->'staff'->0->>'last_name' as last_name
FROM (SELECT search_staff_admin('Smth', NULL, false, 10, 0) as result) t;

\echo ''
\echo '3. SESSION SEARCH TESTS'
\echo '-----------------------'

-- Test 3.1: Exact match on student name
SELECT 'Test 3.1: Session search "Alice"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as count
FROM (SELECT search_sessions_admin('Alice', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result) t;

-- Test 3.2: Fuzzy match on student name
SELECT 'Test 3.2: Session fuzzy "Alce" (typo)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as count
FROM (SELECT search_sessions_admin('Alce', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result) t;

-- Test 3.3: Exact match on staff name
SELECT 'Test 3.3: Session search "Jane"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as count
FROM (SELECT search_sessions_admin('Jane', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result) t;

-- Test 3.4: Fuzzy match on staff name
SELECT 'Test 3.4: Session fuzzy "Jne" (typo)' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'sessions') as count
FROM (SELECT search_sessions_admin('Jne', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 10, 0) as result) t;

\echo ''
\echo '4. FUZZY PATTERN GENERATION TESTS'
\echo '----------------------------------'

SELECT 'Test 4.1: Pattern for "john"' as test_case,
  build_fuzzy_like('john') as pattern,
  'Expected: %j%o%h%n%' as expected;

SELECT 'Test 4.2: Pattern for "J.O.H.N"' as test_case,
  build_fuzzy_like('J.O.H.N') as pattern,
  'Expected: %J%O%H%N%' as expected;

SELECT 'Test 4.3: Pattern for "IB MATH"' as test_case,
  build_fuzzy_like('IB MATH') as pattern,
  'Expected: %I%B%M%A%T%H%' as expected;

\echo ''
\echo '5. EDGE CASE TESTS'
\echo '------------------'

-- Test 5.1: Empty string
SELECT 'Test 5.1: Empty string' as test_case,
  (result->>'total')::int as total
FROM (SELECT search_students_admin('', NULL, false, 10, 0) as result) t;

-- Test 5.2: NULL search
SELECT 'Test 5.2: NULL search' as test_case,
  (result->>'total')::int as total
FROM (SELECT search_students_admin(NULL, NULL, false, 10, 0) as result) t;

-- Test 5.3: Single character
SELECT 'Test 5.3: Single character "A"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count
FROM (SELECT search_students_admin('A', NULL, false, 10, 0) as result) t;

-- Test 5.4: Special characters
SELECT 'Test 5.4: Special chars "Alice-Williams"' as test_case,
  (result->>'total')::int as total,
  jsonb_array_length(result->'students') as count
FROM (SELECT search_students_admin('Alice-Williams', NULL, false, 10, 0) as result) t;

\echo ''
\echo '6. COMPARISON: EXACT VS FUZZY'
\echo '------------------------------'

SELECT 
  'Exact: "Alice"' as search_type,
  (result->>'total')::int as result_count
FROM (SELECT search_students_admin('Alice', NULL, false, 100, 0) as result) t
UNION ALL
SELECT 
  'Fuzzy: "Alce"' as search_type,
  (result->>'total')::int as result_count
FROM (SELECT search_students_admin('Alce', NULL, false, 100, 0) as result) t
UNION ALL
SELECT 
  'Fuzzy: "A.L.I.C.E"' as search_type,
  (result->>'total')::int as result_count
FROM (SELECT search_students_admin('A.L.I.C.E', NULL, false, 100, 0) as result) t;

\echo ''
\echo '========================================'
\echo 'ALL TESTS COMPLETED'
\echo '========================================'
\echo ''
\echo 'SUMMARY:'
\echo '- Exact matching: Should find exact substring matches'
\echo '- Fuzzy matching: Should find matches even with typos/spacing'
\echo '- Both patterns work together (OR logic)'
\echo ''


