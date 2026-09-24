-- Discarded exam attempts still count as quota starts, but their submitted
-- question rows must not contribute to student history or aggregate progress.
CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_attempts
WITH (security_invoker = false)
AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.student_question_set_attempt_id,
  attempt.student_practice_session_id,
  COALESCE(attempt.question_id, (attempt.content_snapshot #>> '{question,id}')::UUID) AS question_id,
  COALESCE(question.question_stem_id, (attempt.content_snapshot #>> '{stem,id}')::UUID) AS question_stem_id,
  COALESCE(question.index, (attempt.content_snapshot #>> '{question,index}')::INTEGER) AS question_index,
  COALESCE(question.question_text, attempt.content_snapshot #> '{question,questionText}') AS question_text,
  COALESCE(question.question_type, (attempt.content_snapshot #>> '{question,questionType}')::public.ucat_question_type) AS question_type,
  COALESCE(question.time_burden_seconds, (attempt.content_snapshot #>> '{question,timeBurdenSeconds}')::INTEGER) AS time_burden_seconds,
  COALESCE(stem.stem_text, attempt.content_snapshot #> '{stem,stemText}') AS stem_text,
  COALESCE(stem.question_stem_category_id, (attempt.content_snapshot #>> '{stem,categoryId}')::UUID) AS question_stem_category_id,
  COALESCE(category.name, attempt.content_snapshot #>> '{stem,categoryName}') AS category_name,
  COALESCE(section.id, (attempt.content_snapshot #>> '{stem,sectionId}')::UUID) AS ucat_section_id,
  COALESCE(section.name, attempt.content_snapshot #>> '{stem,sectionName}') AS section_name,
  COALESCE(section.section_number, (attempt.content_snapshot #>> '{stem,sectionNumber}')::INTEGER) AS section_number,
  attempt.question_answer_option_id,
  COALESCE(selected_option.answer_text, (
    SELECT option -> 'answerText'
    FROM jsonb_array_elements(COALESCE(attempt.content_snapshot -> 'answerOptions', '[]'::jsonb)) option
    WHERE option ->> 'id' = attempt.question_answer_option_id::TEXT
    LIMIT 1
  )) AS selected_answer_text,
  attempt.answer_snapshot,
  attempt.score,
  attempt.is_flagged,
  attempt.is_submitted,
  attempt.attempted_at,
  attempt.time_spent_seconds,
  attempt.student_question_speed,
  attempt.was_timed,
  attempt.mode,
  attempt.content_snapshot
FROM public.student_question_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access
LEFT JOIN public.student_question_set_attempts set_attempt
  ON set_attempt.id = attempt.student_question_set_attempt_id
LEFT JOIN public.student_practice_sessions practice_session
  ON practice_session.id = attempt.student_practice_session_id
LEFT JOIN public.ucat_questions question ON question.id = attempt.question_id
LEFT JOIN public.question_stems stem ON stem.id = question.question_stem_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_answer_options selected_option ON selected_option.id = attempt.question_answer_option_id
WHERE (
    attempt.student_question_set_attempt_id IS NULL
    OR set_attempt.discarded_at IS NULL
  )
  AND (
    attempt.student_practice_session_id IS NULL
    OR practice_session.discarded_at IS NULL
  );

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated;
