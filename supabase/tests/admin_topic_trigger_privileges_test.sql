BEGIN;
SELECT plan(8);

SELECT ok(
  (
    SELECT NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'recalculate_topic_indices_for_siblings'
  ),
  'topic reindex helper remains private'
);

SELECT ok(
  (
    SELECT bool_and(
      procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=public']::text[]
      AND NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    )
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'trigger_recalculate_descendants_after_update',
        'trigger_process_deferred_topic_recalc',
        'trigger_recalculate_topic_siblings_after_delete'
      )
  ),
  'topic mutation triggers use private fixed-path security-definer boundaries'
);

INSERT INTO public.topics (id, name, subject_id, parent_id, index, code)
SELECT
  fixture.id::uuid,
  fixture.name,
  parent.subject_id,
  parent.id,
  fixture.index,
  fixture.code
FROM public.topics parent
CROSS JOIN (
  VALUES
    ('a1100000-0000-4000-8000-000000000001', 'Move me', 20, '1.20'),
    ('a1100000-0000-4000-8000-000000000002', 'Delete me', 21, '1.21'),
    ('a1100000-0000-4000-8000-000000000003', 'Keep me', 22, '1.22')
) AS fixture(id, name, index, code)
WHERE parent.id = '30000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    UPDATE public.topics
    SET parent_id = '30000000-0000-0000-0000-000000000002'
    WHERE id = 'a1100000-0000-4000-8000-000000000001'
  $$,
  'ADMINSTAFF can move a subtopic beneath a different topic'
);

SELECT is(
  (
    SELECT parent_id
    FROM public.topics
    WHERE id = 'a1100000-0000-4000-8000-000000000001'
  ),
  '30000000-0000-0000-0000-000000000002'::uuid,
  'the moved subtopic is persisted beneath its new parent'
);

SELECT is(
  (
    SELECT code
    FROM public.topics
    WHERE id = 'a1100000-0000-4000-8000-000000000001'
  ),
  '2.1',
  'the moved subtopic receives the code for its new hierarchy location'
);

SELECT lives_ok(
  $$
    DELETE FROM public.topics
    WHERE id = 'a1100000-0000-4000-8000-000000000002'
  $$,
  'ADMINSTAFF can delete a subtopic while its siblings are reindexed'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.topics
    WHERE id = 'a1100000-0000-4000-8000-000000000002'
  ),
  0,
  'the deleted subtopic is removed'
);

SELECT is(
  (
    SELECT index
    FROM public.topics
    WHERE id = 'a1100000-0000-4000-8000-000000000003'
  ),
  2,
  'deleting a subtopic compacts the remaining sibling indices'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
