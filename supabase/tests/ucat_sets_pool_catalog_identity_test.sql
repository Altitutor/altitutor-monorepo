BEGIN;
SELECT plan(15);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(public.ucat_question_set_catalog_name(
  'f3100000-0000-4000-8000-000000000001', false
), 'Mock 1 Verbal Reasoning',
  'a published mock still names its occupied component set');

CREATE TEMP TABLE pool_catalog_ids (kind TEXT PRIMARY KEY, id UUID NOT NULL);
INSERT INTO pool_catalog_ids(kind, id)
SELECT 'mock', public.tutor_ucat_upsert_mock_v2(
  NULL, 'Occupancy catalog fixture', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
);

INSERT INTO pool_catalog_ids(kind, id)
SELECT 'set', public.tutor_ucat_upsert_question_set_v2(
  NULL, NULL, '{}'::JSONB, 'pace', 1, NULL, 'full_section', 'public', '[]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  '54100000-0000-4000-8000-000000000001'
);
UPDATE public.question_sets
SET status = 'published'
WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set');

SELECT ok(
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')) IS NOT NULL,
  'publishing a standalone set assigns a sets-pool catalog index'
);

SELECT public.tutor_ucat_attach_mock_set(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'mock'),
  (SELECT id FROM pool_catalog_ids WHERE kind = 'set')
);

SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'set'), false
), format(
  'Verbal Reasoning Full Set %s',
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set'))
), 'a draft mock does not replace the standalone catalog name');

SELECT ok(
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')) IS NOT NULL,
  'attaching to a draft mock keeps the sets-pool catalog index'
);

SELECT ok(
  (SELECT is_available_in_sets_pool FROM public.vtutor_ucat_question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')),
  'a draft mock leaves the published set in the sets pool'
);

UPDATE public.ucat_mocks
SET status = 'published'
WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'mock');

SELECT is((SELECT catalog_index FROM public.ucat_mocks
  WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'mock')), 3,
  'publishing a mock appends it to the published catalog sequence');
SELECT is(public.ucat_mock_catalog_name(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'mock')
), 'Mock 3', 'a published mock uses its published-only catalog index');

SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'set'), false
), format(
  'Mock %s Verbal Reasoning',
  (SELECT catalog_index FROM public.ucat_mocks
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'mock'))
), 'publishing the mock switches the set to a mock-relative name');

SELECT is((SELECT catalog_index FROM public.question_sets
  WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')), NULL,
  'an occupying published mock clears the standalone catalog index');

SELECT is((SELECT is_available_in_sets_pool FROM public.vtutor_ucat_question_sets
  WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')), FALSE,
  'a published mock reserves the set from the sets pool');

UPDATE public.ucat_mocks
SET status = 'draft'
WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'mock');

SELECT is((SELECT catalog_index FROM public.ucat_mocks
  WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'mock')), NULL,
  'withdrawing a mock releases its published catalog index');

SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'set'), false
), format(
  'Verbal Reasoning Full Set %s',
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set'))
), 'withdrawing the mock restores a numbered standalone catalog name');

SELECT ok(
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')) IS NOT NULL,
  'withdrawing the mock returns the set to the standalone sequence'
);

SELECT public.tutor_ucat_delete_mock(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'mock')
);

SELECT is(public.ucat_question_set_catalog_name(
  (SELECT id FROM pool_catalog_ids WHERE kind = 'set'), false
), format(
  'Verbal Reasoning Full Set %s',
  (SELECT catalog_index FROM public.question_sets
    WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set'))
), 'a deleted mock does not name its surviving published component set');

SELECT is((SELECT mock_id FROM public.question_sets
  WHERE id = (SELECT id FROM pool_catalog_ids WHERE kind = 'set')),
  (SELECT id FROM pool_catalog_ids WHERE kind = 'mock'),
  'soft deleting a mock keeps component-set ownership for restore');

SELECT * FROM finish();
ROLLBACK;
