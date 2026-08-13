BEGIN;
SELECT plan(23);

SELECT col_not_null(
  'public',
  'ucat_questions',
  'response_type',
  'canonical Response type is required after activation'
);

SELECT col_not_null(
  'public',
  'ucat_questions',
  'answer_scheme',
  'canonical Answer scheme is required after activation'
);

SELECT has_table(
  'public',
  'ucat_response_contract_legacy_write_observations',
  'the compatibility window records legacy-only writes'
);

SELECT ok(
  (
    SELECT class.relrowsecurity
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname = 'ucat_response_contract_legacy_write_observations'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ucat_response_contract_legacy_write_observations'
  ),
  'legacy-write observations are protected by deny-by-default RLS'
);

SELECT results_eq(
  $$
    SELECT check_name, issue_count
    FROM public.ucat_response_contract_activation_report('-infinity'::timestamptz)
    WHERE check_name NOT LIKE 'legacy_%_writes_since_observation'
    ORDER BY check_name
  $$,
  $$VALUES
    ('invalid_answer_keys'::text, 0::bigint),
    ('legacy_answer_snapshots'::text, 0::bigint),
    ('missing_content_snapshot_contracts'::text, 0::bigint),
    ('missing_question_contracts'::text, 0::bigint),
    ('response_type_scheme_mismatches'::text, 0::bigint),
    ('unresolved_published_classifications'::text, 0::bigint)
  $$,
  'the activated local dataset has no unresolved canonical-contract issues'
);

SELECT is(
  public.ucat_canonical_response_snapshot(
    'a4410000-0000-4000-8000-000000000001'::uuid,
    'decision_making_binary_placement',
    jsonb_build_object(
      'type', 'syllogism_v1',
      'answers', jsonb_build_array(
        jsonb_build_object(
          'question_answer_option_id',
          'a4420000-0000-4000-8000-000000000001',
          'answer', true
        ),
        jsonb_build_object(
          'question_answer_option_id',
          'a4420000-0000-4000-8000-000000000002',
          'answer', false
        )
      )
    ),
    NULL
  ),
  jsonb_build_object(
    'type', 'ucat_response_v1',
    'questionId', 'a4410000-0000-4000-8000-000000000001',
    'answerScheme', 'decision_making_binary_placement',
    'response', jsonb_build_object(
      'kind', 'placement',
      'placements', jsonb_build_object(
        'a4420000-0000-4000-8000-000000000001', 'yes',
        'a4420000-0000-4000-8000-000000000002', 'no'
      )
    )
  ),
  'legacy DM snapshots convert deterministically to ucat_response_v1'
);

SELECT is(
  public.ucat_canonical_response_snapshot(
    'a4410000-0000-4000-8000-000000000003'::uuid,
    'single_choice',
    NULL,
    'a4420000-0000-4000-8000-000000000003'::uuid
  ),
  jsonb_build_object(
    'type', 'ucat_response_v1',
    'questionId', 'a4410000-0000-4000-8000-000000000003',
    'answerScheme', 'single_choice',
    'response', jsonb_build_object(
      'kind', 'single_select',
      'selectedOptionId', 'a4420000-0000-4000-8000-000000000003'
    )
  ),
  'legacy selected-option attempts gain a canonical snapshot'
);

SELECT is(
  public.ucat_canonical_content_snapshot(
    jsonb_build_object(
      'schemaVersion', 1,
      'stem', jsonb_build_object('sectionName', 'Decision Making'),
      'question', jsonb_build_object(
        'id', 'a4410000-0000-4000-8000-000000000004',
        'questionType', 'syllogism'
      ),
      'answerOptions', jsonb_build_array(
        jsonb_build_object('id', 'yes-option', 'isAnswer', true),
        jsonb_build_object('id', 'no-option', 'isAnswer', false)
      )
    )
  ) #>> '{question,responseType}',
  'drag_and_drop',
  'historical content snapshots gain their canonical Response type'
);

SELECT is(
  public.ucat_canonical_content_snapshot(
    jsonb_build_object(
      'schemaVersion', 1,
      'stem', jsonb_build_object('sectionName', 'Decision Making'),
      'question', jsonb_build_object(
        'id', 'a4410000-0000-4000-8000-000000000004',
        'questionType', 'syllogism'
      ),
      'answerOptions', jsonb_build_array(
        jsonb_build_object('id', 'yes-option', 'isAnswer', true),
        jsonb_build_object('id', 'no-option', 'isAnswer', false)
      )
    )
  ) #>> '{answerOptions,1,answerKeyValue}',
  'no',
  'historical content snapshot options gain canonical answer keys'
);

INSERT INTO public.question_stems (id, section_id, stem_text)
VALUES (
  'a4400000-0000-4000-8000-000000000001',
  'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
  '{"type":"doc","content":[]}'::jsonb
);

INSERT INTO public.ucat_questions (
  id,
  question_stem_id,
  question_text,
  index,
  question_type
)
VALUES (
  'a4410000-0000-4000-8000-000000000005',
  'a4400000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[]}'::jsonb,
  0,
  'syllogism'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_response_contract_legacy_write_observations
    WHERE record_id = 'a4410000-0000-4000-8000-000000000005'
      AND relation_name = 'ucat_questions'
  ),
  1::bigint,
  'a legacy-only question write is observed during compatibility'
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
  'a4410000-0000-4000-8000-000000000006',
  'a4400000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[]}'::jsonb,
  1,
  'multiple_choice',
  'single_choice'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_response_contract_legacy_write_observations
    WHERE record_id = 'a4410000-0000-4000-8000-000000000006'
  ),
  0::bigint,
  'a canonical question write does not create a legacy observation'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  is_answer
)
VALUES (
  'a4420000-0000-4000-8000-000000000005',
  'a4410000-0000-4000-8000-000000000005',
  '{"type":"doc","content":[]}'::jsonb,
  0,
  true
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_response_contract_legacy_write_observations
    WHERE record_id = 'a4420000-0000-4000-8000-000000000005'
      AND relation_name = 'question_answer_options'
  ),
  1::bigint,
  'a detectable legacy-only answer-key write is observed'
);

SELECT is(
  (
    SELECT issue_count
    FROM public.ucat_response_contract_activation_report('-infinity'::timestamptz)
    WHERE check_name = 'legacy_question_writes_since_observation'
  ),
  1::bigint,
  'the activation report counts legacy question writes in its observation window'
);

SELECT is(
  (
    SELECT issue_count
    FROM public.ucat_response_contract_activation_report('-infinity'::timestamptz)
    WHERE check_name = 'legacy_answer_key_writes_since_observation'
  ),
  1::bigint,
  'the activation report counts detectable legacy answer-key writes'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    INSERT INTO public.ucat_questions (
      id,
      question_stem_id,
      question_text,
      index,
      question_type
    ) VALUES (
      'a4410000-0000-4000-8000-000000000009',
      'a4400000-0000-4000-8000-000000000001',
      '{"type":"doc","content":[]}'::jsonb,
      3,
      'multiple_choice'
    )
  $$,
  'an authenticated ADMINSTAFF legacy write is not blocked by observation-table RLS'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)
    FROM public.ucat_response_contract_legacy_write_observations
    WHERE record_id = 'a4410000-0000-4000-8000-000000000009'
      AND relation_name = 'ucat_questions'
  ),
  1::bigint,
  'an authenticated ADMINSTAFF legacy write is recorded for observation'
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
  'a4410000-0000-4000-8000-000000000008',
  'a4400000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[]}'::jsonb,
  2,
  'drag_and_drop',
  'situational_judgement_most_least'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  answer_key_value
)
VALUES (
  'a4420000-0000-4000-8000-000000000008',
  'a4410000-0000-4000-8000-000000000008',
  '{"type":"doc","content":[]}'::jsonb,
  0,
  'most'
);

SELECT ok(
  (
    SELECT sample_ids @> ARRAY['a4410000-0000-4000-8000-000000000008'::uuid]
    FROM public.ucat_response_contract_activation_report('-infinity'::timestamptz)
    WHERE check_name = 'invalid_answer_keys'
  ),
  'the activation report rejects incomplete Most/Least key cardinality'
);

SELECT throws_ok(
  $$
    SELECT public.ucat_canonical_response_snapshot(
      'a4410000-0000-4000-8000-000000000007'::uuid,
      'decision_making_binary_placement',
      '{"type":"syllogism_v1","answers":[{"answer":true}]}'::jsonb,
      NULL
    )
  $$,
  'P0001',
  'Malformed legacy UCAT response snapshot',
  'malformed legacy snapshots fail closed instead of being guessed'
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
  'a4410000-0000-4000-8000-000000000010',
  'a4400000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[]}'::jsonb,
  4,
  'multiple_choice',
  'single_choice'
);

INSERT INTO public.question_answer_options (
  id,
  question_id,
  answer_text,
  index,
  answer_key_value
)
VALUES (
  'a4420000-0000-4000-8000-000000000010',
  'a4410000-0000-4000-8000-000000000010',
  '{"type":"doc","content":[]}'::jsonb,
  0,
  'correct'
);

ALTER TABLE public.student_question_attempts
  DISABLE TRIGGER validate_ucat_question_attempt_response;

INSERT INTO public.student_question_attempts (
  id,
  student_id,
  question_id,
  question_answer_option_id
)
SELECT
  'a4430000-0000-4000-8000-000000000010',
  student.id,
  'a4410000-0000-4000-8000-000000000010',
  'a4420000-0000-4000-8000-000000000010'
FROM public.students student
ORDER BY student.id
LIMIT 1;

ALTER TABLE public.student_question_attempts
  ENABLE TRIGGER validate_ucat_question_attempt_response;

UPDATE public.question_answer_options
SET deleted_at = clock_timestamp()
WHERE id = 'a4420000-0000-4000-8000-000000000010';

UPDATE public.ucat_questions
SET deleted_at = clock_timestamp()
WHERE id = 'a4410000-0000-4000-8000-000000000010';

SELECT lives_ok(
  $$
    UPDATE public.student_question_attempts
    SET answer_snapshot = public.ucat_canonical_response_snapshot(
      question_id,
      'single_choice',
      answer_snapshot,
      question_answer_option_id
    )
    WHERE id = 'a4430000-0000-4000-8000-000000000010'
  $$,
  'historical attempts convert after their question and option are soft-deleted'
);

SELECT is(
  (
    SELECT answer_snapshot->>'type'
    FROM public.student_question_attempts
    WHERE id = 'a4430000-0000-4000-8000-000000000010'
  ),
  'ucat_response_v1',
  'the soft-deleted historical attempt stores a canonical response snapshot'
);

INSERT INTO public.ucat_questions (
  id,
  question_stem_id,
  question_text,
  index,
  response_type,
  answer_scheme
)
VALUES
  (
    'a4410000-0000-4000-8000-000000000011',
    'a4400000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[]}'::jsonb,
    5,
    'drag_and_drop',
    'decision_making_binary_placement'
  ),
  (
    'a4410000-0000-4000-8000-000000000012',
    'a4400000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[]}'::jsonb,
    6,
    'drag_and_drop',
    'decision_making_binary_placement'
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
    'a4420000-0000-4000-8000-000000000011',
    'a4410000-0000-4000-8000-000000000011',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'yes'
  ),
  (
    'a4420000-0000-4000-8000-000000000012',
    'a4410000-0000-4000-8000-000000000012',
    '{"type":"doc","content":[]}'::jsonb,
    0,
    'no'
  );

ALTER TABLE public.student_question_attempts
  DISABLE TRIGGER validate_ucat_question_attempt_response;

INSERT INTO public.student_question_attempts (
  id,
  student_id,
  question_id,
  answer_snapshot
)
SELECT
  'a4430000-0000-4000-8000-000000000011',
  student.id,
  'a4410000-0000-4000-8000-000000000011',
  jsonb_build_object(
    'type', 'syllogism_v1',
    'answers', jsonb_build_array(
      jsonb_build_object(
        'question_answer_option_id', 'a4420000-0000-4000-8000-000000000012',
        'answer', false
      ),
      jsonb_build_object(
        'question_answer_option_id', 'a4420000-0000-4000-8000-000000000011',
        'answer', true
      )
    )
  )
FROM public.students student
ORDER BY student.id
LIMIT 1;

ALTER TABLE public.student_question_attempts
  ENABLE TRIGGER validate_ucat_question_attempt_response;

SELECT lives_ok(
  $$
    UPDATE public.student_question_attempts
    SET answer_snapshot = public.ucat_canonical_attempt_response_snapshot(
      question_id,
      'decision_making_binary_placement',
      answer_snapshot,
      question_answer_option_id
    )
    WHERE id = 'a4430000-0000-4000-8000-000000000011'
  $$,
  'legacy conversion removes placement answers belonging to another question'
);

SELECT is(
  (
    SELECT answer_snapshot#>'{response,placements}'
    FROM public.student_question_attempts
    WHERE id = 'a4430000-0000-4000-8000-000000000011'
  ),
  jsonb_build_object('a4420000-0000-4000-8000-000000000011', 'yes'),
  'legacy conversion preserves only this attempt question''s placement evidence'
);

SELECT throws_ok(
  $$
    SELECT public.ucat_canonical_attempt_response_snapshot(
      'a4410000-0000-4000-8000-000000000011',
      'decision_making_binary_placement',
      '{"type":"syllogism_v1","answers":[{"answer":true}]}'::jsonb,
      NULL
    )
  $$,
  'P0001',
  'Malformed legacy UCAT response snapshot',
  'attempt canonicalization still rejects structurally malformed legacy answers'
);

SELECT * FROM finish();
ROLLBACK;
