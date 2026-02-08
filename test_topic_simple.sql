-- Simple test for topic parent update fix
\set ON_ERROR_STOP on

-- Clean up
DELETE FROM public.topics WHERE name LIKE 'TEST_%';

-- Create test topics using a simple approach
DO $$
DECLARE
  math_subject_id UUID;
BEGIN
  SELECT id INTO math_subject_id FROM public.subjects 
  WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' 
  LIMIT 1;
  
  -- Create root topics (let triggers calculate indices)
  INSERT INTO public.topics (id, subject_id, name, parent_id, created_by)
  VALUES
    ('a0000000-0000-0000-0000-000000000001', math_subject_id, 'TEST_Root1', NULL, '00000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000002', math_subject_id, 'TEST_Root2', NULL, '00000000-0000-0000-0000-000000000001'),
    ('a0000000-0000-0000-0000-000000000003', math_subject_id, 'TEST_Root3', NULL, '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  
  -- Create child topics (let triggers calculate indices)
  INSERT INTO public.topics (id, subject_id, name, parent_id, created_by)
  VALUES
    ('b0000000-0000-0000-0000-000000000001', math_subject_id, 'TEST_Child1', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000002', math_subject_id, 'TEST_Child2', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END $$;

\echo 'Initial state:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST: Move Root3 to be child of Root1'
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = 'a0000000-0000-0000-0000-000000000003';

\echo 'After update:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST: Move Child2 to Root2'
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000002'
WHERE id = 'b0000000-0000-0000-0000-000000000002';

\echo 'After update:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST: Move Child2 back to Root1'
UPDATE public.topics 
SET parent_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = 'b0000000-0000-0000-0000-000000000002';

\echo 'After update:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'TEST: Move Root3 back to root'
UPDATE public.topics 
SET parent_id = NULL
WHERE id = 'a0000000-0000-0000-0000-000000000003';

\echo 'After update:'
SELECT id, name, parent_id, index FROM public.topics WHERE name LIKE 'TEST_%' ORDER BY parent_id NULLS FIRST, index;

\echo ''
\echo 'Verifying sequential indices...'
DO $$
DECLARE
  rec RECORD;
  prev_index INTEGER;
  first BOOLEAN;
BEGIN
  -- Check roots are sequential (may not start at 1 due to existing topics)
  first := true;
  prev_index := NULL;
  FOR rec IN SELECT index FROM public.topics WHERE name LIKE 'TEST_%' AND parent_id IS NULL ORDER BY index
  LOOP
    IF NOT first AND rec.index != prev_index + 1 THEN
      RAISE EXCEPTION 'Root indices not sequential: got % after %', rec.index, prev_index;
    END IF;
    prev_index := rec.index;
    first := false;
  END LOOP;
  
  -- Check children of Root1 are sequential
  first := true;
  prev_index := NULL;
  FOR rec IN SELECT index FROM public.topics WHERE name LIKE 'TEST_%' AND parent_id = 'a0000000-0000-0000-0000-000000000001' ORDER BY index
  LOOP
    IF NOT first AND rec.index != prev_index + 1 THEN
      RAISE EXCEPTION 'Child indices not sequential: got % after %', rec.index, prev_index;
    END IF;
    prev_index := rec.index;
    first := false;
  END LOOP;
  
  -- Check no duplicate indices in same group
  IF EXISTS (
    SELECT 1 FROM (
      SELECT subject_id, parent_id, index, COUNT(*) as cnt
      FROM public.topics
      WHERE name LIKE 'TEST_%'
      GROUP BY subject_id, parent_id, index
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Found duplicate indices in same group';
  END IF;
  
  RAISE NOTICE 'All indices are sequential and unique - TEST PASSED!';
END $$;

\echo ''
\echo 'Cleaning up...'
DELETE FROM public.topics WHERE name LIKE 'TEST_%';
\echo 'Done!'
