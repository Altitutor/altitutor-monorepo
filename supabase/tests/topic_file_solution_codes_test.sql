BEGIN;
SELECT plan(9);

-- Calculus is seed topic 2, so TEST files get codes 2T.n / 2T.n_SOL.
-- Isolated from the seed NOTES file on the same topic.

INSERT INTO public.files (
  id, mimetype, filename, size_bytes, storage_provider, bucket, storage_path, created_by
)
VALUES
  ('f1ce0000-0000-4000-8000-000000000001', 'application/pdf', '2T.1.pdf', 100, 'supabase', 'resources', 'tests/2t1.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000002', 'application/pdf', '2T.2.pdf', 100, 'supabase', 'resources', 'tests/2t2.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000003', 'application/pdf', '2T.3.pdf', 100, 'supabase', 'resources', 'tests/2t3.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000011', 'application/pdf', '2T.1 SOL extra.pdf', 100, 'supabase', 'resources', 'tests/2t1-sol-extra.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000012', 'application/pdf', '2T.1 SOL.pdf', 100, 'supabase', 'resources', 'tests/2t1-sol.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000013', 'application/pdf', '2T.2 SOL.pdf', 100, 'supabase', 'resources', 'tests/2t2-sol.pdf', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.topics_files (
  id, topic_id, type, file_id, is_solutions, is_solutions_of_id, created_by
)
VALUES
  (
    'f1ce0000-0000-4000-8000-000000000101',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000001',
    false,
    NULL,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'f1ce0000-0000-4000-8000-000000000102',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000002',
    false,
    NULL,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'f1ce0000-0000-4000-8000-000000000103',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000003',
    false,
    NULL,
    '00000000-0000-0000-0000-000000000001'
  );

-- Extra unlinked solution uploaded first, then the real solutions linked to tests 1 and 2.
INSERT INTO public.topics_files (
  id, topic_id, type, file_id, is_solutions, is_solutions_of_id, created_by
)
VALUES
  (
    'f1ce0000-0000-4000-8000-000000000111',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000011',
    true,
    NULL,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'f1ce0000-0000-4000-8000-000000000112',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000012',
    true,
    'f1ce0000-0000-4000-8000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'f1ce0000-0000-4000-8000-000000000113',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000013',
    true,
    'f1ce0000-0000-4000-8000-000000000102',
    '00000000-0000-0000-0000-000000000001'
  );

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000101'),
  '2T.1',
  'first test keeps 2T.1'
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000112'),
  '2T.1_SOL',
  'solution linked to 2T.1 is coded 2T.1_SOL even when another solution was uploaded first'
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000113'),
  '2T.2_SOL',
  'solution linked to 2T.2 is coded 2T.2_SOL rather than the next solution sequence number'
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000111'),
  '2T.3_SOL',
  'unlinked extra solution moves to an unused number instead of occupying 2T.1_SOL'
);

SELECT public.batch_update_topic_file_indices(
  jsonb_build_array(
    jsonb_build_object('id', 'f1ce0000-0000-4000-8000-000000000101', 'index', 2),
    jsonb_build_object('id', 'f1ce0000-0000-4000-8000-000000000102', 'index', 1)
  )
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000112'),
  '2T.2_SOL',
  'reordering tests updates the linked solution code to the new parent number'
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000113'),
  '2T.1_SOL',
  'the solution that followed the swapped test becomes 2T.1_SOL'
);

SELECT public.batch_update_topic_file_indices(
  jsonb_build_array(
    jsonb_build_object('id', 'f1ce0000-0000-4000-8000-000000000101', 'index', 1),
    jsonb_build_object('id', 'f1ce0000-0000-4000-8000-000000000102', 'index', 2)
  )
);

UPDATE public.topics_files
SET is_solutions_of_id = 'f1ce0000-0000-4000-8000-000000000103'
WHERE id = 'f1ce0000-0000-4000-8000-000000000113';

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000113'),
  '2T.3_SOL',
  'relinking a solution from 2T.2 to 2T.3 updates its code'
);

SELECT is(
  (SELECT code FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000111'),
  '2T.2_SOL',
  'an unlinked solution fills the unused number left by the relinked file'
);

UPDATE public.topics_files
SET is_solutions_of_id = 'f1ce0000-0000-4000-8000-000000000102'
WHERE id = 'f1ce0000-0000-4000-8000-000000000111';

DELETE FROM public.topics_files
WHERE id = 'f1ce0000-0000-4000-8000-000000000101';

SELECT is(
  ARRAY(
    SELECT code
    FROM public.topics_files
    WHERE id IN (
      'f1ce0000-0000-4000-8000-000000000102',
      'f1ce0000-0000-4000-8000-000000000111'
    )
    ORDER BY code
  ),
  ARRAY['2T.1', '2T.1_SOL'],
  'deleting a test compacts remaining tests and their linked solutions follow the new numbers'
);

SELECT * FROM finish();
ROLLBACK;
