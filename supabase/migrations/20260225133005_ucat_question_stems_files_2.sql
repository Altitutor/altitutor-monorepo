-- ==========================================
-- Helper to extract image file IDs from ProseMirror JSONB docs
-- ==========================================

CREATE OR REPLACE FUNCTION public.extract_image_file_ids_from_doc(p_doc JSONB)
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT (img->'attrs'->>'fileId')::UUID),
    ARRAY[]::UUID[]
  )
  FROM jsonb_path_query(COALESCE(p_doc, '{}'::jsonb), '$.** ? (@.type == "image")') AS img
  WHERE (img->'attrs'->>'fileId') IS NOT NULL
$$;

COMMENT ON FUNCTION public.extract_image_file_ids_from_doc(JSONB) IS
  'Extracts distinct UUIDs from image nodes in a ProseMirror JSONB document, reading attrs.fileId.';

-- ==========================================
-- Extend tutor_ucat_upsert_question_stem_bundle to maintain image link tables
-- ==========================================

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_is_private BOOLEAN,
  p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_staff_id UUID;
  v_question JSONB;
  v_question_id UUID;
  v_option JSONB;
  v_tag_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_stem_id IS NULL THEN
    INSERT INTO public.question_stems (
      section_id,
      question_stem_category_id,
      stem_text,
      is_private,
      created_by,
      updated_by
    ) VALUES (
      p_section_id,
      p_question_stem_category_id,
      COALESCE(p_stem_text, '{}'::jsonb),
      COALESCE(p_is_private, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_stem_id;
  ELSE
    UPDATE public.question_stems
    SET section_id = p_section_id,
        question_stem_category_id = p_question_stem_category_id,
        stem_text = COALESCE(p_stem_text, '{}'::jsonb),
        is_private = COALESCE(p_is_private, false),
        updated_by = v_staff_id
    WHERE id = p_stem_id
    RETURNING id INTO v_stem_id;

    IF v_stem_id IS NULL THEN
      RAISE EXCEPTION 'question_stem_not_found';
    END IF;

    -- Clear existing tag, answer option, question, and image link records for this stem
    DELETE FROM public.questions_question_tags
    WHERE question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = v_stem_id);

    DELETE FROM public.question_answer_options
    WHERE question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = v_stem_id);

    DELETE FROM public.questions_files
    WHERE question_id IN (SELECT id FROM public.ucat_questions WHERE question_stem_id = v_stem_id);

    DELETE FROM public.question_stems_files
    WHERE question_stem_id = v_stem_id;

    DELETE FROM public.ucat_questions
    WHERE question_stem_id = v_stem_id;
  END IF;

  FOR v_question IN SELECT * FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
  LOOP
    INSERT INTO public.ucat_questions (
      question_stem_id,
      question_text,
      answer_explanation,
      index,
      difficulty,
      time_burden_seconds,
      question_type,
      created_by,
      updated_by
    ) VALUES (
      v_stem_id,
      COALESCE(v_question->'question_text', '{}'::jsonb),
      v_question->'answer_explanation',
      COALESCE((v_question->>'index')::INTEGER, 1),
      NULLIF(v_question->>'difficulty', '')::NUMERIC,
      NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
      COALESCE((v_question->>'question_type')::public.ucat_question_type, 'multiple_choice'::public.ucat_question_type),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_question_id;

    -- Link images in question_text into questions_files
    INSERT INTO public.questions_files (question_id, file_id)
    SELECT v_question_id, file_id
    FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(v_question->'question_text', '{}'::jsonb))) AS file_id
    ON CONFLICT (question_id, file_id) DO NOTHING;

    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_question->'answer_options', '[]'::jsonb))
    LOOP
      INSERT INTO public.question_answer_options (
        question_id,
        answer_text,
        answer_explanation,
        index,
        is_answer,
        image_file_id,
        created_by,
        updated_by
      ) VALUES (
        v_question_id,
        COALESCE(v_option->'answer_text', '{}'::jsonb),
        v_option->'answer_explanation',
        COALESCE((v_option->>'index')::INTEGER, 1),
        COALESCE((v_option->>'is_answer')::BOOLEAN, false),
        NULLIF(v_option->>'image_file_id', '')::UUID,
        v_staff_id,
        v_staff_id
      );
    END LOOP;

    FOR v_tag_id IN
      SELECT DISTINCT NULLIF(value::TEXT, '')::UUID
      FROM jsonb_array_elements_text(COALESCE(v_question->'tag_ids', '[]'::jsonb))
    LOOP
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO public.questions_question_tags (question_id, tag_id, created_by)
        VALUES (v_question_id, v_tag_id, v_staff_id)
        ON CONFLICT (question_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Maintain question_stems_files based on images in stem_text
  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT v_stem_id, file_id
  FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(p_stem_text, '{}'::jsonb))) AS file_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  RETURN v_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB) TO authenticated;


