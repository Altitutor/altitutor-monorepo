-- Move flashcard scheduling from the old SQL SM-2 approximation to app-level FSRS state.

DROP VIEW IF EXISTS public.vstudent_flashcard_review_cards;
DROP FUNCTION IF EXISTS public.student_rate_flashcard_review_card(UUID, TEXT);
DROP VIEW IF EXISTS public.vstaff_topic_flashcard_settings;
DROP TABLE IF EXISTS public.topic_flashcard_settings CASCADE;

ALTER TABLE public.student_flashcard_review_states
  ADD COLUMN IF NOT EXISTS stability NUMERIC,
  ADD COLUMN IF NOT EXISTS difficulty NUMERIC,
  ADD COLUMN IF NOT EXISTS scheduled_days INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_days >= 0),
  ADD COLUMN IF NOT EXISTS learning_steps INTEGER NOT NULL DEFAULT 0 CHECK (learning_steps >= 0),
  ADD COLUMN IF NOT EXISTS reps INTEGER NOT NULL DEFAULT 0 CHECK (reps >= 0),
  ADD COLUMN IF NOT EXISTS lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'New' CHECK (state IN ('New', 'Learning', 'Review', 'Relearning'));

ALTER TABLE public.student_flashcard_review_states
  DROP COLUMN IF EXISTS interval_days,
  DROP COLUMN IF EXISTS ease_factor,
  DROP COLUMN IF EXISTS repetitions;

CREATE OR REPLACE VIEW public.vstudent_flashcard_review_cards
WITH (security_invoker = false)
AS
SELECT
  rc.id,
  rc.flashcard_id,
  rc.cloze_index,
  f.topic_id,
  f.cloze_text,
  f.extra,
  f.index AS flashcard_index,
  COALESCE(s.due_at, NOW()) AS due_at,
  s.stability,
  s.difficulty,
  COALESCE(s.scheduled_days, 0) AS scheduled_days,
  COALESCE(s.learning_steps, 0) AS learning_steps,
  COALESCE(s.reps, 0) AS reps,
  COALESCE(s.lapses, 0) AS lapses,
  COALESCE(s.state, 'New') AS state,
  s.last_reviewed_at,
  s.last_rating
FROM public.flashcard_review_cards rc
JOIN public.flashcards f ON f.id = rc.flashcard_id
LEFT JOIN public.student_flashcard_review_states s
  ON s.review_card_id = rc.id
  AND s.student_id = public.current_student_id()
WHERE rc.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND f.topic_id IN (SELECT id FROM public.vstudent_topics);

GRANT SELECT ON public.vstudent_flashcard_review_cards TO authenticated;
