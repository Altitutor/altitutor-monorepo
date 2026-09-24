BEGIN;
SELECT plan(16);

SELECT hasnt_column(
  'public',
  'ucat_questions',
  'question_type',
  'questions no longer store the legacy interaction type'
);

SELECT hasnt_column(
  'public',
  'question_answer_options',
  'is_answer',
  'answer options no longer store the legacy Boolean key'
);

SELECT hasnt_type(
  'public',
  'ucat_question_type',
  'the legacy question type enum is removed'
);

SELECT hasnt_column(
  'public',
  'student_question_attempts',
  'question_answer_option_id',
  'attempts store only the canonical response snapshot'
);

SELECT col_not_null(
  'public',
  'ucat_questions',
  'response_type',
  'canonical Response type remains required'
);

SELECT col_not_null(
  'public',
  'ucat_questions',
  'answer_scheme',
  'canonical Answer scheme remains required'
);

SELECT has_column(
  'public',
  'question_answer_options',
  'answer_key_value',
  'canonical answer-key storage remains available'
);

SELECT hasnt_table(
  'public',
  'ucat_response_contract_legacy_write_observations',
  'compatibility-write telemetry is removed after verification'
);

SELECT hasnt_function(
  'public',
  'ucat_canonical_response_snapshot',
  ARRAY['uuid', 'ucat_answer_scheme', 'jsonb', 'uuid'],
  'the historical response conversion helper is removed'
);

SELECT hasnt_function(
  'public',
  'ucat_canonical_content_snapshot',
  ARRAY['jsonb'],
  'the historical content conversion helper is removed'
);

SELECT hasnt_function(
  'public',
  'tutor_ucat_upsert_stem_response_adapter',
  ARRAY[
    'uuid', 'uuid', 'uuid', 'jsonb', 'ucat_access_scope', 'jsonb',
    'ucat_question_source_channel', 'text'
  ],
  'the expansion-era storage adapter is removed'
);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', subject.id
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.tutor_ucat_upsert_question_stem_bundle(
      NULL,
      '8dfbf286-e952-4581-b065-255ead834628',
      NULL,
      '{"type":"doc","content":[]}'::jsonb,
      'public',
      '[{"index":1,"question_text":{},"answer_options":[]}]'::jsonb,
      'individual',
      NULL
    )
  $$,
  'P0001',
  'canonical_response_contract_required',
  'the public writer rejects a noncanonical question payload'
);

CREATE TEMP TABLE contraction_stem AS
SELECT public.tutor_ucat_upsert_question_stem_bundle(
  NULL,
  '8dfbf286-e952-4581-b065-255ead834628',
  NULL,
  '{"type":"doc","content":[]}'::jsonb,
  'public',
  jsonb_build_array(jsonb_build_object(
    'index', 1,
    'question_text', '{}'::jsonb,
    'response_type', 'multiple_choice',
    'answer_scheme', 'single_choice',
    'tag_ids', '[]'::jsonb,
    'answer_options', jsonb_build_array(
      jsonb_build_object('index', 1, 'answer_text', '{}'::jsonb, 'answer_key_value', 'correct'),
      jsonb_build_object('index', 2, 'answer_text', '{}'::jsonb, 'answer_key_value', NULL)
    )
  )),
  'individual',
  NULL
) AS id;

SELECT results_eq(
  $$
    SELECT response_type::text, answer_scheme::text
    FROM public.ucat_questions
    WHERE question_stem_id = (SELECT id FROM contraction_stem)
  $$,
  $$ VALUES ('multiple_choice', 'single_choice') $$,
  'the canonical writer persists the response contract'
);

SELECT results_eq(
  $$
    SELECT option.answer_key_value::text
    FROM public.question_answer_options option
    JOIN public.ucat_questions question ON question.id = option.question_id
    WHERE question.question_stem_id = (SELECT id FROM contraction_stem)
    ORDER BY option.index
  $$,
  $$ VALUES ('correct'), (NULL::text) $$,
  'the canonical writer persists answer keys without Boolean aliases'
);

SELECT is(
  (
    SELECT detail.questions->0->>'answer_scheme'
    FROM public.vtutor_ucat_question_stem_detail detail
    WHERE detail.id = (SELECT id FROM contraction_stem)
  ),
  'single_choice',
  'the tutor detail projection exposes the canonical scheme'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT public.tutor_ucat_upsert_question_stem_bundle(
      (SELECT id FROM contraction_stem),
      '8dfbf286-e952-4581-b065-255ead834628', NULL,
      '{"type":"doc","content":[]}'::jsonb, 'public', '[]'::jsonb,
      'individual', NULL
    )
  $$,
  'P0001',
  'forbidden',
  'students cannot execute the tutor writer'
);

SELECT * FROM finish();
ROLLBACK;
