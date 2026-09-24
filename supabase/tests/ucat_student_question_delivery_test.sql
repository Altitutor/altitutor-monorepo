BEGIN;

SELECT plan(6);

SELECT has_function(
  'public',
  'get_student_ucat_question_set_engine_payload',
  ARRAY['uuid'],
  'the bounded student question-set delivery function exists'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_student_ucat_question_set_engine_payload(uuid)',
    'EXECUTE'
  ),
  'authenticated students can execute bounded question-set delivery'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_student_ucat_question_set_engine_payload(uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute bounded question-set delivery'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  public.get_student_ucat_question_set_engine_payload(
    'f3000000-0000-4000-8000-000000000002'
  )->>'source_type',
  'set',
  'an entitled student receives a set payload'
);

SELECT ok(
  jsonb_array_length(
    public.get_student_ucat_question_set_engine_payload(
      'f3000000-0000-4000-8000-000000000002'
    )->'stem_details'
  ) > 0,
  'the delivered payload contains stem details'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.get_student_ucat_question_set_engine_payload(
        'f3000000-0000-4000-8000-000000000002'
      )->'stem_details'
    ) stem,
    LATERAL jsonb_array_elements(stem->'questions') question
    WHERE question->>'response_type' IS NULL
       OR question->>'answer_scheme' IS NULL
       OR jsonb_array_length(question->'answer_options') < 2
  ),
  'every delivered question retains a complete canonical response contract'
);

SELECT * FROM finish();
ROLLBACK;
