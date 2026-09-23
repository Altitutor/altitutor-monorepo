BEGIN;

SELECT plan(3);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM pg_catalog.pg_constraint constraint_record
    JOIN pg_catalog.pg_class relation ON relation.oid = constraint_record.conrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'sessions'
      AND constraint_record.conname = 'sessions_drafting_subject_required_check'
      AND constraint_record.contype = 'c'
  ),
  1,
  'Drafting sessions require a Subject'
);

SELECT throws_ok(
  $$
    INSERT INTO public.sessions (id, type)
    VALUES ('dfa70000-0000-4000-8000-000000000001', 'DRAFTING')
  $$,
  '23514',
  'new row for relation "sessions" violates check constraint "sessions_drafting_subject_required_check"',
  'a subjectless Drafting session is rejected'
);

SELECT lives_ok(
  $$
    INSERT INTO public.sessions (id, type, subject_id)
    SELECT
      'dfa70000-0000-4000-8000-000000000002',
      'DRAFTING',
      id
    FROM public.subjects
    ORDER BY id
    LIMIT 1
  $$,
  'a Drafting session can store its selected Subject directly'
);

SELECT * FROM finish();

ROLLBACK;
