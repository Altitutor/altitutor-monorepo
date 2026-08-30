BEGIN;
SELECT plan(3);

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

WITH next_indices AS (
  SELECT COALESCE(max(catalog_index), 0) AS base_index
  FROM public.ucat_mocks
  WHERE deleted_at IS NULL
)
INSERT INTO public.ucat_mocks (
  id, name, status, access_scope, blueprint_id, catalog_index
)
SELECT
  fixture.id,
  '',
  'draft',
  'public',
  '54100000-0000-4000-8000-000000000001',
  next_indices.base_index + fixture.position
FROM next_indices
CROSS JOIN (VALUES
  ('ca720000-0000-4000-8000-000000000001'::UUID, 1),
  ('ca720000-0000-4000-8000-000000000002'::UUID, 2)
) fixture(id, position);

SELECT public.ucat_compact_mock_catalog();

SELECT is(
  (SELECT array_agg(catalog_index ORDER BY catalog_index)
   FROM public.ucat_mocks
   WHERE deleted_at IS NULL),
  ARRAY(SELECT generate_series(1, (SELECT count(*)::INTEGER FROM public.ucat_mocks WHERE deleted_at IS NULL))),
  'mock compaction does not leave temporary displacement indices behind'
);

SELECT * FROM finish();
ROLLBACK;
