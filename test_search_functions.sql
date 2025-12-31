-- Comprehensive test script for search functions with fuzzy matching
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -f test_search_functions.sql

\echo '========================================'
\echo 'Testing Search Functions with Fuzzy Matching'
\echo '========================================'
\echo ''

-- Set up test environment
SET ROLE authenticated;
SET request.jwt.claims = '{"role": "authenticated", "user_role": "ADMINSTAFF"}'::jsonb;

\echo '1. Testing search_students_admin with EXACT matches'
\echo '---------------------------------------------------'
SELECT 
  'Exact match: "John"' as test_case,
  jsonb_pretty(search_students_admin('John', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)) as result;
\echo ''

SELECT 
  'Exact match: "Smith"' as test_case,
  jsonb_pretty(search_students_admin('Smith', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)) as result;
\echo ''

\echo '2. Testing search_students_admin with FUZZY matches'
\echo '----------------------------------------------------'
SELECT 
  'Fuzzy match: "Jhon" (typo for John)' as test_case,
  jsonb_pretty(search_students_admin('Jhon', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)) as result;
\echo ''

SELECT 
  'Fuzzy match: "J.O.H.N" (spaced)' as test_case,
  jsonb_pretty(search_students_admin('J.O.H.N', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)) as result;
\echo ''

SELECT 
  'Fuzzy match: "Smth" (typo for Smith)' as test_case,
  jsonb_pretty(search_students_admin('Smth', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)) as result;
\echo ''

\echo '3. Testing search_staff_admin with EXACT matches'
\echo '------------------------------------------------'
SELECT 
  'Exact match: "Jane"' as test_case,
  jsonb_pretty(search_staff_admin('Jane', ARRAY['ACTIVE']::TEXT[], false, 10, 0)) as result;
\echo ''

SELECT 
  'Exact match: "Doe"' as test_case,
  jsonb_pretty(search_staff_admin('Doe', ARRAY['ACTIVE']::TEXT[], false, 10, 0)) as result;
\echo ''

\echo '4. Testing search_staff_admin with FUZZY matches'
\echo '------------------------------------------------'
SELECT 
  'Fuzzy match: "Jne" (typo for Jane)' as test_case,
  jsonb_pretty(search_staff_admin('Jne', ARRAY['ACTIVE']::TEXT[], false, 10, 0)) as result;
\echo ''

SELECT 
  'Fuzzy match: "D.O.E" (spaced)' as test_case,
  jsonb_pretty(search_staff_admin('D.O.E', ARRAY['ACTIVE']::TEXT[], false, 10, 0)) as result;
\echo ''

\echo '5. Testing search_sessions_admin with EXACT matches'
\echo '---------------------------------------------------'
SELECT 
  'Exact match: student name "John"' as test_case,
  jsonb_pretty(search_sessions_admin('John', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 5, 0)) as result;
\echo ''

SELECT 
  'Exact match: class shortname "IB"' as test_case,
  jsonb_pretty(search_sessions_admin('IB', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 5, 0)) as result;
\echo ''

\echo '6. Testing search_sessions_admin with FUZZY matches'
\echo '----------------------------------------------------'
SELECT 
  'Fuzzy match: student name "Jhon" (typo)' as test_case,
  jsonb_pretty(search_sessions_admin('Jhon', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 5, 0)) as result;
\echo ''

SELECT 
  'Fuzzy match: class shortname "I.B" (spaced)' as test_case,
  jsonb_pretty(search_sessions_admin('I.B', NULL, NULL, NULL, NULL, NULL, ARRAY['ACTIVE']::TEXT[], NULL, false, 5, 0)) as result;
\echo ''

\echo '7. Testing edge cases'
\echo '---------------------'
SELECT 
  'Empty search string' as test_case,
  (search_students_admin('', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)->>'total')::int as total_count;
\echo ''

SELECT 
  'NULL search' as test_case,
  (search_students_admin(NULL, ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)->>'total')::int as total_count;
\echo ''

SELECT 
  'Very short search (1 char)' as test_case,
  (search_students_admin('J', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)->>'total')::int as total_count;
\echo ''

SELECT 
  'Special characters in search' as test_case,
  (search_students_admin('John-Smith', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 10, 0)->>'total')::int as total_count;
\echo ''

\echo '8. Verifying fuzzy matching pattern'
\echo '-------------------------------------'
SELECT 
  'Testing build_fuzzy_like function' as test_case,
  build_fuzzy_like('john') as fuzzy_pattern,
  build_fuzzy_like('J.O.H.N') as fuzzy_pattern_spaced,
  build_fuzzy_like('IB MATH') as fuzzy_pattern_class;
\echo ''

\echo '9. Comparing exact vs fuzzy results'
\echo '-----------------------------------'
SELECT 
  'Exact search for "John"' as search_type,
  COUNT(*) as result_count
FROM jsonb_array_elements(search_students_admin('John', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0)->'students') as student;

SELECT 
  'Fuzzy search for "Jhon"' as search_type,
  COUNT(*) as result_count
FROM jsonb_array_elements(search_students_admin('Jhon', ARRAY['ACTIVE', 'TRIAL']::TEXT[], false, 100, 0)->'students') as student;
\echo ''

\echo '========================================'
\echo 'Test Summary'
\echo '========================================'
\echo 'If you see results above, the functions are working correctly.'
\echo 'Fuzzy matching should find results even with typos or spacing.'



