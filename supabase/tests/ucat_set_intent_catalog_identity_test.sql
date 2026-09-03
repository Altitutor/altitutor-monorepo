BEGIN;
SELECT plan(32);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(to_regclass('public.question_sets_ucat_mocks'), NULL,
  'the obsolete mock membership junction is absent');

SELECT is(public.ucat_question_set_catalog_name(
  'f3000000-0000-4000-8000-000000000001', false
), 'Verbal Reasoning Full Set 1', 'standalone expanded names are deterministic');
SELECT is(public.ucat_question_set_catalog_name(
  'f3000000-0000-4000-8000-000000000001', true
), 'VR Full Set 1', 'standalone compact names are deterministic');

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is((SELECT name FROM public.vstudent_ucat_mocks
  WHERE id = 'f4000000-0000-4000-8000-000000000001'),
  'Mock 1', 'Student mock views expose deterministic names under authenticated RLS');
SELECT is((SELECT display_name FROM public.vstudent_ucat_question_sets
  WHERE id = 'f3000000-0000-4000-8000-000000000001'),
  'Verbal Reasoning Full Set 1',
  'Student Set views expose deterministic names under authenticated RLS');
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

UPDATE public.question_sets
SET timing_mode = 'pace', pace_multiplier = 0.7, fixed_time_limit_seconds = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000001';
SELECT is((SELECT time_limit_seconds FROM public.question_sets
  WHERE id = 'f3000000-0000-4000-8000-000000000001'), 1886,
  '0.7x pace grants more time and rounds the resolved seconds up');

UPDATE public.question_sets
SET timing_mode = 'fixed', pace_multiplier = NULL, fixed_time_limit_seconds = 333
WHERE id = 'f3000000-0000-4000-8000-000000000001';
SELECT is((SELECT time_limit_seconds FROM public.question_sets
  WHERE id = 'f3000000-0000-4000-8000-000000000001'), 333,
  'fixed timing resolves to its explicit duration');

UPDATE public.question_sets
SET timing_mode = 'untimed', pace_multiplier = NULL, fixed_time_limit_seconds = NULL
WHERE id = 'f3000000-0000-4000-8000-000000000001';
SELECT is((SELECT time_limit_seconds FROM public.question_sets
  WHERE id = 'f3000000-0000-4000-8000-000000000001'), NULL,
  'untimed intent resolves to no time limit');

CREATE TEMP TABLE test_catalog_ids (kind TEXT PRIMARY KEY, id UUID NOT NULL);
INSERT INTO test_catalog_ids(kind, id)
SELECT 'mock', public.tutor_ucat_upsert_mock_v2(
  NULL, 'Internal benchmark note', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
);

SELECT is((SELECT count(*)::INTEGER FROM public.question_sets
  WHERE mock_id = (SELECT id FROM test_catalog_ids WHERE kind = 'mock')), 0,
  'creating a mock does not materialize empty component sets');
SELECT is(public.ucat_mock_catalog_name((SELECT id FROM test_catalog_ids WHERE kind = 'mock')),
  'Mock', 'a newly created mock is unnumbered until it is published');
SELECT is((SELECT catalog_index FROM public.ucat_mocks
  WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'mock')), NULL,
  'creating a mock does not consume a published catalog index');
SELECT lives_ok($$SELECT public.tutor_ucat_reorder_mocks(
  ARRAY[
    'f4000000-0000-4000-8000-000000000002'::UUID,
    'f4000000-0000-4000-8000-000000000001'::UUID
  ]
)$$, 'published mocks can be reordered without unpublished mocks');
SELECT is((SELECT catalog_index FROM public.ucat_mocks
  WHERE id = 'f4000000-0000-4000-8000-000000000002'), 1,
  'reordering published mocks updates deterministic numbering');
SELECT throws_ok(
  format(
    'SELECT public.tutor_ucat_reorder_mocks(ARRAY[%L::uuid, %L::uuid, %L::uuid])',
    'f4000000-0000-4000-8000-000000000002',
    'f4000000-0000-4000-8000-000000000001',
    (SELECT id FROM test_catalog_ids WHERE kind = 'mock')
  ),
  'P0001',
  'mock_catalog_order_must_include_every_published_mock_once',
  'unpublished mocks cannot be included in the published mock order'
);

INSERT INTO test_catalog_ids(kind, id)
SELECT 'component', public.tutor_ucat_upsert_question_set_v2(
  NULL, NULL, '{}'::JSONB, 'pace', 1, NULL, 'full_section', 'public', '[]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  '54100000-0000-4000-8000-000000000001'
);
SELECT public.tutor_ucat_attach_mock_set(
  (SELECT id FROM test_catalog_ids WHERE kind = 'mock'),
  (SELECT id FROM test_catalog_ids WHERE kind = 'component')
);

SELECT is((SELECT count(*)::INTEGER FROM public.question_sets
  WHERE mock_id = (SELECT id FROM test_catalog_ids WHERE kind = 'mock')), 1,
  'a component set can be created separately and attached to the mock');
SELECT is((SELECT bool_and(
    set_format = 'full_section' AND timing_mode = 'pace' AND pace_multiplier = 1
    AND reference_blueprint_id = '54100000-0000-4000-8000-000000000001'
  ) FROM public.question_sets
  WHERE mock_id = (SELECT id FROM test_catalog_ids WHERE kind = 'mock')), TRUE,
  'component sets carry exact full-section exam-pace intent');

SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM test_catalog_ids WHERE kind = 'component'), false
), 'Verbal Reasoning Full Set',
  'a draft mock does not give an unpublished component a mock-relative name');
SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM test_catalog_ids WHERE kind = 'component'), true
), 'VR Full Set',
  'unpublished components keep unnumbered compact standalone names on a draft mock');

SELECT lives_ok(format(
  'SELECT public.tutor_ucat_detach_mock_set(%L::uuid)',
  (SELECT id FROM test_catalog_ids WHERE kind = 'component')
), 'a draft component can be detached without deleting it');
SELECT is((SELECT mock_id FROM public.question_sets
  WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component')), NULL,
  'detachment turns the same set into a standalone set');
SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM test_catalog_ids WHERE kind = 'component'), false
), 'Verbal Reasoning Full Set', 'an unpublished detached set has no catalog number');
SELECT is((SELECT catalog_index FROM public.question_sets
  WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component')), NULL,
  'an unpublished standalone set does not consume a catalog index');
UPDATE public.question_sets
SET status = 'published'
WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component');
SELECT is((SELECT catalog_index FROM public.question_sets
  WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component')), 3,
  'publishing a standalone set appends it to the published ordering scope');
SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM test_catalog_ids WHERE kind = 'component'), false
), 'Verbal Reasoning Full Set 3',
  'published standalone names use the published-only index');
UPDATE public.question_sets
SET status = 'draft'
WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component');
SELECT ok(
  public.ucat_content_publication_issues(
    'set', (SELECT id FROM test_catalog_ids WHERE kind = 'component')
  ) @> '[{"code":"full_section_question_count_mismatch"}]'::JSONB,
  'full-section intent validates the exact blueprint question count before publication'
);

SELECT lives_ok(format(
  'SELECT public.tutor_ucat_attach_mock_set(%L::uuid, %L::uuid)',
  (SELECT id FROM test_catalog_ids WHERE kind = 'mock'),
  (SELECT id FROM test_catalog_ids WHERE kind = 'component')
), 'the detached set can be attached back to its owning mock');
SELECT is((SELECT reference_blueprint_id FROM public.question_sets
  WHERE id = (SELECT id FROM test_catalog_ids WHERE kind = 'component')),
  '54100000-0000-4000-8000-000000000001'::UUID,
  'attachment rebases the set reference to the mock blueprint');

SELECT lives_ok($$SELECT public.tutor_ucat_reorder_question_sets(
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  'full_section',
  ARRAY[
    'f3000000-0000-4000-8000-000000000002'::UUID,
    'f3000000-0000-4000-8000-000000000001'::UUID
  ]
)$$, 'standalone sets can be reordered within section and format');
SELECT is((SELECT catalog_index FROM public.question_sets
  WHERE id = 'f3000000-0000-4000-8000-000000000002'), 1,
  'reordering updates deterministic numbering');

SELECT lives_ok(format(
  'SELECT public.tutor_ucat_delete_mock(%L::uuid)',
  (SELECT id FROM test_catalog_ids WHERE kind = 'mock')
), 'a mock with no session dependencies can be soft deleted');
SELECT is((SELECT count(*)::INTEGER FROM public.question_sets
  WHERE mock_id = (SELECT id FROM test_catalog_ids WHERE kind = 'mock')
    AND deleted_at IS NULL), 1,
  'soft deleting a mock preserves its attached component sets');
SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM test_catalog_ids WHERE kind = 'component'), false
), 'Verbal Reasoning Full Set',
  'a deleted mock does not keep a mock-relative catalog name');

SELECT * FROM finish();
ROLLBACK;
