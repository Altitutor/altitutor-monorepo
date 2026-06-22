-- When tutors delete question stems, remove them from all non-deleted sets first
-- (including student-generated sets not shown in vtutor_ucat_question_stems.set_ids).

CREATE OR REPLACE FUNCTION public.tutor_ucat_remove_stems_from_all_sets(p_stem_ids UUID[])
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

  DELETE FROM public.question_stems_question_sets qsq
  USING public.question_sets qs
  WHERE qsq.question_set_id = qs.id
    AND qs.deleted_at IS NULL
    AND qsq.question_stem_id = ANY(p_stem_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_remove_stems_from_all_sets(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_stem(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM public.tutor_ucat_remove_stems_from_all_sets(ARRAY[p_stem_id]);

  UPDATE public.question_answer_options qao
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE qao.question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = p_stem_id);

  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE question_stem_id = p_stem_id;

  UPDATE public.question_stems
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_stem_id;
END;
$$;

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

  PERFORM public.tutor_ucat_remove_stems_from_all_sets(p_stem_ids);

  UPDATE public.question_answer_options qao
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE qao.question_id IN (
    SELECT id FROM public.ucat_questions WHERE question_stem_id = ANY(p_stem_ids)
  );

  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE question_stem_id = ANY(p_stem_ids);

  UPDATE public.question_stems
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_stem_ids);
END;
$$;
