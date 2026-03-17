-- UCAT visibility cascade and blocks
-- 1. Mock: when visibility changes, cascade to all sets and question stems in those sets
-- 2. Set: when visibility changes, cascade to all question stems; block public->private if set is in a public mock
-- 3. Question stem: block public->private if stem is in a public set

-- ========================
-- 1. tutor_ucat_upsert_mock: cascade visibility to sets and stems
-- ========================

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock(
  p_mock_id UUID,
  p_name TEXT,
  p_is_private BOOLEAN,
  p_set_ids JSONB,
  p_instructions_text JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_staff_id UUID;
  v_set_id UUID;
  v_index INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    INSERT INTO public.ucat_mocks (
      name,
      is_private,
      instructions_text,
      created_by,
      updated_by
    ) VALUES (
      COALESCE(NULLIF(p_name, ''), 'Untitled Mock'),
      COALESCE(p_is_private, false),
      p_instructions_text,
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_mock_id;
  ELSE
    UPDATE public.ucat_mocks
    SET name = COALESCE(NULLIF(p_name, ''), name),
        is_private = COALESCE(p_is_private, false),
        instructions_text = p_instructions_text,
        updated_by = v_staff_id
    WHERE id = p_mock_id
    RETURNING id INTO v_mock_id;

    IF v_mock_id IS NULL THEN
      RAISE EXCEPTION 'mock_not_found';
    END IF;

    DELETE FROM public.question_sets_ucat_mocks WHERE ucat_mock_id = v_mock_id;
  END IF;

  FOR v_set_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_set_ids, '[]'::jsonb))
  LOOP
    IF v_set_id IS NOT NULL THEN
      v_index := v_index + 1;
      INSERT INTO public.question_sets_ucat_mocks (
        question_set_id,
        ucat_mock_id,
        index,
        created_by,
        updated_by
      ) VALUES (
        v_set_id,
        v_mock_id,
        v_index,
        v_staff_id,
        v_staff_id
      );
    END IF;
  END LOOP;

  -- Cascade visibility to all sets in this mock and their stems
  UPDATE public.question_sets
  SET is_private = COALESCE(p_is_private, false),
      updated_by = v_staff_id
  WHERE id IN (
    SELECT question_set_id
    FROM public.question_sets_ucat_mocks
    WHERE ucat_mock_id = v_mock_id
  )
  AND deleted_at IS NULL;

  UPDATE public.question_stems
  SET is_private = COALESCE(p_is_private, false),
      updated_by = v_staff_id
  WHERE id IN (
    SELECT qsq.question_stem_id
    FROM public.question_stems_question_sets qsq
    JOIN public.question_sets_ucat_mocks qsum ON qsum.question_set_id = qsq.question_set_id
    WHERE qsum.ucat_mock_id = v_mock_id
  )
  AND deleted_at IS NULL;

  RETURN v_mock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, BOOLEAN, JSONB, JSONB) TO authenticated;

-- ========================
-- 2. tutor_ucat_upsert_question_set: block public->private if in public mock; cascade to stems
-- ========================

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_set(
  p_set_id UUID,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_is_private BOOLEAN,
  p_is_student_generated BOOLEAN,
  p_stem_ids JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
  v_public_mock_id UUID;
  v_public_mock_name TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  -- Block public->private if set is in a public mock
  IF p_set_id IS NOT NULL AND COALESCE(p_is_private, false) = true THEN
    SELECT m.id, m.name INTO v_public_mock_id, v_public_mock_name
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.ucat_mocks m ON m.id = qsum.ucat_mock_id AND m.deleted_at IS NULL AND m.is_private = false
    WHERE qsum.question_set_id = p_set_id
    LIMIT 1;

    IF v_public_mock_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot change to private: this set is in the public mock "%". Remove it from the mock or make the mock private first. Edit mock: /ucat/mocks/%', COALESCE(v_public_mock_name, 'Untitled'), v_public_mock_id;
    END IF;
  END IF;

  IF p_set_id IS NULL THEN
    INSERT INTO public.question_sets (
      name,
      description,
      time_limit_seconds,
      is_private,
      is_student_generated,
      created_by,
      updated_by
    ) VALUES (
      p_name,
      p_description,
      p_time_limit_seconds,
      COALESCE(p_is_private, false),
      COALESCE(p_is_student_generated, false),
      v_staff_id,
      v_staff_id
    )
    RETURNING id INTO v_set_id;
  ELSE
    UPDATE public.question_sets
    SET name = p_name,
        description = p_description,
        time_limit_seconds = p_time_limit_seconds,
        is_private = COALESCE(p_is_private, false),
        is_student_generated = COALESCE(p_is_student_generated, false),
        updated_by = v_staff_id
    WHERE id = p_set_id
    RETURNING id INTO v_set_id;

    IF v_set_id IS NULL THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;

    DELETE FROM public.question_stems_question_sets WHERE question_set_id = v_set_id;
  END IF;

  FOR v_stem_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_stem_ids, '[]'::jsonb))
  LOOP
    IF v_stem_id IS NOT NULL THEN
      v_index := v_index + 1;
      INSERT INTO public.question_stems_question_sets (
        question_stem_id,
        question_set_id,
        index,
        created_by,
        updated_by
      ) VALUES (
        v_stem_id,
        v_set_id,
        v_index,
        v_staff_id,
        v_staff_id
      );
    END IF;
  END LOOP;

  -- Cascade visibility to all stems in this set
  UPDATE public.question_stems
  SET is_private = COALESCE(p_is_private, false),
      updated_by = v_staff_id
  WHERE id IN (
    SELECT question_stem_id
    FROM public.question_stems_question_sets
    WHERE question_set_id = v_set_id
  )
  AND deleted_at IS NULL;

  RETURN v_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set(UUID, JSONB, JSONB, INTEGER, BOOLEAN, BOOLEAN, JSONB) TO authenticated;

-- ========================
-- 3. tutor_ucat_upsert_question_stem_bundle: block public->private if stem is in a public set
-- ========================

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
  v_option_id UUID;
  v_option JSONB;
  v_tag_id UUID;
  v_file_id UUID;
  v_public_set_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();

  -- Block public->private if stem is in a public set
  IF p_stem_id IS NOT NULL AND COALESCE(p_is_private, false) = true THEN
    SELECT qs.id INTO v_public_set_id
    FROM public.question_stems_question_sets qsq
    JOIN public.question_sets qs ON qs.id = qsq.question_set_id AND qs.deleted_at IS NULL AND qs.is_private = false
    WHERE qsq.question_stem_id = p_stem_id
    LIMIT 1;

    IF v_public_set_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot change to private: this question stem is in one or more public sets. Remove it from the set or make the set private first. Edit set: /ucat/sets/%', v_public_set_id;
    END IF;
  END IF;

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
        created_by,
        updated_by
      ) VALUES (
        v_question_id,
        COALESCE(v_option->'answer_text', '{}'::jsonb),
        v_option->'answer_explanation',
        COALESCE((v_option->>'index')::INTEGER, 1),
        COALESCE((v_option->>'is_answer')::BOOLEAN, false),
        v_staff_id,
        v_staff_id
      )
      RETURNING id INTO v_option_id;

      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_text', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_text')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;

      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_explanation', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_explanation')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;
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

  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT v_stem_id, file_id
  FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(p_stem_text, '{}'::jsonb))) AS file_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  RETURN v_stem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB) TO authenticated;
