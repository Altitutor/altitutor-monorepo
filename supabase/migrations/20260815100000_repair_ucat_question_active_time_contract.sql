-- ALTI-545 removed student_question_attempts.question_answer_option_id after
-- canonical response snapshots became the sole answer persistence contract.
-- Recreate the timing-only writer so it no longer references that removed
-- compatibility column. The contraction migration was already deployed and
-- is therefore intentionally left unchanged.
CREATE OR REPLACE FUNCTION public.increment_ucat_question_active_time(
  p_student_id uuid,
  p_question_id uuid,
  p_set_attempt_id uuid,
  p_practice_session_id uuid,
  p_elapsed_milliseconds bigint,
  p_was_timed boolean,
  p_mode text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_set_attempt_id IS NOT NULL THEN
    INSERT INTO public.student_question_attempts (
      student_id,
      student_question_set_attempt_id,
      student_practice_session_id,
      question_id,
      answer_snapshot,
      is_flagged,
      is_submitted,
      time_spent_seconds,
      time_spent_milliseconds,
      first_seen_at,
      was_timed,
      mode
    ) VALUES (
      p_student_id,
      p_set_attempt_id,
      NULL,
      p_question_id,
      NULL,
      false,
      false,
      NULLIF((GREATEST(p_elapsed_milliseconds, 0) + 999) / 1000, 0),
      GREATEST(p_elapsed_milliseconds, 0),
      now(),
      p_was_timed,
      p_mode
    )
    ON CONFLICT (student_question_set_attempt_id, question_id)
    DO UPDATE SET
      time_spent_milliseconds = COALESCE(
        public.student_question_attempts.time_spent_milliseconds,
        0
      ) + GREATEST(excluded.time_spent_milliseconds, 0),
      time_spent_seconds = NULLIF((
        COALESCE(public.student_question_attempts.time_spent_milliseconds, 0)
          + GREATEST(excluded.time_spent_milliseconds, 0)
          + 999
      ) / 1000, 0),
      first_seen_at = COALESCE(
        public.student_question_attempts.first_seen_at,
        excluded.first_seen_at
      ),
      was_timed = excluded.was_timed,
      mode = excluded.mode;
  ELSIF p_practice_session_id IS NOT NULL THEN
    INSERT INTO public.student_question_attempts (
      student_id,
      student_question_set_attempt_id,
      student_practice_session_id,
      question_id,
      answer_snapshot,
      is_flagged,
      is_submitted,
      time_spent_seconds,
      time_spent_milliseconds,
      first_seen_at,
      was_timed,
      mode
    ) VALUES (
      p_student_id,
      NULL,
      p_practice_session_id,
      p_question_id,
      NULL,
      false,
      false,
      NULLIF((GREATEST(p_elapsed_milliseconds, 0) + 999) / 1000, 0),
      GREATEST(p_elapsed_milliseconds, 0),
      now(),
      p_was_timed,
      p_mode
    )
    ON CONFLICT (student_practice_session_id, question_id)
    DO UPDATE SET
      time_spent_milliseconds = COALESCE(
        public.student_question_attempts.time_spent_milliseconds,
        0
      ) + GREATEST(excluded.time_spent_milliseconds, 0),
      time_spent_seconds = NULLIF((
        COALESCE(public.student_question_attempts.time_spent_milliseconds, 0)
          + GREATEST(excluded.time_spent_milliseconds, 0)
          + 999
      ) / 1000, 0),
      first_seen_at = COALESCE(
        public.student_question_attempts.first_seen_at,
        excluded.first_seen_at
      ),
      was_timed = excluded.was_timed,
      mode = excluded.mode;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_ucat_question_active_time(
  uuid, uuid, uuid, uuid, bigint, boolean, text
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_ucat_question_active_time(
  uuid, uuid, uuid, uuid, bigint, boolean, text
) TO service_role;
