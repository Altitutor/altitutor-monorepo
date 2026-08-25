BEGIN;
SELECT plan(9);

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
VALUES
  (
    'd0900000-0000-4000-8000-000000000001',
    '8dfbf286-e952-4581-b065-255ead834628',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dedupe regression marker alpha bravo charlie delta echo foxtrot golf."}]}]}'::JSONB
  ),
  (
    'd0900000-0000-4000-8000-000000000002',
    '8dfbf286-e952-4581-b065-255ead834628',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dedupe regression marker alpha bravo charlie delta echo foxtrot golf."}]}]}'::JSONB
  ),
  (
    'd0900000-0000-4000-8000-000000000003',
    '8dfbf286-e952-4581-b065-255ead834628',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dedupe regression marker alpha bravo charlie delta echo foxtrot hotel."}]}]}'::JSONB
  ),
  (
    'd0900000-0000-4000-8000-000000000004',
    '8dfbf286-e952-4581-b065-255ead834628',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Dedupe regression marker unrelated zucchini nebula quartz."}]}]}'::JSONB
  );

CREATE TEMP TABLE exact_result AS
SELECT public.tutor_ucat_list_duplicate_stem_pairs(
  'Dedupe regression marker',
  ARRAY['8dfbf286-e952-4581-b065-255ead834628'::UUID],
  1.0,
  1,
  100
) AS payload;

CREATE TEMP TABLE broad_result AS
SELECT public.tutor_ucat_list_duplicate_stem_pairs(
  'Dedupe regression marker',
  ARRAY['8dfbf286-e952-4581-b065-255ead834628'::UUID],
  0.8,
  1,
  100
) AS payload;

SELECT ok(
  (SELECT payload->'items' @> '[{"id":"d0900000-0000-4000-8000-000000000001:d0900000-0000-4000-8000-000000000002"}]'::JSONB FROM exact_result),
  '100% threshold returns stems with identical normalized stem text'
);

SELECT ok(
  NOT (SELECT payload->'items' @> '[{"id":"d0900000-0000-4000-8000-000000000001:d0900000-0000-4000-8000-000000000003"}]'::JSONB FROM exact_result),
  '100% threshold excludes a near match'
);

SELECT ok(
  (SELECT payload->'items' @> '[{"id":"d0900000-0000-4000-8000-000000000001:d0900000-0000-4000-8000-000000000003"}]'::JSONB FROM broad_result),
  'lowering the threshold returns a stem-only near match'
);

SELECT is(
  (SELECT (payload->>'similarityThreshold')::DOUBLE PRECISION FROM broad_result),
  0.8::DOUBLE PRECISION,
  'the response reports the applied similarity threshold'
);

SELECT lives_ok(
  $$
    SELECT public.tutor_ucat_merge_duplicate_stem_pair(
      'd0900000-0000-4000-8000-000000000001',
      'd0900000-0000-4000-8000-000000000003',
      0.8
    )
  $$,
  'a tutor may merge either displayed near-match stem into the other'
);

SELECT isnt(
  (
    SELECT deleted_at
    FROM public.question_stems
    WHERE id = 'd0900000-0000-4000-8000-000000000003'
  ),
  NULL::TIMESTAMPTZ,
  'merging soft-deletes the selected source stem'
);

SELECT ok(
  to_regprocedure('public.tutor_ucat_list_exact_duplicate_stems(text,uuid[],integer,integer)') IS NULL,
  'the legacy list function is removed'
);

SELECT ok(
  to_regprocedure('public.tutor_ucat_dismiss_exact_duplicate_pair(uuid,uuid,text)') IS NULL,
  'the legacy dismissal function is removed'
);

SELECT ok(
  to_regclass('public.ucat_duplicate_pair_dismissals') IS NULL,
  'legacy not-duplicate decisions are removed'
);

SELECT * FROM finish();
ROLLBACK;
