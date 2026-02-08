-- Comprehensive test script for topic parent update fix
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -f test_topic_parent_update.sql

\set ON_ERROR_STOP on

\echo '========================================'
\echo 'TEST: Topic Parent Update Fix'
\echo '========================================'
\echo ''

-- Clean up any existing test topics
DELETE FROM public.topics WHERE name LIKE 'TEST_%';

-- Get subject ID
DO $$
DECLARE
  math_subject_id UUID;
BEGIN
  SELECT id INTO math_subject_id FROM public.subjects 
  WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' 
  LIMIT 1;
  
  IF math_subject_id IS NULL THEN
    RAISE EXCEPTION 'Could not find Mathematical Methods subject';
  END IF;
  
  -- Store in a temp table for use in subsequent statements
  CREATE TEMP TABLE test_config AS SELECT math_subject_id as subject_id;
  
  RAISE NOTICE 'Using subject ID: %', math_subject_id;
END $$;

\echo '========================================'
\echo 'TEST 1: Create test topics'
\echo '========================================'

-- Create root topics
INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'a0000000-0000-0000-0000-000000000001'::uuid,
  subject_id,
  'TEST_Root1',
  1,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'a0000000-0000-0000-0000-000000000002'::uuid,
  subject_id,
  'TEST_Root2',
  2,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'a0000000-0000-0000-0000-000000000003'::uuid,
  subject_id,
  'TEST_Root3',
  3,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

-- Create child topics
INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'b0000000-0000-0000-0000-000000000001'::uuid,
  subject_id,
  'TEST_Child1',
  1,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'b0000000-0000-0000-0000-000000000002'::uuid,
  subject_id,
  'TEST_Child2',
  2,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'b0000000-0000-0000-0000-000000000003'::uuid,
  subject_id,
  'TEST_Child3',
  1,
  'a0000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

\echo 'Initial state:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo '========================================'
\echo 'TEST 2: Update parent_id from NULL to parent (make child)'
\echo '========================================'

-- Move TEST_Root3 to be a child of TEST_Root1
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = 'a0000000-0000-0000-0000-000000000003';

\echo 'After moving TEST_Root3 to be child of TEST_Root1:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

-- Verify indices are sequential
DO $$
DECLARE
  root_count INTEGER;
  child_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO root_count FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id IS NULL;
  
  SELECT COUNT(*) INTO child_count FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001';
  
  IF root_count != 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 2 root topics, got %', root_count;
  END IF;
  
  IF child_count != 3 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 3 children of Root1, got %', child_count;
  END IF;
  
  RAISE NOTICE 'TEST PASSED: Correct number of root topics (%) and children (%)', root_count, child_count;
END $$;

\echo ''
\echo '========================================'
\echo 'TEST 3: Update parent_id from parent to NULL (make root)'
\echo '========================================'

-- Move TEST_Child3 from Root2 to be a root topic
UPDATE public.topics 
SET parent_id = NULL
WHERE id = 'b0000000-0000-0000-0000-000000000003';

\echo 'After moving TEST_Child3 to be root:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

-- Verify indices are sequential
DO $$
DECLARE
  root_count INTEGER;
  child_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO root_count FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id IS NULL;
  
  SELECT COUNT(*) INTO child_count FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001';
  
  IF root_count != 3 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 3 root topics, got %', root_count;
  END IF;
  
  IF child_count != 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 2 children of Root1, got %', child_count;
  END IF;
  
  RAISE NOTICE 'TEST PASSED: Correct number of root topics (%) and children (%)', root_count, child_count;
END $$;

\echo ''
\echo '========================================'
\echo 'TEST 4: Update parent_id from one parent to another'
\echo '========================================'

-- Move TEST_Child2 from Root1 to Root2
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000002'
WHERE id = 'b0000000-0000-0000-0000-000000000002';

\echo 'After moving TEST_Child2 from Root1 to Root2:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

-- Verify indices are sequential
DO $$
DECLARE
  root1_children INTEGER;
  root2_children INTEGER;
BEGIN
  SELECT COUNT(*) INTO root1_children FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001';
  
  SELECT COUNT(*) INTO root2_children FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000002';
  
  IF root1_children != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 1 child of Root1, got %', root1_children;
  END IF;
  
  IF root2_children != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 1 child of Root2, got %', root2_children;
  END IF;
  
  RAISE NOTICE 'TEST PASSED: Correct number of children for Root1 (%) and Root2 (%)', root1_children, root2_children;
END $$;

\echo ''
\echo '========================================'
\echo 'TEST 5: Verify sequential indices'
\echo '========================================'

DO $$
DECLARE
  topic_rec RECORD;
  expected_index INTEGER;
BEGIN
  -- Check root topics have sequential indices
  expected_index := 1;
  FOR topic_rec IN 
    SELECT id, name, index FROM public.topics 
    WHERE name LIKE 'TEST_%' AND parent_id IS NULL 
    ORDER BY index
  LOOP
    IF topic_rec.index != expected_index THEN
      RAISE EXCEPTION 'TEST FAILED: Root topic % has index %, expected %', topic_rec.name, topic_rec.index, expected_index;
    END IF;
    expected_index := expected_index + 1;
  END LOOP;
  
  -- Check children of Root1 have sequential indices
  expected_index := 1;
  FOR topic_rec IN 
    SELECT id, name, index FROM public.topics 
    WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001'
    ORDER BY index
  LOOP
    IF topic_rec.index != expected_index THEN
      RAISE EXCEPTION 'TEST FAILED: Child topic % has index %, expected %', topic_rec.name, topic_rec.index, expected_index;
    END IF;
    expected_index := expected_index + 1;
  END LOOP;
  
  -- Check children of Root2 have sequential indices
  expected_index := 1;
  FOR topic_rec IN 
    SELECT id, name, index FROM public.topics 
    WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000002'
    ORDER BY index
  LOOP
    IF topic_rec.index != expected_index THEN
      RAISE EXCEPTION 'TEST FAILED: Child topic % has index %, expected %', topic_rec.name, topic_rec.index, expected_index;
    END IF;
    expected_index := expected_index + 1;
  END LOOP;
  
  RAISE NOTICE 'TEST PASSED: All indices are sequential';
END $$;

\echo ''
\echo '========================================'
\echo 'TEST 6: Test updating to same parent (no-op)'
\echo '========================================'

-- Try updating parent_id to the same value (should not trigger recalculation)
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = 'b0000000-0000-0000-0000-000000000001'
  AND parent_id = 'a0000000-0000-0000-0000-000000000001';

\echo 'After no-op update (same parent):'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo '========================================'
\echo 'TEST 7: Test multiple rapid updates'
\echo '========================================'

-- Create more test topics
INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'c0000000-0000-0000-0000-000000000001'::uuid,
  subject_id,
  'TEST_Rapid1',
  4,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'c0000000-0000-0000-0000-000000000002'::uuid,
  subject_id,
  'TEST_Rapid2',
  5,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
SELECT 
  'c0000000-0000-0000-0000-000000000003'::uuid,
  subject_id,
  'TEST_Rapid3',
  6,
  NULL,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM test_config
ON CONFLICT DO NOTHING;

-- Rapidly move them all to be children of Root1
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'c0000000-0000-0000-0000-000000000002';
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000001' WHERE id = 'c0000000-0000-0000-0000-000000000003';

\echo 'After rapid updates:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

-- Verify all children of Root1 have sequential indices
DO $$
DECLARE
  child_count INTEGER;
  max_index INTEGER;
  min_index INTEGER;
BEGIN
  SELECT COUNT(*) INTO child_count FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001';
  
  SELECT MAX(index), MIN(index) INTO max_index, min_index FROM public.topics 
  WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001';
  
  IF child_count != 4 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 4 children of Root1, got %', child_count;
  END IF;
  
  IF min_index != 1 OR max_index != 4 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected indices 1-4, got %-%', min_index, max_index;
  END IF;
  
  RAISE NOTICE 'TEST PASSED: All % children have sequential indices (%)', child_count, max_index;
END $$;

\echo ''
\echo '========================================'
\echo 'TEST 8: Test unique constraint (should not violate)'
\echo '========================================'

-- This should NOT cause a unique constraint violation
-- The trigger should recalculate the index before the constraint check
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000002'
WHERE id = 'c0000000-0000-0000-0000-000000000001';

\echo 'After moving to Root2 (should not violate constraint):'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo '========================================'
\echo 'TEST 9: Verify no duplicate indices'
\echo '========================================'

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Check for duplicate (subject_id, parent_id, index) combinations
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT subject_id, parent_id, index, COUNT(*) as cnt
    FROM public.topics
    WHERE name LIKE 'TEST_%'
    GROUP BY subject_id, parent_id, index
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Found % duplicate index combinations', duplicate_count;
  END IF;
  
  RAISE NOTICE 'TEST PASSED: No duplicate indices found';
END $$;

\echo ''
\echo '========================================'
\echo 'ALL TESTS PASSED!'
\echo '========================================'

-- Clean up
DELETE FROM public.topics WHERE name LIKE 'TEST_%';
DROP TABLE IF EXISTS test_config;

\echo 'Test topics cleaned up.'
