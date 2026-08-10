BEGIN;
SELECT plan(16);

SELECT has_table('public', 'ucat_mock_blueprint_eligibility_audits', 'blueprint eligibility decisions are durable');
SELECT has_function('public', 'tutor_ucat_audit_mock_blueprint', ARRAY['uuid', 'uuid'], 'tutors can run a candidate audit');
SELECT has_function('public', 'tutor_ucat_confirm_mock_blueprint_audit', ARRAY['uuid'], 'tutors can confirm a passing audit');

INSERT INTO public.ucat_mock_blueprints (
  id, code, test_year, version, official_facts_label, altitutor_policy_label
) VALUES (
  '54300000-0000-4000-8000-000000000001', 'test-audit-2027-v1', 2027, 2, 'Test facts', 'Test policy'
);
INSERT INTO public.ucat_mock_blueprint_sections (
  blueprint_id, section_code, section_index, exact_question_count,
  answering_time_seconds, instruction_time_seconds, altitutor_composition_policy
) VALUES (
  '54300000-0000-4000-8000-000000000001', 'decision_making', 0, 2, 120, 90,
  '{"categoryRules":[{"category":"Syllogisms","unit":"questions","min":2,"max":2}]}'::jsonb
);

INSERT INTO public.question_stems (id, section_id, question_stem_category_id, stem_text, status, access_scope, presentation_format)
SELECT input.id, section.id, category.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"All foxes sleep."}]}]}'::jsonb,
  'published', 'public', 'passage'
FROM (VALUES
  ('54310000-0000-4000-8000-000000000001'::uuid),
  ('54310000-0000-4000-8000-000000000002'::uuid)
) input(id)
JOIN public.ucat_sections section ON section.section_number = 2
JOIN public.question_stem_categories category ON category.ucat_section_id = section.id AND category.name = 'Syllogisms';

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, answer_explanation, index, question_type, response_type, answer_scheme
)
SELECT ('54320000-0000-4000-8000-' || lpad(row_number() OVER ()::text, 12, '0'))::uuid, stem.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Conclusion"}]}]}'::jsonb,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Reason"}]}]}'::jsonb,
  1, 'multiple_choice', 'multiple_choice', 'single_choice'
FROM public.question_stems stem WHERE stem.id::text LIKE '54310000-0000-4000-8000-%';

INSERT INTO public.question_answer_options (question_id, answer_text, index, is_answer, answer_key_value)
SELECT question.id, jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object(
  'type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',option.index::text))))),
  option.index, option.index = 1, CASE WHEN option.index = 1 THEN 'correct'::public.ucat_answer_key_value END
FROM public.ucat_questions question CROSS JOIN generate_series(1, 2) option(index)
WHERE question.question_stem_id::text LIKE '54310000-0000-4000-8000-%';

INSERT INTO public.question_sets (id, name, time_limit_seconds, status, access_scope)
VALUES ('54330000-0000-4000-8000-000000000001', '{"type":"doc"}'::jsonb, 120, 'published', 'public');
INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
SELECT id, '54330000-0000-4000-8000-000000000001', row_number() OVER (ORDER BY id)
FROM public.question_stems WHERE id::text LIKE '54310000-0000-4000-8000-%';
INSERT INTO public.ucat_mocks (id, name, status, access_scope)
VALUES ('54340000-0000-4000-8000-000000000001', 'Legacy mock', 'in_review', 'public');
INSERT INTO public.question_sets_ucat_mocks (question_set_id, ucat_mock_id, index)
VALUES ('54330000-0000-4000-8000-000000000001', '54340000-0000-4000-8000-000000000001', 1);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);

SELECT is((SELECT blueprint_id FROM public.ucat_mocks WHERE id = '54340000-0000-4000-8000-000000000001'), NULL,
  'legacy mocks begin without a blanket blueprint attachment');

SELECT lives_ok($$SELECT public.tutor_ucat_audit_mock_blueprint(
  '54340000-0000-4000-8000-000000000001', '54300000-0000-4000-8000-000000000001')$$,
  'a tutor can audit an unattached candidate without changing its composition');
SELECT is((SELECT decision::text FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'eligible',
  'a fully passing candidate is eligible');
SELECT ok((SELECT gate_results ?& ARRAY['compliance','publicationState','sectionPurity','provisionalMetadata']
  FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1),
  'the durable audit records deterministic gate groups');
SELECT is((SELECT blueprint_id FROM public.ucat_mocks WHERE id = '54340000-0000-4000-8000-000000000001'), NULL,
  'running an audit never attaches or recomposes a mock');

SELECT lives_ok($$SELECT public.tutor_ucat_confirm_mock_blueprint_audit(
  (SELECT id FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1))$$,
  'a tutor can confirm a currently passing candidate');
SELECT is((SELECT blueprint_id FROM public.ucat_mocks WHERE id = '54340000-0000-4000-8000-000000000001'),
  '54300000-0000-4000-8000-000000000001'::uuid, 'confirmation attaches the reviewed immutable blueprint');
SELECT is((SELECT decision::text FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'attached',
  'confirmation remains visible in the durable decision record');

UPDATE public.ucat_mocks SET blueprint_id = NULL WHERE id = '54340000-0000-4000-8000-000000000001';
UPDATE public.question_stems SET question_stem_category_id = NULL
WHERE id = '54310000-0000-4000-8000-000000000001';
SELECT public.tutor_ucat_audit_mock_blueprint(
  '54340000-0000-4000-8000-000000000001', '54300000-0000-4000-8000-000000000001');
SELECT is((SELECT decision::text FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'provisional',
  'unresolved Decision Making classification is provisional rather than attached');
SELECT throws_ok($$SELECT public.tutor_ucat_confirm_mock_blueprint_audit(
  (SELECT id FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1))$$,
  'P0001', 'mock_blueprint_audit_not_eligible', 'a provisional candidate cannot be confirmed');

UPDATE public.question_stems SET question_stem_category_id = (
  SELECT category.id FROM public.question_stem_categories category
  JOIN public.ucat_sections section ON section.id = category.ucat_section_id
  WHERE section.section_number = 2 AND category.name = 'Syllogisms'
) WHERE id = '54310000-0000-4000-8000-000000000001';
UPDATE public.question_sets SET status = 'draft' WHERE id = '54330000-0000-4000-8000-000000000001';
SELECT public.tutor_ucat_audit_mock_blueprint(
  '54340000-0000-4000-8000-000000000001', '54300000-0000-4000-8000-000000000001');
SELECT is((SELECT decision::text FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1), 'failed',
  'unpublished shared content fails without being changed automatically');
SELECT ok((SELECT gate_results #>> '{publicationState,compliant}' FROM public.ucat_mock_blueprint_eligibility_audits ORDER BY checked_at DESC LIMIT 1) = 'false',
  'the failed publication-state reason remains durable');

SELECT throws_ok($$SELECT public.tutor_ucat_upsert_mock(
  '54340000-0000-4000-8000-000000000001', 'Legacy mock', 'public',
  '["54330000-0000-4000-8000-000000000001"]'::jsonb, NULL,
  '54300000-0000-4000-8000-000000000001')$$,
  'P0001', 'mock_blueprint_requires_eligible_audit', 'ordinary mock edits cannot bypass audited confirmation');

SELECT * FROM finish();
ROLLBACK;
