-- Topic-linked cloze flashcards with per-cloze spaced repetition.

CREATE TABLE IF NOT EXISTS public.flashcard_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  index INTEGER NOT NULL CHECK (index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcard_collections_topic_index
  ON public.flashcard_collections(topic_id, index)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flashcard_collections_topic
  ON public.flashcard_collections(topic_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.flashcard_collections(id) ON DELETE CASCADE,
  title TEXT,
  cloze_text TEXT NOT NULL,
  extra TEXT,
  index INTEGER NOT NULL CHECK (index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  CONSTRAINT flashcards_cloze_text_has_marker CHECK (cloze_text ~ '\{\{c[0-9]+::')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_collection_index
  ON public.flashcards(collection_id, index)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_collection
  ON public.flashcards(collection_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.flashcard_review_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  cloze_index INTEGER NOT NULL CHECK (cloze_index > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (flashcard_id, cloze_index)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_review_cards_flashcard
  ON public.flashcard_review_cards(flashcard_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.student_flashcard_review_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  review_card_id UUID NOT NULL REFERENCES public.flashcard_review_cards(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  ease_factor NUMERIC NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_reviewed_at TIMESTAMPTZ,
  last_rating TEXT CHECK (last_rating IS NULL OR last_rating IN ('again', 'hard', 'good', 'easy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, review_card_id)
);

CREATE INDEX IF NOT EXISTS idx_student_flashcard_review_states_due
  ON public.student_flashcard_review_states(student_id, due_at);

CREATE OR REPLACE FUNCTION public.extract_flashcard_cloze_indexes(p_cloze_text TEXT)
RETURNS INTEGER[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT (m[1])::INTEGER ORDER BY (m[1])::INTEGER), ARRAY[]::INTEGER[])
  FROM regexp_matches(COALESCE(p_cloze_text, ''), '\{\{c([0-9]+)::', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION public.sync_flashcard_review_cards(p_flashcard_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indexes INTEGER[];
  v_index INTEGER;
BEGIN
  SELECT public.extract_flashcard_cloze_indexes(cloze_text)
  INTO v_indexes
  FROM public.flashcards
  WHERE id = p_flashcard_id AND deleted_at IS NULL;

  IF v_indexes IS NULL OR array_length(v_indexes, 1) IS NULL THEN
    UPDATE public.flashcard_review_cards
    SET deleted_at = NOW()
    WHERE flashcard_id = p_flashcard_id AND deleted_at IS NULL;
    RETURN;
  END IF;

  UPDATE public.flashcard_review_cards
  SET deleted_at = NOW()
  WHERE flashcard_id = p_flashcard_id
    AND deleted_at IS NULL
    AND NOT (cloze_index = ANY(v_indexes));

  FOREACH v_index IN ARRAY v_indexes LOOP
    INSERT INTO public.flashcard_review_cards (flashcard_id, cloze_index, deleted_at)
    VALUES (p_flashcard_id, v_index, NULL)
    ON CONFLICT (flashcard_id, cloze_index)
    DO UPDATE SET deleted_at = NULL;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_flashcard_review_cards_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_flashcard_review_cards(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_flashcard_review_cards_on_change ON public.flashcards;
CREATE TRIGGER sync_flashcard_review_cards_on_change
  AFTER INSERT OR UPDATE OF cloze_text, deleted_at ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_flashcard_review_cards_trigger();

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
    JOIN public.flashcard_collections fc ON fc.id = f.collection_id
    WHERE rc.id = p_review_card_id
      AND rc.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND fc.topic_id IN (SELECT id FROM public.vstudent_topics)
  ) THEN
    RAISE EXCEPTION 'flashcard_review_card_not_accessible';
  END IF;

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
    v_interval := 1;
    v_ease := GREATEST(1.3, v_ease - 0.2);
    v_lapses := v_lapses + 1;
  ELSIF p_rating = 'hard' THEN
    v_repetitions := v_repetitions + 1;
    v_interval := GREATEST(1, CEIL(GREATEST(v_state.interval_days, 1) * 1.2)::INTEGER);
    v_ease := GREATEST(1.3, v_ease - 0.15);
  ELSIF p_rating = 'good' THEN
    v_interval := CASE
      WHEN v_repetitions = 0 THEN 1
      WHEN v_repetitions = 1 THEN 6
      ELSE CEIL(GREATEST(v_state.interval_days, 1) * v_ease)::INTEGER
    END;
    v_repetitions := v_repetitions + 1;
  ELSE
    v_interval := CASE
      WHEN v_repetitions = 0 THEN 4
      WHEN v_repetitions = 1 THEN 7
      ELSE CEIL(GREATEST(v_state.interval_days, 1) * v_ease * 1.3)::INTEGER
    END;
    v_repetitions := v_repetitions + 1;
    v_ease := v_ease + 0.15;
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

GRANT EXECUTE ON FUNCTION public.student_rate_flashcard_review_card(UUID, TEXT) TO authenticated;

ALTER TABLE public.flashcard_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_review_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_flashcard_review_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read flashcard collections" ON public.flashcard_collections;
CREATE POLICY "Staff read flashcard collections" ON public.flashcard_collections
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Staff write flashcard collections" ON public.flashcard_collections;
CREATE POLICY "Staff write flashcard collections" ON public.flashcard_collections
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
  WITH CHECK ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Students read accessible flashcard collections" ON public.flashcard_collections;
CREATE POLICY "Students read accessible flashcard collections" ON public.flashcard_collections
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND topic_id IN (SELECT id FROM public.vstudent_topics));

DROP POLICY IF EXISTS "Staff read flashcards" ON public.flashcards;
CREATE POLICY "Staff read flashcards" ON public.flashcards
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Staff write flashcards" ON public.flashcards;
CREATE POLICY "Staff write flashcards" ON public.flashcards
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
  WITH CHECK ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Students read accessible flashcards" ON public.flashcards;
CREATE POLICY "Students read accessible flashcards" ON public.flashcards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND collection_id IN (
      SELECT id FROM public.flashcard_collections
      WHERE deleted_at IS NULL AND topic_id IN (SELECT id FROM public.vstudent_topics)
    )
  );

DROP POLICY IF EXISTS "Staff read flashcard review cards" ON public.flashcard_review_cards;
CREATE POLICY "Staff read flashcard review cards" ON public.flashcard_review_cards
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

DROP POLICY IF EXISTS "Students read accessible flashcard review cards" ON public.flashcard_review_cards;
CREATE POLICY "Students read accessible flashcard review cards" ON public.flashcard_review_cards
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND flashcard_id IN (
      SELECT f.id
      FROM public.flashcards f
      JOIN public.flashcard_collections fc ON fc.id = f.collection_id
      WHERE f.deleted_at IS NULL
        AND fc.deleted_at IS NULL
        AND fc.topic_id IN (SELECT id FROM public.vstudent_topics)
    )
  );

DROP POLICY IF EXISTS "Students own flashcard review states" ON public.student_flashcard_review_states;
CREATE POLICY "Students own flashcard review states" ON public.student_flashcard_review_states
  FOR ALL TO authenticated
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());

DROP POLICY IF EXISTS "Staff read flashcard review states" ON public.student_flashcard_review_states;
CREATE POLICY "Staff read flashcard review states" ON public.student_flashcard_review_states
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

CREATE OR REPLACE VIEW public.vstaff_flashcard_collections
WITH (security_invoker = false)
AS
SELECT
  fc.*,
  t.name AS topic_name,
  t.code AS topic_code,
  t.subject_id,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards f
    WHERE f.collection_id = fc.id AND f.deleted_at IS NULL
  ) AS flashcard_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE f.collection_id = fc.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
  ) AS review_card_count
FROM public.flashcard_collections fc
JOIN public.topics t ON t.id = fc.topic_id
WHERE fc.deleted_at IS NULL
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcard_collections TO authenticated;

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
JOIN public.flashcard_collections fc ON fc.id = f.collection_id
WHERE f.deleted_at IS NULL
  AND fc.deleted_at IS NULL
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcards TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_flashcard_collections
WITH (security_invoker = false)
AS
SELECT
  fc.id,
  fc.topic_id,
  fc.title,
  fc.description,
  fc.index,
  fc.created_at,
  fc.updated_at,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcards f
    WHERE f.collection_id = fc.id AND f.deleted_at IS NULL
  ) AS flashcard_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    JOIN public.flashcards f ON f.id = rc.flashcard_id
    WHERE f.collection_id = fc.id
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
    WHERE f.collection_id = fc.id
      AND f.deleted_at IS NULL
      AND rc.deleted_at IS NULL
      AND COALESCE(s.due_at, NOW()) <= NOW()
  ) AS due_review_card_count
FROM public.flashcard_collections fc
WHERE fc.deleted_at IS NULL
  AND fc.topic_id IN (SELECT id FROM public.vstudent_topics);

GRANT SELECT ON public.vstudent_flashcard_collections TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_flashcard_review_cards
WITH (security_invoker = false)
AS
SELECT
  rc.id,
  rc.flashcard_id,
  rc.cloze_index,
  f.collection_id,
  f.title,
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
JOIN public.flashcard_collections fc ON fc.id = f.collection_id
LEFT JOIN public.student_flashcard_review_states s
  ON s.review_card_id = rc.id
  AND s.student_id = public.current_student_id()
WHERE rc.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND fc.deleted_at IS NULL
  AND fc.topic_id IN (SELECT id FROM public.vstudent_topics);

GRANT SELECT ON public.vstudent_flashcard_review_cards TO authenticated;
