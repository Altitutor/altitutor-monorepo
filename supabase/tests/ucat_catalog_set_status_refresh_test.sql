BEGIN;
SELECT plan(6);

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  'c1300000-0000-4000-8000-000000000001',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Pool stem"}]}]}'::jsonb,
  'published',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_sets (id, name, time_limit_seconds, status, access_scope, section_id)
SELECT
  'c1300000-0000-4000-8000-000000000010',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"In-review set"}]}]}'::jsonb,
  240,
  'in_review',
  'private',
  section.id
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES (
  'c1300000-0000-4000-8000-000000000001',
  'c1300000-0000-4000-8000-000000000010',
  1
);

SELECT is(
  (
    SELECT projection.is_available_in_question_pool
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'an in-review set does not reserve a published public stem from the question pool'
);

UPDATE public.ucat_question_catalog_projection
SET stem_search_text = 'sentinel-search-text'
WHERE stem_id = 'c1300000-0000-4000-8000-000000000001';

UPDATE public.question_sets
SET status = 'published'
WHERE id = 'c1300000-0000-4000-8000-000000000010';

SELECT is(
  (
    SELECT projection.is_available_in_question_pool
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  FALSE,
  'publishing a set reserves its published public stems from the question pool'
);

SELECT is(
  (
    SELECT projection.stem_search_text
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  'sentinel-search-text',
  'publishing a set does not rebuild stem search text in the catalog projection'
);

UPDATE public.question_sets
SET name = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Renamed set"}]}]}'::jsonb
WHERE id = 'c1300000-0000-4000-8000-000000000010';

SELECT is(
  (
    SELECT projection.set_names_text
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  'renamed set',
  'renaming a set updates catalog set names without a full stem rebuild'
);

SELECT is(
  (
    SELECT projection.stem_search_text
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  'sentinel-search-text',
  'renaming a set does not rebuild stem search text in the catalog projection'
);

UPDATE public.question_sets
SET time_limit_seconds = 300
WHERE id = 'c1300000-0000-4000-8000-000000000010';

SELECT is(
  (
    SELECT projection.stem_search_text
    FROM public.ucat_question_catalog_projection projection
    WHERE projection.stem_id = 'c1300000-0000-4000-8000-000000000001'
  ),
  'sentinel-search-text',
  'catalog-irrelevant set updates do not rebuild stem search text'
);

SELECT * FROM finish();
ROLLBACK;
