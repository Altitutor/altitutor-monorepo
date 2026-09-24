-- Reordering is one aggregate operation. Park and finalize all card positions
-- with two set-based statements instead of issuing two updates per card from
-- the application.

CREATE OR REPLACE FUNCTION public.tutor_reorder_topic_flashcards(
  p_topic_id UUID,
  p_ordered_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parking_start INTEGER;
BEGIN
  IF COALESCE(cardinality(p_ordered_ids), 0) = 0 THEN
    RETURN;
  END IF;

  SELECT GREATEST(
    cardinality(p_ordered_ids),
    COALESCE(MAX(flashcard.index), 0)
  ) + 1
  INTO v_parking_start
  FROM public.flashcards flashcard
  WHERE flashcard.topic_id = p_topic_id
    AND flashcard.deleted_at IS NULL;

  UPDATE public.flashcards flashcard
  SET index = v_parking_start + ordering.position::INTEGER - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordering(id, position)
  WHERE flashcard.id = ordering.id
    AND flashcard.topic_id = p_topic_id;

  UPDATE public.flashcards flashcard
  SET index = ordering.position::INTEGER
  FROM unnest(p_ordered_ids) WITH ORDINALITY AS ordering(id, position)
  WHERE flashcard.id = ordering.id
    AND flashcard.topic_id = p_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_reorder_topic_flashcards(UUID, UUID[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_reorder_topic_flashcards(UUID, UUID[])
TO service_role;
