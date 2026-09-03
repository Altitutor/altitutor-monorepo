BEGIN;
SELECT plan(3);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT staff.id, subject.id
FROM public.staff staff
CROSS JOIN public.subjects subject
WHERE staff.id = '00000000-0000-0000-0000-000000000010'
  AND subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  stem.id,
  (SELECT section.id FROM public.ucat_sections section WHERE section.section_number = 1 LIMIT 1),
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Catalog total stem"}]}]}'::jsonb,
  stem.status,
  'public'
FROM (
  VALUES
    ('74000000-0000-4000-8000-000000000001'::uuid, 'draft'::public.ucat_content_status),
    ('74000000-0000-4000-8000-000000000002'::uuid, 'draft'::public.ucat_content_status),
    ('74000000-0000-4000-8000-000000000003'::uuid, 'published'::public.ucat_content_status)
) AS stem(id, status);

INSERT INTO public.ucat_questions (
  question_stem_id,
  question_text,
  index,
  response_type,
  answer_scheme
)
SELECT
  stem.id,
  jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Question ' || question_index))
    ))
  ),
  question_index,
  'multiple_choice',
  'single_choice'
FROM (
  VALUES
    ('74000000-0000-4000-8000-000000000001'::uuid, 2),
    ('74000000-0000-4000-8000-000000000002'::uuid, 3),
    ('74000000-0000-4000-8000-000000000003'::uuid, 4)
) AS stem(id, question_count)
CROSS JOIN generate_series(1, stem.question_count) question_index;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
    ARRAY[
      '74000000-0000-4000-8000-000000000001',
      '74000000-0000-4000-8000-000000000002',
      '74000000-0000-4000-8000-000000000003'
    ]::UUID[],
    NULL
  ) - 'items',
  jsonb_build_object(
    'total', 2,
    'questionTotal', 5,
    'page', 1,
    'pageSize', 20
  ),
  'catalog totals count filtered stems and their questions'
);

SELECT is(
  public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, TRUE, NULL, 3, NULL, NULL,
    ARRAY[
      '74000000-0000-4000-8000-000000000001',
      '74000000-0000-4000-8000-000000000002',
      '74000000-0000-4000-8000-000000000003'
    ]::UUID[],
    NULL
  ) - 'items',
  jsonb_build_object(
    'total', 1,
    'questionTotal', 3,
    'page', 1,
    'pageSize', 20
  ),
  'catalog question total respects the same filters as the stem total'
);

SELECT is(
  public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
    ARRAY['74000000-0000-4000-8000-000000000099']::UUID[],
    NULL
  ) - 'items',
  jsonb_build_object(
    'total', 0,
    'questionTotal', 0,
    'page', 1,
    'pageSize', 20
  ),
  'empty catalog filters report zero stems and zero questions'
);

SELECT * FROM finish();
ROLLBACK;
