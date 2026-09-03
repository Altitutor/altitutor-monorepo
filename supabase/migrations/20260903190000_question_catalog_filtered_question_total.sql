-- Return the filtered question count alongside the stem total so the
-- questions catalog pagination summary can show both.

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_question_catalog(
  p_status TEXT DEFAULT 'draft',
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_section_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_include_no_category BOOLEAN DEFAULT FALSE,
  p_tag_ids UUID[] DEFAULT NULL,
  p_access_scopes TEXT[] DEFAULT NULL,
  p_set_ids UUID[] DEFAULT NULL,
  p_include_without_set BOOLEAN DEFAULT FALSE,
  p_source_channels TEXT[] DEFAULT NULL,
  p_created_by UUID[] DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_by TEXT DEFAULT NULL,
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_ids_only BOOLEAN DEFAULT FALSE,
  p_ai_review_statuses TEXT[] DEFAULT NULL,
  p_question_count_min INTEGER DEFAULT NULL,
  p_question_count_max INTEGER DEFAULT NULL,
  p_practice_pool BOOLEAN DEFAULT NULL,
  p_stem_ids UUID[] DEFAULT NULL,
  p_audit_filters TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(
    GREATEST(COALESCE(p_page_size, 20), 1),
    CASE WHEN p_ids_only THEN 50000 ELSE 100 END
  );
  safe_search TEXT := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
  safe_like_search TEXT;
  safe_direction TEXT := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  safe_search := REPLACE(safe_search, '’', '''');
  safe_search := REPLACE(safe_search, '‘', '''');
  safe_search := REPLACE(safe_search, '“', '"');
  safe_search := REPLACE(safe_search, '”', '"');
  safe_search := REPLACE(safe_search, '‐', '-');
  safe_search := REPLACE(safe_search, '‑', '-');
  safe_search := REPLACE(safe_search, '‒', '-');
  safe_search := REPLACE(safe_search, '–', '-');
  safe_search := REPLACE(safe_search, '—', '-');
  safe_search := REPLACE(safe_search, '―', '-');
  safe_like_search := REPLACE(
    REPLACE(REPLACE(safe_search, E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'in_review', 'published') THEN
    RAISE EXCEPTION 'invalid question catalog status';
  END IF;

  IF p_question_count_min IS NOT NULL AND p_question_count_min < 0 THEN
    RAISE EXCEPTION 'invalid question count min';
  END IF;

  IF p_question_count_max IS NOT NULL AND p_question_count_max < 0 THEN
    RAISE EXCEPTION 'invalid question count max';
  END IF;

  IF
    p_question_count_min IS NOT NULL
    AND p_question_count_max IS NOT NULL
    AND p_question_count_min > p_question_count_max
  THEN
    RAISE EXCEPTION 'invalid question count range';
  END IF;

  IF COALESCE(CARDINALITY(p_ai_review_statuses), 0) > 0
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p_ai_review_statuses) status_value
      WHERE status_value NOT IN (
        'not_requested',
        'reviewing',
        'deferred',
        'format_blocked',
        'unavailable',
        'unreviewable',
        'passed',
        'concerns',
        'critical'
      )
    )
  THEN
    RAISE EXCEPTION 'invalid ai review status filter';
  END IF;

  IF COALESCE(CARDINALITY(p_audit_filters), 0) > 0
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p_audit_filters) filter_value
      WHERE NOT public.ucat_is_valid_audit_catalog_filter(filter_value)
    )
  THEN
    RAISE EXCEPTION 'invalid_audit_catalog_filter';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT catalog.*
    FROM public.vtutor_ucat_question_catalog catalog
    WHERE
      (
        (p_show_deleted AND catalog.deleted_at IS NOT NULL)
        OR
        (
          NOT p_show_deleted
          AND catalog.deleted_at IS NULL
          AND catalog.status::TEXT = COALESCE(p_status, 'draft')
        )
      )
      AND (COALESCE(CARDINALITY(p_stem_ids), 0) = 0 OR catalog.id = ANY(p_stem_ids))
      AND (
        safe_search = ''
        OR (
          ('stem_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('question_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.question_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('answer_option_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.answer_option_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('tutor_source_note' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.tutor_source_note_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
        )
      )
      AND (COALESCE(CARDINALITY(p_section_ids), 0) = 0 OR catalog.section_id = ANY(p_section_ids))
      AND (
        (COALESCE(CARDINALITY(p_category_ids), 0) = 0 AND NOT p_include_no_category)
        OR catalog.question_stem_category_id = ANY(COALESCE(p_category_ids, '{}'::UUID[]))
        OR (p_include_no_category AND catalog.question_stem_category_id IS NULL)
      )
      AND (COALESCE(CARDINALITY(p_tag_ids), 0) = 0 OR catalog.tag_ids && p_tag_ids)
      AND (
        COALESCE(CARDINALITY(p_access_scopes), 0) = 0
        OR catalog.access_scope::TEXT = ANY(p_access_scopes)
      )
      AND (
        (COALESCE(CARDINALITY(p_set_ids), 0) = 0 AND NOT p_include_without_set)
        OR catalog.set_ids && COALESCE(p_set_ids, '{}'::UUID[])
        OR (p_include_without_set AND CARDINALITY(catalog.set_ids) = 0)
      )
      AND (
        COALESCE(CARDINALITY(p_source_channels), 0) = 0
        OR catalog.source_channel::TEXT = ANY(p_source_channels)
      )
      AND (
        COALESCE(CARDINALITY(p_ai_review_statuses), 0) = 0
        OR catalog.ai_review_status = ANY(p_ai_review_statuses)
      )
      AND (COALESCE(CARDINALITY(p_created_by), 0) = 0 OR catalog.created_by = ANY(p_created_by))
      AND (p_created_from IS NULL OR catalog.created_at >= p_created_from)
      AND (p_created_to IS NULL OR catalog.created_at <= p_created_to)
      AND (p_question_count_min IS NULL OR catalog.question_count >= p_question_count_min)
      AND (p_question_count_max IS NULL OR catalog.question_count <= p_question_count_max)
      AND (p_practice_pool IS NULL OR catalog.is_available_in_question_pool = p_practice_pool)
      AND (
        COALESCE(CARDINALITY(p_audit_filters), 0) = 0
        OR EXISTS (
          SELECT 1
          FROM UNNEST(p_audit_filters) filter_value
          WHERE public.ucat_question_stem_matches_audit_catalog_filter(catalog.id, filter_value)
        )
      )
  ),
  ranked AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'asc' THEN section_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'desc' THEN section_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'asc' THEN category_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'desc' THEN category_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'asc' THEN question_count END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'desc' THEN question_count END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'asc' THEN set_names_text END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'desc' THEN set_names_text END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'asc' THEN access_scope::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'desc' THEN access_scope::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'asc' THEN source_channel::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'desc' THEN source_channel::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'asc' THEN created_at END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'desc' THEN created_at END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'asc' THEN status::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'desc' THEN status::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'asc' THEN updated_at END ASC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'desc' THEN updated_at END DESC NULLS LAST,
          id ASC
      ) AS result_ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM ranked
    WHERE result_ordinal > (safe_page - 1) * safe_page_size
      AND result_ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        CASE
          WHEN p_ids_only THEN JSONB_BUILD_OBJECT('id', id)
          ELSE (
            TO_JSONB(page_rows)
              - 'result_ordinal'
              - 'stem_search_text'
              - 'question_search_text'
              - 'answer_option_search_text'
              - 'tutor_source_note_search_text'
              - 'stem_comparison_text'
              - 'stem_comparison_hash'
              - 'question_text_fingerprint'
              - 'question_bundle_fingerprint'
              - 'set_names_text'
          ) || JSONB_BUILD_OBJECT(
              'audit_memberships',
              COALESCE((
                SELECT JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'runId', run.id,
                    'title', run.title,
                    'runStatus', run.status,
                    'targetStatus', target.status,
                    'result', target.result,
                    'createdAt', run.created_at,
                    'why', target.outcome->>'why'
                  )
                  ORDER BY run.created_at DESC, run.id DESC
                )
                FROM public.vtutor_ucat_mcp_audit_run_targets target
                JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
                WHERE target.content_type = 'stem'
                  AND target.content_id = page_rows.id
                  AND run.status IN ('selecting', 'active', 'completed')
              ), '[]'::JSONB)
            )
        END
        ORDER BY result_ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'questionTotal', (SELECT COALESCE(SUM(question_count), 0) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(
    result,
    JSONB_BUILD_OBJECT(
      'items', '[]'::JSONB,
      'total', 0,
      'questionTotal', 0,
      'page', safe_page,
      'pageSize', safe_page_size
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER, BOOLEAN, UUID[], TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER, BOOLEAN, UUID[], TEXT[]
) TO authenticated;
