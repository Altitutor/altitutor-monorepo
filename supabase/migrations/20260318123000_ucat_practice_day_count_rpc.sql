-- RPC to count submitted question attempts for a student on "today" in their timezone.
-- Used by practice-day discount logic.
CREATE OR REPLACE FUNCTION public.count_submitted_attempts_today(
  p_student_id UUID,
  p_timezone TEXT DEFAULT 'Australia/Adelaide'
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.student_question_attempts sqa
  WHERE sqa.student_id = p_student_id
    AND sqa.is_submitted = true
    AND (sqa.attempted_at AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::date =
        (NOW() AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::date;
$$;

GRANT EXECUTE ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.count_submitted_attempts_today(UUID, TEXT) IS 'Count submitted question attempts for student on today in given timezone. Used for practice-day discount.';
