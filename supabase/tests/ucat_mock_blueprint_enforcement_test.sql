BEGIN;
SELECT plan(8);

SELECT has_column('public', 'ucat_mocks', 'blueprint_id', 'full mocks may reference an immutable blueprint');
SELECT has_function('public', 'ucat_mock_blueprint_compliance', ARRAY['uuid'], 'mock compliance is a durable database projection');

INSERT INTO public.ucat_mock_blueprints (
  id, code, test_year, version, official_facts_label, altitutor_policy_label
) VALUES (
  '54200000-0000-4000-8000-000000000001', 'test-2027-v1', 2027, 1, 'Test facts', 'Test policy'
);

INSERT INTO public.ucat_mock_blueprint_sections (
  blueprint_id, section_code, section_index, exact_question_count,
  answering_time_seconds, instruction_time_seconds, altitutor_composition_policy
) VALUES (
  '54200000-0000-4000-8000-000000000001', 'decision_making', 0, 4, 240, 90,
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
  id, question_stem_id, question_text, index, question_type, response_type, answer_scheme
)
SELECT
  ('54220000-0000-4000-8000-' || lpad(row_number() OVER ()::text, 12, '0'))::uuid,
  stem.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Question"}]}]}'::jsonb,
  1, 'multiple_choice', 'multiple_choice', 'single_choice'
FROM public.question_stems stem
WHERE stem.id::text LIKE '54210000-0000-4000-8000-%';

INSERT INTO public.question_sets (id, name, time_limit_seconds, status, access_scope)
VALUES (
  '54230000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
  240, 'published', 'public'
);

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
SELECT stem.id, '54230000-0000-4000-8000-000000000001', row_number() OVER (ORDER BY stem.id)
FROM public.question_stems stem
WHERE stem.id::text LIKE '54210000-0000-4000-8000-%';

INSERT INTO public.ucat_mocks (id, name, status, access_scope, blueprint_id)
VALUES ('54240000-0000-4000-8000-000000000001', 'Blueprint mock', 'in_review', 'public', '54200000-0000-4000-8000-000000000001');

INSERT INTO public.question_sets_ucat_mocks (question_set_id, ucat_mock_id, index)
VALUES ('54230000-0000-4000-8000-000000000001', '54240000-0000-4000-8000-000000000001', 1);

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

UPDATE public.ucat_mocks SET blueprint_id = NULL
WHERE id = '54240000-0000-4000-8000-000000000001';

SELECT is(
  public.ucat_mock_blueprint_compliance('54240000-0000-4000-8000-000000000001')->>'applicable',
  'false',
  'an unversioned mock remains outside blueprint enforcement'
);

SELECT * FROM finish();
ROLLBACK;
