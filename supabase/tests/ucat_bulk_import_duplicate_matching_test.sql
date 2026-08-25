BEGIN;
SELECT plan(6);

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

INSERT INTO public.question_stems (id, section_id, stem_text)
VALUES (
  'd0910000-0000-4000-8000-000000000001',
  '8dfbf286-e952-4581-b065-255ead834628',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bulk import marker alpha bravo charlie delta echo foxtrot golf."}]}]}'::JSONB
);

CREATE TEMP TABLE exact_result AS
SELECT public.tutor_ucat_match_import_stems(
  '[
    {
      "id":"import-exact",
      "sectionId":"8dfbf286-e952-4581-b065-255ead834628",
      "stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bulk import marker alpha bravo charlie delta echo foxtrot golf."}]}]}
    },
    {
      "id":"import-near-a",
      "sectionId":"8dfbf286-e952-4581-b065-255ead834628",
      "stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Within import marker india juliet kilo lima mike november oscar."}]}]}
    },
    {
      "id":"import-near-b",
      "sectionId":"8dfbf286-e952-4581-b065-255ead834628",
      "stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Within import marker india juliet kilo lima mike november oscar."}]}]}
    }
  ]'::JSONB,
  1.0
) AS payload;

CREATE TEMP TABLE broad_result AS
SELECT public.tutor_ucat_match_import_stems(
  '[
    {
      "id":"import-near-catalog",
      "sectionId":"8dfbf286-e952-4581-b065-255ead834628",
      "stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bulk import marker alpha bravo charlie delta echo foxtrot hotel."}]}]}
    }
  ]'::JSONB,
  0.8
) AS payload;

SELECT ok(
  (SELECT payload->'items' @> '[{"draftId":"import-exact","matchSource":"catalog","matchStemId":"d0910000-0000-4000-8000-000000000001","similarity":1}]'::JSONB FROM exact_result),
  'identical imported and catalog stem text is returned at 100%'
);

SELECT ok(
  (SELECT payload->'items' @> '[{"draftId":"import-near-a","matchSource":"draft","matchStemId":"import-near-b","similarity":1}]'::JSONB FROM exact_result),
  'duplicate stems within the import are returned once'
);

SELECT ok(
  (SELECT payload->'items' @> '[{"draftId":"import-near-catalog","matchSource":"catalog","matchStemId":"d0910000-0000-4000-8000-000000000001"}]'::JSONB FROM broad_result),
  'lowering the threshold returns a near catalog stem match'
);

SELECT is(
  (SELECT (payload->>'similarityThreshold')::DOUBLE PRECISION FROM broad_result),
  0.8::DOUBLE PRECISION,
  'the response reports the applied threshold'
);

SELECT is(
  JSONB_ARRAY_LENGTH((SELECT payload->'items' FROM exact_result)),
  2,
  'only stem-text matches are returned'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_match_import_stems('[]'::JSONB, 0.95)$$,
  '22023',
  'At least one import stem is required',
  'empty import batches are rejected'
);

SELECT * FROM finish();
ROLLBACK;
