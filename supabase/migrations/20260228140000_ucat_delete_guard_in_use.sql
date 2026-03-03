-- Block delete when question stems are in any set, or sets are in any mock.
-- Single and bulk RPCs: raise a clear error instead of deleting.
-- Set delete does NOT cascade to stems: we only soft-delete the set row (linking records remain).

-- Single: block stem delete if in any (non-deleted) set
CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_stem(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_set BOOLEAN;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.question_stems_question_sets qsq
    JOIN public.question_sets qs ON qs.id = qsq.question_set_id AND qs.deleted_at IS NULL
    WHERE qsq.question_stem_id = p_stem_id
  ) INTO v_in_set;

  IF v_in_set THEN
    RAISE EXCEPTION 'Cannot delete: this question stem is in one or more sets. Remove it from all sets first.';
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

-- Bulk: block if any stem is in any (non-deleted) set
CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_stems(p_stem_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked_count INT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF array_length(p_stem_ids, 1) IS NULL OR array_length(p_stem_ids, 1) = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT qsq.question_stem_id) INTO v_blocked_count
  FROM public.question_stems_question_sets qsq
  JOIN public.question_sets qs ON qs.id = qsq.question_set_id AND qs.deleted_at IS NULL
  WHERE qsq.question_stem_id = ANY(p_stem_ids);

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % question stem(s) are in one or more sets. Remove them from all sets first.', v_blocked_count;
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

-- Single: block set delete if in any (non-deleted) mock
CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_mock BOOLEAN;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.ucat_mocks m ON m.id = qsum.ucat_mock_id AND m.deleted_at IS NULL
    WHERE qsum.question_set_id = p_set_id
  ) INTO v_in_mock;

  IF v_in_mock THEN
    RAISE EXCEPTION 'Cannot delete: this question set is in one or more mocks. Remove it from all mocks first.';
  END IF;

  -- Soft-delete the set only (no cascade to stems or linking table)
  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

-- Bulk: block if any set is in any (non-deleted) mock
CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_delete_question_sets(p_set_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked_count INT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF array_length(p_set_ids, 1) IS NULL OR array_length(p_set_ids, 1) = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT qsum.question_set_id) INTO v_blocked_count
  FROM public.question_sets_ucat_mocks qsum
  JOIN public.ucat_mocks m ON m.id = qsum.ucat_mock_id AND m.deleted_at IS NULL
  WHERE qsum.question_set_id = ANY(p_set_ids);

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % question set(s) are in one or more mocks. Remove them from all mocks first.', v_blocked_count;
  END IF;

  -- Soft-delete the sets only (no cascade to stems or linking table)
  UPDATE public.question_sets
  SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
  WHERE id = ANY(p_set_ids);
END;
$$;
