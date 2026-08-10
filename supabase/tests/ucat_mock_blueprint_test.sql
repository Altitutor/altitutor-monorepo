BEGIN;
SELECT plan(11);

SELECT has_table('public', 'ucat_mock_blueprints', 'versioned UCAT blueprints are stored');
SELECT has_table('public', 'ucat_mock_blueprint_sections', 'blueprint section facts are stored separately');

SELECT is(
  (SELECT code FROM public.ucat_mock_blueprints WHERE test_year = 2026 AND version = 1),
  'ucat-anz-2026-v1',
  'the immutable 2026 v1 blueprint has a stable code'
);

SELECT is(
  (SELECT count(*)::integer FROM public.ucat_mock_blueprint_sections WHERE blueprint_id = '54100000-0000-4000-8000-000000000001'),
  4,
  'the blueprint stores all four sections'
);

SELECT results_eq(
  $$
    SELECT section_code, exact_question_count, answering_time_seconds, instruction_time_seconds
    FROM public.ucat_mock_blueprint_sections
    WHERE blueprint_id = '54100000-0000-4000-8000-000000000001'
    ORDER BY section_index
  $$,
  $$ VALUES
    ('verbal_reasoning', 44, 1320, 90),
    ('decision_making', 35, 2220, 90),
    ('quantitative_reasoning', 36, 1560, 120),
    ('situational_judgement', 69, 1560, 90)
  $$,
  'official totals and answering/instruction timings are exact and separate'
);

SELECT is(
  (SELECT altitutor_composition_policy #>> '{categoryRules,0,min}'
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = '54100000-0000-4000-8000-000000000001'
     AND section_code = 'decision_making'),
  '5',
  'Decision Making Syllogisms minimum is stored as five questions'
);

SELECT is(
  (SELECT altitutor_composition_policy #>> '{presentationRules,1,max}'
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = '54100000-0000-4000-8000-000000000001'
     AND section_code = 'decision_making'),
  '2',
  'Decision Making table or graph/chart presentation maximum is stored as two questions'
);

SELECT is(
  (SELECT altitutor_composition_policy #>> '{responseContractRules,0,requiredPlacementCount}'
   FROM public.ucat_mock_blueprint_sections
   WHERE blueprint_id = '54100000-0000-4000-8000-000000000001'
     AND section_code = 'situational_judgement'),
  '2',
  'Most/Least cardinality stores two required placements'
);

SELECT throws_ok(
  $$UPDATE public.ucat_mock_blueprints SET version = 2 WHERE code = 'ucat-anz-2026-v1'$$,
  '55000',
  'UCAT mock blueprint versions are immutable; create a new version instead',
  'blueprint versions cannot be updated'
);

SELECT throws_ok(
  $$DELETE FROM public.ucat_mock_blueprint_sections WHERE blueprint_id = '54100000-0000-4000-8000-000000000001' AND section_code = 'verbal_reasoning'$$,
  '55000',
  'UCAT mock blueprint versions are immutable; create a new version instead',
  'historical blueprint section facts cannot be deleted'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.prevent_ucat_mock_blueprint_mutation()', 'EXECUTE'),
  'authenticated callers cannot invoke the immutability trigger directly'
);

SELECT * FROM finish();
ROLLBACK;
