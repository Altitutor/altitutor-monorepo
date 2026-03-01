-- ========================
-- UCAT Soft Delete: replace hard delete with soft delete; add restore RPCs
-- ========================

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

  -- Soft-delete all answer_options for questions in this stem
  UPDATE public.question_answer_options qao
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE qao.question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = p_stem_id);

  -- Soft-delete all questions in this stem
  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE question_stem_id = p_stem_id;

  -- Soft-delete the stem
  UPDATE public.question_stems
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_stem_id;
END;
$$;

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

  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.ucat_mocks
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_mock_id;
END;
$$;

-- Restore RPCs

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_stem(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Restore all answer_options for questions in this stem
  UPDATE public.question_answer_options qao
  SET deleted_at = NULL, deleted_by = NULL
  WHERE qao.question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = p_stem_id);

  -- Restore all questions in this stem
  UPDATE public.ucat_questions
  SET deleted_at = NULL, deleted_by = NULL
  WHERE question_stem_id = p_stem_id;

  -- Restore the stem
  UPDATE public.question_stems
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_question_stem(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.question_sets
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_question_set(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.ucat_mocks
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_mock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_mock(UUID) TO authenticated;
