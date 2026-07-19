-- Merge a duplicate UCAT question stem into another stem without rebuilding questions.
-- Keeping question IDs intact preserves attempt history and question-level file/tag links.

CREATE OR REPLACE FUNCTION public.tutor_ucat_merge_question_stems(
  p_target_stem_id UUID,
  p_source_stem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.question_stems%ROWTYPE;
  v_source public.question_stems%ROWTYPE;
  v_target_content JSONB;
  v_source_content JSONB;
  v_unique_source_content JSONB;
  v_next_question_index INTEGER;
  v_question RECORD;
  v_duplicate_question_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target_stem_id IS NULL OR p_source_stem_id IS NULL OR p_target_stem_id = p_source_stem_id THEN
    RAISE EXCEPTION 'Two different question stems are required';
  END IF;

  SELECT * INTO v_target
  FROM public.question_stems
  WHERE id = p_target_stem_id AND deleted_at IS NULL
  FOR UPDATE;

  SELECT * INTO v_source
  FROM public.question_stems
  WHERE id = p_source_stem_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_target.id IS NULL OR v_source.id IS NULL THEN
    RAISE EXCEPTION 'Question stem not found';
  END IF;

  IF v_target.section_id <> v_source.section_id THEN
    RAISE EXCEPTION 'Question stems must belong to the same UCAT section';
  END IF;

  -- Preserve rich-text blocks that exist only on the source stem. This captures
  -- importer-added instructions without duplicating blocks shared by both stems.
  v_target_content := COALESCE(v_target.stem_text->'content', '[]'::JSONB);
  v_source_content := COALESCE(v_source.stem_text->'content', '[]'::JSONB);
  SELECT COALESCE(jsonb_agg(source_block ORDER BY ordinal), '[]'::JSONB)
  INTO v_unique_source_content
  FROM jsonb_array_elements(v_source_content) WITH ORDINALITY AS source(source_block, ordinal)
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_target_content) AS target(target_block)
    WHERE target.target_block = source.source_block
  );

  SELECT COALESCE(MAX(index), -1) + 1
  INTO v_next_question_index
  FROM public.ucat_questions
  WHERE question_stem_id = p_target_stem_id AND deleted_at IS NULL;

  FOR v_question IN
    SELECT q.*
    FROM public.ucat_questions q
    WHERE q.question_stem_id = p_source_stem_id AND q.deleted_at IS NULL
    ORDER BY q.index, q.id
  LOOP
    -- Collapse a byte-for-byte equivalent question already present on the target.
    -- Question text, explanation, metadata, tags, and ordered options must all match.
    v_duplicate_question_id := NULL;
    SELECT candidate.id INTO v_duplicate_question_id
    FROM public.ucat_questions candidate
    WHERE jsonb_array_length(v_unique_source_content) = 0
      AND candidate.question_stem_id = p_target_stem_id
      AND candidate.deleted_at IS NULL
      AND candidate.question_text = v_question.question_text
      AND candidate.answer_explanation IS NOT DISTINCT FROM v_question.answer_explanation
      AND candidate.difficulty IS NOT DISTINCT FROM v_question.difficulty
      AND candidate.time_burden_seconds IS NOT DISTINCT FROM v_question.time_burden_seconds
      AND candidate.question_type = v_question.question_type
      AND (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'is_answer', option.is_answer
        ) ORDER BY option.index), '[]'::JSONB)
        FROM public.question_answer_options option
        WHERE option.question_id = candidate.id AND option.deleted_at IS NULL
      ) = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'is_answer', option.is_answer
        ) ORDER BY option.index), '[]'::JSONB)
        FROM public.question_answer_options option
        WHERE option.question_id = v_question.id AND option.deleted_at IS NULL
      )
      AND (
        SELECT COALESCE(jsonb_agg(tag.tag_id ORDER BY tag.tag_id), '[]'::JSONB)
        FROM public.questions_question_tags tag
        WHERE tag.question_id = candidate.id
      ) = (
        SELECT COALESCE(jsonb_agg(tag.tag_id ORDER BY tag.tag_id), '[]'::JSONB)
        FROM public.questions_question_tags tag
        WHERE tag.question_id = v_question.id
      )
    LIMIT 1;

    IF v_duplicate_question_id IS NULL THEN
      UPDATE public.ucat_questions
      SET question_stem_id = p_target_stem_id,
          index = v_next_question_index,
          question_text = CASE
            WHEN jsonb_array_length(v_unique_source_content) > 0
              AND jsonb_typeof(question_text) = 'object'
              AND jsonb_typeof(question_text->'content') = 'array'
              THEN jsonb_set(
                question_text,
                '{content}',
                v_unique_source_content || COALESCE(question_text->'content', '[]'::JSONB),
                true
              )
            ELSE question_text
          END,
          updated_at = NOW(),
          updated_by = public.current_tutor_id()
      WHERE id = v_question.id;

      -- Source-only stem blocks may contain images which now live in the moved
      -- question. Retain their file links at question scope as well.
      IF jsonb_array_length(v_unique_source_content) > 0 THEN
        INSERT INTO public.questions_files (question_id, file_id)
        SELECT v_question.id, source_file.file_id
        FROM public.question_stems_files source_file
        WHERE source_file.question_stem_id = p_source_stem_id
        ON CONFLICT (question_id, file_id) DO NOTHING;
      END IF;

      v_next_question_index := v_next_question_index + 1;
    ELSE
      UPDATE public.question_answer_options
      SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
      WHERE question_id = v_question.id AND deleted_at IS NULL;

      UPDATE public.ucat_questions
      SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
      WHERE id = v_question.id;
    END IF;
  END LOOP;

  -- Retain every set membership without creating duplicate target memberships.
  UPDATE public.question_stems_question_sets source_membership
  SET question_stem_id = p_target_stem_id,
      updated_at = NOW(),
      updated_by = public.current_tutor_id()
  WHERE source_membership.question_stem_id = p_source_stem_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets target_membership
      WHERE target_membership.question_stem_id = p_target_stem_id
        AND target_membership.question_set_id = source_membership.question_set_id
    );

  DELETE FROM public.question_stems_question_sets
  WHERE question_stem_id = p_source_stem_id;

  -- Retain all stem-level rich-text file links.
  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT p_target_stem_id, source_file.file_id
  FROM public.question_stems_files source_file
  WHERE source_file.question_stem_id = p_source_stem_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  DELETE FROM public.question_stems_files
  WHERE question_stem_id = p_source_stem_id;

  UPDATE public.question_stems
  SET deleted_at = NOW(),
      deleted_by = public.current_tutor_id(),
      updated_at = NOW(),
      updated_by = public.current_tutor_id()
  WHERE id = p_source_stem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_merge_question_stems(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_merge_question_stems(UUID, UUID) TO authenticated;
