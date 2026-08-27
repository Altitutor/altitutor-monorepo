BEGIN;

SELECT plan(12);

SELECT has_function(
  'public',
  'tutor_ucat_list_stem_picker_catalog',
  ARRAY['uuid', 'integer', 'boolean'],
  'tutor stem pickers have a compact catalog RPC'
);
SELECT has_function(
  'public',
  'tutor_ucat_reconciliation_content_issues',
  ARRAY['uuid[]'],
  'reconciliation has a purpose-built content issue RPC'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.tutor_ucat_list_stem_picker_catalog(uuid,integer,boolean)',
    'EXECUTE'
  ),
  'authenticated staff can execute the compact picker catalog RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.tutor_ucat_list_stem_picker_catalog(uuid,integer,boolean)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the compact picker catalog RPC'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.tutor_ucat_reconciliation_content_issues(uuid[])',
    'EXECUTE'
  ),
  'authenticated staff can execute the reconciliation RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.tutor_ucat_reconciliation_content_issues(uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the reconciliation RPC'
);
SELECT ok(
  (
    SELECT BOOL_AND(procedure.prosecdef)
      AND BOOL_AND(procedure.proconfig @> ARRAY['search_path=""']::TEXT[])
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'tutor_ucat_list_stem_picker_catalog',
        'tutor_ucat_reconciliation_content_issues',
        'tutor_ucat_list_private_stems_not_in_set'
      )
  ),
  'staff catalog RPCs use fixed-path security-definer boundaries'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.enforce_ucat_practice_attempt_quota()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.enforce_ucat_practice_attempt_quota()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.notify_ucat_content_release()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.notify_ucat_content_release()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.refresh_ucat_public_question_counts_cache()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.refresh_ucat_public_question_counts_cache()', 'EXECUTE'),
  'trigger-only UCAT functions cannot be called through PostgREST roles'
);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT
  '00000000-0000-0000-0000-000000000010'::UUID,
  subject.id
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  TRUE
);

SELECT lives_ok(
  $$ SELECT public.tutor_ucat_list_stem_picker_catalog(NULL, 500, FALSE) $$,
  'a UCAT tutor can load the compact picker catalog'
);
SELECT lives_ok(
  $$ SELECT public.tutor_ucat_reconciliation_content_issues(NULL) $$,
  'a UCAT tutor can load reconciliation content issues'
);
SELECT lives_ok(
  $$ SELECT public.tutor_ucat_list_private_stems_not_in_set(NULL, NULL, 1, 25) $$,
  'a UCAT tutor can load the optimized private-stem queue'
);
SELECT ok(
  NOT COALESCE(
    public.tutor_ucat_list_stem_picker_catalog(NULL, 500, FALSE)
      #> '{items,0,questions,0}'
      ? 'question_text',
    FALSE
  ),
  'whole-bank picker questions omit rich question text'
);

SELECT * FROM finish();
ROLLBACK;
