BEGIN;
SELECT plan(4);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

CREATE TEMP TABLE shape_mock AS
SELECT public.tutor_ucat_upsert_mock_v2(
  NULL, 'Shape test', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
) AS id;

SELECT is(
  (public.ucat_mock_blueprint_compliance((SELECT id FROM shape_mock))->>'compliant')::BOOLEAN,
  FALSE,
  'an empty generated full mock is not blueprint compliant'
);

SELECT ok(
  public.ucat_content_publication_issues('mock', (SELECT id FROM shape_mock)) @>
    '[{"code":"blueprint_noncompliant"}]'::JSONB,
  'blueprint noncompliance blocks mock publication'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.question_sets
   WHERE mock_id = (SELECT id FROM shape_mock)
     AND set_format = 'full_section'
     AND timing_mode = 'pace'
     AND pace_multiplier = 1),
  4,
  'generated mock components have full-section exam-pace intent'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.question_sets component
   JOIN public.ucat_mock_blueprint_sections blueprint_section
     ON blueprint_section.blueprint_id = component.reference_blueprint_id
   JOIN public.ucat_sections section
     ON section.id = component.section_id
    AND section.section_number = blueprint_section.section_index + 1
   WHERE component.mock_id = (SELECT id FROM shape_mock)
     AND component.time_limit_seconds = blueprint_section.answering_time_seconds),
  4,
  'mock component runtime timing resolves to the blueprint section time'
);

SELECT * FROM finish();
ROLLBACK;
