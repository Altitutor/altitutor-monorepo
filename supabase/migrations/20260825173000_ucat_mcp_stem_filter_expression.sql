-- MCP stem search: optional multi-status filters and composable all/any/clause expressions.

CREATE OR REPLACE FUNCTION public.ucat_question_catalog_matches_filter_clause(
  p_catalog public.vtutor_ucat_question_catalog,
  p_clause JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_statuses TEXT[];
  v_audit_filters TEXT[];
BEGIN
  IF p_clause IS NULL OR p_clause = '{}'::JSONB THEN
    RETURN TRUE;
  END IF;

  IF p_clause ? 'statuses' AND JSONB_ARRAY_LENGTH(p_clause->'statuses') > 0 THEN
    SELECT ARRAY_AGG(value::TEXT)
    INTO v_statuses
    FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'statuses') AS value;
    IF COALESCE(CARDINALITY(v_statuses), 0) = 0
      OR NOT (p_catalog.status::TEXT = ANY(v_statuses))
    THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'stemIds' AND JSONB_ARRAY_LENGTH(p_clause->'stemIds') > 0 THEN
    IF NOT (
      p_catalog.id = ANY(
        ARRAY(
          SELECT value::UUID
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'stemIds') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'sectionIds' AND JSONB_ARRAY_LENGTH(p_clause->'sectionIds') > 0 THEN
    IF NOT (
      p_catalog.section_id = ANY(
        ARRAY(
          SELECT value::UUID
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'sectionIds') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'categoryIds' OR COALESCE((p_clause->>'includeNoCategory')::BOOLEAN, FALSE) THEN
    IF NOT (
      (
        p_clause ? 'categoryIds'
        AND JSONB_ARRAY_LENGTH(p_clause->'categoryIds') > 0
        AND p_catalog.question_stem_category_id = ANY(
          ARRAY(
            SELECT value::UUID
            FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'categoryIds') AS value
          )
        )
      )
      OR (
        COALESCE((p_clause->>'includeNoCategory')::BOOLEAN, FALSE)
        AND p_catalog.question_stem_category_id IS NULL
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'tagIds' AND JSONB_ARRAY_LENGTH(p_clause->'tagIds') > 0 THEN
    IF NOT (
      p_catalog.tag_ids && ARRAY(
        SELECT value::UUID
        FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'tagIds') AS value
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'accessScopes' AND JSONB_ARRAY_LENGTH(p_clause->'accessScopes') > 0 THEN
    IF NOT (
      p_catalog.access_scope::TEXT = ANY(
        ARRAY(
          SELECT value::TEXT
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'accessScopes') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'practicePool' AND p_clause->'practicePool' IS NOT NULL THEN
    IF p_catalog.is_available_in_question_pool IS DISTINCT FROM (p_clause->>'practicePool')::BOOLEAN THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'setIds' OR COALESCE((p_clause->>'includeWithoutSet')::BOOLEAN, FALSE) THEN
    IF NOT (
      (
        p_clause ? 'setIds'
        AND JSONB_ARRAY_LENGTH(p_clause->'setIds') > 0
        AND p_catalog.set_ids && ARRAY(
          SELECT value::UUID
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'setIds') AS value
        )
      )
      OR (
        COALESCE((p_clause->>'includeWithoutSet')::BOOLEAN, FALSE)
        AND CARDINALITY(p_catalog.set_ids) = 0
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'sourceChannels' AND JSONB_ARRAY_LENGTH(p_clause->'sourceChannels') > 0 THEN
    IF NOT (
      p_catalog.source_channel::TEXT = ANY(
        ARRAY(
          SELECT value::TEXT
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'sourceChannels') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'aiReviewStatuses' AND JSONB_ARRAY_LENGTH(p_clause->'aiReviewStatuses') > 0 THEN
    IF NOT (
      p_catalog.ai_review_status = ANY(
        ARRAY(
          SELECT value::TEXT
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'aiReviewStatuses') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'createdBy' AND JSONB_ARRAY_LENGTH(p_clause->'createdBy') > 0 THEN
    IF NOT (
      p_catalog.created_by = ANY(
        ARRAY(
          SELECT value::UUID
          FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'createdBy') AS value
        )
      )
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'createdFrom' AND NULLIF(p_clause->>'createdFrom', '') IS NOT NULL THEN
    IF p_catalog.created_at < (p_clause->>'createdFrom')::TIMESTAMPTZ THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'createdTo' AND NULLIF(p_clause->>'createdTo', '') IS NOT NULL THEN
    IF p_catalog.created_at > (p_clause->>'createdTo')::TIMESTAMPTZ THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'questionCountMin' AND NULLIF(p_clause->>'questionCountMin', '') IS NOT NULL THEN
    IF p_catalog.question_count < (p_clause->>'questionCountMin')::INTEGER THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'questionCountMax' AND NULLIF(p_clause->>'questionCountMax', '') IS NOT NULL THEN
    IF p_catalog.question_count > (p_clause->>'questionCountMax')::INTEGER THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF p_clause ? 'auditFilters' AND JSONB_ARRAY_LENGTH(p_clause->'auditFilters') > 0 THEN
    SELECT ARRAY_AGG(value::TEXT)
    INTO v_audit_filters
    FROM JSONB_ARRAY_ELEMENTS_TEXT(p_clause->'auditFilters') AS value;

    IF EXISTS (
      SELECT 1
      FROM UNNEST(v_audit_filters) filter_value
      WHERE NOT public.ucat_is_valid_audit_catalog_filter(filter_value)
    ) THEN
      RAISE EXCEPTION 'invalid_audit_catalog_filter';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM UNNEST(v_audit_filters) filter_value
      WHERE public.ucat_question_stem_matches_audit_catalog_filter(p_catalog.id, filter_value)
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_question_catalog_matches_filter_expr(
  p_catalog public.vtutor_ucat_question_catalog,
  p_expr JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_child JSONB;
BEGIN
  IF p_expr IS NULL OR p_expr = '{}'::JSONB THEN
    RETURN TRUE;
  END IF;

  IF p_expr ? 'all' THEN
    IF JSONB_ARRAY_LENGTH(p_expr->'all') = 0 THEN
      RETURN TRUE;
    END IF;
    FOR v_child IN
      SELECT value FROM JSONB_ARRAY_ELEMENTS(p_expr->'all')
    LOOP
      IF NOT public.ucat_question_catalog_matches_filter_expr(p_catalog, v_child) THEN
        RETURN FALSE;
      END IF;
    END LOOP;
    RETURN TRUE;
  END IF;

  IF p_expr ? 'any' THEN
    IF JSONB_ARRAY_LENGTH(p_expr->'any') = 0 THEN
      RETURN FALSE;
    END IF;
    FOR v_child IN
      SELECT value FROM JSONB_ARRAY_ELEMENTS(p_expr->'any')
    LOOP
      IF public.ucat_question_catalog_matches_filter_expr(p_catalog, v_child) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
    RETURN FALSE;
  END IF;

  IF p_expr ? 'clause' THEN
    RETURN public.ucat_question_catalog_matches_filter_clause(p_catalog, p_expr->'clause');
  END IF;

  RAISE EXCEPTION 'invalid_catalog_filter_expression';
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_question_catalog_compose_filter(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_clause JSONB := '{}'::JSONB;
  v_statuses JSONB;
  v_parts JSONB[] := ARRAY[]::JSONB[];
  v_filter JSONB;
BEGIN
  IF p_payload ? 'filter' THEN
    v_parts := ARRAY_APPEND(v_parts, p_payload->'filter');
  END IF;

  IF p_payload ? 'statuses' OR p_payload ? 'status' THEN
    v_statuses := COALESCE(p_payload->'statuses', '[]'::JSONB);
    IF NULLIF(p_payload->>'status', '') IS NOT NULL THEN
      v_statuses := v_statuses || JSONB_BUILD_ARRAY(p_payload->>'status');
    END IF;
    IF JSONB_ARRAY_LENGTH(v_statuses) > 0 THEN
      v_clause := v_clause || JSONB_BUILD_OBJECT('statuses', v_statuses);
    END IF;
  END IF;

  IF p_payload ? 'auditFilters' AND JSONB_ARRAY_LENGTH(p_payload->'auditFilters') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('auditFilters', p_payload->'auditFilters');
  END IF;
  IF p_payload ? 'stemIds' AND JSONB_ARRAY_LENGTH(p_payload->'stemIds') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('stemIds', p_payload->'stemIds');
  END IF;

  IF p_payload ? 'sectionIds' OR NULLIF(p_payload->>'sectionId', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT(
      'sectionIds',
      COALESCE(p_payload->'sectionIds', '[]'::JSONB)
        || CASE
          WHEN NULLIF(p_payload->>'sectionId', '') IS NULL THEN '[]'::JSONB
          ELSE JSONB_BUILD_ARRAY(p_payload->>'sectionId')
        END
    );
  END IF;

  IF p_payload ? 'categoryIds' OR NULLIF(p_payload->>'categoryId', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT(
      'categoryIds',
      COALESCE(p_payload->'categoryIds', '[]'::JSONB)
        || CASE
          WHEN NULLIF(p_payload->>'categoryId', '') IS NULL THEN '[]'::JSONB
          ELSE JSONB_BUILD_ARRAY(p_payload->>'categoryId')
        END
    );
  END IF;

  IF COALESCE((p_payload->>'includeNoCategory')::BOOLEAN, FALSE) THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('includeNoCategory', TRUE);
  END IF;

  IF p_payload ? 'tagIds' AND JSONB_ARRAY_LENGTH(p_payload->'tagIds') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('tagIds', p_payload->'tagIds');
  END IF;

  IF p_payload ? 'accessScopes' OR NULLIF(p_payload->>'accessScope', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT(
      'accessScopes',
      COALESCE(p_payload->'accessScopes', '[]'::JSONB)
        || CASE
          WHEN NULLIF(p_payload->>'accessScope', '') IS NULL THEN '[]'::JSONB
          ELSE JSONB_BUILD_ARRAY(p_payload->>'accessScope')
        END
    );
  END IF;

  IF p_payload ? 'practicePool' AND p_payload->'practicePool' IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('practicePool', p_payload->'practicePool');
  END IF;

  IF p_payload ? 'setIds' AND JSONB_ARRAY_LENGTH(p_payload->'setIds') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('setIds', p_payload->'setIds');
  END IF;

  IF COALESCE((p_payload->>'includeWithoutSet')::BOOLEAN, FALSE) THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('includeWithoutSet', TRUE);
  END IF;

  IF p_payload ? 'sourceChannels' AND JSONB_ARRAY_LENGTH(p_payload->'sourceChannels') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('sourceChannels', p_payload->'sourceChannels');
  END IF;

  IF p_payload ? 'aiReviewStatuses' AND JSONB_ARRAY_LENGTH(p_payload->'aiReviewStatuses') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('aiReviewStatuses', p_payload->'aiReviewStatuses');
  END IF;

  IF p_payload ? 'createdBy' AND JSONB_ARRAY_LENGTH(p_payload->'createdBy') > 0 THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('createdBy', p_payload->'createdBy');
  END IF;

  IF NULLIF(p_payload->>'createdFrom', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('createdFrom', p_payload->>'createdFrom');
  END IF;

  IF NULLIF(p_payload->>'createdTo', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('createdTo', p_payload->>'createdTo');
  END IF;

  IF NULLIF(p_payload->>'questionCountMin', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('questionCountMin', p_payload->>'questionCountMin');
  END IF;

  IF NULLIF(p_payload->>'questionCountMax', '') IS NOT NULL THEN
    v_clause := v_clause || JSONB_BUILD_OBJECT('questionCountMax', p_payload->>'questionCountMax');
  END IF;

  IF v_clause <> '{}'::JSONB THEN
    v_parts := ARRAY_APPEND(v_parts, JSONB_BUILD_OBJECT('clause', v_clause));
  END IF;

  IF COALESCE(CARDINALITY(v_parts), 0) = 0 THEN
    RETURN NULL;
  END IF;

  IF CARDINALITY(v_parts) = 1 THEN
    RETURN v_parts[1];
  END IF;

  RETURN JSONB_BUILD_OBJECT('all', TO_JSONB(v_parts));
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_search_question_stems(
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_sort_by TEXT DEFAULT NULL,
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_ids_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  v_filter JSONB;
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), CASE WHEN p_ids_only THEN 50000 ELSE 100 END);
  safe_search TEXT := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
  safe_like_search TEXT;
  safe_direction TEXT := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_filter := public.ucat_question_catalog_compose_filter(COALESCE(p_payload, '{}'::JSONB));

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

  WITH filtered AS MATERIALIZED (
    SELECT catalog.*
    FROM public.vtutor_ucat_question_catalog catalog
    WHERE
      (
        (p_show_deleted AND catalog.deleted_at IS NOT NULL)
        OR (NOT p_show_deleted AND catalog.deleted_at IS NULL)
      )
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
      AND (
        v_filter IS NULL
        OR public.ucat_question_catalog_matches_filter_expr(catalog, v_filter)
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
                    'createdAt', target.created_at,
                    'why', target.outcome->>'why'
                  )
                  ORDER BY target.created_at DESC, run.created_at DESC
                )
                FROM public.vtutor_ucat_mcp_audit_run_targets target
                JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
                WHERE target.content_type = 'stem'
                  AND target.content_id = page_rows.id
                  AND run.status IN ('selecting', 'active', 'completed')
              ), '[]'::JSONB)
            )
        END
        ORDER BY page_rows.result_ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(result, JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'total', 0, 'page', safe_page, 'pageSize', safe_page_size));
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_catalog_matches_filter_clause(
  public.vtutor_ucat_question_catalog, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_catalog_matches_filter_clause(
  public.vtutor_ucat_question_catalog, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.ucat_question_catalog_matches_filter_expr(
  public.vtutor_ucat_question_catalog, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_catalog_matches_filter_expr(
  public.vtutor_ucat_question_catalog, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.ucat_question_catalog_compose_filter(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_catalog_compose_filter(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_search_question_stems(
  JSONB, BOOLEAN, TEXT, TEXT[], TEXT, TEXT, INTEGER, INTEGER, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_search_question_stems(
  JSONB, BOOLEAN, TEXT, TEXT[], TEXT, TEXT, INTEGER, INTEGER, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[]
)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_filter JSONB;
  safe_search TEXT;
  safe_like_search TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_filter := public.ucat_question_catalog_compose_filter(COALESCE(p_payload, '{}'::JSONB));

  safe_search := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
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

  RETURN QUERY
  SELECT catalog.id
  FROM public.vtutor_ucat_question_catalog catalog
  WHERE
    (
      (p_show_deleted AND catalog.deleted_at IS NOT NULL)
      OR (NOT p_show_deleted AND catalog.deleted_at IS NULL)
    )
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
    AND (
      v_filter IS NULL
      OR public.ucat_question_catalog_matches_filter_expr(catalog, v_filter)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  JSONB, BOOLEAN, TEXT, TEXT[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  JSONB, BOOLEAN, TEXT, TEXT[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_create_audit_run(
  p_idempotency_key TEXT,
  p_title TEXT,
  p_brief TEXT,
  p_published_write_mode TEXT,
  p_selector JSONB,
  p_workflow_id TEXT,
  p_workflow_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run_id UUID;
  v_staff_id UUID;
  v_selector_kind TEXT;
  v_target JSONB;
  v_content_type TEXT;
  v_status public.ucat_content_status;
  v_access_scope public.ucat_access_scope;
  v_section_id UUID;
  v_folder_id UUID;
  v_oauth_client_id TEXT;
  v_request_hash TEXT;
  v_existing RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_published_write_mode NOT IN ('proposal_only', 'apply_valid_changes') THEN
    RAISE EXCEPTION 'invalid_audit_write_mode';
  END IF;
  v_selector_kind := COALESCE(p_selector->>'kind', 'manual');
  IF v_selector_kind NOT IN ('manual', 'explicit', 'filter') THEN
    RAISE EXCEPTION 'invalid_audit_selector';
  END IF;

  v_staff_id := public.current_tutor_id();
  v_oauth_client_id := COALESCE(
    NULLIF((SELECT auth.jwt()->>'client_id'), ''),
    'direct-auth'
  );
  v_request_hash := encode(extensions.digest(
    convert_to(jsonb_build_object(
      'title', p_title,
      'brief', p_brief,
      'publishedWriteMode', p_published_write_mode,
      'selector', p_selector,
      'workflowId', p_workflow_id,
      'workflowVersion', p_workflow_version
    )::TEXT, 'UTF8'),
    'sha256'
  ), 'hex');
  SELECT id, request_hash INTO v_existing
  FROM public.ucat_mcp_audit_runs
  WHERE created_by = v_staff_id
    AND oauth_client_id = v_oauth_client_id
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'mcp_idempotency_key_reused_with_different_request';
    END IF;
    RETURN public.tutor_ucat_mcp_get_audit_run(v_existing.id, 0, 1);
  END IF;

  INSERT INTO public.ucat_mcp_audit_runs (
    title, brief, published_write_mode, selector, workflow_id,
    workflow_version, idempotency_key, request_hash, created_by, oauth_client_id
  ) VALUES (
    BTRIM(p_title), NULLIF(BTRIM(COALESCE(p_brief, '')), ''),
    p_published_write_mode, COALESCE(p_selector, '{"kind":"manual"}'::JSONB),
    NULLIF(BTRIM(COALESCE(p_workflow_id, '')), ''),
    NULLIF(BTRIM(COALESCE(p_workflow_version, '')), ''),
    p_idempotency_key, v_request_hash, v_staff_id, v_oauth_client_id
  ) RETURNING id INTO v_run_id;

  IF v_selector_kind = 'explicit' THEN
    FOR v_target IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_selector->'targets', '[]'::JSONB))
    LOOP
      v_content_type := v_target->>'contentType';
      PERFORM public.ucat_mcp_assert_target_exists(v_content_type, (v_target->>'id')::UUID);
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      VALUES (v_run_id, v_content_type, (v_target->>'id')::UUID)
      ON CONFLICT (run_id, content_type, content_id) DO NOTHING;
    END LOOP;
  ELSIF v_selector_kind = 'filter' THEN
    v_content_type := p_selector->>'contentType';
    v_status := NULLIF(p_selector->>'status', '')::public.ucat_content_status;
    v_access_scope := NULLIF(p_selector->>'accessScope', '')::public.ucat_access_scope;
    v_section_id := NULLIF(p_selector->>'sectionId', '')::UUID;
    v_folder_id := NULLIF(p_selector->>'folderId', '')::UUID;

    IF v_content_type = 'stem' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      SELECT v_run_id, 'stem', stem_id
      FROM public.ucat_question_catalog_filtered_stem_ids(
        p_selector,
        FALSE,
        NULLIF(BTRIM(COALESCE(p_selector->>'query', '')), ''),
        CASE
          WHEN JSONB_ARRAY_LENGTH(COALESCE(p_selector->'searchScopes', '[]'::JSONB)) = 0 THEN
            ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[]
          ELSE ARRAY(
            SELECT value::TEXT
            FROM JSONB_ARRAY_ELEMENTS_TEXT(p_selector->'searchScopes') AS value
          )
        END
      ) AS stem_id;
    ELSIF v_content_type = 'set' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      SELECT v_run_id, 'set', item.id
      FROM public.question_sets item
      WHERE item.deleted_at IS NULL
        AND (v_status IS NULL OR item.status = v_status)
        AND (v_access_scope IS NULL OR item.access_scope = v_access_scope);
    ELSIF v_content_type = 'mock' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      SELECT v_run_id, 'mock', item.id
      FROM public.ucat_mocks item
      WHERE item.deleted_at IS NULL
        AND (v_status IS NULL OR item.status = v_status)
        AND (v_access_scope IS NULL OR item.access_scope = v_access_scope);
    ELSIF v_content_type = 'learning_module' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      WITH RECURSIVE folder_tree AS (
        SELECT module.id
        FROM public.ucat_learning_modules module
        WHERE module.id = v_folder_id AND module.deleted_at IS NULL
        UNION ALL
        SELECT child.id
        FROM public.ucat_learning_modules child
        JOIN folder_tree parent
          ON parent.id = child.parent_ucat_learning_module_id
        WHERE child.deleted_at IS NULL
      )
      SELECT v_run_id, 'learning_module', item.id
      FROM public.ucat_learning_modules item
      WHERE item.deleted_at IS NULL
        AND (v_status IS NULL OR item.status = v_status)
        AND (v_access_scope IS NULL OR item.access_scope = v_access_scope)
        AND (v_section_id IS NULL OR item.ucat_section_id = v_section_id)
        AND (
          v_folder_id IS NULL
          OR item.id IN (SELECT id FROM folder_tree)
        );
    ELSE
      RAISE EXCEPTION 'invalid_ucat_content_type';
    END IF;
  END IF;

  RETURN public.tutor_ucat_mcp_get_audit_run(v_run_id, 0, 1);
END;
$$;
