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

CREATE TABLE IF NOT EXISTS public.topic_flashcard_settings (
  topic_id UUID PRIMARY KEY REFERENCES public.topics(id) ON DELETE CASCADE,
  again_interval_days INTEGER NOT NULL DEFAULT 1 CHECK (again_interval_days >= 0),
  hard_multiplier NUMERIC NOT NULL DEFAULT 1.2 CHECK (hard_multiplier > 0),
  good_first_interval_days INTEGER NOT NULL DEFAULT 1 CHECK (good_first_interval_days >= 0),
  good_second_interval_days INTEGER NOT NULL DEFAULT 6 CHECK (good_second_interval_days >= 0),
  easy_first_interval_days INTEGER NOT NULL DEFAULT 4 CHECK (easy_first_interval_days >= 0),
  easy_second_interval_days INTEGER NOT NULL DEFAULT 7 CHECK (easy_second_interval_days >= 0),
  easy_multiplier NUMERIC NOT NULL DEFAULT 1.3 CHECK (easy_multiplier > 0),
  ease_min NUMERIC NOT NULL DEFAULT 1.3 CHECK (ease_min > 0),
  again_ease_delta NUMERIC NOT NULL DEFAULT -0.2,
  hard_ease_delta NUMERIC NOT NULL DEFAULT -0.15,
  easy_ease_delta NUMERIC NOT NULL DEFAULT 0.15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

ALTER TABLE public.topic_flashcard_settings ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Staff read topic flashcard settings" ON public.topic_flashcard_settings;
CREATE POLICY "Staff read topic flashcard settings" ON public.topic_flashcard_settings
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Staff write topic flashcard settings" ON public.topic_flashcard_settings;
CREATE POLICY "Staff write topic flashcard settings" ON public.topic_flashcard_settings
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
  WITH CHECK ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

CREATE OR REPLACE FUNCTION public.student_rate_flashcard_review_card(
  p_review_card_id UUID,
  p_rating TEXT
)
RETURNS public.student_flashcard_review_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_state public.student_flashcard_review_states;
  v_interval INTEGER;
  v_ease NUMERIC;
  v_repetitions INTEGER;
  v_lapses INTEGER;
  v_again_interval_days INTEGER := 1;
  v_hard_multiplier NUMERIC := 1.2;
  v_good_first_interval_days INTEGER := 1;
  v_good_second_interval_days INTEGER := 6;
  v_easy_first_interval_days INTEGER := 4;
  v_easy_second_interval_days INTEGER := 7;
  v_easy_multiplier NUMERIC := 1.3;
  v_ease_min NUMERIC := 1.3;
  v_again_ease_delta NUMERIC := -0.2;
  v_hard_ease_delta NUMERIC := -0.15;
  v_easy_ease_delta NUMERIC := 0.15;
BEGIN
  IF p_rating NOT IN ('again', 'hard', 'good', 'easy') THEN
    RAISE EXCEPTION 'invalid_flashcard_rating';
  END IF;

  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'student_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE rc.id = p_review_card_id
      AND rc.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.topic_id IN (SELECT id FROM public.vstudent_topics)
  ) THEN
    RAISE EXCEPTION 'flashcard_review_card_not_accessible';
  END IF;

  SELECT
    COALESCE(s.again_interval_days, v_again_interval_days),
    COALESCE(s.hard_multiplier, v_hard_multiplier),
    COALESCE(s.good_first_interval_days, v_good_first_interval_days),
    COALESCE(s.good_second_interval_days, v_good_second_interval_days),
    COALESCE(s.easy_first_interval_days, v_easy_first_interval_days),
    COALESCE(s.easy_second_interval_days, v_easy_second_interval_days),
    COALESCE(s.easy_multiplier, v_easy_multiplier),
    COALESCE(s.ease_min, v_ease_min),
    COALESCE(s.again_ease_delta, v_again_ease_delta),
    COALESCE(s.hard_ease_delta, v_hard_ease_delta),
    COALESCE(s.easy_ease_delta, v_easy_ease_delta)
  INTO
    v_again_interval_days,
    v_hard_multiplier,
    v_good_first_interval_days,
    v_good_second_interval_days,
    v_easy_first_interval_days,
    v_easy_second_interval_days,
    v_easy_multiplier,
    v_ease_min,
    v_again_ease_delta,
    v_hard_ease_delta,
    v_easy_ease_delta
  FROM public.flashcard_review_cards rc
  JOIN public.flashcards f ON f.id = rc.flashcard_id
  LEFT JOIN public.topic_flashcard_settings s ON s.topic_id = f.topic_id
  WHERE rc.id = p_review_card_id;

  INSERT INTO public.student_flashcard_review_states (student_id, review_card_id)
  VALUES (v_student_id, p_review_card_id)
  ON CONFLICT (student_id, review_card_id) DO NOTHING;

  SELECT *
  INTO v_state
  FROM public.student_flashcard_review_states
  WHERE student_id = v_student_id AND review_card_id = p_review_card_id
  FOR UPDATE;

  v_ease := v_state.ease_factor;
  v_repetitions := v_state.repetitions;
  v_lapses := v_state.lapses;

  IF p_rating = 'again' THEN
    v_repetitions := 0;
    v_interval := v_again_interval_days;
    v_ease := GREATEST(v_ease_min, v_ease + v_again_ease_delta);
    v_lapses := v_lapses + 1;
  ELSIF p_rating = 'hard' THEN
    v_repetitions := v_repetitions + 1;
    v_interval := GREATEST(1, CEIL(GREATEST(v_state.interval_days, 1) * v_hard_multiplier)::INTEGER);
    v_ease := GREATEST(v_ease_min, v_ease + v_hard_ease_delta);
  ELSIF p_rating = 'good' THEN
    v_interval := CASE
      WHEN v_repetitions = 0 THEN v_good_first_interval_days
      WHEN v_repetitions = 1 THEN v_good_second_interval_days
      ELSE CEIL(GREATEST(v_state.interval_days, 1) * v_ease)::INTEGER
    END;
    v_repetitions := v_repetitions + 1;
  ELSE
    v_interval := CASE
      WHEN v_repetitions = 0 THEN v_easy_first_interval_days
      WHEN v_repetitions = 1 THEN v_easy_second_interval_days
      ELSE CEIL(GREATEST(v_state.interval_days, 1) * v_ease * v_easy_multiplier)::INTEGER
    END;
    v_repetitions := v_repetitions + 1;
    v_ease := v_ease + v_easy_ease_delta;
  END IF;

  UPDATE public.student_flashcard_review_states
  SET
    due_at = NOW() + make_interval(days => v_interval),
    interval_days = v_interval,
    ease_factor = v_ease,
    repetitions = v_repetitions,
    lapses = v_lapses,
    last_reviewed_at = NOW(),
    last_rating = p_rating,
    updated_at = NOW()
  WHERE id = v_state.id
  RETURNING * INTO v_state;

  RETURN v_state;
END;
$$;

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

CREATE OR REPLACE VIEW public.vstaff_topic_flashcard_settings
WITH (security_invoker = false)
AS
SELECT
  t.id AS topic_id,
  COALESCE(s.again_interval_days, 1) AS again_interval_days,
  COALESCE(s.hard_multiplier, 1.2) AS hard_multiplier,
  COALESCE(s.good_first_interval_days, 1) AS good_first_interval_days,
  COALESCE(s.good_second_interval_days, 6) AS good_second_interval_days,
  COALESCE(s.easy_first_interval_days, 4) AS easy_first_interval_days,
  COALESCE(s.easy_second_interval_days, 7) AS easy_second_interval_days,
  COALESCE(s.easy_multiplier, 1.3) AS easy_multiplier,
  COALESCE(s.ease_min, 1.3) AS ease_min,
  COALESCE(s.again_ease_delta, -0.2) AS again_ease_delta,
  COALESCE(s.hard_ease_delta, -0.15) AS hard_ease_delta,
  COALESCE(s.easy_ease_delta, 0.15) AS easy_ease_delta
FROM public.topics t
LEFT JOIN public.topic_flashcard_settings s ON s.topic_id = t.id
WHERE ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_topic_flashcard_settings TO authenticated;

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
  COALESCE(s.interval_days, 0) AS interval_days,
  COALESCE(s.ease_factor, 2.5) AS ease_factor,
  COALESCE(s.repetitions, 0) AS repetitions,
  COALESCE(s.lapses, 0) AS lapses,
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
