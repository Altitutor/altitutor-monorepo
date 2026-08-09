BEGIN;
SELECT plan(12);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.sync_ucat_question_response_contract()',
    'EXECUTE'
  ),
  'authenticated callers cannot invoke the question compatibility trigger directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.sync_ucat_answer_option_key()',
    'EXECUTE'
  ),
  'authenticated callers cannot invoke the answer-key compatibility trigger directly'
);

INSERT INTO public.question_stems (id, section_id, stem_text)
VALUES
  (
    'fc100000-0000-4000-8000-000000000001',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    '{"type":"doc","content":[]}'::jsonb
  ),
  (
    'fc100000-0000-4000-8000-000000000002',
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
    '{"type":"doc","content":[]}'::jsonb
  ),
  (
    'fc100000-0000-4000-8000-000000000003',
    '8dfbf286-e952-4581-b065-255ead834628',
    '{"type":"doc","content":[]}'::jsonb
  );

INSERT INTO public.ucat_questions (
  id,
  question_stem_id,
  question_text,
  index,
  question_type
)
VALUES
  (
    'fc110000-0000-4000-8000-000000000001',
    'fc100000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'multiple_choice'
  ),
  (
    'fc110000-0000-4000-8000-000000000002',
    'fc100000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'syllogism'
  ),
  (
    'fc110000-0000-4000-8000-000000000003',
    'fc100000-0000-4000-8000-000000000003',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'multiple_choice'
  );

SELECT is(
  (SELECT response_type::text FROM public.ucat_questions WHERE id = 'fc110000-0000-4000-8000-000000000001'),
  'multiple_choice',
  'legacy multiple-choice writes populate the canonical Response type'
);

SELECT is(
  (SELECT answer_scheme::text FROM public.ucat_questions WHERE id = 'fc110000-0000-4000-8000-000000000003'),
  'situational_judgement_rating',
  'legacy SJT writes populate the rating Answer scheme'
);

SELECT is(
  (
    SELECT response_type::text || '/' || answer_scheme::text
    FROM public.ucat_questions
    WHERE id = 'fc110000-0000-4000-8000-000000000002'
  ),
  'drag_and_drop/decision_making_binary_placement',
  'legacy syllogism writes populate the DM binary placement contract'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  is_answer
)
VALUES
  (
    'fc120000-0000-4000-8000-000000000001',
    'fc110000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    true
  ),
  (
    'fc120000-0000-4000-8000-000000000002',
    'fc110000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[]}'::jsonb,
    1,
    false
  );

SELECT is(
  (SELECT answer_key_value::text FROM public.question_answer_options WHERE id = 'fc120000-0000-4000-8000-000000000001'),
  'yes',
  'legacy true DM keys become Yes placements'
);

SELECT is(
  (SELECT answer_key_value::text FROM public.question_answer_options WHERE id = 'fc120000-0000-4000-8000-000000000002'),
  'no',
  'legacy false DM keys become No placements'
);

INSERT INTO public.ucat_questions (
  id,
  question_stem_id,
  question_text,
  index,
  response_type,
  answer_scheme
)
VALUES (
  'fc110000-0000-4000-8000-000000000004',
  'fc100000-0000-4000-8000-000000000002',
  '{"type":"doc","content":[]}'::jsonb,
  1,
  'drag_and_drop',
  'decision_making_binary_placement'
);

SELECT is(
  (SELECT question_type::text FROM public.ucat_questions WHERE id = 'fc110000-0000-4000-8000-000000000004'),
  'syllogism',
  'canonical DM writes keep the legacy question type coherent'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  answer_key_value
)
VALUES (
  'fc120000-0000-4000-8000-000000000003',
  'fc110000-0000-4000-8000-000000000004',
  '{"type":"doc","content":[]}'::jsonb,
  0,
  'no'
);

SELECT is(
  (SELECT is_answer FROM public.question_answer_options WHERE id = 'fc120000-0000-4000-8000-000000000003'),
  false,
  'canonical No placements keep the legacy Boolean key coherent'
);

INSERT INTO public.ucat_questions (
  id,
  question_stem_id,
  question_text,
  index,
  response_type,
  answer_scheme
)
VALUES (
  'fc110000-0000-4000-8000-000000000005',
  'fc100000-0000-4000-8000-000000000003',
  '{"type":"doc","content":[]}'::jsonb,
  1,
  'drag_and_drop',
  'situational_judgement_most_least'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.ucat_content_publication_issues(
        'stem',
        'fc100000-0000-4000-8000-000000000003'
      )
    ) issue
    WHERE issue ->> 'code' = 'sj_most_least_not_activated'
  ),
  'Most/Least publication remains blocked during foundation expansion'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  answer_key_value
)
VALUES
  (
    'fc120000-0000-4000-8000-000000000004',
    'fc110000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'least'
  ),
  (
    'fc120000-0000-4000-8000-000000000005',
    'fc110000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[]}'::jsonb,
    1,
    NULL
  );

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.ucat_content_publication_issues(
        'stem',
        'fc100000-0000-4000-8000-000000000001'
      )
    ) issue
    WHERE issue ->> 'code' = 'invalid_response_answer_key'
  ),
  'publication rejects a canonical key that is invalid for its Answer scheme'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.question_stem_categories
    WHERE id IN (
      '24df84c6-47d7-45d3-a255-e32d23c20eef',
      'd97a0bf2-aa09-4ec3-86bb-5dd5146a9a57'
    )
  ),
  2,
  'the two accepted candidate-facing categories are present'
);

SELECT * FROM finish();
ROLLBACK;
