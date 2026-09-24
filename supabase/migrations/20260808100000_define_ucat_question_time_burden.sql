UPDATE public.ucat_questions
SET time_burden_seconds = NULL
WHERE time_burden_seconds IS NOT NULL
  AND time_burden_seconds <= 0;

ALTER TABLE public.ucat_questions
  ADD CONSTRAINT ucat_questions_time_burden_seconds_positive
  CHECK (time_burden_seconds IS NULL OR time_burden_seconds > 0);

COMMENT ON COLUMN public.ucat_questions.time_burden_seconds IS
  'Expected active working time, in whole seconds, for a candidate from the target UCAT cohort to submit a fully correct answer on first exposure under realistic section timing and without assistance. The question is encountered in its authored position within the stem. NULL means unknown. Initially authored or AI-estimated and eligible for later replacement by the denormalised average of eligible observed successful-answer times.';
