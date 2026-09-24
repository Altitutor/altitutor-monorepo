-- Reuse tutor-web question-catalog filters when materialising stem audit-run targets.

CREATE OR REPLACE FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  p_status TEXT DEFAULT NULL,
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_stem_ids UUID[] DEFAULT NULL,
  p_section_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_include_no_category BOOLEAN DEFAULT FALSE,
  p_tag_ids UUID[] DEFAULT NULL,
  p_access_scopes TEXT[] DEFAULT NULL,
  p_practice_pool BOOLEAN DEFAULT NULL,
  p_set_ids UUID[] DEFAULT NULL,
  p_include_without_set BOOLEAN DEFAULT FALSE,
  p_source_channels TEXT[] DEFAULT NULL,
  p_ai_review_statuses TEXT[] DEFAULT NULL,
  p_audit_filters TEXT[] DEFAULT NULL,
  p_created_by UUID[] DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_question_count_min INTEGER DEFAULT NULL,
  p_question_count_max INTEGER DEFAULT NULL
)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  safe_search TEXT;
  safe_like_search TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
      OR
      (
        NOT p_show_deleted
        AND catalog.deleted_at IS NULL
        AND (p_status IS NULL OR catalog.status::TEXT = p_status)
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
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  BOOLEAN, UUID[], BOOLEAN, TEXT[], TEXT[], TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ,
  INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_catalog_filtered_stem_ids(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  BOOLEAN, UUID[], BOOLEAN, TEXT[], TEXT[], TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ,
  INTEGER, INTEGER
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
  v_category_id UUID;
  v_folder_id UUID;
  v_section_ids UUID[];
  v_category_ids UUID[];
  v_access_scopes TEXT[];
  v_stem_ids UUID[];
  v_audit_filters TEXT[];
  v_search_scopes TEXT[];
  v_source_channels TEXT[];
  v_ai_review_statuses TEXT[];
  v_created_by UUID[];
  v_tag_ids UUID[];
  v_set_ids UUID[];
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
    v_category_id := NULLIF(p_selector->>'categoryId', '')::UUID;
    v_folder_id := NULLIF(p_selector->>'folderId', '')::UUID;

    v_section_ids := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'sectionIds', '[]'::JSONB)) AS value
    );
    IF v_section_id IS NOT NULL THEN
      v_section_ids := ARRAY(SELECT DISTINCT unnest(v_section_ids || ARRAY[v_section_id]));
    END IF;

    v_category_ids := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'categoryIds', '[]'::JSONB)) AS value
    );
    IF v_category_id IS NOT NULL THEN
      v_category_ids := ARRAY(SELECT DISTINCT unnest(v_category_ids || ARRAY[v_category_id]));
    END IF;

    v_access_scopes := ARRAY(
      SELECT value::TEXT
      FROM jsonb_array_elements_text(COALESCE(p_selector->'accessScopes', '[]'::JSONB)) AS value
    );
    IF v_access_scope IS NOT NULL THEN
      v_access_scopes := ARRAY(SELECT DISTINCT unnest(v_access_scopes || ARRAY[v_access_scope::TEXT]));
    END IF;

    v_stem_ids := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'stemIds', '[]'::JSONB)) AS value
    );
    v_audit_filters := ARRAY(
      SELECT value::TEXT
      FROM jsonb_array_elements_text(COALESCE(p_selector->'auditFilters', '[]'::JSONB)) AS value
    );
    v_search_scopes := ARRAY(
      SELECT value::TEXT
      FROM jsonb_array_elements_text(COALESCE(p_selector->'searchScopes', '[]'::JSONB)) AS value
    );
    v_source_channels := ARRAY(
      SELECT value::TEXT
      FROM jsonb_array_elements_text(COALESCE(p_selector->'sourceChannels', '[]'::JSONB)) AS value
    );
    v_ai_review_statuses := ARRAY(
      SELECT value::TEXT
      FROM jsonb_array_elements_text(COALESCE(p_selector->'aiReviewStatuses', '[]'::JSONB)) AS value
    );
    v_created_by := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'createdBy', '[]'::JSONB)) AS value
    );
    v_tag_ids := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'tagIds', '[]'::JSONB)) AS value
    );
    v_set_ids := ARRAY(
      SELECT value::UUID
      FROM jsonb_array_elements_text(COALESCE(p_selector->'setIds', '[]'::JSONB)) AS value
    );

    IF v_content_type = 'stem' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      SELECT v_run_id, 'stem', stem_id
      FROM public.ucat_question_catalog_filtered_stem_ids(
        v_status::TEXT,
        FALSE,
        NULLIF(BTRIM(COALESCE(p_selector->>'query', '')), ''),
        CASE
          WHEN CARDINALITY(v_search_scopes) = 0 THEN
            ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[]
          ELSE v_search_scopes
        END,
        CASE WHEN CARDINALITY(v_stem_ids) = 0 THEN NULL ELSE v_stem_ids END,
        CASE WHEN CARDINALITY(v_section_ids) = 0 THEN NULL ELSE v_section_ids END,
        CASE WHEN CARDINALITY(v_category_ids) = 0 THEN NULL ELSE v_category_ids END,
        COALESCE((p_selector->>'includeNoCategory')::BOOLEAN, FALSE),
        CASE WHEN CARDINALITY(v_tag_ids) = 0 THEN NULL ELSE v_tag_ids END,
        CASE WHEN CARDINALITY(v_access_scopes) = 0 THEN NULL ELSE v_access_scopes END,
        NULLIF(p_selector->>'practicePool', '')::BOOLEAN,
        CASE WHEN CARDINALITY(v_set_ids) = 0 THEN NULL ELSE v_set_ids END,
        COALESCE((p_selector->>'includeWithoutSet')::BOOLEAN, FALSE),
        CASE WHEN CARDINALITY(v_source_channels) = 0 THEN NULL ELSE v_source_channels END,
        CASE WHEN CARDINALITY(v_ai_review_statuses) = 0 THEN NULL ELSE v_ai_review_statuses END,
        CASE WHEN CARDINALITY(v_audit_filters) = 0 THEN NULL ELSE v_audit_filters END,
        CASE WHEN CARDINALITY(v_created_by) = 0 THEN NULL ELSE v_created_by END,
        NULLIF(p_selector->>'createdFrom', '')::TIMESTAMPTZ,
        NULLIF(p_selector->>'createdTo', '')::TIMESTAMPTZ,
        NULLIF(p_selector->>'questionCountMin', '')::INTEGER,
        NULLIF(p_selector->>'questionCountMax', '')::INTEGER
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
