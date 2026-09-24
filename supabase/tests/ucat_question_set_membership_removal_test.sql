BEGIN;
SELECT plan(11);

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

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT fixture.id, section.id, fixture.stem_text, 'draft', 'public'
FROM public.ucat_sections section
CROSS JOIN (
  VALUES
    ('a5830000-0000-4000-8000-000000000001'::UUID, '{"type":"doc","content":[]}'::JSONB),
    ('a5830000-0000-4000-8000-000000000002'::UUID, '{"type":"doc","content":[]}'::JSONB),
    ('a5830000-0000-4000-8000-000000000003'::UUID, '{"type":"doc","content":[]}'::JSONB)
) AS fixture(id, stem_text)
WHERE section.section_number = 1;

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
)
SELECT
  ('b5830000-0000-4000-8000-' || right(stem.id::TEXT, 12))::UUID,
  stem.id,
  '{"type":"doc","content":[]}'::JSONB,
  1,
  'multiple_choice',
  'single_choice'
FROM public.question_stems stem
WHERE stem.id IN (
  'a5830000-0000-4000-8000-000000000001',
  'a5830000-0000-4000-8000-000000000002',
  'a5830000-0000-4000-8000-000000000003'
);

CREATE TEMP TABLE test_set_ids (id UUID PRIMARY KEY);
GRANT SELECT ON test_set_ids TO authenticated;
INSERT INTO test_set_ids(id)
SELECT public.tutor_ucat_upsert_question_set_v2(
  NULL,
  'ALTI-583 membership removal fixture',
  '{"type":"doc","content":[]}'::JSONB,
  'pace',
  1,
  NULL,
  'partial_section',
  'public',
  '["a5830000-0000-4000-8000-000000000001","a5830000-0000-4000-8000-000000000002","a5830000-0000-4000-8000-000000000003"]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  '54100000-0000-4000-8000-000000000001'
);

SELECT has_function(
  'public',
  'tutor_ucat_remove_question_set_stems',
  ARRAY['uuid', 'uuid[]'],
  'the narrow set membership removal RPC exists'
);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_remove_question_set_stems(
    (SELECT id FROM test_set_ids),
    ARRAY[
      'a5830000-0000-4000-8000-000000000001'::UUID,
      'a5830000-0000-4000-8000-000000000003'::UUID
    ]
  )$$,
  'selected memberships can be removed atomically'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.question_stems_question_sets
    WHERE question_set_id = (SELECT id FROM test_set_ids)),
  1,
  'unrelated memberships are preserved'
);

SELECT is(
  (SELECT question_stem_id FROM public.question_stems_question_sets
    WHERE question_set_id = (SELECT id FROM test_set_ids)),
  'a5830000-0000-4000-8000-000000000002'::UUID,
  'the requested stems are the only memberships removed'
);

SELECT is(
  (SELECT index FROM public.question_stems_question_sets
    WHERE question_set_id = (SELECT id FROM test_set_ids)),
  2,
  'the authored order of surviving memberships is unchanged'
);

SELECT is(
  (SELECT time_limit_seconds FROM public.question_sets
    WHERE id = (SELECT id FROM test_set_ids)),
  public.ucat_question_set_time_limit_seconds((SELECT id FROM test_set_ids)),
  'the set timing projection is recomputed after membership removal'
);

SELECT is(
  (SELECT set_ids @> ARRAY[(SELECT id FROM test_set_ids)]
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'a5830000-0000-4000-8000-000000000001'),
  FALSE,
  'the catalog projection drops the removed set membership'
);

SELECT is(
  (SELECT set_ids @> ARRAY[(SELECT id FROM test_set_ids)]
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = 'a5830000-0000-4000-8000-000000000002'),
  TRUE,
  'the catalog projection retains the surviving set membership'
);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_remove_question_set_stems(
    (SELECT id FROM test_set_ids),
    ARRAY['a5830000-0000-4000-8000-000000000001'::UUID]
  )$$,
  'repeating a removal is idempotent'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.tutor_ucat_remove_question_set_stems(
    (SELECT id FROM test_set_ids),
    ARRAY['a5830000-0000-4000-8000-000000000002'::UUID]
  )$$,
  'P0001',
  'forbidden',
  'non-UCAT tutors cannot remove memberships'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.question_stems_question_sets
    WHERE question_set_id = (SELECT id FROM test_set_ids)),
  0,
  'authenticated callers cannot read the base membership table directly'
);

SELECT * FROM finish();
ROLLBACK;
