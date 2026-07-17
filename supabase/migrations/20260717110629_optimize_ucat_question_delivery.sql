-- Keep question delivery independent from live attempt aggregates. The existing
-- detail view remains available to review surfaces that show answer statistics.
CREATE VIEW public.vstudent_ucat_question_stem_delivery
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question.id,
      'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'time_burden_seconds', question.time_burden_seconds,
      'question_type', question.question_type,
      'answer_options', (
        SELECT json_agg(json_build_object(
          'id', option.id,
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'index', option.index,
          'is_answer', option.is_answer
        ) ORDER BY option.index)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id
          AND option.deleted_at IS NULL
      )
    ) ORDER BY question.index)
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible
  ON accessible.id = stem.id
JOIN public.ucat_sections section
  ON section.id = stem.section_id;

GRANT SELECT ON public.vstudent_ucat_question_stem_delivery TO authenticated;

-- Practice selection only needs question identities/counts. Avoid building all
-- rich question/option JSON merely to decide which stem to serve next.
CREATE VIEW public.vstudent_ucat_practice_stem_index
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  stem.question_stem_category_id,
  ARRAY(
    SELECT question.id
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
    ORDER BY question.index
  ) AS question_ids
FROM public.vstudent_ucat_question_stems stem
WHERE stem.is_available_for_practice = true;

GRANT SELECT ON public.vstudent_ucat_practice_stem_index TO authenticated;

-- Assemble an entire set/mock delivery payload inside Postgres so the browser
-- pays for one authenticated RPC instead of a set/mock -> sets -> stems
-- request waterfall. All source rows still pass through the existing student
-- access views.
CREATE FUNCTION public.get_student_ucat_question_engine_payload(
  p_source_type TEXT,
  p_source_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE p_source_type
    WHEN 'set' THEN (
      SELECT jsonb_build_object(
        'source_type', 'set',
        'set_detail', to_jsonb(set_detail),
        'stem_details', COALESCE((
          SELECT jsonb_agg(to_jsonb(stem_detail) ORDER BY stem_meta.ordinality)
          FROM jsonb_array_elements(COALESCE(to_jsonb(set_detail.stems), '[]'::jsonb))
            WITH ORDINALITY AS stem_meta(value, ordinality)
          JOIN public.vstudent_ucat_question_stem_delivery stem_detail
            ON stem_detail.id = (stem_meta.value ->> 'stem_id')::UUID
        ), '[]'::jsonb)
      )
      FROM public.vstudent_ucat_question_set_detail set_detail
      WHERE set_detail.id = p_source_id
    )
    WHEN 'mock' THEN (
      SELECT jsonb_build_object(
        'source_type', 'mock',
        'mock_detail', to_jsonb(mock_detail),
        'sets', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'set_detail', to_jsonb(set_detail),
              'stem_details', COALESCE((
                SELECT jsonb_agg(to_jsonb(stem_detail) ORDER BY stem_meta.ordinality)
                FROM jsonb_array_elements(COALESCE(to_jsonb(set_detail.stems), '[]'::jsonb))
                  WITH ORDINALITY AS stem_meta(value, ordinality)
                JOIN public.vstudent_ucat_question_stem_delivery stem_detail
                  ON stem_detail.id = (stem_meta.value ->> 'stem_id')::UUID
              ), '[]'::jsonb)
            )
            ORDER BY set_meta.ordinality
          )
          FROM jsonb_array_elements(COALESCE(to_jsonb(mock_detail.sets), '[]'::jsonb))
            WITH ORDINALITY AS set_meta(value, ordinality)
          JOIN public.vstudent_ucat_question_set_detail set_detail
            ON set_detail.id = (set_meta.value ->> 'id')::UUID
        ), '[]'::jsonb)
      )
      FROM public.vstudent_ucat_mock_detail mock_detail
      WHERE mock_detail.id = p_source_id
    )
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_question_engine_payload(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_ucat_question_engine_payload(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_question_engine_payload(TEXT, UUID) TO authenticated;

-- Store one server-authorized lookahead stem for unlimited practice. Delivery
-- can then commit the exact prefetched content without selecting and rebuilding
-- it a second time.
ALTER TABLE public.student_practice_sessions
  ADD COLUMN prefetched_stem_snapshot JSONB;
