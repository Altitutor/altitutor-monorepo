BEGIN;
SELECT plan(4);

INSERT INTO public.ucat_sections (
  id, section_number, name, display_columns, time_limit_seconds, number_of_questions
) VALUES (
  'ca700000-0000-4000-8000-000000000001', 99, 'Catalog compaction fixture', 1, 120, 2
);

INSERT INTO public.question_sets (
  id, description, status, access_scope, section_id, set_format,
  timing_mode, pace_multiplier, reference_blueprint_id
) VALUES
  (
    'ca710000-0000-4000-8000-000000000001', '{}'::JSONB, 'published', 'public',
    'ca700000-0000-4000-8000-000000000001', 'full_section', 'pace', 1,
    '54100000-0000-4000-8000-000000000001'
  ),
  (
    'ca710000-0000-4000-8000-000000000002', '{}'::JSONB, 'published', 'public',
    'ca700000-0000-4000-8000-000000000001', 'full_section', 'pace', 1,
    '54100000-0000-4000-8000-000000000001'
  );

SELECT is(
  (SELECT array_agg(catalog_index ORDER BY catalog_index)
   FROM public.question_sets
   WHERE section_id = 'ca700000-0000-4000-8000-000000000001'),
  ARRAY[1, 2],
  'the isolated set scope starts with contiguous catalog indices'
);

SELECT public.ucat_compact_standalone_set_catalog(
  'ca700000-0000-4000-8000-000000000001',
  'full_section'
);

SELECT is(
  (SELECT array_agg(catalog_index ORDER BY catalog_index)
   FROM public.question_sets
   WHERE section_id = 'ca700000-0000-4000-8000-000000000001'),
  ARRAY[1, 2],
  'set compaction does not leave temporary displacement indices behind'
);

INSERT INTO public.ucat_mocks (
  id, name, status, access_scope, blueprint_id
)
VALUES
  (
    'ca720000-0000-4000-8000-000000000001', '', 'draft', 'public',
    '54100000-0000-4000-8000-000000000001'
  ),
  (
    'ca720000-0000-4000-8000-000000000002', '', 'published', 'public',
    '54100000-0000-4000-8000-000000000001'
  );

SELECT public.ucat_compact_mock_catalog();

SELECT is(
  (SELECT array_agg(catalog_index ORDER BY catalog_index)
   FROM public.ucat_mocks
   WHERE deleted_at IS NULL AND status = 'published'),
  ARRAY(SELECT generate_series(
    1,
    (SELECT count(*)::INTEGER FROM public.ucat_mocks
      WHERE deleted_at IS NULL AND status = 'published')
  )),
  'mock compaction does not leave temporary displacement indices behind'
);
SELECT is(
  (SELECT catalog_index FROM public.ucat_mocks
    WHERE id = 'ca720000-0000-4000-8000-000000000001'),
  NULL,
  'unpublished mocks stay unnumbered through mock compaction'
);

SELECT * FROM finish();
ROLLBACK;
