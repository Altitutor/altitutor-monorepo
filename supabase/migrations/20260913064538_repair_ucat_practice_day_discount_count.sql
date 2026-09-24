-- ALTI: keep Accountability Pricing qualification on the canonical response
-- snapshot after question_answer_option_id was removed from attempt storage.
CREATE OR REPLACE FUNCTION public.count_submitted_attempts_today(
  p_student_id UUID,
  p_timezone TEXT DEFAULT 'Australia/Adelaide'
)
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.student_question_attempts attempt
  WHERE attempt.student_id = p_student_id
    AND attempt.is_submitted = TRUE
    AND (
      jsonb_typeof(
        attempt.answer_snapshot#>'{response,selectedOptionId}'
      ) = 'string'
      OR (
        jsonb_typeof(
          attempt.answer_snapshot#>'{response,placements}'
        ) = 'object'
        AND attempt.answer_snapshot#>'{response,placements}' <> '{}'::JSONB
      )
    )
    AND (attempt.attempted_at AT TIME ZONE p_timezone)::DATE =
        (NOW() AT TIME ZONE p_timezone)::DATE;
$$;

REVOKE ALL ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT)
TO service_role;

COMMENT ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT) IS
  'Count submitted attempts with a canonical nonblank response for the student today in the given timezone. Used for practice-day discounts.';
