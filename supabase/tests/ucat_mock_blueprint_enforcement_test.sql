BEGIN;
SELECT plan(17);

SELECT has_column('public', 'ucat_mocks', 'blueprint_id', 'full mocks may reference an immutable blueprint');
SELECT has_function('public', 'ucat_mock_blueprint_compliance', ARRAY['uuid'], 'mock compliance is a durable database projection');
SELECT ok(
  has_function_privilege('authenticated', 'public.ucat_mock_blueprint_compliance(uuid)', 'EXECUTE'),
  'authenticated can execute mock blueprint compliance because tutor set views call it'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.ucat_content_publication_issues(text,uuid)', 'EXECUTE'),
  'authenticated can execute publication issues because tutor stem/set views call it'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.ucat_content_before_mock_blueprint_issues(text,uuid)', 'EXECUTE'),
  'the renamed legacy diagnostic does not retain authenticated execution'
);

INSERT INTO public.ucat_mock_blueprints (
  id, code, test_year, version, official_facts_label, altitutor_policy_label
) VALUES (
  '54200000-0000-4000-8000-000000000001', 'test-2027-v1', 2027, 1, 'Test facts', 'Test policy'
);

INSERT INTO public.ucat_mock_blueprint_sections (
  blueprint_id, section_code, section_index, exact_question_count,
  answering_time_seconds, instruction_time_seconds, altitutor_composition_policy
) VALUES (
  '54200000-0000-4000-8000-000000000001', 'decision_making', 1, 4, 240, 90,
  '{"categoryRules":[{"category":"Syllogisms","unit":"questions","min":2,"preferred":2,"max":2},{"category":"Logical Puzzles","unit":"questions","min":2,"preferred":2,"max":2}]}'::jsonb
);

INSERT INTO public.question_stems (id, section_id, question_stem_category_id, stem_text, status, access_scope)
SELECT input.id, section.id, category.id, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}'::jsonb, 'published', 'public'
FROM (VALUES
  ('54210000-0000-4000-8000-000000000001'::uuid, 'Syllogisms'),
  ('54210000-0000-4000-8000-000000000002'::uuid, 'Syllogisms'),
  ('54210000-0000-4000-8000-000000000003'::uuid, 'Logical Puzzles'),
  ('54210000-0000-4000-8000-000000000004'::uuid, 'Logical Puzzles')
) input(id, category_name)
JOIN public.ucat_sections section ON section.section_number = 2
JOIN public.question_stem_categories category
  ON category.ucat_section_id = section.id AND category.name = input.category_name;

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
)
SELECT
  ('54220000-0000-4000-8000-' || lpad(row_number() OVER ()::text, 12, '0'))::uuid,
  stem.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Question"}]}]}'::jsonb,
  1, 'multiple_choice', 'single_choice'
FROM public.question_stems stem
WHERE stem.id::text LIKE '54210000-0000-4000-8000-%';

UPDATE public.ucat_questions
SET answer_explanation = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Explanation"}]}]}'::jsonb
WHERE question_stem_id::text LIKE '54210000-0000-4000-8000-%';

INSERT INTO public.question_answer_options (question_id, answer_text, index, answer_key_value)
SELECT question.id,
  jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object(
    'type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', option.index::text))
  ))),
  option.index,
  CASE WHEN option.index = 1 THEN 'correct'::public.ucat_answer_key_value ELSE NULL END
FROM public.ucat_questions question
CROSS JOIN generate_series(1, 4) AS option(index)
WHERE question.question_stem_id::text LIKE '54210000-0000-4000-8000-%';

INSERT INTO public.ucat_mocks (id, name, status, access_scope, blueprint_id)
VALUES (
  '54240000-0000-4000-8000-000000000001', '', 'in_review', 'public',
  '54200000-0000-4000-8000-000000000001'
);

INSERT INTO public.question_sets (
  id, name, status, access_scope, section_id, set_format, timing_mode,
  pace_multiplier, fixed_time_limit_seconds, reference_blueprint_id, mock_id
)
SELECT
  '54230000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
  'published', 'public', section.id,
  'full_section', 'pace', 1, NULL,
  '54200000-0000-4000-8000-000000000001',
  '54240000-0000-4000-8000-000000000001'
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
SELECT stem.id, '54230000-0000-4000-8000-000000000001', row_number() OVER (ORDER BY stem.id)
FROM public.question_stems stem
WHERE stem.id::text LIKE '54210000-0000-4000-8000-%';

SELECT is(
  public.ucat_mock_blueprint_compliance('54240000-0000-4000-8000-000000000001')->>'compliant',
  'true',
  'an exact whole-stem set inside every range is compliant'
);

DELETE FROM public.question_stems_question_sets
WHERE question_set_id = '54230000-0000-4000-8000-000000000001'
  AND question_stem_id = '54210000-0000-4000-8000-000000000004';

SELECT is(
  public.ucat_mock_blueprint_compliance('54240000-0000-4000-8000-000000000001')->>'compliant',
  'false',
  'shared-set edits recalculate linked mock compliance without repairing composition'
);

SELECT is(
  (SELECT check_item->>'actual'
   FROM jsonb_array_elements(public.ucat_mock_blueprint_compliance('54240000-0000-4000-8000-000000000001') #> '{sections,0,checks}') check_item
   WHERE check_item->>'label' = 'Logical Puzzles'),
  '1',
  'the durable report exposes the current actual value for a failed range'
);

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES ('54210000-0000-4000-8000-000000000004', '54230000-0000-4000-8000-000000000001', 4);
UPDATE public.ucat_mocks SET status = 'published'
WHERE id = '54240000-0000-4000-8000-000000000001';
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
SELECT lives_ok(
  $$SELECT public.tutor_ucat_upsert_question_stem_bundle(
    '54210000-0000-4000-8000-000000000004',
    (SELECT section_id FROM public.question_stems WHERE id = '54210000-0000-4000-8000-000000000004'),
    (SELECT id FROM public.question_stem_categories WHERE name = 'Syllogisms' AND ucat_section_id =
      (SELECT section_id FROM public.question_stems WHERE id = '54210000-0000-4000-8000-000000000004')),
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test"}]}]}'::jsonb,
    'public',
    (SELECT jsonb_agg(jsonb_build_object(
      'id', question.id, 'index', question.index, 'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'response_type', question.response_type,
      'answer_scheme', question.answer_scheme,
      'answer_options', (SELECT jsonb_agg(jsonb_build_object(
        'id', option.id, 'index', option.index, 'answer_text', option.answer_text,
        'answer_key_value', option.answer_key_value
      ) ORDER BY option.index) FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.deleted_at IS NULL)
    )) FROM public.ucat_questions question
      WHERE question.question_stem_id = '54210000-0000-4000-8000-000000000004' AND question.deleted_at IS NULL)
  )$$,
  'category-range misses do not block saving a stem on a published mock'
);

SELECT is(
  public.ucat_mock_blueprint_compliance('54240000-0000-4000-8000-000000000001')->>'compliant',
  'true',
  'a published mock stays publication-compliant when only category ranges miss'
);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_upsert_question_set_v2(
    '54230000-0000-4000-8000-000000000001',
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
    'pace', 1, NULL, 'full_section', 'public',
    '["54210000-0000-4000-8000-000000000001","54210000-0000-4000-8000-000000000002","54210000-0000-4000-8000-000000000003","54210000-0000-4000-8000-000000000004"]'::jsonb,
    (SELECT section_id FROM public.question_sets WHERE id = '54230000-0000-4000-8000-000000000001'),
    '54200000-0000-4000-8000-000000000001'
  )$$,
  'category-range misses do not block saving a published mock component set'
);

UPDATE public.ucat_mocks
SET deleted_at = timezone('utc', now()),
    catalog_index = NULL
WHERE id = '54240000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$SELECT public.tutor_ucat_upsert_question_set_v2(
    '54230000-0000-4000-8000-000000000001',
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
    'pace', 1, NULL, 'full_section', 'public',
    '["54210000-0000-4000-8000-000000000001","54210000-0000-4000-8000-000000000002","54210000-0000-4000-8000-000000000003","54210000-0000-4000-8000-000000000004"]'::jsonb,
    (SELECT section_id FROM public.question_sets WHERE id = '54230000-0000-4000-8000-000000000001'),
    '54200000-0000-4000-8000-000000000001'
  )$$,
  'a leftover mock_id on a deleted mock does not block saving a published set'
);

UPDATE public.ucat_mocks
SET deleted_at = NULL
WHERE id = '54240000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$SELECT public.tutor_ucat_bulk_update_question_stem_metadata(
    ARRAY['54210000-0000-4000-8000-000000000004'::uuid],
    'b35d193a-d054-4ac2-8ae3-669ac1ff79bc',
    NULL
  )$$,
  'bulk category edits do not block when question totals still match'
);
SELECT throws_ok(
  $$SELECT public.tutor_ucat_upsert_question_set_v2(
    '54230000-0000-4000-8000-000000000001',
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
    'pace', 1, NULL, 'full_section', 'public',
    '["54210000-0000-4000-8000-000000000001","54210000-0000-4000-8000-000000000002","54210000-0000-4000-8000-000000000003"]'::jsonb,
    (SELECT section_id FROM public.question_sets WHERE id = '54230000-0000-4000-8000-000000000001'),
    '54200000-0000-4000-8000-000000000001'
  )$$,
  'P0001',
  'published_content_invalid:[{"code": "full_section_question_count_mismatch", "message": "A full section set requires exactly 4 questions for its reference blueprint; found 3.", "entity_id": "54230000-0000-4000-8000-000000000001", "entity_type": "set"}]',
  'shared-set edits cannot violate their own full-section publication intent'
);

DELETE FROM public.question_stems_question_sets
WHERE question_set_id = '54230000-0000-4000-8000-000000000001'
  AND question_stem_id = '54210000-0000-4000-8000-000000000004';

SELECT ok(
  public.ucat_content_publication_issues('mock', '54240000-0000-4000-8000-000000000001') @>
    '[{"code":"blueprint_noncompliant"}]'::jsonb,
  'blueprint noncompliance blocks full-mock publication'
);

SELECT ok(
  NOT public.ucat_content_publication_issues('set', '54230000-0000-4000-8000-000000000001') @>
    '[{"code":"blueprint_noncompliant"}]'::jsonb,
  'ordinary and focused sets are not independently constrained by full-mock ranges'
);

SELECT col_not_null(
  'public', 'ucat_mocks', 'blueprint_id',
  'every mock now requires an explicit blueprint'
);

SELECT * FROM finish();
ROLLBACK;
