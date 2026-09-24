-- Assemble one delivered question set after one student-access check. The
-- previous SECURITY INVOKER function repeatedly expanded the full access views
-- for every nested stem, which made production-sized sets exceed PostgREST's
-- authenticated statement timeout.

CREATE OR REPLACE FUNCTION public.get_student_ucat_question_set_engine_payload(
  p_set_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vstudent_ucat_accessible_question_sets accessible
    WHERE accessible.id = p_set_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'source_type', 'set',
    'set_detail', jsonb_build_object(
      'id', question_set.id,
      'name', question_set.name,
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds,
      'created_at', question_set.created_at,
      'updated_at', question_set.updated_at,
      'stems', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'stem_id', stem.id,
            'stem_text', stem.stem_text,
            'questions_meta', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object('id', question.id, 'index', question.index)
                ORDER BY question.index
              )
              FROM public.ucat_questions question
              WHERE question.question_stem_id = stem.id
                AND question.deleted_at IS NULL
            ), '[]'::JSONB)
          )
          ORDER BY membership.index
        )
        FROM public.question_stems_question_sets membership
        JOIN public.question_stems stem
          ON stem.id = membership.question_stem_id
          AND stem.deleted_at IS NULL
          AND stem.status = 'published'
        WHERE membership.question_set_id = question_set.id
      ), '[]'::JSONB)
    ),
    'stem_details', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', stem.id,
          'section_id', stem.section_id,
          'section_number', section.section_number,
          'section_name', section.name,
          'display_columns', section.display_columns,
          'section_instructions_text', section.instructions_text,
          'section_instructions_time_limit_seconds', section.instructions_time_limit_seconds,
          'section_time_limit_seconds', section.time_limit_seconds,
          'question_stem_category_id', stem.question_stem_category_id,
          'stem_text', stem.stem_text,
          'created_at', stem.created_at,
          'updated_at', stem.updated_at,
          'questions', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', question.id,
                'question_text', question.question_text,
                'answer_explanation', question.answer_explanation,
                'index', question.index,
                'difficulty', question.difficulty,
                'time_burden_seconds', question.time_burden_seconds,
                'question_type', question.question_type,
                'response_type', question.response_type,
                'answer_scheme', question.answer_scheme,
                'answer_options', COALESCE((
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', option.id,
                      'answer_text', option.answer_text,
                      'answer_explanation', option.answer_explanation,
                      'index', option.index,
                      'is_answer', option.is_answer,
                      'answer_key_value', option.answer_key_value
                    )
                    ORDER BY option.index
                  )
                  FROM public.question_answer_options option
                  WHERE option.question_id = question.id
                    AND option.deleted_at IS NULL
                ), '[]'::JSONB)
              )
              ORDER BY question.index
            )
            FROM public.ucat_questions question
            WHERE question.question_stem_id = stem.id
              AND question.deleted_at IS NULL
          ), '[]'::JSONB)
        )
        ORDER BY membership.index
      )
      FROM public.question_stems_question_sets membership
      JOIN public.question_stems stem
        ON stem.id = membership.question_stem_id
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
      JOIN public.ucat_sections section ON section.id = stem.section_id
      WHERE membership.question_set_id = question_set.id
    ), '[]'::JSONB)
  )
  INTO v_payload
  FROM public.question_sets question_set
  WHERE question_set.id = p_set_id
    AND question_set.deleted_at IS NULL
    AND question_set.status = 'published';

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_question_set_engine_payload(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_question_set_engine_payload(UUID)
  TO authenticated;
