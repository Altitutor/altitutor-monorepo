-- Bulk import uses the same stem-only pg_trgm similarity contract as the
-- reconciliation queue. Drafts remain unpersisted; this RPC matches one batch
-- against the indexed catalog projection and against itself.

CREATE OR REPLACE FUNCTION public.tutor_ucat_match_import_stems(
  p_drafts JSONB,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.95
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  draft_count INTEGER;
  safe_threshold DOUBLE PRECISION := LEAST(
    GREATEST(COALESCE(p_similarity_threshold, 0.95), 0.8),
    1.0
  );
  previous_threshold TEXT;
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  IF JSONB_TYPEOF(p_drafts) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import stems must be a JSON array' USING ERRCODE = '22023';
  END IF;

  draft_count := JSONB_ARRAY_LENGTH(p_drafts);
  IF draft_count = 0 THEN
    RAISE EXCEPTION 'At least one import stem is required' USING ERRCODE = '22023';
  END IF;
  IF draft_count > 200 THEN
    RAISE EXCEPTION 'At most 200 import stems may be matched at once' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM JSONB_ARRAY_ELEMENTS(p_drafts) item
    WHERE JSONB_TYPEOF(item) IS DISTINCT FROM 'object'
      OR NULLIF(BTRIM(item->>'id'), '') IS NULL
      OR NULLIF(BTRIM(item->>'sectionId'), '') IS NULL
      OR NOT (item ? 'stemText')
  ) THEN
    RAISE EXCEPTION 'Each import stem requires id, sectionId, and stemText'
      USING ERRCODE = '22023';
  END IF;
  IF (
    SELECT COUNT(DISTINCT item->>'id')
    FROM JSONB_ARRAY_ELEMENTS(p_drafts) item
  ) <> draft_count THEN
    RAISE EXCEPTION 'Import stem ids must be unique' USING ERRCODE = '22023';
  END IF;

  previous_threshold := current_setting('pg_trgm.similarity_threshold');
  PERFORM set_config('pg_trgm.similarity_threshold', safe_threshold::TEXT, TRUE);

  WITH drafts AS MATERIALIZED (
    SELECT
      item->>'id' AS draft_id,
      (item->>'sectionId')::UUID AS section_id,
      public.canonical_ucat_catalog_rich_text(item->'stemText') AS comparison_text,
      ordinal::INTEGER AS ordinal
    FROM JSONB_ARRAY_ELEMENTS(p_drafts) WITH ORDINALITY input(item, ordinal)
  ),
  matches AS (
    SELECT
      draft.draft_id,
      'catalog'::TEXT AS match_source,
      projection.stem_id::TEXT AS match_stem_id,
      extensions.similarity(
        draft.comparison_text,
        projection.stem_comparison_text
      ) AS similarity_score
    FROM drafts draft
    JOIN public.question_stems stem
      ON stem.section_id = draft.section_id
      AND stem.deleted_at IS NULL
      AND stem.status IN ('draft', 'in_review', 'published')
    JOIN public.ucat_question_catalog_projection projection
      ON projection.stem_id = stem.id
      AND projection.stem_comparison_text <> ''
      AND projection.stem_comparison_text
        OPERATOR(extensions.%) draft.comparison_text
    WHERE draft.comparison_text <> ''

    UNION ALL

    SELECT
      left_draft.draft_id,
      'draft'::TEXT AS match_source,
      right_draft.draft_id AS match_stem_id,
      extensions.similarity(
        left_draft.comparison_text,
        right_draft.comparison_text
      ) AS similarity_score
    FROM drafts left_draft
    JOIN drafts right_draft
      ON right_draft.ordinal > left_draft.ordinal
      AND right_draft.section_id = left_draft.section_id
    WHERE left_draft.comparison_text <> ''
      AND right_draft.comparison_text <> ''
      AND extensions.similarity(
        left_draft.comparison_text,
        right_draft.comparison_text
      ) >= safe_threshold
  ),
  ordered_matches AS (
    SELECT *
    FROM matches
    WHERE similarity_score >= safe_threshold
    ORDER BY similarity_score DESC, draft_id, match_source, match_stem_id
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'draftId', draft_id,
          'matchSource', match_source,
          'matchStemId', match_stem_id,
          'similarity', ROUND(similarity_score::NUMERIC, 4)
        )
        ORDER BY similarity_score DESC, draft_id, match_source, match_stem_id
      ),
      '[]'::JSONB
    ),
    'similarityThreshold', safe_threshold
  )
  INTO result
  FROM ordered_matches;

  PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    IF previous_threshold IS NOT NULL THEN
      PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_match_import_stems(JSONB, DOUBLE PRECISION)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_match_import_stems(JSONB, DOUBLE PRECISION)
  TO authenticated;
