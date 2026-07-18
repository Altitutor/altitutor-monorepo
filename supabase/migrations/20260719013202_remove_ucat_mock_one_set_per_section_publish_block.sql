-- Allow publishing mocks that do not have exactly one set per UCAT section.
-- Soft UI guidance can still recommend exam-like coverage; this is no longer a hard gate.

CREATE OR REPLACE FUNCTION public.ucat_mock_publication_shape_issues(p_mock_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ucat_sections) THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'code', 'missing_section_configuration',
      'message', 'Configure the UCAT sections before publishing a mock.'
    ));
  END IF;

  IF EXISTS (
    WITH set_sections AS (
      SELECT
        member.question_set_id,
        COUNT(DISTINCT stem.section_id) AS section_count
      FROM public.question_sets_ucat_mocks member
      LEFT JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = member.question_set_id
      LEFT JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id
       AND stem.deleted_at IS NULL
      WHERE member.ucat_mock_id = p_mock_id
      GROUP BY member.question_set_id
    )
    SELECT 1 FROM set_sections WHERE section_count <> 1
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'invalid_set_sections',
      'message', 'Every set in a mock must contain questions from exactly one UCAT section.'
    ));
  END IF;

  IF EXISTS (
    WITH member_shape AS (
      SELECT
        member.index,
        question_set.id AS set_id,
        question_set.time_limit_seconds,
        (ARRAY_AGG(DISTINCT stem.section_id) FILTER (WHERE stem.section_id IS NOT NULL))[1] AS section_id,
        COUNT(DISTINCT stem.section_id) AS section_count,
        COUNT(question.id) FILTER (WHERE question.deleted_at IS NULL) AS question_count
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      LEFT JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = question_set.id
      LEFT JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id
       AND stem.deleted_at IS NULL
      LEFT JOIN public.ucat_questions question
        ON question.question_stem_id = stem.id
      WHERE member.ucat_mock_id = p_mock_id
      GROUP BY member.index, question_set.id, question_set.time_limit_seconds
    )
    SELECT 1
    FROM member_shape shape
    JOIN public.ucat_sections section ON section.id = shape.section_id
    WHERE shape.section_count = 1
      AND section.number_of_questions IS DISTINCT FROM shape.question_count::INTEGER
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'incorrect_set_question_counts',
      'message', 'Every set must contain the configured number of questions for its UCAT section.'
    ));
  END IF;

  IF EXISTS (
    WITH member_shape AS (
      SELECT
        question_set.id AS set_id,
        question_set.time_limit_seconds,
        (ARRAY_AGG(DISTINCT stem.section_id) FILTER (WHERE stem.section_id IS NOT NULL))[1] AS section_id,
        COUNT(DISTINCT stem.section_id) AS section_count
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      LEFT JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = question_set.id
      LEFT JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id
       AND stem.deleted_at IS NULL
      WHERE member.ucat_mock_id = p_mock_id
      GROUP BY question_set.id, question_set.time_limit_seconds
    )
    SELECT 1
    FROM member_shape shape
    JOIN public.ucat_sections section ON section.id = shape.section_id
    WHERE shape.section_count = 1
      AND section.time_limit_seconds IS DISTINCT FROM shape.time_limit_seconds
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'incorrect_set_time_limits',
      'message', 'Every set must use the configured time limit for its UCAT section.'
    ));
  END IF;

  IF EXISTS (
    WITH ordered_sections AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY section_number, id)::INTEGER AS expected_index
      FROM public.ucat_sections
    ), member_shape AS (
      SELECT
        member.index,
        (ARRAY_AGG(DISTINCT stem.section_id) FILTER (WHERE stem.section_id IS NOT NULL))[1] AS section_id,
        COUNT(DISTINCT stem.section_id) AS section_count
      FROM public.question_sets_ucat_mocks member
      LEFT JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = member.question_set_id
      LEFT JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id
       AND stem.deleted_at IS NULL
      WHERE member.ucat_mock_id = p_mock_id
      GROUP BY member.index, member.question_set_id
    )
    SELECT 1
    FROM member_shape shape
    JOIN ordered_sections section ON section.id = shape.section_id
    WHERE shape.section_count = 1
      AND shape.index <> section.expected_index
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'incorrect_set_order',
      'message', 'Order the mock sets by UCAT section.'
    ));
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_publication_shape_issues(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_mock_publication_shape_issues(UUID) TO authenticated;
