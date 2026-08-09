BEGIN;
SELECT plan(5);

CREATE TEMP TABLE response_fixture AS
SELECT
  question.id AS question_id,
  question.answer_scheme::TEXT AS answer_scheme,
  (SELECT option.id FROM public.question_answer_options option
   WHERE option.question_id = question.id AND option.deleted_at IS NULL
   ORDER BY option.index LIMIT 1) AS option_id,
  (SELECT student.id FROM public.students student ORDER BY student.id LIMIT 1) AS student_id
FROM public.ucat_questions question
WHERE question.answer_scheme = 'single_choice'
  AND question.deleted_at IS NULL
  AND (SELECT count(*) FROM public.question_answer_options option
       WHERE option.question_id = question.id AND option.deleted_at IS NULL) >= 2
LIMIT 1;

SELECT ok(
  pg_get_viewdef('public.vstudent_ucat_question_stem_delivery'::regclass) LIKE '%response_type%'
    AND pg_get_viewdef('public.vstudent_ucat_question_stem_delivery'::regclass) LIKE '%answer_scheme%'
    AND pg_get_viewdef('public.vstudent_ucat_question_stem_delivery'::regclass) LIKE '%answer_key_value%',
  'student delivery exposes canonical response contracts and answer keys'
);

SELECT lives_ok(
  $$
    INSERT INTO public.student_question_attempts (
      student_id, question_id, question_answer_option_id, answer_snapshot
    )
    SELECT student_id, question_id, option_id, jsonb_build_object(
      'type', 'ucat_response_v1',
      'questionId', question_id,
      'answerScheme', answer_scheme,
      'response', jsonb_build_object(
        'kind', 'single_select',
        'selectedOptionId', option_id
      )
    )
    FROM response_fixture
  $$,
  'a valid canonical response snapshot persists'
);

SELECT throws_ok(
  $$
    INSERT INTO public.student_question_attempts (
      student_id, question_id, answer_snapshot
    )
    SELECT student_id, question_id, jsonb_build_object(
      'type', 'ucat_response_v1',
      'questionId', question_id,
      'answerScheme', answer_scheme,
      'response', jsonb_build_object(
        'kind', 'single_select',
        'selectedOptionId', 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      )
    )
    FROM response_fixture
  $$,
  'P0001',
  'UCAT response references an unknown option',
  'an unknown option ID is rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.student_question_attempts (
      student_id, question_id, question_answer_option_id, answer_snapshot
    )
    SELECT student_id, question_id,
      'ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID,
      jsonb_build_object(
        'type', 'ucat_response_v1',
        'questionId', question_id,
        'answerScheme', answer_scheme,
        'response', jsonb_build_object(
          'kind', 'single_select',
          'selectedOptionId', option_id
        )
      )
    FROM response_fixture
  $$,
  'P0001',
  'UCAT response snapshot conflicts with the selected option column',
  'conflicting canonical and compatibility answers are rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.student_question_attempts (
      student_id, question_id, answer_snapshot
    )
    SELECT student_id, question_id, jsonb_build_object(
      'type', 'syllogism_v1',
      'answers', '[]'::jsonb
    )
    FROM response_fixture
  $$,
  'P0001',
  'Invalid UCAT response snapshot contract',
  'new persistence rejects legacy response snapshots'
);

SELECT * FROM finish();
ROLLBACK;
