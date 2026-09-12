CREATE OR REPLACE FUNCTION public.tutor_ucat_remove_question_set_stems(
  p_set_id UUID,
  p_stem_ids UUID[]
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

  IF p_set_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.question_sets question_set
    WHERE question_set.id = p_set_id
      AND question_set.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'question_set_not_found';
  END IF;

  IF COALESCE(cardinality(p_stem_ids), 0) = 0 THEN
    RETURN;
  END IF;

  DELETE FROM public.question_stems_question_sets membership
  WHERE membership.question_set_id = p_set_id
    AND membership.question_stem_id = ANY(p_stem_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_remove_question_set_stems(UUID, UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_remove_question_set_stems(UUID, UUID[])
  TO authenticated;
