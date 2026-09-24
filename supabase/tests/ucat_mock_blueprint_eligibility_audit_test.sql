BEGIN;
SELECT plan(17);

SELECT has_table('public', 'ucat_mock_blueprint_eligibility_audits', 'blueprint eligibility decisions are durable');
SELECT has_function('public', 'tutor_ucat_audit_mock_blueprint', ARRAY['uuid', 'uuid'], 'tutors can run a candidate audit');
SELECT has_function('public', 'tutor_ucat_confirm_mock_blueprint_audit', ARRAY['uuid'], 'tutors can confirm a passing audit');

INSERT INTO public.ucat_mock_blueprints (
  id, code, test_year, version, official_facts_label, altitutor_policy_label
) VALUES
  ('54300000-0000-4000-8000-000000000001', 'test-audit-v1', 2027, 1, 'Test facts', 'Test policy'),
  ('54300000-0000-4000-8000-000000000002', 'test-audit-v2', 2027, 2, 'Test facts', 'Test policy');
INSERT INTO public.ucat_mock_blueprint_sections (
  blueprint_id, section_code, section_index, exact_question_count,
  answering_time_seconds, instruction_time_seconds, altitutor_composition_policy
)
SELECT blueprint_id, 'decision_making', 1, 2, 120, 90,
  '{"categoryRules":[{"category":"Syllogisms","unit":"questions","min":2,"max":2}]}'::JSONB
FROM (VALUES
  ('54300000-0000-4000-8000-000000000001'::UUID),
  ('54300000-0000-4000-8000-000000000002'::UUID)
) source(blueprint_id);

INSERT INTO public.question_stems (id, section_id, question_stem_category_id, stem_text, status, access_scope)
SELECT input.id, section.id, category.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"All foxes sleep."}]}]}'::JSONB,
  'published', 'public'
FROM (VALUES
  ('54310000-0000-4000-8000-000000000001'::UUID),
  ('54310000-0000-4000-8000-000000000002'::UUID)
) input(id)
JOIN public.ucat_sections section ON section.section_number = 2
JOIN public.question_stem_categories category
  ON category.ucat_section_id = section.id AND category.name = 'Syllogisms';

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, answer_explanation, index, response_type, answer_scheme
)
SELECT ('54320000-0000-4000-8000-' || lpad(row_number() OVER ()::TEXT, 12, '0'))::UUID,
  stem.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Conclusion"}]}]}'::JSONB,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Reason"}]}]}'::JSONB,
  1, 'multiple_choice', 'single_choice'
FROM public.question_stems stem WHERE stem.id::TEXT LIKE '54310000-0000-4000-8000-%';

INSERT INTO public.question_answer_options (question_id, answer_text, index, answer_key_value)
SELECT question.id,
  jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
    'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',option.index::TEXT))))),
  option.index, CASE WHEN option.index = 1 THEN 'correct'::public.ucat_answer_key_value END
FROM public.ucat_questions question CROSS JOIN generate_series(1, 2) option(index)
WHERE question.question_stem_id::TEXT LIKE '54310000-0000-4000-8000-%';

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

CREATE TEMP TABLE audit_mock AS
SELECT public.tutor_ucat_upsert_mock_v2(
  NULL, 'Audit test', 'public', NULL,
  '54300000-0000-4000-8000-000000000001'
) AS id;

CREATE TEMP TABLE audit_component AS
SELECT public.tutor_ucat_upsert_question_set_v2(
  NULL, NULL, '{}'::JSONB, 'pace', 1, NULL, 'full_section', 'public', '[]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 2),
  '54300000-0000-4000-8000-000000000001'
) AS id;

SELECT public.tutor_ucat_attach_mock_set(
  (SELECT id FROM audit_mock),
  (SELECT id FROM audit_component)
);

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
SELECT stem.id, component.id, row_number() OVER (ORDER BY stem.id)
FROM public.question_sets component
JOIN audit_mock mock ON mock.id = component.mock_id
CROSS JOIN public.question_stems stem
WHERE stem.id::TEXT LIKE '54310000-0000-4000-8000-%';
UPDATE public.question_sets SET status = 'published'
WHERE mock_id = (SELECT id FROM audit_mock);

SELECT is(
  (SELECT blueprint_id FROM public.ucat_mocks WHERE id = (SELECT id FROM audit_mock)),
  '54300000-0000-4000-8000-000000000001'::UUID,
  'a mock is created with an explicit blueprint'
);
SELECT lives_ok(format(
  'SELECT public.tutor_ucat_audit_mock_blueprint(%L::uuid, %L::uuid)',
  (SELECT id FROM audit_mock), '54300000-0000-4000-8000-000000000002'
), 'a tutor can audit a replacement blueprint without changing composition');
SELECT is((SELECT decision::TEXT FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'eligible',
  'a fully passing replacement candidate is eligible');
SELECT ok((SELECT gate_results ?& ARRAY['compliance','publicationState','sectionPurity','provisionalMetadata']
  FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1),
  'the durable audit records deterministic gate groups');
SELECT is((SELECT blueprint_id FROM public.ucat_mocks WHERE id = (SELECT id FROM audit_mock)),
  '54300000-0000-4000-8000-000000000001'::UUID,
  'running an audit never changes the attached blueprint');

SELECT lives_ok($$SELECT public.tutor_ucat_confirm_mock_blueprint_audit(
  (SELECT id FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1))$$,
  'a tutor can confirm a currently passing candidate');
SELECT is((SELECT blueprint_id FROM public.ucat_mocks WHERE id = (SELECT id FROM audit_mock)),
  '54300000-0000-4000-8000-000000000002'::UUID,
  'confirmation replaces the reviewed immutable blueprint');
SELECT is((SELECT count(*)::INTEGER FROM public.question_sets
  WHERE mock_id = (SELECT id FROM audit_mock)
    AND reference_blueprint_id = '54300000-0000-4000-8000-000000000002'),
  1, 'confirmation rebases every component reference atomically');
SELECT is((SELECT decision::TEXT FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'attached',
  'confirmation remains visible in the durable decision record');

UPDATE public.question_stems SET question_stem_category_id = NULL
WHERE id = '54310000-0000-4000-8000-000000000001';
SELECT public.tutor_ucat_audit_mock_blueprint(
  (SELECT id FROM audit_mock), '54300000-0000-4000-8000-000000000001');
SELECT is((SELECT decision::TEXT FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'provisional',
  'unresolved Decision Making classification is provisional');
SELECT throws_ok($$SELECT public.tutor_ucat_confirm_mock_blueprint_audit(
  (SELECT id FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1))$$,
  'P0001', 'mock_blueprint_audit_not_eligible', 'a provisional candidate cannot be confirmed');

UPDATE public.question_sets SET status = 'draft' WHERE mock_id = (SELECT id FROM audit_mock);
SELECT public.tutor_ucat_audit_mock_blueprint(
  (SELECT id FROM audit_mock), '54300000-0000-4000-8000-000000000001');
SELECT is((SELECT decision::TEXT FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'failed',
  'unpublished component content fails without being changed automatically');
SELECT ok((SELECT gate_results #>> '{publicationState,compliant}'
  FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1) = 'false',
  'the failed publication-state reason remains durable');

SELECT throws_ok(format(
  'SELECT public.tutor_ucat_upsert_mock_v2(%L::uuid, %L, %L, NULL, %L::uuid)',
  (SELECT id FROM audit_mock), 'Audit test', 'public',
  '54300000-0000-4000-8000-000000000001'
), 'P0001', 'mock_blueprint_requires_eligible_audit',
  'ordinary mock edits cannot bypass audited replacement');

SELECT * FROM finish();
ROLLBACK;
