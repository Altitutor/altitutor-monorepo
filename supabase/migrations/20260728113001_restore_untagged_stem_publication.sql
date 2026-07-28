-- Tags improve discovery and reconciliation, but are not required for a
-- complete student-facing question. A later lifecycle migration replaced the
-- wrapper below and accidentally restored missing_tags as a hard blocker.
-- Restore the intended split while retaining lesson readiness checks.

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
  v_issues JSONB := '[]'::jsonb;
  v_enriched JSONB := '[]'::jsonb;
BEGIN
  IF p_content_type IN ('stem', 'set', 'mock') THEN
    v_issues := public.ucat_content_core_publication_issues(p_content_type, p_content_id);

    SELECT COALESCE(
      jsonb_agg(
        issue || jsonb_build_object(
          'entity_type', p_content_type,
          'entity_id', p_content_id
        )
      ),
      '[]'::jsonb
    )
    INTO v_enriched
    FROM jsonb_array_elements(v_issues) issue
    WHERE issue->>'code' <> 'missing_tags';

    IF p_content_type = 'mock' THEN
      SELECT v_enriched || COALESCE(
        jsonb_agg(
          issue || jsonb_build_object(
            'entity_type', 'mock',
            'entity_id', p_content_id
          )
        ),
        '[]'::jsonb
      )
      INTO v_enriched
      FROM jsonb_array_elements(public.ucat_mock_publication_shape_issues(p_content_id)) issue;
    END IF;

    RETURN v_enriched;
  END IF;

  IF p_content_type = 'lesson' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules
      WHERE id = p_content_id
        AND deleted_at IS NULL
        AND kind = 'lesson'
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object(
        'code', 'not_found',
        'message', 'Lesson not found.',
        'entity_type', 'lesson',
        'entity_id', p_content_id
      ));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks block
      LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
      LEFT JOIN public.ucat_questions question ON question.id = block.question_id
      LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
      WHERE block.learning_module_id = p_content_id
        AND block.deleted_at IS NULL
        AND (
          (
            block.block_type = 'question_stem'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::jsonb
              OR block.question_stem_id IS NULL
              OR stem.id IS NULL
              OR stem.deleted_at IS NOT NULL
              OR stem.status IS DISTINCT FROM 'published'
            )
          )
          OR (
            block.block_type = 'question'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::jsonb
              OR block.question_id IS NULL
              OR question.id IS NULL
              OR question.deleted_at IS NOT NULL
              OR question_stem.id IS NULL
              OR question_stem.deleted_at IS NOT NULL
              OR question_stem.status IS DISTINCT FROM 'published'
            )
          )
        )
    ) THEN
      v_enriched := v_enriched || jsonb_build_array(jsonb_build_object(
        'code', 'unpublished_assessment',
        'message', 'Every assessment block must reference published question content with no pending placeholders.',
        'entity_type', 'lesson',
        'entity_id', p_content_id
      ));
    END IF;

    RETURN v_enriched;
  END IF;

  RAISE EXCEPTION 'invalid_ucat_content_type';
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;
