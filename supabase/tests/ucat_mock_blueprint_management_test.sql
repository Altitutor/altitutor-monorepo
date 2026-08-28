BEGIN;
SELECT plan(10);

SELECT has_function(
  'public',
  'tutor_ucat_create_mock_blueprint_version',
  ARRAY['uuid', 'integer', 'text', 'text', 'jsonb'],
  'blueprint versions have an atomic creation function'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges privilege
    WHERE privilege.routine_schema = 'public'
      AND privilege.routine_name = 'tutor_ucat_create_mock_blueprint_version'
      AND privilege.grantee = 'authenticated'
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'authenticated clients cannot bypass the tutor API route'
);

CREATE TEMP TABLE test_blueprint_result (id UUID);
INSERT INTO test_blueprint_result
SELECT public.tutor_ucat_create_mock_blueprint_version(
  '54100000-0000-4000-8000-000000000001',
  2026,
  'Official UCAT ANZ 2026 exact totals and timings',
  'Tutor-managed composition policy',
  jsonb_build_array(
    jsonb_build_object('section','verbal_reasoning','sectionIndex',0,'exactQuestionCount',44,'answeringTimeSeconds',1320,'instructionTimeSeconds',90,'categoryRules','[]'::jsonb),
    jsonb_build_object(
      'section','decision_making','sectionIndex',1,'exactQuestionCount',35,
      'answeringTimeSeconds',2220,'instructionTimeSeconds',90,
      'categoryRules', jsonb_build_array(jsonb_build_object(
        'categoryId', (
          SELECT category.id
          FROM public.question_stem_categories category
          JOIN public.ucat_sections section ON section.id = category.ucat_section_id
          WHERE section.section_number = 2 AND category.name = 'Syllogisms'
          LIMIT 1
        ),
        'unit','questions','min',5,'preferred',6,'max',7
      ))
    ),
    jsonb_build_object('section','quantitative_reasoning','sectionIndex',2,'exactQuestionCount',36,'answeringTimeSeconds',1560,'instructionTimeSeconds',120,'categoryRules','[]'::jsonb),
    jsonb_build_object('section','situational_judgement','sectionIndex',3,'exactQuestionCount',69,'answeringTimeSeconds',1560,'instructionTimeSeconds',90,'categoryRules','[]'::jsonb)
  )
);

SELECT is(
  (SELECT version FROM public.ucat_mock_blueprints WHERE id = (SELECT id FROM test_blueprint_result)),
  2,
  'editing creates the next version'
);

SELECT is(
  (SELECT code FROM public.ucat_mock_blueprints WHERE id = (SELECT id FROM test_blueprint_result)),
  'ucat-anz-2026-v2',
  'the version receives a deterministic code'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.ucat_mock_blueprint_sections WHERE blueprint_id = (SELECT id FROM test_blueprint_result)),
  4,
  'all four sections are stored'
);

SELECT ok(
  (SELECT altitutor_composition_policy ? 'structureRules'
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = (SELECT id FROM test_blueprint_result)
     AND section_code = 'quantitative_reasoning'),
  'advanced source rules survive versioning'
);

SELECT is(
  (SELECT jsonb_array_length(altitutor_composition_policy->'categoryRules')
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = (SELECT id FROM test_blueprint_result)
     AND section_code = 'decision_making'),
  1,
  'editable category rules replace the source rules'
);

SELECT is(
  (SELECT altitutor_composition_policy #>> '{categoryRules,0,category}'
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = (SELECT id FROM test_blueprint_result)
     AND section_code = 'decision_making'),
  'Syllogisms',
  'canonical category ids are resolved to an immutable name snapshot'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_create_mock_blueprint_version(
    NULL, 2027, 'Official facts', 'Policy',
    jsonb_build_array(jsonb_build_object('section','verbal_reasoning'))
  )$$,
  'P0001',
  'mock_blueprint_requires_four_sections',
  'incomplete blueprints are rejected'
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

SELECT lives_ok(
  $$SELECT public.tutor_ucat_upsert_mock(
    NULL,
    'Blueprint-selected draft',
    'private'::public.ucat_access_scope,
    '[]'::jsonb,
    NULL,
    '54100000-0000-4000-8000-000000000001'
  )$$,
  'a blueprint can be selected when a mock draft is created'
);

SELECT * FROM finish();
ROLLBACK;
