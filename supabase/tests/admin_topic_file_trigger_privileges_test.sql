BEGIN;
SELECT plan(5);

SELECT ok(
  (
    SELECT NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      AND procedure.proconfig @> ARRAY['search_path=public']::text[]
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'recalculate_topic_file_indices_for_siblings'
  ),
  'topic-file reindex helper is private and uses a fixed search path'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    UPDATE public.topics_files
    SET type = 'NOTES'
    WHERE id = '55627936-db87-4e6c-b792-ef966e180bad'
  $$,
  'ADMINSTAFF can move a topic file between sibling groups'
);

SELECT lives_ok(
  $$
    DELETE FROM public.topics_files
    WHERE id = '55627936-db87-4e6c-b792-ef966e180bad'
  $$,
  'ADMINSTAFF can delete a topic file while its siblings are reindexed'
);

RESET ROLE;

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=public']::text[]
      AND NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'trigger_recalculate_topic_file_siblings_after_update'
  ),
  'topic-file update trigger uses a private fixed-path security-definer boundary'
);

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=public']::text[]
      AND NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'trigger_recalculate_topic_file_siblings_after_delete'
  ),
  'topic-file delete trigger uses a private fixed-path security-definer boundary'
);

SELECT * FROM finish();
ROLLBACK;
