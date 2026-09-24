BEGIN;
SELECT plan(12);

SELECT has_column(
  'public',
  'question_sets',
  'section_id',
  'a question set belongs to an authored UCAT section'
);

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

CREATE FUNCTION pg_temp.test_upsert_question_set(
  p_set_id UUID,
  p_note JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
AS $$
  SELECT public.tutor_ucat_upsert_question_set_v2(
    p_set_id,
    p_note #>> '{content,0,content,0,text}',
    p_description,
    CASE WHEN p_time_limit_seconds IS NULL THEN 'untimed'::public.ucat_question_set_timing_mode
      ELSE 'fixed'::public.ucat_question_set_timing_mode END,
    NULL,
    p_time_limit_seconds,
    'partial_section',
    p_access_scope,
    p_stem_ids,
    p_section_id,
    '54100000-0000-4000-8000-000000000001'
  );
$$;

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  'a1300000-0000-4000-8000-000000000001',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR stem"}]}]}'::jsonb,
  'draft',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 1
LIMIT 1;

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  'a1300000-0000-4000-8000-000000000002',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM stem"}]}]}'::jsonb,
  'draft',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

SELECT throws_ok(
  $$SELECT pg_temp.test_upsert_question_set(
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"No section"}]}]}'::jsonb,
    NULL, NULL, 'public', '[]'::jsonb
  )$$,
  'P0001',
  'question_set_section_required',
  'creating a set without an authored section is rejected'
);

SELECT lives_ok(
  $$SELECT pg_temp.test_upsert_question_set(
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR draft"}]}]}'::jsonb,
    NULL, NULL, 'public', '[]'::jsonb,
    (SELECT id FROM public.ucat_sections WHERE section_number = 1 LIMIT 1)
  )$$,
  'an empty draft can be created with an authored section'
);

SELECT is(
  (
    SELECT section.section_number
    FROM public.question_sets qs
    JOIN public.ucat_sections section ON section.id = qs.section_id
    WHERE qs.authoring_note = 'VR draft'
    ORDER BY qs.created_at DESC
    LIMIT 1
  ),
  1,
  'the empty draft keeps its authored Verbal Reasoning section'
);

SELECT throws_ok(
  format(
    $sql$SELECT pg_temp.test_upsert_question_set(
      %L::uuid,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR draft"}]}]}'::jsonb,
      NULL, NULL, 'public',
      '["a1300000-0000-4000-8000-000000000002"]'::jsonb,
      (SELECT id FROM public.ucat_sections WHERE section_number = 1 LIMIT 1)
    )$sql$,
    (SELECT id FROM public.question_sets WHERE authoring_note = 'VR draft' ORDER BY created_at DESC LIMIT 1)
  ),
  'P0001',
  'question_stem_not_found_or_section_mismatch',
  'a Verbal Reasoning set cannot gain a Decision Making stem'
);

SELECT lives_ok(
  format(
    $sql$SELECT pg_temp.test_upsert_question_set(
      %L::uuid,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR draft"}]}]}'::jsonb,
      NULL, NULL, 'public',
      '["a1300000-0000-4000-8000-000000000001"]'::jsonb,
      (SELECT id FROM public.ucat_sections WHERE section_number = 1 LIMIT 1)
    )$sql$,
    (SELECT id FROM public.question_sets WHERE authoring_note = 'VR draft' ORDER BY created_at DESC LIMIT 1)
  ),
  'a Verbal Reasoning set can include a Verbal Reasoning stem'
);

SELECT throws_ok(
  format(
    $sql$SELECT pg_temp.test_upsert_question_set(
      %L::uuid,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR draft"}]}]}'::jsonb,
      NULL, NULL, 'public',
      '["a1300000-0000-4000-8000-000000000001"]'::jsonb,
      (SELECT id FROM public.ucat_sections WHERE section_number = 2 LIMIT 1)
    )$sql$,
    (SELECT id FROM public.question_sets WHERE authoring_note = 'VR draft' ORDER BY created_at DESC LIMIT 1)
  ),
  'P0001',
  'question_set_section_has_members',
  'a set with member stems cannot change section'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_upsert_question_stem_bundle(
    'a1300000-0000-4000-8000-000000000001',
    (SELECT id FROM public.ucat_sections WHERE section_number = 2 LIMIT 1),
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR stem"}]}]}'::jsonb,
    'public',
    '[]'::jsonb
  )$$,
  'P0001',
  'question_stem_section_frozen_by_set',
  'a stem in a live set cannot change UCAT section'
);

SELECT lives_ok(
  format(
    $sql$SELECT pg_temp.test_upsert_question_set(
      %L::uuid,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR draft"}]}]}'::jsonb,
      NULL, NULL, 'public',
      '[]'::jsonb,
      (SELECT id FROM public.ucat_sections WHERE section_number = 1 LIMIT 1)
    )$sql$,
    (SELECT id FROM public.question_sets WHERE authoring_note = 'VR draft' ORDER BY created_at DESC LIMIT 1)
  ),
  'member stems can be cleared without changing section'
);

SELECT lives_ok(
  format(
    $sql$SELECT pg_temp.test_upsert_question_set(
      %L::uuid,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Now DM"}]}]}'::jsonb,
      NULL, NULL, 'public',
      '[]'::jsonb,
      (SELECT id FROM public.ucat_sections WHERE section_number = 2 LIMIT 1)
    )$sql$,
    (SELECT id FROM public.question_sets WHERE authoring_note = 'VR draft' ORDER BY created_at DESC LIMIT 1)
  ),
  'an empty set can change its authored section'
);

INSERT INTO public.question_sets (
  id, name, status, access_scope, section_id, deleted_at, deleted_by,
  set_format, timing_mode, pace_multiplier, fixed_time_limit_seconds,
  reference_blueprint_id, catalog_index
)
SELECT
  'a1300000-0000-4000-8000-000000000010',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Deleted DM"}]}]}'::jsonb,
  'draft', 'public', section.id, NOW(), '00000000-0000-0000-0000-000000000010',
  'partial_section', 'untimed', NULL, NULL,
  '54100000-0000-4000-8000-000000000001', NULL
FROM public.ucat_sections section
WHERE section.section_number = 2
LIMIT 1;

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES ('a1300000-0000-4000-8000-000000000002', 'a1300000-0000-4000-8000-000000000010', 1);

SELECT lives_ok(
  $$SELECT public.tutor_ucat_upsert_question_stem_bundle(
    'a1300000-0000-4000-8000-000000000002',
    (SELECT id FROM public.ucat_sections WHERE section_number = 1 LIMIT 1),
    NULL,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"was DM"}]}]}'::jsonb,
    'public',
    '[]'::jsonb
  )$$,
  'deleted-set membership does not freeze a stem section'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_restore_question_set('a1300000-0000-4000-8000-000000000010')$$,
  'P0001',
  'question_set_restore_section_mismatch',
  'restore refuses when remaining member stems no longer match the set section'
);

SELECT * FROM finish();
ROLLBACK;
