-- Server-backed UCAT reconciliation queues for the two high-volume workflows.
-- Keep these queues independent from the low-volume legacy reconciliation report.

CREATE TABLE public.ucat_duplicate_pair_dismissals (
  stem_id_low UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  stem_id_high UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  stem_hash_low TEXT NOT NULL,
  stem_hash_high TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_by UUID NOT NULL REFERENCES public.staff(id),
  reason TEXT NOT NULL DEFAULT 'keep_both',
  PRIMARY KEY (stem_id_low, stem_id_high),
  CONSTRAINT ucat_duplicate_pair_dismissals_ordered
    CHECK (stem_id_low < stem_id_high),
  CONSTRAINT ucat_duplicate_pair_dismissals_reason_present
    CHECK (BTRIM(reason) <> '')
);

ALTER TABLE public.ucat_duplicate_pair_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ucat_duplicate_pair_dismissals FROM PUBLIC, anon, authenticated;

CREATE INDEX ucat_duplicate_pair_dismissals_dismissed_at_idx
  ON public.ucat_duplicate_pair_dismissals (dismissed_at DESC);

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  p_search TEXT DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      catalog.id,
      catalog.section_id,
      catalog.section_name,
      catalog.question_stem_category_id,
      catalog.category_name,
      catalog.stem_text,
      detail.questions,
      catalog.updated_at
    FROM public.vtutor_ucat_question_catalog catalog
    JOIN public.vtutor_ucat_question_stem_detail detail ON detail.id = catalog.id
    WHERE catalog.deleted_at IS NULL
      AND catalog.access_scope::TEXT = 'private'
      AND CARDINALITY(catalog.set_ids) = 0
      AND (
        COALESCE(CARDINALITY(p_section_ids), 0) = 0
        OR catalog.section_id = ANY(p_section_ids)
      )
      AND (
        safe_search = ''
        OR catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
        OR LOWER(COALESCE(catalog.section_name, '')) LIKE '%' || safe_like_search || '%' ESCAPE E'\\'
      )
  ),
  numbered AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, id) AS ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT * FROM numbered
    WHERE ordinal > (safe_page - 1) * safe_page_size
      AND ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', id,
          'sectionId', section_id,
          'sectionName', section_name,
          'categoryId', question_stem_category_id,
          'categoryName', category_name,
          'stemText', stem_text,
          'questions', questions
        )
        ORDER BY ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  TEXT, UUID[], INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_private_stems_not_in_set(
  TEXT, UUID[], INTEGER, INTEGER
) TO authenticated;

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
  result JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT
      left_catalog.id AS stem_id_a,
      right_catalog.id AS stem_id_b,
      left_catalog.section_id,
      left_catalog.section_name,
      left_catalog.stem_comparison_hash AS stem_hash_a,
      right_catalog.stem_comparison_hash AS stem_hash_b,
      left_catalog.question_bundle_fingerprint = right_catalog.question_bundle_fingerprint
        AS bundles_equal,
      GREATEST(left_catalog.updated_at, right_catalog.updated_at) AS latest_at
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
          'recommendation', CASE WHEN bundles_equal THEN 'delete' ELSE 'merge' END,
          'suggestedMergeDirection',
            CASE
              WHEN bundles_equal THEN NULL
              WHEN JSON_ARRAY_LENGTH(left_questions) <= JSON_ARRAY_LENGTH(right_questions)
                THEN 'A-into-B'
              ELSE 'B-into-A'
            END,
          'comparisonKind', CASE WHEN bundles_equal THEN 'complete_duplicate' ELSE 'shared_stem' END
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
  low_hash TEXT;
  high_hash TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;
  IF p_stem_id_a = p_stem_id_b THEN
    RAISE EXCEPTION 'A duplicate pair requires two different stems';
  END IF;

  SELECT stem_comparison_hash INTO low_hash
  FROM public.ucat_question_catalog_projection
  WHERE stem_id = low_id;

  SELECT stem_comparison_hash INTO high_hash
  FROM public.ucat_question_catalog_projection
  WHERE stem_id = high_id;

  IF low_hash IS NULL OR high_hash IS NULL OR low_hash <> high_hash THEN
    RAISE EXCEPTION 'The stems are no longer an exact normalized-text pair';
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
    low_hash,
    high_hash,
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

-- Merge exact-stem candidates conservatively. The chosen target wins whenever
-- both stems contain the same normalized question text but the options or
-- explanations differ; source-only questions are retained by the existing
-- merge routine. Choosing the merge direction is therefore an explicit content
-- decision rather than silently retaining two conflicting copies.
CREATE OR REPLACE FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  p_target_stem_id UUID,
  p_source_stem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_projection public.ucat_question_catalog_projection%ROWTYPE;
  source_projection public.ucat_question_catalog_projection%ROWTYPE;
  source_question RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;
  IF p_target_stem_id IS NULL
    OR p_source_stem_id IS NULL
    OR p_target_stem_id = p_source_stem_id
  THEN
    RAISE EXCEPTION 'Two different question stems are required';
  END IF;

  SELECT projection.* INTO target_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_target_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  SELECT projection.* INTO source_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_source_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  IF target_projection.stem_id IS NULL OR source_projection.stem_id IS NULL THEN
    RAISE EXCEPTION 'Question stem not found';
  END IF;
  IF target_projection.stem_comparison_hash <> source_projection.stem_comparison_hash THEN
    RAISE EXCEPTION 'The question stems no longer have matching normalized stem content';
  END IF;

  FOR source_question IN
    SELECT source.id
    FROM public.ucat_questions source
    WHERE source.question_stem_id = p_source_stem_id
      AND source.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.ucat_questions target
        WHERE target.question_stem_id = p_target_stem_id
          AND target.deleted_at IS NULL
          AND target.question_type = source.question_type
          AND public.canonical_ucat_catalog_rich_text(target.question_text)
            = public.canonical_ucat_catalog_rich_text(source.question_text)
      )
  LOOP
    UPDATE public.question_answer_options
    SET
      deleted_at = NOW(),
      deleted_by = public.current_tutor_id()
    WHERE question_id = source_question.id
      AND deleted_at IS NULL;

    UPDATE public.ucat_questions
    SET
      deleted_at = NOW(),
      deleted_by = public.current_tutor_id()
    WHERE id = source_question.id;
  END LOOP;

  PERFORM public.tutor_ucat_merge_question_stems(
    p_target_stem_id,
    p_source_stem_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  UUID, UUID
) TO authenticated;
