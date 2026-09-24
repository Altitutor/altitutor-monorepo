BEGIN;
SELECT plan(4);

INSERT INTO public.files (
  id, mimetype, filename, size_bytes, storage_provider, bucket, storage_path, created_by
)
VALUES
  ('f1ce0000-0000-4000-8000-000000000201', 'application/pdf', '2T.1.pdf', 100, 'supabase', 'resources', 'tests/dup-2t1.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000211', 'application/pdf', '2T.1 SOL a.pdf', 100, 'supabase', 'resources', 'tests/dup-2t1-sol-a.pdf', '00000000-0000-0000-0000-000000000001'),
  ('f1ce0000-0000-4000-8000-000000000212', 'application/pdf', '2T.1 SOL b.pdf', 100, 'supabase', 'resources', 'tests/dup-2t1-sol-b.pdf', '00000000-0000-0000-0000-000000000001');

INSERT INTO public.topics_files (
  id, topic_id, type, file_id, is_solutions, is_solutions_of_id, created_by
)
VALUES
  (
    'f1ce0000-0000-4000-8000-000000000301',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000201',
    false,
    NULL,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'f1ce0000-0000-4000-8000-000000000311',
    '30000000-0000-0000-0000-000000000002',
    'TEST',
    'f1ce0000-0000-4000-8000-000000000211',
    true,
    'f1ce0000-0000-4000-8000-000000000301',
    '00000000-0000-0000-0000-000000000001'
  );

SELECT lives_ok(
  $$
    INSERT INTO public.topics_files (
      id, topic_id, type, file_id, is_solutions, is_solutions_of_id, created_by
    )
    VALUES (
      'f1ce0000-0000-4000-8000-000000000312',
      '30000000-0000-0000-0000-000000000002',
      'TEST',
      'f1ce0000-0000-4000-8000-000000000212',
      true,
      'f1ce0000-0000-4000-8000-000000000301',
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'a second solution can stay linked to the same test without a unique-index collision'
);

SELECT lives_ok(
  $$
    SELECT public.recalculate_topic_file_indices_for_siblings(
      '30000000-0000-0000-0000-000000000002',
      'TEST',
      true
    )
  $$,
  'recalculating an already-duplicated parent link does not collide on unique index'
);

SELECT is(
  (SELECT index FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000311'),
  (SELECT index FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000301'),
  'the earlier solution inherits the parent test number'
);

SELECT isnt(
  (SELECT index FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000312'),
  (SELECT index FROM public.topics_files WHERE id = 'f1ce0000-0000-4000-8000-000000000311'),
  'the extra linked solution keeps a different stored index'
);

SELECT * FROM finish();
ROLLBACK;
