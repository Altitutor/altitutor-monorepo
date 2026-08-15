BEGIN;
SELECT plan(5);

SELECT is(
  position(
    'question_answer_option_id' IN pg_get_functiondef(
      'public.increment_ucat_question_active_time(uuid,uuid,uuid,uuid,bigint,boolean,text)'::regprocedure
    )
  ),
  0,
  'active-time persistence does not reference the removed selected-option column'
);

CREATE TEMP TABLE active_time_fixture AS
SELECT
  question.id AS question_id,
  stem.section_id,
  '10000000-0000-0000-0000-000000000010'::uuid AS student_id,
  'f3000000-0000-4000-8000-000000000001'::uuid AS question_set_id
FROM public.ucat_questions question
JOIN public.question_stems stem ON stem.id = question.question_stem_id
WHERE question.deleted_at IS NULL
  AND stem.deleted_at IS NULL
ORDER BY question.id
LIMIT 1;

INSERT INTO public.student_question_set_attempts (
  id,
  student_id,
  question_set_id,
  attempted_at
)
SELECT
  'fa150000-0000-4000-8000-000000000001',
  student_id,
  question_set_id,
  now()
FROM active_time_fixture;

INSERT INTO public.student_practice_sessions (
  id,
  student_id,
  ucat_section_id,
  section_key,
  started_at
)
SELECT
  'fa150000-0000-4000-8000-000000000002',
  student_id,
  section_id,
  'active-time-contract-test',
  now()
FROM active_time_fixture;

SELECT lives_ok(
  format(
    $$SELECT public.increment_ucat_question_active_time(
      %L::uuid, %L::uuid, %L::uuid, NULL, 1250, true, 'question'
    )$$,
    fixture.student_id,
    fixture.question_id,
    'fa150000-0000-4000-8000-000000000001'
  ),
  'set active time creates a canonical attempt row'
)
FROM active_time_fixture fixture;

SELECT results_eq(
  $$
    SELECT time_spent_milliseconds, time_spent_seconds, answer_snapshot
    FROM public.student_question_attempts
    WHERE student_question_set_attempt_id = 'fa150000-0000-4000-8000-000000000001'
  $$,
  $$ VALUES (1250::bigint, 2, NULL::jsonb) $$,
  'set active time stores timing without a legacy selected-option value'
);

SELECT lives_ok(
  format(
    $$SELECT public.increment_ucat_question_active_time(
      %L::uuid, %L::uuid, NULL, %L::uuid, 750, false, 'question_stem'
    )$$,
    fixture.student_id,
    fixture.question_id,
    'fa150000-0000-4000-8000-000000000002'
  ),
  'practice active time creates a canonical attempt row'
)
FROM active_time_fixture fixture;

SELECT results_eq(
  $$
    SELECT time_spent_milliseconds, time_spent_seconds, answer_snapshot
    FROM public.student_question_attempts
    WHERE student_practice_session_id = 'fa150000-0000-4000-8000-000000000002'
  $$,
  $$ VALUES (750::bigint, 1, NULL::jsonb) $$,
  'practice active time stores timing without a legacy selected-option value'
);

SELECT * FROM finish();
ROLLBACK;
