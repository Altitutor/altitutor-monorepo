-- Treat each topic as the flashcard collection boundary.

DROP VIEW IF EXISTS public.vstudent_flashcard_review_cards;
DROP VIEW IF EXISTS public.vstudent_flashcard_collections;
DROP VIEW IF EXISTS public.vstaff_flashcards;
DROP VIEW IF EXISTS public.vstaff_flashcard_collections;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE;

UPDATE public.flashcards f
SET topic_id = fc.topic_id
FROM public.flashcard_collections fc
WHERE f.collection_id = fc.id
  AND f.topic_id IS NULL;

ALTER TABLE public.flashcards
  ALTER COLUMN topic_id SET NOT NULL;

DROP INDEX IF EXISTS public.idx_flashcards_collection_index;
DROP INDEX IF EXISTS public.idx_flashcards_collection;

DROP POLICY IF EXISTS "Students read accessible flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Students read accessible flashcard review cards" ON public.flashcard_review_cards;

ALTER TABLE public.flashcards
  DROP COLUMN IF EXISTS collection_id;

ALTER TABLE public.flashcards
  DROP COLUMN IF EXISTS title;

DROP TABLE IF EXISTS public.flashcard_collections CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_topic_index
  ON public.flashcards(topic_id, index)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_topic
  ON public.flashcards(topic_id)
  WHERE deleted_at IS NULL;

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

CREATE POLICY "Students read accessible flashcards" ON public.flashcards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND topic_id IN (SELECT id FROM public.vstudent_topics)
  );

CREATE POLICY "Students read accessible flashcard review cards" ON public.flashcard_review_cards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND flashcard_id IN (
      SELECT f.id
      FROM public.flashcards f
      WHERE f.deleted_at IS NULL
        AND f.topic_id IN (SELECT id FROM public.vstudent_topics)
    )
  );

CREATE OR REPLACE VIEW public.vstaff_flashcard_topics
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.id AS topic_id,
  t.name AS title,
  NULL::TEXT AS description,
  COALESCE(t.index, 0) AS index,
  t.name AS topic_name,
  t.code AS topic_code,
  t.subject_id,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards f
    WHERE f.topic_id = t.id AND f.deleted_at IS NULL
  ) AS flashcard_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE f.topic_id = t.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
  ) AS review_card_count
FROM public.topics t
WHERE EXISTS (
    SELECT 1
    FROM public.flashcards f
    WHERE f.topic_id = t.id AND f.deleted_at IS NULL
  )
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcard_topics TO authenticated;

CREATE OR REPLACE VIEW public.vstaff_flashcards
WITH (security_invoker = false)
AS
SELECT
  f.*,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    WHERE rc.flashcard_id = f.id AND rc.deleted_at IS NULL
  ) AS review_card_count
FROM public.flashcards f
WHERE f.deleted_at IS NULL
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcards TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_flashcard_topics
WITH (security_invoker = false)
AS
SELECT
  t.id,
  t.id AS topic_id,
  t.name AS title,
  NULL::TEXT AS description,
  COALESCE(t.index, 0) AS index,
  t.created_at,
  t.updated_at,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards f
    WHERE f.topic_id = t.id AND f.deleted_at IS NULL
  ) AS flashcard_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE f.topic_id = t.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
  ) AS review_card_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    LEFT JOIN public.student_flashcard_review_states s
      ON s.review_card_id = rc.id
      AND s.student_id = public.current_student_id()
    WHERE f.topic_id = t.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
      AND COALESCE(s.due_at, NOW()) <= NOW()
  ) AS due_review_card_count
FROM public.topics t
WHERE t.id IN (SELECT id FROM public.vstudent_topics)
  AND EXISTS (
    SELECT 1
    FROM public.flashcards f
    WHERE f.topic_id = t.id AND f.deleted_at IS NULL
  );

GRANT SELECT ON public.vstudent_flashcard_topics TO authenticated;

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
