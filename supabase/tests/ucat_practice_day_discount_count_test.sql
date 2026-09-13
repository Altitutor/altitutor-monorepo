BEGIN;
SELECT plan(4);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.count_submitted_attempts_today(UUID, TEXT)',
    'EXECUTE'
  ),
  'the service role can count qualifying practice-day attempts'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.count_submitted_attempts_today(UUID, TEXT)',
    'EXECUTE'
  ),
  'authenticated callers cannot invoke the server-only qualification RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.count_submitted_attempts_today(UUID, TEXT)',
    'EXECUTE'
  ),
  'anonymous callers cannot invoke the server-only qualification RPC'
);

CREATE TEMP TABLE practice_discount_fixture AS
SELECT
  student.id AS student_id,
  question.id AS question_id,
  question.answer_scheme::TEXT AS answer_scheme,
  option.id AS option_id,
  (
    SELECT COUNT(*)::BIGINT
    FROM public.student_question_attempts attempt
    WHERE attempt.student_id = student.id
      AND attempt.is_submitted = TRUE
      AND (
        jsonb_typeof(attempt.answer_snapshot#>'{response,selectedOptionId}') = 'string'
        OR (
          jsonb_typeof(
            attempt.answer_snapshot#>'{response,placements}'
          ) = 'object'
          AND attempt.answer_snapshot#>'{response,placements}' <> '{}'::JSONB
        )
      )
      AND (attempt.attempted_at AT TIME ZONE 'Australia/Adelaide')::DATE =
          (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE
  ) AS answered_today_before
FROM public.students student
CROSS JOIN LATERAL (
  SELECT candidate.id, candidate.answer_scheme
  FROM public.ucat_questions candidate
  WHERE candidate.answer_scheme IN ('single_choice', 'situational_judgement_rating')
    AND candidate.deleted_at IS NULL
  ORDER BY candidate.id
  LIMIT 1
) question
CROSS JOIN LATERAL (
  SELECT candidate.id
  FROM public.question_answer_options candidate
  WHERE candidate.question_id = question.id
    AND candidate.deleted_at IS NULL
  ORDER BY candidate.index, candidate.id
  LIMIT 1
) option
ORDER BY student.id
LIMIT 1;

INSERT INTO public.student_question_attempts (
  student_id,
  question_id,
  answer_snapshot,
  is_submitted,
  attempted_at
)
SELECT
  student_id,
  question_id,
  jsonb_build_object(
    'type', 'ucat_response_v1',
    'questionId', question_id,
    'answerScheme', answer_scheme,
    'response', jsonb_build_object(
      'kind', 'single_select',
      'selectedOptionId', option_id
    )
  ),
  TRUE,
  NOW()
FROM practice_discount_fixture
UNION ALL
SELECT
  student_id,
  question_id,
  jsonb_build_object(
    'type', 'ucat_response_v1',
    'questionId', question_id,
    'answerScheme', answer_scheme,
    'response', jsonb_build_object(
      'kind', 'single_select',
      'selectedOptionId', NULL
    )
  ),
  TRUE,
  NOW()
FROM practice_discount_fixture;

SELECT lives_ok(
  format(
    $assert$
      DO $body$
      DECLARE
        v_actual BIGINT;
      BEGIN
        SELECT public.count_submitted_attempts_today(%1$L::UUID, 'Australia/Adelaide')
        INTO v_actual;

        IF v_actual <> %2$s THEN
          RAISE EXCEPTION 'expected %2$s answered attempts today, got %%', v_actual;
        END IF;
      END;
      $body$;
    $assert$,
    student_id,
    answered_today_before + 1
  ),
  'practice-day qualification counts a submitted canonical answer and excludes a submitted blank'
)
FROM practice_discount_fixture;

SELECT * FROM finish();
ROLLBACK;
