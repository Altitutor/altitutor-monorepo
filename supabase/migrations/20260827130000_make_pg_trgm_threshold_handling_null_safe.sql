-- A fresh Postgres backend may not have loaded pg_trgm yet, so its custom GUC
-- can be absent even though the extension is installed. Treat that as a valid
-- initial state and only restore a threshold that existed before the call.

CREATE OR REPLACE FUNCTION public.refresh_ucat_duplicate_stem_pairs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_stem_id UUID := COALESCE(NEW.stem_id, OLD.stem_id);
  changed_section_id UUID;
  changed_updated_at TIMESTAMPTZ;
  changed_text TEXT;
  previous_threshold TEXT;
BEGIN
  DELETE FROM public.ucat_duplicate_stem_pairs pair
  WHERE pair.stem_id_low = changed_stem_id OR pair.stem_id_high = changed_stem_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT stem.section_id, stem.updated_at
  INTO changed_section_id, changed_updated_at
  FROM public.question_stems stem
  WHERE stem.id = changed_stem_id AND stem.deleted_at IS NULL;

  changed_text := NEW.stem_comparison_text;
  IF changed_section_id IS NULL OR changed_text = '' THEN
    RETURN NEW;
  END IF;

  previous_threshold := current_setting('pg_trgm.similarity_threshold', TRUE);
  PERFORM set_config('pg_trgm.similarity_threshold', '0.8', TRUE);

  INSERT INTO public.ucat_duplicate_stem_pairs (
    stem_id_low,
    stem_id_high,
    section_id,
    similarity,
    latest_at
  )
  SELECT
    LEAST(changed_stem_id, other_projection.stem_id),
    GREATEST(changed_stem_id, other_projection.stem_id),
    changed_section_id,
    extensions.similarity(changed_text, other_projection.stem_comparison_text),
    GREATEST(changed_updated_at, other_stem.updated_at)
  FROM public.ucat_question_catalog_projection other_projection
  JOIN public.question_stems other_stem
    ON other_stem.id = other_projection.stem_id
    AND other_stem.deleted_at IS NULL
    AND other_stem.section_id = changed_section_id
  WHERE other_projection.stem_id <> changed_stem_id
    AND other_projection.stem_comparison_text <> ''
    AND other_projection.stem_comparison_text OPERATOR(extensions.%) changed_text
  ON CONFLICT (stem_id_low, stem_id_high)
  DO UPDATE SET
    section_id = EXCLUDED.section_id,
    similarity = EXCLUDED.similarity,
    latest_at = EXCLUDED.latest_at,
    refreshed_at = NOW();

  IF previous_threshold IS NOT NULL THEN
    PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    IF previous_threshold IS NOT NULL THEN
      PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
    END IF;
    RAISE;
END;
$$;

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

  previous_threshold := current_setting('pg_trgm.similarity_threshold', TRUE);
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

  IF previous_threshold IS NOT NULL THEN
    PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
  END IF;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    IF previous_threshold IS NOT NULL THEN
      PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_ucat_duplicate_stem_pairs()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rebuilt_pair_count BIGINT;
  previous_threshold TEXT;
BEGIN
  previous_threshold := current_setting('pg_trgm.similarity_threshold', TRUE);
  PERFORM set_config('pg_trgm.similarity_threshold', '0.8', TRUE);

  TRUNCATE public.ucat_duplicate_stem_pairs;

  INSERT INTO public.ucat_duplicate_stem_pairs (
    stem_id_low,
    stem_id_high,
    section_id,
    similarity,
    latest_at
  )
  SELECT
    left_projection.stem_id,
    right_projection.stem_id,
    left_stem.section_id,
    extensions.similarity(
      left_projection.stem_comparison_text,
      right_projection.stem_comparison_text
    ),
    GREATEST(left_stem.updated_at, right_stem.updated_at)
  FROM public.ucat_question_catalog_projection left_projection
  JOIN public.question_stems left_stem
    ON left_stem.id = left_projection.stem_id
    AND left_stem.deleted_at IS NULL
  JOIN public.ucat_question_catalog_projection right_projection
    ON right_projection.stem_id > left_projection.stem_id
    AND right_projection.stem_comparison_text <> ''
    AND right_projection.stem_comparison_text
      OPERATOR(extensions.%) left_projection.stem_comparison_text
  JOIN public.question_stems right_stem
    ON right_stem.id = right_projection.stem_id
    AND right_stem.deleted_at IS NULL
    AND right_stem.section_id = left_stem.section_id
  WHERE left_projection.stem_comparison_text <> '';

  GET DIAGNOSTICS rebuilt_pair_count = ROW_COUNT;
  IF previous_threshold IS NOT NULL THEN
    PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
  END IF;

  RETURN rebuilt_pair_count;
EXCEPTION
  WHEN OTHERS THEN
    IF previous_threshold IS NOT NULL THEN
      PERFORM set_config('pg_trgm.similarity_threshold', previous_threshold, TRUE);
    END IF;
    RAISE;
END;
$$;

