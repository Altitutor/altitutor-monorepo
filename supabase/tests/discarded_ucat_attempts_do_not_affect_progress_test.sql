BEGIN;
SELECT plan(3);

CREATE TEMP TABLE test_progress_questions AS
SELECT
  question.id,
  row_number() OVER (ORDER BY question.id) AS test_index
FROM public.ucat_questions question
JOIN public.question_stems stem
  ON stem.id = question.question_stem_id
WHERE question.deleted_at IS NULL
  AND stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND stem.access_scope = 'public'
  AND question.answer_scheme <> 'decision_making_binary_placement'
ORDER BY question.id
LIMIT 3;

INSERT INTO public.student_question_set_attempts (
  id,
  student_id,
  question_set_id,
  attempted_at,
  completed_at,
  discarded_at
)
VALUES
  (
    'fa000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000006',
    'f3000000-0000-4000-8000-000000000001',
    now() - interval '3 minutes',
    null,
    null
  ),
  (
    'fa000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000006',
    'f3000000-0000-4000-8000-000000000001',
    now() - interval '2 minutes',
    null,
    now() - interval '1 minute'
  );

INSERT INTO public.student_practice_sessions (
  id,
  student_id,
  ucat_section_id,
  section_key,
  started_at,
  discarded_at
)
SELECT
  'fa000000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000006',
  stem.section_id,
  'discarded-progress-test',
  now() - interval '2 minutes',
  now() - interval '1 minute'
FROM test_progress_questions selected
JOIN public.ucat_questions question ON question.id = selected.id
JOIN public.question_stems stem ON stem.id = question.question_stem_id
WHERE selected.test_index = 3;

INSERT INTO public.student_question_attempts (
  id,
  student_id,
  student_question_set_attempt_id,
  student_practice_session_id,
  question_id,
  score,
  is_submitted,
  attempted_at
)
SELECT
  CASE selected.test_index
    WHEN 1 THEN 'fb000000-0000-4000-8000-000000000001'::uuid
    WHEN 2 THEN 'fb000000-0000-4000-8000-000000000002'::uuid
    ELSE 'fb000000-0000-4000-8000-000000000003'::uuid
  END,
  '10000000-0000-0000-0000-000000000006',
  CASE selected.test_index
    WHEN 1 THEN 'fa000000-0000-4000-8000-000000000001'::uuid
    WHEN 2 THEN 'fa000000-0000-4000-8000-000000000002'::uuid
    ELSE null
  END,
  CASE selected.test_index
    WHEN 3 THEN 'fa000000-0000-4000-8000-000000000003'::uuid
    ELSE null
  END,
  selected.id,
  1,
  true,
  now() - interval '1 minute'
FROM test_progress_questions selected;

UPDATE public.student_question_set_attempts
SET completed_at = now() - interval '30 seconds'
WHERE id = 'fa000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.vstudent_ucat_my_question_attempts attempt
    WHERE attempt.id IN (
      'fb000000-0000-4000-8000-000000000001',
      'fb000000-0000-4000-8000-000000000002',
      'fb000000-0000-4000-8000-000000000003'
    )
  ),
  1::bigint,
  'student question history excludes answers from discarded set and practice attempts'
);

SELECT is(
  (
    SELECT coalesce(sum(progress.max_score), 0)::bigint
    FROM public.vstudent_ucat_my_question_progress progress
  ),
  1::bigint,
  'student aggregate progress excludes answers from discarded attempts'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.student_question_set_attempts attempt
    WHERE attempt.id = 'fa000000-0000-4000-8000-000000000002'
      AND attempt.discarded_at IS NOT NULL
  ),
  1::bigint,
  'discarding preserves the attempt start used by quota counting'
);

SELECT * FROM finish();
ROLLBACK;
