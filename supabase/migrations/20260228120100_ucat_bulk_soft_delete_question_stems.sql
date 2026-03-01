-- Bulk soft-delete question stems (and their questions/answer_options). Single RPC for N stems.

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_stems(p_stem_ids UUID[])
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

  -- Soft-delete all answer_options for questions in these stems
  UPDATE public.question_answer_options qao
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE qao.question_id IN (
    SELECT id FROM public.ucat_questions WHERE question_stem_id = ANY(p_stem_ids)
  );

  -- Soft-delete all questions in these stems
  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE question_stem_id = ANY(p_stem_ids);

  -- Soft-delete the stems
  UPDATE public.question_stems
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_stem_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_question_stems(UUID[]) TO authenticated;

-- Bulk soft-delete question sets
CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_sets(p_set_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF array_length(p_set_ids, 1) IS NULL OR array_length(p_set_ids, 1) = 0 THEN
    RETURN;
  END IF;
  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_set_ids);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_question_sets(UUID[]) TO authenticated;

-- Bulk soft-delete mocks
CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_mocks(p_mock_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF array_length(p_mock_ids, 1) IS NULL OR array_length(p_mock_ids, 1) = 0 THEN
    RETURN;
  END IF;
  UPDATE public.ucat_mocks
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_mock_ids);
END;
$$;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_delete_mocks(UUID[]) TO authenticated;
