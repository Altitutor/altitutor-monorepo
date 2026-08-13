BEGIN;
SELECT plan(4);

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
VALUES
  (
    '54410000-0000-4000-8000-000000000001',
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM"}]}]}'::jsonb,
    'published',
    'public'
  ),
  (
    '54410000-0000-4000-8000-000000000002',
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR"}]}]}'::jsonb,
    'published',
    'public'
  );

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
)
VALUES
  (
    '54420000-0000-4000-8000-000000000001',
    '54410000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"DM question"}]}]}'::jsonb,
    1, 'multiple_choice', 'single_choice'
  ),
  (
    '54420000-0000-4000-8000-000000000002',
    '54410000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"VR question"}]}]}'::jsonb,
    1, 'multiple_choice', 'single_choice'
  );

INSERT INTO public.question_sets (id, name, time_limit_seconds, status, access_scope, section_id)
VALUES
  (
    '54430000-0000-4000-8000-000000000001',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Short DM"}]}]}'::jsonb,
    60,
    'published',
    'public',
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a'
  ),
  (
    '54430000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Empty DM"}]}]}'::jsonb,
    60,
    'published',
    'public',
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a'
  );

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES
  ('54410000-0000-4000-8000-000000000001', '54430000-0000-4000-8000-000000000001', 1);

INSERT INTO public.ucat_mocks (id, name, status, access_scope)
VALUES
  ('54440000-0000-4000-8000-000000000001', 'Short mock', 'in_review', 'public'),
  ('54440000-0000-4000-8000-000000000002', 'Mixed mock', 'in_review', 'public');

INSERT INTO public.question_sets_ucat_mocks (question_set_id, ucat_mock_id, index)
VALUES
  ('54430000-0000-4000-8000-000000000001', '54440000-0000-4000-8000-000000000001', 1),
  ('54430000-0000-4000-8000-000000000002', '54440000-0000-4000-8000-000000000002', 1);

SELECT ok(
  NOT public.ucat_mock_publication_shape_issues('54440000-0000-4000-8000-000000000001') @>
    '[{"code":"incorrect_set_question_counts"}]'::jsonb,
  'a short section set does not fail mock shape for question count'
);

SELECT ok(
  NOT public.ucat_mock_publication_shape_issues('54440000-0000-4000-8000-000000000001') @>
    '[{"code":"incorrect_set_time_limits"}]'::jsonb,
  'a set with a non-exam answering time does not fail mock shape'
);

SELECT ok(
  NOT public.ucat_content_publication_issues('mock', '54440000-0000-4000-8000-000000000001') @>
    '[{"code":"incorrect_set_question_counts"}]'::jsonb
  AND NOT public.ucat_content_publication_issues('mock', '54440000-0000-4000-8000-000000000001') @>
    '[{"code":"incorrect_set_time_limits"}]'::jsonb,
  'publication issues no longer include section question-count or answering-time shape gates'
);

SELECT ok(
  public.ucat_mock_publication_shape_issues('54440000-0000-4000-8000-000000000002') @>
    '[{"code":"invalid_set_sections"}]'::jsonb,
  'a mock set with no stems still fails the single-section shape rule'
);

SELECT * FROM finish();
ROLLBACK;
