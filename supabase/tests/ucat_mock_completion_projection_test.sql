BEGIN;
SELECT plan(6);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

CREATE TEMP TABLE projection_mock AS
SELECT public.tutor_ucat_upsert_mock_v2(
  NULL, 'Projection test', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
) AS id;

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
SELECT source_member.question_stem_id, component.id, 1
FROM public.question_sets component
JOIN projection_mock mock ON mock.id = component.mock_id
JOIN public.ucat_sections section ON section.id = component.section_id AND section.section_number = 1
CROSS JOIN LATERAL (
  SELECT member.question_stem_id
  FROM public.question_stems_question_sets member
  JOIN public.question_stems stem ON stem.id = member.question_stem_id
  WHERE stem.section_id = component.section_id
  LIMIT 1
) source_member;

CREATE TEMP TABLE mock_projection_question AS
SELECT
  component.mock_id,
  component.id AS set_id,
  question.id AS question_id
FROM public.question_sets component
JOIN public.question_stems_question_sets stem_membership
  ON stem_membership.question_set_id = component.id
JOIN public.ucat_questions question
  ON question.question_stem_id = stem_membership.question_stem_id
 AND question.deleted_at IS NULL
WHERE component.mock_id = (SELECT id FROM projection_mock)
ORDER BY component.mock_id, question.index
LIMIT 1;

INSERT INTO public.student_ucat_mock_attempts (
  id,
  student_id,
  ucat_mock_id,
  was_timed,
  attempted_at
)
SELECT
  'fe000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  fixture.mock_id,
  true,
  now() - interval '2 minutes'
FROM mock_projection_question fixture;

INSERT INTO public.student_question_set_attempts (
  id,
  student_id,
  question_set_id,
  student_ucat_mock_attempt_id,
  score_points,
  total_points,
  was_timed,
  set_speed,
  attempted_at
)
SELECT
  'fe000000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000006',
  fixture.set_id,
  'fe000000-0000-4000-8000-000000000001',
  1,
  1,
  true,
  1,
  now() - interval '2 minutes'
FROM mock_projection_question fixture;

UPDATE public.student_question_set_attempts
SET completed_at = now() - interval '1 minute'
WHERE id = 'fe000000-0000-4000-8000-000000000002';

INSERT INTO public.student_question_attempts (
  id,
  student_id,
  student_question_set_attempt_id,
  question_id,
  score,
  is_submitted,
  attempted_at
)
SELECT
  'fe000000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000006',
  'fe000000-0000-4000-8000-000000000002',
  fixture.question_id,
  1,
  true,
  now() - interval '1 minute'
FROM mock_projection_question fixture;

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.student_ucat_question_progress
    WHERE student_id = '10000000-0000-0000-0000-000000000006'
      AND question_id = (
        SELECT question_id FROM mock_projection_question
      )
  ),
  0::bigint,
  'a completed child Set does not project progress before its Mock completes'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_student_ucat_score_projection_evidence(
      '10000000-0000-0000-0000-000000000006'
    ) evidence
    WHERE evidence.evidence_session_id =
      'fe000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'a completed child Set is not score evidence before its Mock completes'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000006'
      AND requested_reasons @> ARRAY['activity_completed']
  ),
  0::bigint,
  'child Set completion does not enqueue a premature activity refresh'
);

UPDATE public.student_ucat_mock_attempts
SET
  completed_at = now(),
  score_points = 1,
  total_points = 1
WHERE id = 'fe000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.student_ucat_question_progress
    WHERE student_id = '10000000-0000-0000-0000-000000000006'
      AND question_id = (
        SELECT question_id FROM mock_projection_question
      )
  ),
  1::bigint,
  'Mock completion projects all submitted child questions'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.get_student_ucat_score_projection_evidence(
      '10000000-0000-0000-0000-000000000006'
    ) evidence
    WHERE evidence.evidence_session_id =
      'fe000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'Mock completion admits its completed child Sets as score evidence'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000006'
      AND requested_reasons @> ARRAY['activity_completed']
  ),
  1::bigint,
  'parent Mock completion enqueues the activity refresh once'
);

SELECT * FROM finish();
ROLLBACK;
