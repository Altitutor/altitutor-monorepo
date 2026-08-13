BEGIN;
SELECT plan(5);

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

SELECT is(
  (
    SELECT string_agg(category.name, ',' ORDER BY category.name)
    FROM public.question_stem_categories category
    WHERE category.id IN (
      'b35d193a-d054-4ac2-8ae3-669ac1ff79bc',
      '24df84c6-47d7-45d3-a255-e32d23c20eef',
      'af97ced6-4266-4926-988b-2cc6cf288e23'
    )
  ),
  'Interpreting Information and Drawing Conclusions,Probabilistic and Statistical Reasoning,Syllogisms',
  'the reviewed migration targets stable canonical Decision Making categories'
);

CREATE TEMP TABLE category_migration_stem AS
SELECT public.tutor_ucat_upsert_question_stem_bundle(
  NULL,
  'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
  '24df84c6-47d7-45d3-a255-e32d23c20eef',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Applied business conditions"}]}]}'::jsonb,
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
            'content', jsonb_build_array(jsonb_build_object(
              'type', 'text',
              'text', 'Conclusion ' || option_index
            ))
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
    SELECT stem.question_stem_category_id
    FROM public.question_stems stem
    WHERE stem.id = (SELECT id FROM category_migration_stem)
  ),
  '24df84c6-47d7-45d3-a255-e32d23c20eef'::uuid,
  'the fixture starts in Interpreting Information and Drawing Conclusions'
);

UPDATE public.question_stems
SET question_stem_category_id = 'b35d193a-d054-4ac2-8ae3-669ac1ff79bc'
WHERE id = (SELECT id FROM category_migration_stem);

SELECT is(
  (
    SELECT question.response_type::text || '/' || question.answer_scheme::text
    FROM public.ucat_questions question
    WHERE question.question_stem_id = (SELECT id FROM category_migration_stem)
      AND question.deleted_at IS NULL
  ),
  'drag_and_drop/decision_making_binary_placement',
  'moving a stem to Syllogisms does not change its response contract'
);

UPDATE public.question_stems
SET question_stem_category_id = 'af97ced6-4266-4926-988b-2cc6cf288e23'
WHERE id = (SELECT id FROM category_migration_stem);

SELECT is(
  (
    SELECT question.response_type::text || '/' || question.answer_scheme::text
    FROM public.ucat_questions question
    WHERE question.question_stem_id = (SELECT id FROM category_migration_stem)
      AND question.deleted_at IS NULL
  ),
  'drag_and_drop/decision_making_binary_placement',
  'moving a stem to Probability does not change its response contract'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.question_stems stem
    WHERE stem.id = 'e421a4e9-308b-44c3-a709-0a9008085524'
      AND stem.deleted_at IS NULL
  ),
  'the approved garbage stem is absent or quarantined locally'
);

SELECT * FROM finish();
ROLLBACK;
