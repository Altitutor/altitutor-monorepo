BEGIN;
SELECT plan(6);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

INSERT INTO public.ucat_sections (
  id, section_number, name, display_columns, time_limit_seconds, number_of_questions
) VALUES (
  'ca800000-0000-4000-8000-000000000001', 98, 'Bulk status catalog fixture', 1, 120, 2
);

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
VALUES (
  'ca810000-0000-4000-8000-000000000001',
  'ca800000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bulk status stem"}]}]}'::jsonb,
  'published',
  'public'
);

INSERT INTO public.question_sets (
  id, description, status, access_scope, section_id, set_format,
  timing_mode, pace_multiplier, reference_blueprint_id
)
SELECT
  fixture.id,
  '{}'::JSONB,
  'published',
  'public',
  'ca800000-0000-4000-8000-000000000001',
  'full_section',
  'pace',
  1,
  '54100000-0000-4000-8000-000000000001'
FROM (VALUES
  ('ca820000-0000-4000-8000-000000000001'::UUID),
  ('ca820000-0000-4000-8000-000000000002'::UUID),
  ('ca820000-0000-4000-8000-000000000003'::UUID),
  ('ca820000-0000-4000-8000-000000000004'::UUID),
  ('ca820000-0000-4000-8000-000000000005'::UUID),
  ('ca820000-0000-4000-8000-000000000006'::UUID)
) fixture(id);

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES
  ('ca810000-0000-4000-8000-000000000001', 'ca820000-0000-4000-8000-000000000001', 1);

SELECT is(
  (SELECT array_agg(catalog_index ORDER BY catalog_index)
   FROM public.question_sets
   WHERE section_id = 'ca800000-0000-4000-8000-000000000001'),
  ARRAY[1, 2, 3, 4, 5, 6],
  'the isolated set scope starts with contiguous catalog indices'
);

SELECT is(
  (
    SELECT projection.is_available_in_question_pool
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'ca810000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'a published set reserves its published public stem from the question pool'
);

SELECT is(
  public.tutor_ucat_set_content_status_bulk(
    'set',
    ARRAY[
      'ca820000-0000-4000-8000-000000000001',
      'ca820000-0000-4000-8000-000000000002',
      'ca820000-0000-4000-8000-000000000003',
      'ca820000-0000-4000-8000-000000000004',
      'ca820000-0000-4000-8000-000000000005'
    ]::UUID[],
    'in_review'
  ) -> 'movedIds',
  '["ca820000-0000-4000-8000-000000000001", "ca820000-0000-4000-8000-000000000002", "ca820000-0000-4000-8000-000000000003", "ca820000-0000-4000-8000-000000000004", "ca820000-0000-4000-8000-000000000005"]'::JSONB,
  'bulk moving published sets to in review reports every moved id'
);

SELECT is(
  (
    SELECT array_agg(status::TEXT ORDER BY id)
    FROM public.question_sets
    WHERE id IN (
      'ca820000-0000-4000-8000-000000000001',
      'ca820000-0000-4000-8000-000000000002',
      'ca820000-0000-4000-8000-000000000003',
      'ca820000-0000-4000-8000-000000000004',
      'ca820000-0000-4000-8000-000000000005'
    )
  ),
  ARRAY['in_review', 'in_review', 'in_review', 'in_review', 'in_review'],
  'bulk moving published sets to in review updates every selected set'
);

SELECT is(
  (
    SELECT array_agg(catalog_index ORDER BY id)
    FROM public.question_sets
    WHERE section_id = 'ca800000-0000-4000-8000-000000000001'
  ),
  ARRAY[NULL, NULL, NULL, NULL, NULL, 1]::INTEGER[],
  'bulk unpublish compacts the remaining published set onto catalog index 1'
);

SELECT is(
  (
    SELECT projection.is_available_in_question_pool
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'ca810000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'deferred catalog refresh still returns the stem to the question pool after bulk unpublish'
);

SELECT * FROM finish();
ROLLBACK;
