BEGIN;
SELECT plan(3);

CREATE TEMP TABLE projected_question AS
SELECT question.id
FROM public.ucat_questions question
JOIN public.question_stems stem ON stem.id = question.question_stem_id
WHERE question.deleted_at IS NULL
  AND stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND stem.access_scope = 'public'
  AND question.answer_scheme <> 'decision_making_binary_placement'
ORDER BY question.id
LIMIT 1;

INSERT INTO public.student_question_set_attempts (
  id,
  student_id,
  question_set_id,
  attempted_at
)
VALUES (
  'fc000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'f3000000-0000-4000-8000-000000000001',
  now() - interval '1 minute'
);

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
  'fd000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'fc000000-0000-4000-8000-000000000001',
  question.id,
  1,
  true,
  now()
FROM projected_question question;

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.student_ucat_question_progress progress
    JOIN projected_question question ON question.id = progress.question_id
    WHERE progress.student_id = '10000000-0000-0000-0000-000000000006'
  ),
  0::bigint,
  'submitted answers from an incomplete exam activity are not projected'
);

UPDATE public.student_question_set_attempts
SET completed_at = now(), score_points = 1, total_points = 1
WHERE id = 'fc000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.student_ucat_question_progress progress
    JOIN projected_question question ON question.id = progress.question_id
    WHERE progress.student_id = '10000000-0000-0000-0000-000000000006'
  ),
  1::bigint,
  'completing the parent activity projects its best submitted answers'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.ucat_student_preparation_refresh_requests request
    WHERE request.student_id = '10000000-0000-0000-0000-000000000006'
      AND request.requested_reasons @> ARRAY['activity_completed']
  ),
  1::bigint,
  'activity completion durably requests one preparation refresh'
);

SELECT * FROM finish();
ROLLBACK;
