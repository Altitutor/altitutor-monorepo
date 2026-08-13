BEGIN;
SELECT plan(3);

INSERT INTO public.question_stems (id, section_id, stem_text)
VALUES
  (
    'a1300000-0000-4000-8000-000000000001',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First paragraph."}]},{"type":"paragraph","content":[{"type":"text","text":"Second paragraph."}]}]}'::jsonb
  ),
  (
    'a1300000-0000-4000-8000-000000000002',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First paragraph."}]},{"type":"paragraph","content":[{"type":"text","text":"Second paragraph."}]}]}'::jsonb
  ),
  (
    'a1300000-0000-4000-8000-000000000003',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First paragraph."}]},{"type":"paragraph","content":[{"type":"text","text":"Second paragraph."}]}]}'::jsonb
  );

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
    ('a1300000-0000-4000-8000-000000000001'::uuid, 3),
    ('a1300000-0000-4000-8000-000000000002'::uuid, 4),
    ('a1300000-0000-4000-8000-000000000003'::uuid, 5)
) AS stem(id, question_count)
CROSS JOIN generate_series(1, stem.question_count) question_index;

SELECT ok(
  public.ucat_content_publication_issues(
    'stem',
    'a1300000-0000-4000-8000-000000000001'
  ) @> '[{"code":"vr_question_count"}]'::jsonb,
  'publication rejects a Verbal Reasoning stem with fewer than four questions'
);

SELECT isnt(
  public.ucat_content_publication_issues(
    'stem',
    'a1300000-0000-4000-8000-000000000002'
  ) @> '[{"code":"vr_question_count"}]'::jsonb,
  true,
  'publication accepts a Verbal Reasoning stem with exactly four questions'
);

SELECT isnt(
  public.ucat_content_publication_issues(
    'stem',
    'a1300000-0000-4000-8000-000000000003'
  ) @> '[{"code":"vr_question_count"}]'::jsonb,
  true,
  'publication accepts a Verbal Reasoning stem with more than four questions'
);

SELECT * FROM finish();
ROLLBACK;
