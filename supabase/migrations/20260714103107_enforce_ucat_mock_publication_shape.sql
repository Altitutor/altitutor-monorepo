-- Publication is the point where authoring content becomes student-facing.
-- Keep the existing content checks, enrich them with an editor target, and
-- require mocks to match the configured UCAT exam structure exactly.

ALTER FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  RENAME TO ucat_content_core_publication_issues;

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
    SELECT 1
    FROM public.ucat_sections section
    WHERE (
      SELECT COUNT(*)
      FROM public.question_sets_ucat_mocks member
      WHERE member.ucat_mock_id = p_mock_id
        AND (
          SELECT COUNT(DISTINCT stem.section_id)
          FROM public.question_stems_question_sets set_member
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id
          WHERE set_member.question_set_id = member.question_set_id
            AND stem.deleted_at IS NULL
        ) = 1
        AND EXISTS (
          SELECT 1
          FROM public.question_stems_question_sets set_member
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id
          WHERE set_member.question_set_id = member.question_set_id
            AND stem.deleted_at IS NULL
            AND stem.section_id = section.id
        )
    ) <> 1
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'incorrect_section_coverage',
      'message', 'Add exactly one set for every UCAT section.'
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

CREATE OR REPLACE FUNCTION public.ucat_content_publication_issues(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB;
  v_enriched JSONB;
BEGIN
  v_issues := public.ucat_content_core_publication_issues(p_content_type, p_content_id);

  SELECT COALESCE(jsonb_agg(
    issue || jsonb_build_object(
      'entity_type', p_content_type,
      'entity_id', p_content_id
    )
  ), '[]'::jsonb)
  INTO v_enriched
  FROM jsonb_array_elements(v_issues) issue;

  IF p_content_type = 'mock' THEN
    SELECT v_enriched || COALESCE(jsonb_agg(
      issue || jsonb_build_object(
        'entity_type', 'mock',
        'entity_id', p_content_id
      )
    ), '[]'::jsonb)
    INTO v_enriched
    FROM jsonb_array_elements(public.ucat_mock_publication_shape_issues(p_content_id)) issue;
  END IF;

  RETURN v_enriched;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_core_publication_issues(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_mock_publication_shape_issues(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_core_publication_issues(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_mock_publication_shape_issues(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_content_status_bulk(
  p_content_type TEXT,
  p_content_ids UUID[],
  p_current_status public.ucat_content_status,
  p_previous_status public.ucat_content_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_id UUID;
  v_actual_status public.ucat_content_status;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(array_length(p_content_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_item';
  END IF;

  FOREACH v_content_id IN ARRAY p_content_ids
  LOOP
    BEGIN
      IF p_content_type = 'stem' THEN
        SELECT status INTO v_actual_status FROM public.question_stems
        WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
      ELSIF p_content_type = 'set' THEN
        SELECT status INTO v_actual_status FROM public.question_sets
        WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
      ELSIF p_content_type = 'mock' THEN
        SELECT status INTO v_actual_status FROM public.ucat_mocks
        WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
      ELSE
        RAISE EXCEPTION 'invalid_ucat_content_type';
      END IF;

      IF v_actual_status IS NULL THEN
        RAISE EXCEPTION 'ucat_content_not_found';
      END IF;
      IF v_actual_status <> p_current_status THEN
        RAISE EXCEPTION 'undo_status_changed';
      END IF;

      -- The normal lifecycle prevents Draft -> Published. Undo may restore that
      -- exact prior state, but still runs both normal validations atomically.
      IF v_actual_status = 'draft' AND p_previous_status = 'published' THEN
        PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, 'in_review');
        PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, 'published');
      ELSE
        PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, p_previous_status);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'bulk_status_item:%:%', v_content_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_restore_content_status_bulk(
  TEXT, UUID[], public.ucat_content_status, public.ucat_content_status
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_content_status_bulk(
  TEXT, UUID[], public.ucat_content_status, public.ucat_content_status
) TO authenticated;
