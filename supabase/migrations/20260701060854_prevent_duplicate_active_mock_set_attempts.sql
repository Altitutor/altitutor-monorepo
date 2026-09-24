-- Prevent concurrent timing syncs from creating duplicate child set attempts
-- for the same in-progress mock section. Completed historical attempts are
-- intentionally excluded so this guard can be deployed without rewriting old
-- result data.
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_question_set_attempts_active_mock_set_unique
  ON public.student_question_set_attempts (student_ucat_mock_attempt_id, question_set_id)
  WHERE student_ucat_mock_attempt_id IS NOT NULL
    AND completed_at IS NULL;
