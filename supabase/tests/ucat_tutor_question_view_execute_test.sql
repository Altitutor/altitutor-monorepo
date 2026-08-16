BEGIN;
SELECT plan(8);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.ucat_content_publication_issues(text,uuid)',
    'EXECUTE'
  ),
  'authenticated can execute publication issues so tutor stem/set views do not 403'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.ucat_mock_blueprint_compliance(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute mock blueprint compliance so tutor set views do not 403'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.ucat_content_before_mock_blueprint_issues(text,uuid)',
    'EXECUTE'
  ),
  'the unused legacy diagnostic remains unexecutable by authenticated'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    SELECT publication_issues
    FROM public.vtutor_ucat_question_stem_detail
    LIMIT 1
  $$,
  'authenticated tutors can select stem detail including publication_issues'
);

SELECT lives_ok(
  $$
    SELECT publication_issues, linked_mock_blueprint_compliance
    FROM public.vtutor_ucat_question_sets
    LIMIT 1
  $$,
  'authenticated tutors can select question sets including publication and blueprint columns'
);

SELECT lives_ok(
  $$
    SELECT publication_issues
    FROM public.vtutor_ucat_question_set_detail
    LIMIT 1
  $$,
  'authenticated tutors can select set detail including publication_issues'
);

SELECT lives_ok(
  $$
    SELECT publication_issues, blueprint_compliance
    FROM public.vtutor_ucat_mocks
    LIMIT 1
  $$,
  'authenticated tutors can select mocks including publication and blueprint columns'
);

SELECT lives_ok(
  $$
    SELECT publication_issues, blueprint_compliance
    FROM public.vtutor_ucat_mock_detail
    LIMIT 1
  $$,
  'authenticated tutors can select mock detail including publication and blueprint columns'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
