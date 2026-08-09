BEGIN;
SELECT plan(8);

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

CREATE TEMP TABLE activated_stem AS
SELECT public.tutor_ucat_upsert_question_stem_bundle(
  NULL,
  'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
  '24df84c6-47d7-45d3-a255-e32d23c20eef',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Data stem"}]}]}'::jsonb,
  'public',
  jsonb_build_array(jsonb_build_object(
    'index', 1,
    'question_text', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Place Yes or No"}]}]}'::jsonb,
    'question_type', 'syllogism',
    'response_type', 'drag_and_drop',
    'answer_scheme', 'decision_making_binary_placement',
    'tag_ids', '[]'::jsonb,
    'answer_options', (
      SELECT jsonb_agg(jsonb_build_object(
        'index', option_index,
        'answer_text', jsonb_build_object(
          'type', 'doc',
          'content', jsonb_build_array(jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Statement ' || option_index))
          ))
        ),
        'is_answer', option_index <= 2,
        'answer_key_value', CASE WHEN option_index <= 2 THEN 'yes' ELSE 'no' END
      ) ORDER BY option_index)
      FROM generate_series(1, 5) option_index
    )
  )),
  'individual',
  NULL
) AS id;

SELECT is(
  (
    SELECT question.response_type::text || '/' || question.answer_scheme::text
    FROM public.ucat_questions question
    WHERE question.question_stem_id = (SELECT id FROM activated_stem)
      AND question.deleted_at IS NULL
  ),
  'drag_and_drop/decision_making_binary_placement',
  'the tutor bundle RPC writes the canonical question contract'
);

SELECT is(
  (
    SELECT string_agg(option.answer_key_value::text, ',' ORDER BY option.index)
    FROM public.question_answer_options option
    JOIN public.ucat_questions question ON question.id = option.question_id
    WHERE question.question_stem_id = (SELECT id FROM activated_stem)
      AND option.deleted_at IS NULL
  ),
  'yes,yes,no,no,no',
  'the tutor bundle RPC writes the canonical answer key'
);

SELECT is(
  (
    SELECT detail.questions->0->>'response_type'
    FROM public.vtutor_ucat_question_stem_detail detail
    WHERE detail.id = (SELECT id FROM activated_stem)
  ),
  'drag_and_drop',
  'the tutor detail projection carries Response type'
);

SELECT is(
  (
    SELECT detail.questions->0->'answer_options'->0->>'answer_key_value'
    FROM public.vtutor_ucat_question_stem_detail detail
    WHERE detail.id = (SELECT id FROM activated_stem)
  ),
  'yes',
  'the tutor detail projection carries answer-key values'
);

SELECT isnt(
  public.ucat_content_publication_issues('stem', (SELECT id FROM activated_stem)) @>
    '[{"code":"invalid_response_answer_key"}]'::jsonb,
  true,
  'publication accepts a complete Decision Making binary answer key'
);

SELECT ok(
  public.ucat_content_publication_issues('stem', (SELECT id FROM activated_stem)) @>
    '[{"code":"missing_explanations"}]'::jsonb,
  'Decision Making publication requires option explanations'
);

UPDATE public.question_answer_options option
SET answer_explanation = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Explanation"}]}]}'::jsonb
FROM public.ucat_questions question
WHERE option.question_id = question.id
  AND question.question_stem_id = (SELECT id FROM activated_stem);

SELECT isnt(
  public.ucat_content_publication_issues('stem', (SELECT id FROM activated_stem)) @>
    '[{"code":"missing_explanations"}]'::jsonb,
  true,
  'Decision Making publication does not require a question-level explanation'
);

UPDATE public.question_answer_options option
SET answer_key_value = NULL
FROM public.ucat_questions question
WHERE option.question_id = question.id
  AND question.question_stem_id = (SELECT id FROM activated_stem)
  AND option.index = 5;

SELECT ok(
  public.ucat_content_publication_issues('stem', (SELECT id FROM activated_stem)) @>
    '[{"code":"invalid_response_answer_key"}]'::jsonb,
  'publication rejects an incomplete Decision Making binary answer key'
);

SELECT * FROM finish();
ROLLBACK;
