-- UCAT question stem source provenance for tutor-only authoring workflows.

DO $$ BEGIN
  CREATE TYPE public.ucat_question_source_channel AS ENUM (
    'individual',
    'bulk_import',
    'ai_generation'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.question_stems
  ADD COLUMN IF NOT EXISTS source_channel public.ucat_question_source_channel,
  ADD COLUMN IF NOT EXISTS tutor_source_note TEXT;

ALTER TABLE public.ucat_questions
  ADD COLUMN IF NOT EXISTS source_channel public.ucat_question_source_channel,
  ADD COLUMN IF NOT EXISTS ai_generation_metadata JSONB;

UPDATE public.question_stems
SET source_channel = CASE
    WHEN is_ai_generated THEN 'ai_generation'::public.ucat_question_source_channel
    ELSE 'bulk_import'::public.ucat_question_source_channel
  END
WHERE source_channel IS NULL;

UPDATE public.ucat_questions q
SET source_channel = COALESCE(qs.source_channel, 'bulk_import'::public.ucat_question_source_channel),
    ai_generation_metadata = CASE
      WHEN COALESCE(qs.source_channel, 'bulk_import'::public.ucat_question_source_channel) = 'ai_generation'::public.ucat_question_source_channel
      THEN qs.ai_generation_metadata
      ELSE q.ai_generation_metadata
    END
FROM public.question_stems qs
WHERE qs.id = q.question_stem_id
  AND q.source_channel IS NULL;

ALTER TABLE public.question_stems
  ALTER COLUMN source_channel SET DEFAULT 'individual'::public.ucat_question_source_channel,
  ALTER COLUMN source_channel SET NOT NULL;

ALTER TABLE public.ucat_questions
  ALTER COLUMN source_channel SET DEFAULT 'individual'::public.ucat_question_source_channel,
  ALTER COLUMN source_channel SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_question_stems_source_channel
  ON public.question_stems(source_channel);

CREATE INDEX IF NOT EXISTS idx_ucat_questions_source_channel
  ON public.ucat_questions(source_channel);

COMMENT ON COLUMN public.question_stems.source_channel IS 'Tutor-only provenance: workflow that first created this question stem.';
COMMENT ON COLUMN public.question_stems.tutor_source_note IS 'Tutor-only free-text note describing where source-derived content came from.';
COMMENT ON COLUMN public.ucat_questions.source_channel IS 'Tutor-only provenance: workflow that first created this child question.';
COMMENT ON COLUMN public.ucat_questions.ai_generation_metadata IS 'Tutor-only AI provenance for an AI-generated child question.';

DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_is_private BOOLEAN,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
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
      source_channel,
      tutor_source_note,
      created_by,
      updated_by
    ) VALUES (
      p_section_id,
      p_question_stem_category_id,
      COALESCE(p_stem_text, '{}'::jsonb),
      COALESCE(p_is_private, false),
      COALESCE(p_source_channel, 'individual'::public.ucat_question_source_channel),
      NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
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
        tutor_source_note = NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
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
      source_channel,
      ai_generation_metadata,
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
      COALESCE(
        NULLIF(COALESCE(v_question->>'source_channel', v_question->>'sourceChannel'), '')::public.ucat_question_source_channel,
        p_source_channel,
        'individual'::public.ucat_question_source_channel
      ),
      NULLIF(COALESCE(v_question->'ai_generation_metadata', v_question->'aiGenerationMetadata'), 'null'::jsonb),
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

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(UUID, UUID, UUID, JSONB, BOOLEAN, JSONB, public.ucat_question_source_channel, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(
  p_section_id UUID,
  p_stems JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_ids UUID[] := ARRAY[]::UUID[];
  v_stem JSONB;
  v_stem_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN
    RAISE EXCEPTION 'invalid_stems_payload';
  END IF;

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      COALESCE(NULLIF(v_stem->>'stemId', '')::UUID, NULL),
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      COALESCE((v_stem->>'isPrivate')::BOOLEAN, false),
      COALESCE(v_stem->'questions', '[]'::jsonb),
      COALESCE(NULLIF(v_stem->>'sourceChannel', '')::public.ucat_question_source_channel, 'bulk_import'::public.ucat_question_source_channel),
      v_stem->>'tutorSourceNote'
    );

    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;

  RETURN v_result_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(
  p_section_id UUID,
  p_stems JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_ids UUID[] := ARRAY[]::UUID[];
  v_stem JSONB;
  v_stem_id UUID;
  v_ai_metadata JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN
    RAISE EXCEPTION 'invalid_stems_payload';
  END IF;

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      COALESCE(NULLIF(v_stem->>'stemId', '')::UUID, NULL),
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      true,
      COALESCE(v_stem->'questions', '[]'::jsonb),
      'ai_generation'::public.ucat_question_source_channel,
      v_stem->>'tutorSourceNote'
    );

    v_ai_metadata := COALESCE(v_stem->'ai_generation_metadata', '{}'::jsonb);
    UPDATE public.question_stems
    SET is_ai_generated = true,
        source_channel = 'ai_generation'::public.ucat_question_source_channel,
        ai_generation_metadata = NULLIF(v_ai_metadata, '{}'::jsonb),
        approval_status = 'pending',
        approved_by = NULL,
        approved_at = NULL
    WHERE id = v_stem_id;

    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;

  RETURN v_result_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(UUID, JSONB) TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_generated;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems_approved;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stems;

CREATE VIEW public.vtutor_ucat_question_stems
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns AS section_display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.is_ai_generated,
  qs.ai_generation_metadata,
  qs.source_channel,
  qs.tutor_source_note,
  qs.approval_status,
  qs.approved_by,
  qs.approved_at,
  approved_staff.first_name AS approved_by_first_name,
  approved_staff.last_name AS approved_by_last_name,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  (SELECT COUNT(*)::INT FROM public.ucat_questions q WHERE q.question_stem_id = qs.id) AS question_count,
  (SELECT COALESCE(jsonb_agg(qset.name ORDER BY qset.updated_at DESC NULLS LAST, qset.id), '[]'::jsonb)
   FROM public.question_stems_question_sets qsq
   JOIN public.question_sets qset ON qset.id = qsq.question_set_id
     AND qset.is_student_generated = false
     AND qset.deleted_at IS NULL
   WHERE qsq.question_stem_id = qs.id) AS set_names,
  (SELECT COALESCE(jsonb_agg(qset.id ORDER BY qset.updated_at DESC NULLS LAST, qset.id), '[]'::jsonb)
   FROM public.question_stems_question_sets qsq
   JOIN public.question_sets qset ON qset.id = qsq.question_set_id
     AND qset.is_student_generated = false
     AND qset.deleted_at IS NULL
   WHERE qsq.question_stem_id = qs.id) AS set_ids
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = qs.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = qs.updated_by
LEFT JOIN public.staff approved_staff ON approved_staff.id = qs.approved_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stems TO authenticated;

CREATE VIEW public.vtutor_ucat_question_stems_approved
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE approval_status = 'approved';

GRANT SELECT ON public.vtutor_ucat_question_stems_approved TO authenticated;

CREATE VIEW public.vtutor_ucat_question_stems_generated
WITH (security_invoker = false)
AS
SELECT *
FROM public.vtutor_ucat_question_stems
WHERE is_ai_generated = true;

GRANT SELECT ON public.vtutor_ucat_question_stems_generated TO authenticated;

DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;

CREATE VIEW public.vtutor_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qsc.name AS category_name,
  qs.is_private,
  qs.is_ai_generated,
  qs.ai_generation_metadata,
  qs.source_channel,
  qs.tutor_source_note,
  qs.approval_status,
  qs.approved_by,
  qs.approved_at,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
  qs.created_by,
  qs.updated_by,
  qs.deleted_at,
  qs.deleted_by,
  (
    SELECT json_agg(
      json_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'answer_explanation', q.answer_explanation,
        'index', q.index,
        'difficulty', q.difficulty,
        'time_burden_seconds', q.time_burden_seconds,
        'question_type', q.question_type,
        'source_channel', q.source_channel,
        'ai_generation_metadata', q.ai_generation_metadata,
        'deleted_at', q.deleted_at,
        'tags', (
          SELECT json_agg(
            json_build_object('id', qt.id, 'name', qt.name)
          )
          FROM public.questions_question_tags qqt
          JOIN public.question_tags qt ON qt.id = qqt.tag_id
          WHERE qqt.question_id = q.id
        ),
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index,
              'is_answer', qao.is_answer,
              'deleted_at', qao.deleted_at
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
LEFT JOIN public.question_stem_categories qsc ON qsc.id = qs.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;
