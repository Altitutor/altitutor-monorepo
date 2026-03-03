-- ========================
-- UCAT: Add instructions_text (tiptap/prosemirror JSONB) to ucat_sections and ucat_mocks;
-- drop description from ucat_sections (no longer needed).
-- ========================

-- 1. ucat_sections: add instructions_text
ALTER TABLE public.ucat_sections
  ADD COLUMN IF NOT EXISTS instructions_text JSONB DEFAULT NULL;

-- Drop views that depend on ucat_sections so we can drop description
DROP VIEW IF EXISTS public.vtutor_ucat_sections;
DROP VIEW IF EXISTS public.vstudent_ucat_sections;

-- Now drop description from ucat_sections
ALTER TABLE public.ucat_sections
  DROP COLUMN IF EXISTS description;

-- Recreate section views (SELECT us.* now excludes description, includes instructions_text)
CREATE VIEW public.vtutor_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_sections TO authenticated;

CREATE VIEW public.vstudent_ucat_sections
WITH (security_invoker = false)
AS
SELECT us.*
FROM public.ucat_sections us
WHERE public.is_ucat_student();

GRANT SELECT ON public.vstudent_ucat_sections TO authenticated;

-- 2. ucat_mocks: instructions_text for mock-level instructions (always shown at start of mock)
ALTER TABLE public.ucat_mocks
  ADD COLUMN IF NOT EXISTS instructions_text JSONB DEFAULT NULL;

-- 3. vstudent_ucat_mock_detail: expose instructions_text for student question engine
DROP VIEW IF EXISTS public.vstudent_ucat_mock_detail;
CREATE VIEW public.vstudent_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.instructions_text,
  m.created_at,
  m.updated_at,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.is_private = false AND qs.deleted_at IS NULL
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false AND m.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

-- 4. vstudent_ucat_question_stem_detail: expose section instructions_text and time_limit_seconds for set instructions
DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;
CREATE VIEW public.vstudent_ucat_question_stem_detail
WITH (security_invoker = false)
AS
SELECT
  qs.id,
  qs.section_id,
  us.section_number,
  us.name AS section_name,
  us.display_columns,
  us.instructions_text AS section_instructions_text,
  us.time_limit_seconds AS section_time_limit_seconds,
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

-- 5. vtutor_ucat_mock_detail: expose instructions_text for tutor mock editor
DROP VIEW IF EXISTS public.vtutor_ucat_mock_detail;
CREATE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.instructions_text,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  (
    SELECT json_agg(json_build_object('id', qs.id, 'name', qs.name, 'description', qs.description, 'time_limit_seconds', qs.time_limit_seconds) ORDER BY qsum.index)
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.question_sets qs ON qs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;

-- 6. tutor_ucat_upsert_mock: add p_instructions_text parameter and persist instructions_text
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

  RETURN v_mock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, BOOLEAN, JSONB, JSONB) TO authenticated;
