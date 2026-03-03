-- UCAT: Add score_points and scaled_score to student_ucat_mock_attempts
-- Aggregated from child student_question_set_attempts when mock is completed.

ALTER TABLE public.student_ucat_mock_attempts
  ADD COLUMN IF NOT EXISTS score_points NUMERIC,
  ADD COLUMN IF NOT EXISTS total_points NUMERIC,
  ADD COLUMN IF NOT EXISTS scaled_score NUMERIC;
