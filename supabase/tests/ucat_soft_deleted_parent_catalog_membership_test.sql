BEGIN;
SELECT plan(14);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects
WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  (
    SELECT ucat_mock_ids
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  jsonb_build_array('f4000000-0000-4000-8000-000000000001'::UUID),
  'a live published mock still appears in the tutor set mock-membership column'
);

SELECT is(
  (
    SELECT is_available_in_sets_pool
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'a published mock reserves its published public set from the sets library'
);

UPDATE public.ucat_mocks
SET status = 'draft'
WHERE id = 'f4000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT ucat_mock_ids
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  jsonb_build_array('f4000000-0000-4000-8000-000000000001'::UUID),
  'a draft mock still appears in the tutor set mock-membership column'
);

SELECT is(
  (
    SELECT is_available_in_sets_pool
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'a draft mock does not reserve its published public set from the sets library'
);

UPDATE public.ucat_mocks
SET status = 'in_review'
WHERE id = 'f4000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT is_available_in_sets_pool
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'an in-review mock does not reserve its published public set from the sets library'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT is_available_in_sets_library
    FROM public.vstudent_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'the student catalog includes a published public set whose mock is still in review'
);
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

UPDATE public.ucat_mocks
SET status = 'published'
WHERE id = 'f4000000-0000-4000-8000-000000000001';

UPDATE public.ucat_mocks
SET deleted_at = TIMESTAMPTZ '2026-08-30 12:00:00+00',
    catalog_index = NULL
WHERE id = 'f4000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT ucat_mock_ids
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  '[]'::JSONB,
  'deleted mocks are absent from the tutor set mock-membership column'
);

SELECT is(
  (
    SELECT is_available_in_sets_pool
    FROM public.vtutor_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'a published public set is available in the sets library when its mock is deleted'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
SELECT is(
  (
    SELECT is_available_in_sets_library
    FROM public.vstudent_ucat_question_sets
    WHERE id = 'f3100000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'the student catalog also includes a published public set whose mock is deleted'
);
RESET ROLE;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

INSERT INTO public.question_stems (
  id, section_id, stem_text, status, access_scope
)
SELECT
  'c1400000-0000-4000-8000-000000000001',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Deleted-set membership regression"}]}]}'::JSONB,
  'published',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_sets (
  id, status, access_scope, section_id, set_format, timing_mode,
  fixed_time_limit_seconds, reference_blueprint_id
)
SELECT
  'c1400000-0000-4000-8000-000000000010',
  'published',
  'public',
  section.id,
  'partial_section',
  'fixed',
  60,
  '54100000-0000-4000-8000-000000000001'
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_stems_question_sets (
  question_stem_id, question_set_id, index
)
VALUES (
  'c1400000-0000-4000-8000-000000000001',
  'c1400000-0000-4000-8000-000000000010',
  1
);

SELECT is(
  (
    SELECT set_ids
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'c1400000-0000-4000-8000-000000000001'
  ),
  ARRAY['c1400000-0000-4000-8000-000000000010'::UUID],
  'the active set initially appears in the question-page sets column'
);

SELECT is(
  (
    SELECT is_available_in_question_pool
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'c1400000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'the active published set initially reserves the stem from the practice pool'
);

UPDATE public.question_sets
SET deleted_at = TIMESTAMPTZ '2026-08-30 12:05:00+00'
WHERE id = 'c1400000-0000-4000-8000-000000000010';

SELECT is(
  (
    SELECT set_ids
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'c1400000-0000-4000-8000-000000000001'
  ),
  '{}'::UUID[],
  'deleted sets are absent from the tutor question sets column'
);

SELECT is(
  (
    SELECT set_names
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'c1400000-0000-4000-8000-000000000001'
  ),
  '[]'::JSONB,
  'deleted set names are absent from the tutor question sets column'
);

SELECT is(
  (
    SELECT is_available_in_question_pool
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'c1400000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'a published public stem returns to the practice pool when its only set is deleted'
);

SELECT * FROM finish();
ROLLBACK;
