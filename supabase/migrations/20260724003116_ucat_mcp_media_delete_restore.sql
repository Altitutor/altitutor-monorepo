-- Let UCAT tutors resolve generated UCAT image files through the tutor facade.
-- The previous base-table policy allowed this bucket; the role-facade migration
-- inadvertently retained only subject-prefixed storage paths.
CREATE OR REPLACE VIEW public.vtutor_files
WITH (security_invoker = false) AS
SELECT file.*
FROM public.files file
WHERE (SELECT public.is_tutor())
  AND file.deleted_at IS NULL
  AND (
    public.can_tutor_read_file(file.storage_path)
    OR (
      file.bucket = 'ucat-images'
      AND (SELECT public.is_ucat_tutor())
    )
  );

GRANT SELECT ON public.vtutor_files TO authenticated;

-- MCP may soft-delete and restore editable authoring aggregates. The wrapper
-- adds the same published-content and optimistic-concurrency boundaries as the
-- other MCP mutations, while delegating dependency checks and cascades to the
-- established tutor RPCs.
CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_set_deleted(
  p_content_type TEXT,
  p_content_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_deleted BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_current_status public.ucat_content_status;
  v_deleted_at TIMESTAMPTZ;
  v_kind public.ucat_learning_module_kind;
  v_entity_type TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_before_updated_at, v_deleted_at
    FROM public.question_stems
    WHERE id = p_content_id
    FOR UPDATE;
    v_entity_type := 'question_stems';
  ELSIF p_content_type = 'set' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_before_updated_at, v_deleted_at
    FROM public.question_sets
    WHERE id = p_content_id
    FOR UPDATE;
    v_entity_type := 'question_sets';
  ELSIF p_content_type = 'mock' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_before_updated_at, v_deleted_at
    FROM public.ucat_mocks
    WHERE id = p_content_id
    FOR UPDATE;
    v_entity_type := 'ucat_mocks';
  ELSIF p_content_type = 'learning_module' THEN
    SELECT status, updated_at, deleted_at, kind
    INTO v_current_status, v_before_updated_at, v_deleted_at, v_kind
    FROM public.ucat_learning_modules
    WHERE id = p_content_id
    FOR UPDATE;
    v_entity_type := 'ucat_learning_modules';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ucat_content_not_found';
  END IF;
  IF p_content_type = 'learning_module' AND v_kind <> 'lesson' THEN
    RAISE EXCEPTION 'mcp_live_learning_folder_read_only';
  END IF;
  IF v_current_status = 'published' THEN
    RAISE EXCEPTION 'mcp_published_content_read_only';
  END IF;
  IF p_expected_updated_at IS NULL
    OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'mcp_stale_revision';
  END IF;
  IF p_deleted AND v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'mcp_content_already_deleted';
  END IF;
  IF NOT p_deleted AND v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'mcp_content_not_deleted';
  END IF;

  IF p_deleted THEN
    IF p_content_type = 'stem' THEN
      PERFORM public.tutor_ucat_delete_question_stem(p_content_id);
    ELSIF p_content_type = 'set' THEN
      PERFORM public.tutor_ucat_delete_question_set(p_content_id);
    ELSIF p_content_type = 'mock' THEN
      PERFORM public.tutor_ucat_delete_mock(p_content_id);
    ELSE
      PERFORM public.tutor_ucat_soft_delete_learning_module(p_content_id);
    END IF;
  ELSE
    IF p_content_type = 'stem' THEN
      PERFORM public.tutor_ucat_restore_question_stem(p_content_id);
    ELSIF p_content_type = 'set' THEN
      PERFORM public.tutor_ucat_restore_question_set(p_content_id);
    ELSIF p_content_type = 'mock' THEN
      PERFORM public.tutor_ucat_restore_mock(p_content_id);
    ELSE
      PERFORM public.tutor_ucat_restore_learning_module(p_content_id);
    END IF;
  END IF;

  IF p_content_type = 'stem' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_after_updated_at, v_deleted_at
    FROM public.question_stems WHERE id = p_content_id;
  ELSIF p_content_type = 'set' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_after_updated_at, v_deleted_at
    FROM public.question_sets WHERE id = p_content_id;
  ELSIF p_content_type = 'mock' THEN
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_after_updated_at, v_deleted_at
    FROM public.ucat_mocks WHERE id = p_content_id;
  ELSE
    SELECT status, updated_at, deleted_at
    INTO v_current_status, v_after_updated_at, v_deleted_at
    FROM public.ucat_learning_modules WHERE id = p_content_id;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    v_entity_type,
    p_content_id,
    'UPDATED',
    CASE WHEN p_deleted THEN 'delete_ucat_content' ELSE 'restore_ucat_content' END,
    v_before_updated_at,
    v_after_updated_at,
    jsonb_build_array(CASE WHEN p_deleted THEN 'delete' ELSE 'restore' END)
  );

  RETURN jsonb_build_object(
    'id', p_content_id,
    'status', v_current_status,
    'deletedAt', v_deleted_at,
    'revision', public.ucat_mcp_authoring_revision(p_content_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_set_deleted(
  TEXT, UUID, TIMESTAMPTZ, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_set_deleted(
  TEXT, UUID, TIMESTAMPTZ, BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_mcp_set_deleted(TEXT, UUID, TIMESTAMPTZ, BOOLEAN)
IS 'MCP-only soft delete/restore for non-published UCAT authoring aggregates with optimistic concurrency.';
