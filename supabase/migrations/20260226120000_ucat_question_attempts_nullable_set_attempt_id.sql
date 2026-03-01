-- UCAT: Allow question attempts without a set attempt (question-stem mode)
-- Description: Make student_question_set_attempt_id nullable so question attempts
-- can be recorded without belonging to a specific set attempt (e.g. question-stem mode).
-- Date: 2026-02-26

ALTER TABLE public.student_question_attempts
  ALTER COLUMN student_question_set_attempt_id DROP NOT NULL;

