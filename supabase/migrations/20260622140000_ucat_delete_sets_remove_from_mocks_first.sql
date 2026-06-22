-- When tutors delete question sets, remove them from all non-deleted mocks first.

CREATE OR REPLACE FUNCTION public.tutor_ucat_remove_sets_from_all_mocks(p_set_ids UUID[])
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

  DELETE FROM public.question_sets_ucat_mocks qsum
  USING public.ucat_mocks m
  WHERE qsum.ucat_mock_id = m.id
    AND m.deleted_at IS NULL
    AND qsum.question_set_id = ANY(p_set_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_remove_sets_from_all_mocks(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM public.tutor_ucat_remove_sets_from_all_mocks(ARRAY[p_set_id]);

  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

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

  PERFORM public.tutor_ucat_remove_sets_from_all_mocks(p_set_ids);

  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_set_ids);
END;
$$;
