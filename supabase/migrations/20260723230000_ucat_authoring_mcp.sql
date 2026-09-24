-- Migration: UCAT authoring MCP boundaries
-- Why:
--   Codex needs the same tutor-scoped authoring operations as tutor-web, with
--   atomic optimistic concurrency, published-content protection, and a compact
--   MCP-specific audit event. These wrappers deliberately do not expose
--   top-level delete, restore, or publish operations.

CREATE OR REPLACE FUNCTION public.ucat_mcp_authoring_revision(
  p_entity_id UUID,
  p_updated_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
SET search_path = public, extensions
AS $$
  SELECT encode(
    digest(
      p_entity_id::TEXT || ':' || p_updated_at::TEXT,
      'sha256'
    ),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_authoring_revision(UUID, TIMESTAMPTZ) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ucat_mcp_review_issues(
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
  v_issues JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'stem' THEN
    RETURN public.ucat_content_publication_issues('stem', p_content_id);
  END IF;

  IF p_content_type IN ('set', 'mock') THEN
    SELECT COALESCE(jsonb_agg(issue), '[]'::JSONB)
    INTO v_issues
    FROM jsonb_array_elements(
      public.ucat_content_publication_issues(p_content_type, p_content_id)
    ) AS issue
    WHERE issue->>'code' <> 'unpublished_children';
    RETURN v_issues;
  END IF;

  -- Unpublished lessons intentionally support pending generated assessment
  -- placeholders. Their save-time block constraints are the review boundary.
  IF p_content_type = 'lesson' THEN
    RETURN '[]'::JSONB;
  END IF;

  RAISE EXCEPTION 'invalid_ucat_content_type';
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_review_issues(TEXT, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.ucat_mcp_record_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_event_type TEXT,
  p_tool_name TEXT,
  p_before_updated_at TIMESTAMPTZ,
  p_after_updated_at TIMESTAMPTZ,
  p_operation_kinds JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();
  INSERT INTO public.activity_events (
    entity_type,
    entity_id,
    event_type,
    changed_fields,
    metadata,
    staff_id,
    performed_by,
    performed_at
  )
  VALUES (
    p_entity_type,
    p_entity_id,
    CASE WHEN p_event_type = 'CREATED' THEN 'CREATED' ELSE 'UPDATED' END,
    NULL,
    jsonb_build_object(
      'source', 'codex_mcp',
      'oauth_client_id', auth.jwt()->>'client_id',
      'tool', p_tool_name,
      'before_revision', CASE
        WHEN p_before_updated_at IS NULL THEN NULL
        ELSE public.ucat_mcp_authoring_revision(p_entity_id, p_before_updated_at)
      END,
      'after_revision', public.ucat_mcp_authoring_revision(p_entity_id, p_after_updated_at),
      'operation_kinds', COALESCE(p_operation_kinds, '[]'::JSONB)
    ),
    v_staff_id,
    v_staff_id,
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_record_activity(
  TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_record_auxiliary_activity(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_tool_name TEXT,
  p_operation_kinds JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF (p_entity_type, p_tool_name) NOT IN (
    ('ucat_ai_generation_runs', 'start_question_generation'),
    ('files', 'generate_ucat_image'),
    ('files', 'revise_ucat_image'),
    ('ucat_ai_question_assessments', 'request_question_ai_assessment')
  ) THEN
    RAISE EXCEPTION 'invalid_mcp_auxiliary_activity';
  END IF;

  v_staff_id := public.current_tutor_id();
  INSERT INTO public.activity_events (
    entity_type,
    entity_id,
    event_type,
    changed_fields,
    metadata,
    staff_id,
    performed_by,
    performed_at
  )
  VALUES (
    p_entity_type,
    p_entity_id,
    'CREATED',
    NULL,
    jsonb_build_object(
      'source', 'codex_mcp',
      'oauth_client_id', auth.jwt()->>'client_id',
      'tool', p_tool_name,
      'before_revision', NULL,
      'after_revision', NULL,
      'operation_kinds', COALESCE(p_operation_kinds, '[]'::JSONB)
    ),
    v_staff_id,
    v_staff_id,
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_record_auxiliary_activity(
  TEXT, UUID, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_record_auxiliary_activity(
  TEXT, UUID, TEXT, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel,
  p_tutor_source_note TEXT,
  p_ai_generation_metadata JSONB,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_stem_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_stem_id IS NOT NULL THEN
    SELECT updated_at, status
    INTO v_before_updated_at, v_status
    FROM public.question_stems
    WHERE id = p_stem_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'question_stem_not_found';
    END IF;
    IF v_status = 'published' THEN
      RAISE EXCEPTION 'mcp_published_content_read_only';
    END IF;
    IF p_expected_updated_at IS NULL
      OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
    p_stem_id,
    p_section_id,
    p_question_stem_category_id,
    COALESCE(p_stem_text, '{}'::JSONB),
    COALESCE(p_access_scope, 'public'),
    COALESCE(p_questions, '[]'::JSONB),
    COALESCE(p_source_channel, 'ai_generation'),
    p_tutor_source_note
  );

  IF p_stem_id IS NULL AND p_ai_generation_metadata IS NOT NULL THEN
    UPDATE public.question_stems
    SET
      ai_generation_metadata = p_ai_generation_metadata,
      source_channel = 'ai_generation',
      updated_by = public.current_tutor_id()
    WHERE id = v_stem_id;
  END IF;

  SELECT status, updated_at
  INTO v_status, v_after_updated_at
  FROM public.question_stems
  WHERE id = v_stem_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('stem', v_stem_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'question_stems',
    v_stem_id,
    CASE WHEN p_stem_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_stem_id IS NULL THEN 'create_question_stem' ELSE 'update_question_stem' END,
    v_before_updated_at,
    v_after_updated_at,
    p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_stem_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_stem_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_question_stem_bundle(
  UUID, TIMESTAMPTZ, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_question_stem_bundle(
  UUID, TIMESTAMPTZ, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  p_set_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_name JSONB,
  p_description JSONB,
  p_time_limit_seconds INTEGER,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_set_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_set_id IS NOT NULL THEN
    SELECT updated_at, status
    INTO v_before_updated_at, v_status
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'question_set_not_found';
    END IF;
    IF v_status = 'published' THEN
      RAISE EXCEPTION 'mcp_published_content_read_only';
    END IF;
    IF p_expected_updated_at IS NULL
      OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_set_id := public.tutor_ucat_upsert_question_set(
    p_set_id,
    p_name,
    COALESCE(p_description, '{}'::JSONB),
    p_time_limit_seconds,
    COALESCE(p_access_scope, 'public'),
    COALESCE(p_stem_ids, '[]'::JSONB)
  );

  SELECT status, updated_at
  INTO v_status, v_after_updated_at
  FROM public.question_sets
  WHERE id = v_set_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'question_sets',
    v_set_id,
    CASE WHEN p_set_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_set_id IS NULL THEN 'create_question_set' ELSE 'update_question_set' END,
    v_before_updated_at,
    v_after_updated_at,
    p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_set_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_set_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_upsert_mock(
  p_mock_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_name TEXT,
  p_access_scope public.ucat_access_scope,
  p_set_ids JSONB,
  p_instructions_text JSONB,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_mock_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_mock_id IS NOT NULL THEN
    SELECT updated_at, status
    INTO v_before_updated_at, v_status
    FROM public.ucat_mocks
    WHERE id = p_mock_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'mock_not_found';
    END IF;
    IF v_status = 'published' THEN
      RAISE EXCEPTION 'mcp_published_content_read_only';
    END IF;
    IF p_expected_updated_at IS NULL
      OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_mock_id := public.tutor_ucat_upsert_mock(
    p_mock_id,
    p_name,
    COALESCE(p_access_scope, 'public'),
    COALESCE(p_set_ids, '[]'::JSONB),
    p_instructions_text
  );

  SELECT status, updated_at
  INTO v_status, v_after_updated_at
  FROM public.ucat_mocks
  WHERE id = v_mock_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'ucat_mocks',
    v_mock_id,
    CASE WHEN p_mock_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_mock_id IS NULL THEN 'create_mock' ELSE 'update_mock' END,
    v_before_updated_at,
    v_after_updated_at,
    p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_mock_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_mock_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_mock(
  UUID, TIMESTAMPTZ, TEXT, public.ucat_access_scope, JSONB, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_mock(
  UUID, TIMESTAMPTZ, TEXT, public.ucat_access_scope, JSONB, JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_upsert_learning_module(
  p_module_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT,
  p_ucat_section_id UUID,
  p_parent_id UUID,
  p_index INTEGER,
  p_access_scope public.ucat_access_scope,
  p_icon_key TEXT,
  p_estimated_minutes INTEGER,
  p_study_plan_priority TEXT,
  p_study_plan_category_ids UUID[],
  p_study_plan_tag_ids UUID[],
  p_blocks JSONB,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_existing_kind public.ucat_learning_module_kind;
  v_status public.ucat_content_status;
  v_module_id UUID;
  v_has_published_descendant BOOLEAN := false;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_module_id IS NOT NULL THEN
    SELECT updated_at, status, kind
    INTO v_before_updated_at, v_status, v_existing_kind
    FROM public.ucat_learning_modules
    WHERE id = p_module_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'learning_module_not_found';
    END IF;
    IF v_existing_kind IS DISTINCT FROM p_kind THEN
      RAISE EXCEPTION 'mcp_learning_module_kind_immutable';
    END IF;
    IF v_existing_kind = 'lesson' AND v_status = 'published' THEN
      RAISE EXCEPTION 'mcp_published_content_read_only';
    END IF;
    IF p_expected_updated_at IS NULL
      OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;

    IF v_existing_kind = 'folder' THEN
      WITH RECURSIVE descendants AS (
        SELECT child.id, child.kind, child.status
        FROM public.ucat_learning_modules child
        WHERE child.parent_ucat_learning_module_id = p_module_id
          AND child.deleted_at IS NULL
        UNION ALL
        SELECT child.id, child.kind, child.status
        FROM public.ucat_learning_modules child
        JOIN descendants parent ON parent.id = child.parent_ucat_learning_module_id
        WHERE child.deleted_at IS NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM descendants
        WHERE kind = 'lesson' AND status = 'published'
      )
      INTO v_has_published_descendant;

      IF v_has_published_descendant THEN
        RAISE EXCEPTION 'mcp_live_learning_folder_read_only';
      END IF;
    END IF;
  END IF;

  v_module_id := public.tutor_ucat_upsert_learning_module(
    p_module_id,
    p_kind,
    p_title,
    p_description,
    p_ucat_section_id,
    p_parent_id,
    p_index,
    COALESCE(p_access_scope, 'public'),
    COALESCE(p_icon_key, 'book-open'),
    p_estimated_minutes
  );

  PERFORM public.tutor_ucat_update_learning_module_study_plan_metadata(
    v_module_id,
    COALESCE(p_study_plan_priority, 'recommended'),
    COALESCE(p_study_plan_category_ids, '{}'::UUID[]),
    COALESCE(p_study_plan_tag_ids, '{}'::UUID[])
  );

  IF p_kind = 'lesson' THEN
    PERFORM public.tutor_ucat_replace_learning_module_blocks(
      v_module_id,
      COALESCE(p_blocks, '[]'::JSONB)
    );
  ELSIF jsonb_array_length(COALESCE(p_blocks, '[]'::JSONB)) > 0 THEN
    RAISE EXCEPTION 'mcp_folder_cannot_have_blocks';
  END IF;

  UPDATE public.ucat_learning_modules
  SET updated_at = NOW(), updated_by = public.current_tutor_id()
  WHERE id = v_module_id
  RETURNING status, updated_at INTO v_status, v_after_updated_at;

  PERFORM public.ucat_mcp_record_activity(
    'ucat_learning_modules',
    v_module_id,
    CASE WHEN p_module_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_module_id IS NULL THEN 'create_learning_module' ELSE 'update_learning_module' END,
    v_before_updated_at,
    v_after_updated_at,
    p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_module_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_module_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_learning_module(
  UUID, TIMESTAMPTZ, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID,
  INTEGER, public.ucat_access_scope, TEXT, INTEGER, TEXT, UUID[], UUID[], JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_learning_module(
  UUID, TIMESTAMPTZ, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID,
  INTEGER, public.ucat_access_scope, TEXT, INTEGER, TEXT, UUID[], UUID[], JSONB, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_submit_for_review(
  p_content_type TEXT,
  p_content_id UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_current public.ucat_content_status;
  v_issues JSONB;
  v_entity_type TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT status, updated_at INTO v_current, v_before_updated_at
    FROM public.question_stems
    WHERE id = p_content_id AND deleted_at IS NULL
    FOR UPDATE;
    v_entity_type := 'question_stems';
  ELSIF p_content_type = 'set' THEN
    SELECT status, updated_at INTO v_current, v_before_updated_at
    FROM public.question_sets
    WHERE id = p_content_id AND deleted_at IS NULL
    FOR UPDATE;
    v_entity_type := 'question_sets';
  ELSIF p_content_type = 'mock' THEN
    SELECT status, updated_at INTO v_current, v_before_updated_at
    FROM public.ucat_mocks
    WHERE id = p_content_id AND deleted_at IS NULL
    FOR UPDATE;
    v_entity_type := 'ucat_mocks';
  ELSIF p_content_type = 'lesson' THEN
    SELECT status, updated_at INTO v_current, v_before_updated_at
    FROM public.ucat_learning_modules
    WHERE id = p_content_id AND deleted_at IS NULL AND kind = 'lesson'
    FOR UPDATE;
    v_entity_type := 'ucat_learning_modules';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ucat_content_not_found';
  END IF;
  IF v_current <> 'draft' THEN
    RAISE EXCEPTION 'mcp_submit_requires_draft';
  END IF;
  IF p_expected_updated_at IS NULL
    OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'mcp_stale_revision';
  END IF;

  v_issues := public.ucat_mcp_review_issues(p_content_type, p_content_id);
  IF jsonb_array_length(v_issues) > 0 THEN
    RAISE EXCEPTION 'mcp_review_blocked:%', v_issues::TEXT;
  END IF;

  PERFORM public.tutor_ucat_set_content_status(
    p_content_type,
    p_content_id,
    'in_review'
  );

  IF p_content_type = 'stem' THEN
    SELECT updated_at INTO v_after_updated_at FROM public.question_stems WHERE id = p_content_id;
  ELSIF p_content_type = 'set' THEN
    SELECT updated_at INTO v_after_updated_at FROM public.question_sets WHERE id = p_content_id;
  ELSIF p_content_type = 'mock' THEN
    SELECT updated_at INTO v_after_updated_at FROM public.ucat_mocks WHERE id = p_content_id;
  ELSE
    SELECT updated_at INTO v_after_updated_at FROM public.ucat_learning_modules WHERE id = p_content_id;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    v_entity_type,
    p_content_id,
    'UPDATED',
    'submit_for_review',
    v_before_updated_at,
    v_after_updated_at,
    '["submit_for_review"]'::JSONB
  );

  RETURN jsonb_build_object(
    'id', p_content_id,
    'status', 'in_review',
    'revision', public.ucat_mcp_authoring_revision(p_content_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_submit_for_review(
  TEXT, UUID, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_submit_for_review(
  TEXT, UUID, TIMESTAMPTZ
) TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_mcp_submit_for_review(TEXT, UUID, TIMESTAMPTZ)
IS 'MCP-only draft-to-review transition. It never publishes content.';
