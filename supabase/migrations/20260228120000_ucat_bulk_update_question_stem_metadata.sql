-- Bulk update question stem metadata (category, is_private) for tutor UCAT bulk actions.
-- Only columns passed as non-NULL are updated. No schema change to tables.

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(
  p_stem_ids UUID[],
  p_question_stem_category_id UUID DEFAULT NULL,
  p_is_private BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF array_length(p_stem_ids, 1) IS NULL OR array_length(p_stem_ids, 1) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.question_stems
  SET
    question_stem_category_id = COALESCE(p_question_stem_category_id, question_stem_category_id),
    is_private = COALESCE(p_is_private, is_private)
  WHERE id = ANY(p_stem_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(UUID[], UUID, BOOLEAN) TO authenticated;
