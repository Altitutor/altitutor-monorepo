-- Include high-confidence near-copy stem pairs in the duplicates reconciliation
-- queue. Exact matches remain hash-equality; near-copies require the same
-- question_text_fingerprint, different stem hashes, and pg_trgm similarity
-- >= 0.95 (keep in sync with HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY).
-- Merge stays exact-only; near-copies surface as delete/keep-both candidates.

CREATE INDEX IF NOT EXISTS ucat_question_catalog_question_text_fp_idx
  ON public.ucat_question_catalog_projection (question_text_fingerprint, stem_id)
  WHERE question_text_fingerprint <> '';

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_exact_duplicate_stems(
  p_search TEXT DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  safe_search TEXT := LOWER(BTRIM(COALESCE(p_search, '')));
  safe_like_search TEXT := REPLACE(
    REPLACE(REPLACE(LOWER(BTRIM(COALESCE(p_search, ''))), E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );
  -- Keep in sync with HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY in tutor-web.
  near_copy_similarity NUMERIC := 0.95;
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH exact_candidates AS (
    SELECT
      left_catalog.id AS stem_id_a,
      right_catalog.id AS stem_id_b,
      left_catalog.section_id,
      left_catalog.section_name,
      left_catalog.stem_comparison_hash AS stem_hash_a,
      right_catalog.stem_comparison_hash AS stem_hash_b,
      left_catalog.question_bundle_fingerprint = right_catalog.question_bundle_fingerprint
        AS bundles_equal,
      GREATEST(left_catalog.updated_at, right_catalog.updated_at) AS latest_at,
      'exact'::TEXT AS match_kind
    FROM public.ucat_question_catalog_projection left_projection
    JOIN public.ucat_question_catalog_projection right_projection
      ON right_projection.stem_comparison_hash = left_projection.stem_comparison_hash
      AND right_projection.stem_id > left_projection.stem_id
    JOIN public.vtutor_ucat_question_catalog left_catalog
      ON left_catalog.id = left_projection.stem_id
    JOIN public.vtutor_ucat_question_catalog right_catalog
      ON right_catalog.id = right_projection.stem_id
    LEFT JOIN public.ucat_duplicate_pair_dismissals dismissal
      ON dismissal.stem_id_low = left_catalog.id
      AND dismissal.stem_id_high = right_catalog.id
      AND dismissal.stem_hash_low = left_catalog.stem_comparison_hash
      AND dismissal.stem_hash_high = right_catalog.stem_comparison_hash
    WHERE left_catalog.deleted_at IS NULL
      AND right_catalog.deleted_at IS NULL
      AND right_catalog.section_id = left_catalog.section_id
      AND left_catalog.stem_comparison_text <> ''
      AND dismissal.stem_id_low IS NULL
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR left_catalog.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR left_catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR right_catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(left_catalog.section_name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  near_candidates AS (
    SELECT
      left_catalog.id AS stem_id_a,
      right_catalog.id AS stem_id_b,
      left_catalog.section_id,
      left_catalog.section_name,
      left_catalog.stem_comparison_hash AS stem_hash_a,
      right_catalog.stem_comparison_hash AS stem_hash_b,
      left_catalog.question_bundle_fingerprint = right_catalog.question_bundle_fingerprint
        AS bundles_equal,
      GREATEST(left_catalog.updated_at, right_catalog.updated_at) AS latest_at,
      'near'::TEXT AS match_kind
    FROM public.ucat_question_catalog_projection left_projection
    JOIN public.ucat_question_catalog_projection right_projection
      ON right_projection.question_text_fingerprint = left_projection.question_text_fingerprint
      AND right_projection.stem_id > left_projection.stem_id
      AND left_projection.question_text_fingerprint <> ''
      AND right_projection.stem_comparison_hash <> left_projection.stem_comparison_hash
      AND left_projection.stem_comparison_text <> ''
      AND right_projection.stem_comparison_text <> ''
      AND extensions.similarity(
        left_projection.stem_comparison_text,
        right_projection.stem_comparison_text
      ) >= near_copy_similarity
    JOIN public.vtutor_ucat_question_catalog left_catalog
      ON left_catalog.id = left_projection.stem_id
    JOIN public.vtutor_ucat_question_catalog right_catalog
      ON right_catalog.id = right_projection.stem_id
    LEFT JOIN public.ucat_duplicate_pair_dismissals dismissal
      ON dismissal.stem_id_low = left_catalog.id
      AND dismissal.stem_id_high = right_catalog.id
      AND dismissal.stem_hash_low = left_catalog.stem_comparison_hash
      AND dismissal.stem_hash_high = right_catalog.stem_comparison_hash
    WHERE left_catalog.deleted_at IS NULL
      AND right_catalog.deleted_at IS NULL
      AND right_catalog.section_id = left_catalog.section_id
      AND dismissal.stem_id_low IS NULL
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR left_catalog.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR left_catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR right_catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(left_catalog.section_name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  candidates AS MATERIALIZED (
    SELECT * FROM exact_candidates
    UNION ALL
    SELECT * FROM near_candidates
  ),
  numbered AS (
    SELECT
      candidates.*,
      ROW_NUMBER() OVER (ORDER BY latest_at DESC NULLS LAST, stem_id_a, stem_id_b) AS ordinal
    FROM candidates
  ),
  page_pairs AS (
    SELECT * FROM numbered
    WHERE ordinal > (safe_page - 1) * safe_page_size
      AND ordinal <= safe_page * safe_page_size
  ),
  hydrated AS (
    SELECT
      pair.*,
      left_detail.section_id AS left_section_id,
      left_detail.section_name AS left_section_name,
      left_detail.question_stem_category_id AS left_category_id,
      left_detail.category_name AS left_category_name,
      left_detail.stem_text AS left_stem_text,
      left_detail.questions AS left_questions,
      right_detail.section_id AS right_section_id,
      right_detail.section_name AS right_section_name,
      right_detail.question_stem_category_id AS right_category_id,
      right_detail.category_name AS right_category_name,
      right_detail.stem_text AS right_stem_text,
      right_detail.questions AS right_questions,
      left_catalog.access_scope::TEXT = 'private' AS left_private,
      right_catalog.access_scope::TEXT = 'private' AS right_private,
      left_catalog.set_names,
      right_catalog.set_names AS right_set_names
    FROM page_pairs pair
    JOIN public.vtutor_ucat_question_stem_detail left_detail
      ON left_detail.id = pair.stem_id_a
    JOIN public.vtutor_ucat_question_stem_detail right_detail
      ON right_detail.id = pair.stem_id_b
    JOIN public.vtutor_ucat_question_catalog left_catalog
      ON left_catalog.id = pair.stem_id_a
    JOIN public.vtutor_ucat_question_catalog right_catalog
      ON right_catalog.id = pair.stem_id_b
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', stem_id_a::TEXT || ':' || stem_id_b::TEXT,
          'sectionId', section_id,
          'sectionName', section_name,
          'stemA', JSONB_BUILD_OBJECT(
            'id', stem_id_a,
            'sectionId', left_section_id,
            'sectionName', left_section_name,
            'categoryId', left_category_id,
            'categoryName', left_category_name,
            'stemText', left_stem_text,
            'isPrivate', left_private,
            'setNames', COALESCE(set_names, '[]'::JSONB),
            'questions', left_questions
          ),
          'stemB', JSONB_BUILD_OBJECT(
            'id', stem_id_b,
            'sectionId', right_section_id,
            'sectionName', right_section_name,
            'categoryId', right_category_id,
            'categoryName', right_category_name,
            'stemText', right_stem_text,
            'isPrivate', right_private,
            'setNames', COALESCE(right_set_names, '[]'::JSONB),
            'questions', right_questions
          ),
          'recommendation',
            CASE
              WHEN match_kind = 'near' THEN 'delete'
              WHEN bundles_equal THEN 'delete'
              ELSE 'merge'
            END,
          'suggestedMergeDirection',
            CASE
              WHEN match_kind = 'near' THEN NULL
              WHEN bundles_equal THEN NULL
              WHEN JSON_ARRAY_LENGTH(left_questions) <= JSON_ARRAY_LENGTH(right_questions)
                THEN 'A-into-B'
              ELSE 'B-into-A'
            END,
          'comparisonKind',
            CASE
              WHEN match_kind = 'near' THEN 'high_confidence_near_copy'
              WHEN bundles_equal THEN 'complete_duplicate'
              ELSE 'shared_stem'
            END
        )
        ORDER BY ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM candidates),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM hydrated;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_exact_duplicate_stems(
  TEXT, UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_exact_duplicate_stems(
  TEXT, UUID[], INTEGER, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_dismiss_exact_duplicate_pair(
  p_stem_id_a UUID,
  p_stem_id_b UUID,
  p_reason TEXT DEFAULT 'keep_both'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  low_id UUID := LEAST(p_stem_id_a, p_stem_id_b);
  high_id UUID := GREATEST(p_stem_id_a, p_stem_id_b);
  low_projection public.ucat_question_catalog_projection%ROWTYPE;
  high_projection public.ucat_question_catalog_projection%ROWTYPE;
  low_section UUID;
  high_section UUID;
  -- Keep in sync with HIGH_CONFIDENCE_NEAR_COPY_STEM_SIMILARITY in tutor-web.
  near_copy_similarity NUMERIC := 0.95;
  is_exact BOOLEAN := FALSE;
  is_near_copy BOOLEAN := FALSE;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;
  IF p_stem_id_a = p_stem_id_b THEN
    RAISE EXCEPTION 'A duplicate pair requires two different stems';
  END IF;

  SELECT projection.* INTO low_projection
  FROM public.ucat_question_catalog_projection projection
  WHERE projection.stem_id = low_id;

  SELECT projection.* INTO high_projection
  FROM public.ucat_question_catalog_projection projection
  WHERE projection.stem_id = high_id;

  IF low_projection.stem_id IS NULL OR high_projection.stem_id IS NULL THEN
    RAISE EXCEPTION 'The stems are no longer a duplicate pair';
  END IF;

  SELECT stem.section_id INTO low_section
  FROM public.question_stems stem
  WHERE stem.id = low_id AND stem.deleted_at IS NULL;

  SELECT stem.section_id INTO high_section
  FROM public.question_stems stem
  WHERE stem.id = high_id AND stem.deleted_at IS NULL;

  IF low_section IS NULL OR high_section IS NULL OR low_section <> high_section THEN
    RAISE EXCEPTION 'The stems are no longer a duplicate pair';
  END IF;

  is_exact :=
    low_projection.stem_comparison_text <> ''
    AND low_projection.stem_comparison_hash = high_projection.stem_comparison_hash;

  is_near_copy :=
    NOT is_exact
    AND low_projection.question_text_fingerprint <> ''
    AND low_projection.question_text_fingerprint = high_projection.question_text_fingerprint
    AND low_projection.stem_comparison_text <> ''
    AND high_projection.stem_comparison_text <> ''
    AND extensions.similarity(
      low_projection.stem_comparison_text,
      high_projection.stem_comparison_text
    ) >= near_copy_similarity;

  IF NOT is_exact AND NOT is_near_copy THEN
    RAISE EXCEPTION 'The stems are no longer a duplicate pair';
  END IF;

  INSERT INTO public.ucat_duplicate_pair_dismissals (
    stem_id_low,
    stem_id_high,
    stem_hash_low,
    stem_hash_high,
    dismissed_by,
    reason
  )
  VALUES (
    low_id,
    high_id,
    low_projection.stem_comparison_hash,
    high_projection.stem_comparison_hash,
    (SELECT auth.uid()),
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'keep_both')
  )
  ON CONFLICT (stem_id_low, stem_id_high)
  DO UPDATE SET
    stem_hash_low = EXCLUDED.stem_hash_low,
    stem_hash_high = EXCLUDED.stem_hash_high,
    dismissed_at = NOW(),
    dismissed_by = EXCLUDED.dismissed_by,
    reason = EXCLUDED.reason;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_dismiss_exact_duplicate_pair(
  UUID, UUID, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_dismiss_exact_duplicate_pair(
  UUID, UUID, TEXT
) TO authenticated;
