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

INSERT INTO public.question_stems (
  id, section_id, question_stem_category_id, stem_text, status, access_scope
)
VALUES (
  '54510000-0000-4000-8000-000000000001',
  'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
  '6e445f57-7ee1-4cc7-8e46-3a928fb2ab7e',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR"}]}]}'::jsonb,
  'published',
  'public'
);

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
)
VALUES (
  '54520000-0000-4000-8000-000000000001',
  '54510000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Question"}]}]}'::jsonb,
  1, 'multiple_choice', 'single_choice'
);

SELECT ok(
  public.ucat_content_publication_issues('stem', '54510000-0000-4000-8000-000000000001') @>
    '[{"code":"vr_question_count"}]'::jsonb,
  'a Verbal Reasoning stem with fewer than four questions remains unpublishable'
);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_bulk_update_question_stem_metadata(
    ARRAY['54510000-0000-4000-8000-000000000001'::uuid],
    NULL,
    'private'
  )$$,
  'a published VR stem can be made private when it has no public parent'
);

SELECT is(
  (SELECT access_scope::text FROM public.question_stems WHERE id = '54510000-0000-4000-8000-000000000001'),
  'private',
  'the visibility flip persists when no public parent blocks it'
);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_bulk_update_question_stem_metadata(
    ARRAY['54510000-0000-4000-8000-000000000001'::uuid],
    NULL,
    'public'
  )$$,
  'a published VR stem can be made public without satisfying publication gates'
);

INSERT INTO public.ucat_mocks (
  id, name, status, access_scope, blueprint_id, catalog_index
)
VALUES (
  '54540000-0000-4000-8000-000000000001', '', 'published', 'public',
  '54100000-0000-4000-8000-000000000001', 99
);

INSERT INTO public.question_sets (
  id, name, status, access_scope, section_id, set_format, timing_mode,
  pace_multiplier, fixed_time_limit_seconds, reference_blueprint_id, mock_id
)
VALUES (
  '54530000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Public set"}]}]}'::jsonb,
  'published', 'public',
  'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
  'full_section', 'pace', 1, NULL,
  '54100000-0000-4000-8000-000000000001',
  '54540000-0000-4000-8000-000000000001'
);

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES ('54510000-0000-4000-8000-000000000001', '54530000-0000-4000-8000-000000000001', 1);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_set_content_access(
    'stem',
    '54510000-0000-4000-8000-000000000001',
    'private'
  )$$,
  'P0001',
  'private_child_of_public_set',
  'a stem in a public set cannot be made private'
);

SELECT ok(
  public.tutor_ucat_content_visibility_blockers(
    'stem',
    '54510000-0000-4000-8000-000000000001',
    'private'
  ) @> jsonb_build_array(jsonb_build_object(
    'code', 'private_child_of_public_set',
    'entity_type', 'set',
    'entity_id', '54530000-0000-4000-8000-000000000001'::uuid
  )),
  'the visibility blocker names the public parent set'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_set_content_access(
    'set',
    '54530000-0000-4000-8000-000000000001',
    'private'
  )$$,
  'P0001',
  'private_child_of_public_mock',
  'a set in a public mock cannot be made private'
);

SELECT ok(
  public.tutor_ucat_content_visibility_blockers(
    'set',
    '54530000-0000-4000-8000-000000000001',
    'private'
  ) @> jsonb_build_array(jsonb_build_object(
    'code', 'private_child_of_public_mock',
    'entity_type', 'mock',
    'entity_id', '54540000-0000-4000-8000-000000000001'::uuid
  )),
  'the visibility blocker names the public parent mock'
);

SELECT * FROM finish();
ROLLBACK;
