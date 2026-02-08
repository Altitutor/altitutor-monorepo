-- Edge case tests for topic parent update fix
\set ON_ERROR_STOP on

DELETE FROM public.topics WHERE name LIKE 'TEST_%';

\echo '========================================'
\echo 'EDGE CASE TESTS'
\echo '========================================'

DO $$
DECLARE
  math_subject_id UUID;
BEGIN
  SELECT id INTO math_subject_id FROM public.subjects 
  WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' 
  LIMIT 1;
  
  -- Create a hierarchy: Root -> Child1 -> Grandchild1
  INSERT INTO public.topics (id, subject_id, name, parent_id, created_by)
  VALUES
    ('a0000000-0000-0000-0000-000000000010'::uuid, math_subject_id, 'TEST_Root', NULL, '00000000-0000-0000-0000-000000000001'::uuid),
    ('a0000000-0000-0000-0000-000000000011'::uuid, math_subject_id, 'TEST_Child1', 'a0000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
    ('a0000000-0000-0000-0000-000000000012'::uuid, math_subject_id, 'TEST_Grandchild1', 'a0000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
    ('a0000000-0000-0000-0000-000000000013'::uuid, math_subject_id, 'TEST_Child2', 'a0000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END $$;

\echo 'TEST 1: Move child with grandchild to different parent'
\echo 'Before:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

-- Create another root
DO $$
DECLARE
  math_subject_id UUID;
BEGIN
  SELECT id INTO math_subject_id FROM public.subjects 
  WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' 
  LIMIT 1;
  
  INSERT INTO public.topics (id, subject_id, name, parent_id, created_by)
  VALUES ('a0000000-0000-0000-0000-000000000014'::uuid, math_subject_id, 'TEST_Root2', NULL, '00000000-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END $$;

-- Move Child1 (which has Grandchild1) to Root2
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000014'
WHERE id = 'a0000000-0000-0000-0000-000000000011';

\echo 'After:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST 2: Move topic to become sibling of its child (should fail validation)'
-- This should fail due to the validation trigger that prevents circular references
-- Actually, the validation only checks subject_id match, not circular refs
-- But moving a parent to be a child of its own child would create a cycle
-- Let's test if the database prevents this
DO $$
BEGIN
  BEGIN
    UPDATE public.topics 
    SET parent_id = 'a0000000-0000-0000-0000-000000000012'
    WHERE id = 'a0000000-0000-0000-0000-000000000011';
    RAISE NOTICE 'WARNING: Circular reference was allowed (this might be a problem)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Circular reference prevented: %', SQLERRM;
  END;
END $$;

\echo ''
\echo 'TEST 3: Rapid sequential updates'
DO $$
DECLARE
  math_subject_id UUID;
BEGIN
  SELECT id INTO math_subject_id FROM public.subjects 
  WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' 
  LIMIT 1;
  
  -- Create multiple topics
  INSERT INTO public.topics (id, subject_id, name, parent_id, created_by)
  VALUES
    ('a0000000-0000-0000-0000-000000000020'::uuid, math_subject_id, 'TEST_Topic1', NULL, '00000000-0000-0000-0000-000000000001'::uuid),
    ('a0000000-0000-0000-0000-000000000021'::uuid, math_subject_id, 'TEST_Topic2', NULL, '00000000-0000-0000-0000-000000000001'::uuid),
    ('a0000000-0000-0000-0000-000000000022'::uuid, math_subject_id, 'TEST_Topic3', NULL, '00000000-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END $$;

-- Rapidly move them all to be children
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'a0000000-0000-0000-0000-000000000020';
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'a0000000-0000-0000-0000-000000000021';
UPDATE public.topics SET parent_id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'a0000000-0000-0000-0000-000000000022';

\echo 'After rapid updates:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST 4: Verify no duplicate indices'
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT subject_id, parent_id, index, COUNT(*) as cnt
    FROM public.topics
    WHERE name LIKE 'TEST_%'
    GROUP BY subject_id, parent_id, index
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate index combinations', dup_count;
  END IF;
  
  RAISE NOTICE 'No duplicate indices found - TEST PASSED!';
END $$;

\echo ''
\echo 'All edge case tests completed!'
DELETE FROM public.topics WHERE name LIKE 'TEST_%';
