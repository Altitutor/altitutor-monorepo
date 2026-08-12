BEGIN;

SELECT plan(14);

SELECT has_view(
  'public',
  'vstudent_ucat_activity_tag_signals',
  'activity tag signals have a Student-readable facade'
);
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'tag_id', 'tag identity is exposed');
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'section_id', 'section scope is exposed');
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'category_id', 'category scope is exposed');
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'available_question_count', 'accessible inventory is exposed');
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'independent_session_count', 'independent evidence volume is exposed');
SELECT has_column('public', 'vstudent_ucat_activity_tag_signals', 'weakness_score', 'tag weakness is exposed');
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_activity_tag_signals'::regclass, true),
  'vstudent_ucat_accessible_question_stems',
  'inventory is restricted to content accessible to the current Student'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.vstudent_ucat_activity_tag_signals', 'SELECT'),
  'authenticated Students can select the tag-signal facade'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.vstudent_ucat_activity_tag_signals', 'SELECT'),
  'anonymous users cannot select the tag-signal facade'
);

CREATE TEMP TABLE activity_tag_fixture ON COMMIT DROP AS
SELECT
  question.id AS question_id,
  stem.section_id,
  stem.question_stem_category_id AS category_id,
  question.question_text,
  question.question_type,
  question.response_type,
  question.answer_scheme,
  question.answer_explanation
FROM public.ucat_questions question
JOIN public.question_stems stem ON stem.id = question.question_stem_id
WHERE question.deleted_at IS NULL
  AND stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND stem.access_scope = 'public'
  AND stem.question_stem_category_id IS NOT NULL
LIMIT 1;

INSERT INTO public.student_online_product_relationships (student_id, product)
VALUES
  ('10000000-0000-0000-0000-000000000007', 'UCAT_WEB'),
  ('10000000-0000-0000-0000-000000000008', 'UCAT_WEB')
ON CONFLICT (student_id, product) DO UPDATE SET closed_at = NULL;

INSERT INTO public.question_tags (id, name, ucat_section_id)
SELECT '55200000-0000-4000-8000-000000000001'::uuid, 'ALTI-552 accessible fixture', section_id
FROM activity_tag_fixture
UNION ALL
SELECT '55200000-0000-4000-8000-000000000002'::uuid, 'ALTI-552 private fixture', section_id
FROM activity_tag_fixture;

INSERT INTO public.questions_question_tags (question_id, tag_id)
SELECT question_id, '55200000-0000-4000-8000-000000000001'
FROM activity_tag_fixture;

INSERT INTO public.question_stems (
  id, section_id, question_stem_category_id, stem_text, status, access_scope
)
SELECT
  '55200000-0000-4000-8000-000000000003', section_id, category_id,
  '{"type":"doc","content":[]}'::jsonb, 'published', 'private'
FROM activity_tag_fixture;

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, answer_explanation, index,
  question_type, response_type, answer_scheme
)
SELECT
  '55200000-0000-4000-8000-000000000004',
  '55200000-0000-4000-8000-000000000003',
  question_text, answer_explanation, 1, question_type, response_type, answer_scheme
FROM activity_tag_fixture;

INSERT INTO public.questions_question_tags (question_id, tag_id)
VALUES (
  '55200000-0000-4000-8000-000000000004',
  '55200000-0000-4000-8000-000000000002'
);

INSERT INTO public.student_question_attempts (
  id, student_id, question_id, score, is_submitted, content_snapshot
)
SELECT
  '55200000-0000-4000-8000-000000000005'::uuid,
  '10000000-0000-0000-0000-000000000007'::uuid,
  question_id, 0, true, '{}'::jsonb
FROM activity_tag_fixture
UNION ALL
SELECT
  '55200000-0000-4000-8000-000000000006'::uuid,
  '10000000-0000-0000-0000-000000000008'::uuid,
  question_id, 1, true, '{}'::jsonb
FROM activity_tag_fixture;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
SELECT is(
  (
    SELECT (independent_session_count, weakness_score::INTEGER)::TEXT
    FROM public.vstudent_ucat_activity_tag_signals
    WHERE tag_id = '55200000-0000-4000-8000-000000000001'
  ),
  '(1,1)',
  'Student A sees only their own incorrect evidence'
);
SELECT is(
  (
    SELECT available_question_count
    FROM public.vstudent_ucat_activity_tag_signals
    WHERE tag_id = '55200000-0000-4000-8000-000000000001'
  ),
  1,
  'the accessible tag inventory counts the public question'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.vstudent_ucat_activity_tag_signals
    WHERE tag_id = '55200000-0000-4000-8000-000000000002'
  ),
  0,
  'private content cannot make a tag eligible for Student sampling'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);
SELECT is(
  (
    SELECT (independent_session_count, weakness_score::INTEGER)::TEXT
    FROM public.vstudent_ucat_activity_tag_signals
    WHERE tag_id = '55200000-0000-4000-8000-000000000001'
  ),
  '(1,0)',
  'Student B sees only their own correct evidence'
);

SELECT * FROM finish();
ROLLBACK;
