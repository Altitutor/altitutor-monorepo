-- Add first-class image occlusion flashcards while preserving text cloze cards.

DROP VIEW IF EXISTS public.vstudent_flashcard_review_cards;
DROP VIEW IF EXISTS public.vstaff_flashcards;

ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_cloze_text_has_marker;

ALTER TABLE public.flashcards
  ALTER COLUMN cloze_text DROP NOT NULL,
  ADD COLUMN card_type TEXT NOT NULL DEFAULT 'text_cloze',
  ADD COLUMN image_file_id UUID REFERENCES public.files(id) ON DELETE RESTRICT,
  ADD COLUMN image_alt_text TEXT,
  ADD COLUMN occlusion_data JSONB;

CREATE INDEX idx_flashcards_image_file_id
  ON public.flashcards(image_file_id)
  WHERE image_file_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_valid_image_occlusion_data(p_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mask JSONB;
  v_mask_count INTEGER;
  v_natural_width NUMERIC;
  v_natural_height NUMERIC;
  v_cloze_index NUMERIC;
  v_x NUMERIC;
  v_y NUMERIC;
  v_width NUMERIC;
  v_height NUMERIC;
BEGIN
  IF jsonb_typeof(p_data) <> 'object'
    OR p_data ->> 'version' <> '1'
    OR jsonb_typeof(p_data -> 'masks') <> 'array'
    OR (p_data ? 'groupDescriptions' AND jsonb_typeof(p_data -> 'groupDescriptions') <> 'object') THEN
    RETURN FALSE;
  END IF;

  BEGIN
    v_natural_width := (p_data ->> 'naturalWidth')::NUMERIC;
    v_natural_height := (p_data ->> 'naturalHeight')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  IF v_natural_width <= 0 OR v_natural_height <= 0
    OR v_natural_width <> trunc(v_natural_width)
    OR v_natural_height <> trunc(v_natural_height)
    OR v_natural_width * v_natural_height > 25000000 THEN
    RETURN FALSE;
  END IF;

  v_mask_count := jsonb_array_length(p_data -> 'masks');
  IF v_mask_count < 1 OR v_mask_count > 100 THEN
    RETURN FALSE;
  END IF;

  IF (
    SELECT count(DISTINCT mask ->> 'id') <> v_mask_count
    FROM jsonb_array_elements(p_data -> 'masks') AS mask
  ) THEN
    RETURN FALSE;
  END IF;

  FOR v_mask IN SELECT value FROM jsonb_array_elements(p_data -> 'masks') LOOP
    IF jsonb_typeof(v_mask) <> 'object' OR COALESCE(v_mask ->> 'id', '') = '' THEN
      RETURN FALSE;
    END IF;

    BEGIN
      v_cloze_index := (v_mask ->> 'clozeIndex')::NUMERIC;
      v_x := (v_mask ->> 'x')::NUMERIC;
      v_y := (v_mask ->> 'y')::NUMERIC;
      v_width := (v_mask ->> 'width')::NUMERIC;
      v_height := (v_mask ->> 'height')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;

    IF v_cloze_index <= 0 OR v_cloze_index <> trunc(v_cloze_index)
      OR v_x < 0 OR v_y < 0 OR v_width <= 0 OR v_height <= 0
      OR v_x > 1 OR v_y > 1 OR v_width > 1 OR v_height > 1
      OR v_x + v_width > 1.000001 OR v_y + v_height > 1.000001 THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_card_type_check
    CHECK (card_type IN ('text_cloze', 'image_occlusion')),
  ADD CONSTRAINT flashcards_content_by_type_check
    CHECK (
      (
        card_type = 'text_cloze'
        AND cloze_text IS NOT NULL
        AND cloze_text ~ '\{\{c[0-9]+::'
        AND image_file_id IS NULL
        AND occlusion_data IS NULL
      )
      OR
      (
        card_type = 'image_occlusion'
        AND cloze_text IS NULL
        AND image_file_id IS NOT NULL
        AND public.is_valid_image_occlusion_data(occlusion_data)
      )
    );

CREATE OR REPLACE FUNCTION public.extract_flashcard_image_cloze_indexes(p_occlusion_data JSONB)
RETURNS INTEGER[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT (mask ->> 'clozeIndex')::INTEGER ORDER BY (mask ->> 'clozeIndex')::INTEGER),
    ARRAY[]::INTEGER[]
  )
  FROM jsonb_array_elements(COALESCE(p_occlusion_data -> 'masks', '[]'::JSONB)) AS mask;
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
  SELECT CASE
    WHEN card_type = 'image_occlusion'
      THEN public.extract_flashcard_image_cloze_indexes(occlusion_data)
    ELSE public.extract_flashcard_cloze_indexes(cloze_text)
  END
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

DROP TRIGGER IF EXISTS sync_flashcard_review_cards_on_change ON public.flashcards;
CREATE TRIGGER sync_flashcard_review_cards_on_change
  AFTER INSERT OR UPDATE OF card_type, cloze_text, occlusion_data, deleted_at ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_flashcard_review_cards_trigger();

CREATE OR REPLACE VIEW public.vstaff_flashcards
WITH (security_invoker = false)
AS
SELECT
  f.*,
  image_file.storage_path AS image_storage_path,
  image_file.mimetype AS image_mimetype,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    WHERE rc.flashcard_id = f.id AND rc.deleted_at IS NULL
  ) AS review_card_count
FROM public.flashcards f
LEFT JOIN public.files image_file ON image_file.id = f.image_file_id
WHERE f.deleted_at IS NULL
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcards TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_flashcard_review_cards
WITH (security_invoker = false)
AS
SELECT
  rc.id,
  rc.flashcard_id,
  rc.cloze_index,
  f.topic_id,
  f.card_type,
  f.cloze_text,
  f.extra,
  f.image_file_id,
  f.image_alt_text,
  f.occlusion_data,
  image_file.storage_path AS image_storage_path,
  image_file.mimetype AS image_mimetype,
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
JOIN public.topics t ON t.id = f.topic_id
LEFT JOIN public.files image_file ON image_file.id = f.image_file_id
LEFT JOIN public.student_flashcard_review_states s
  ON s.review_card_id = rc.id
  AND s.student_id = public.current_student_id()
WHERE rc.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND t.subject_id IN (
    SELECT access.subject_id
    FROM public.vstudent_my_subject_access access
    WHERE access.subject_id IS NOT NULL
  );

GRANT SELECT ON public.vstudent_flashcard_review_cards TO authenticated;

COMMENT ON VIEW public.vstudent_flashcard_review_cards IS
  'Student text-cloze and image-occlusion review cards scoped by subject access.';

