-- UCAT exam attempt resume: server snapshot + per-segment countdown
-- Supports sets, mocks, and practice sessions (in-progress resume + away expiry).

ALTER TABLE public.student_question_set_attempts
  ADD COLUMN IF NOT EXISTS engine_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS current_segment_ends_at TIMESTAMPTZ;

ALTER TABLE public.student_ucat_mock_attempts
  ADD COLUMN IF NOT EXISTS engine_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS current_segment_ends_at TIMESTAMPTZ;

ALTER TABLE public.student_practice_sessions
  ADD COLUMN IF NOT EXISTS engine_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS current_segment_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_student_question_set_attempts_incomplete
  ON public.student_question_set_attempts (student_id)
  WHERE completed_at IS NULL AND engine_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_ucat_mock_attempts_incomplete
  ON public.student_ucat_mock_attempts (student_id)
  WHERE completed_at IS NULL AND engine_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_practice_sessions_incomplete
  ON public.student_practice_sessions (student_id)
  WHERE completed_at IS NULL AND engine_snapshot IS NOT NULL;
