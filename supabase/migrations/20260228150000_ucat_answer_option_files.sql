-- Migration: Replace answer option image_file_id with answer_option_files join table
-- Description:
--  - Add answer_option_files (answer_option_id, file_id, usage) for option_text and option_explanation
--  - Drop image_file_id from question_answer_options
--  - Update RPC and tutor/student views to use the new table

-- ========================
-- answer_option_files
-- ========================

CREATE TABLE IF NOT EXISTS public.answer_option_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_option_id UUID NOT NULL REFERENCES public.question_answer_options(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  usage TEXT NOT NULL CHECK (usage IN ('option_text', 'option_explanation')),
  UNIQUE (answer_option_id, file_id, usage)
);

CREATE INDEX IF NOT EXISTS idx_answer_option_files_option
  ON public.answer_option_files(answer_option_id);
CREATE INDEX IF NOT EXISTS idx_answer_option_files_file
  ON public.answer_option_files(file_id);

ALTER TABLE public.answer_option_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "ADMINSTAFF full access to answer_option_files" ON public.answer_option_files;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "ADMINSTAFF full access to answer_option_files"
  ON public.answer_option_files
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Drop views that depend on image_file_id before dropping the column
DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;
DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;

-- Drop image_file_id from question_answer_options
ALTER TABLE public.question_answer_options
  DROP COLUMN IF EXISTS image_file_id;

-- ========================
-- Update tutor_ucat_upsert_question_stem_bundle
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

-- ========================
-- Recreate vtutor_ucat_question_stem_detail (no image_file_id; join table not in view)
-- ========================

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
        'deleted_at', q.deleted_at,
        'tags', (
          SELECT json_agg(json_build_object('id', qt.id, 'name', qt.name))
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

-- ========================
-- Recreate vstudent_ucat_question_stem_detail (no image_file_id; join table not in view)
-- ========================

CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  qs.question_stem_category_id,
  qs.stem_text,
  qs.created_at,
  qs.updated_at,
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
        'answer_options', (
          SELECT json_agg(
            json_build_object(
              'id', qao.id,
              'answer_text', qao.answer_text,
              'answer_explanation', qao.answer_explanation,
              'index', qao.index
            )
            ORDER BY qao.index
          )
          FROM public.question_answer_options qao
          WHERE qao.question_id = q.id AND qao.deleted_at IS NULL
        )
      )
      ORDER BY q.index
    )
    FROM public.ucat_questions q
    WHERE q.question_stem_id = qs.id AND q.deleted_at IS NULL
  ) AS questions
FROM public.question_stems qs
JOIN public.ucat_sections us ON us.id = qs.section_id
WHERE public.is_ucat_student() AND qs.is_private = false AND qs.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated;
