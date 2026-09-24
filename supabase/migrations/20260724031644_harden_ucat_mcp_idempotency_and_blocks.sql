-- Preserve stable learning-module block IDs when tutors or MCP agents replace a
-- lesson's ordered block list. Existing IDs are updated in place, new blocks
-- omit `id`, and active blocks omitted from the payload are soft-deleted.
CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_learning_module_blocks(
  p_module_id UUID,
  p_blocks JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.ucat_learning_module_kind;
  v_block JSONB;
  v_block_id UUID;
  v_kept_ids UUID[] := ARRAY[]::UUID[];
  v_idx INTEGER;
  v_temporary_offset INTEGER;
  v_updated_count INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT kind INTO v_kind
  FROM public.ucat_learning_modules
  WHERE id = p_module_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  IF v_kind <> 'lesson' THEN
    RAISE EXCEPTION 'learning_module_not_lesson';
  END IF;

  IF jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'learning_module_blocks_must_be_array';
  END IF;

  SELECT COALESCE(MAX(index), 0) + COUNT(*)::INTEGER + 1
  INTO v_temporary_offset
  FROM public.ucat_learning_module_blocks
  WHERE learning_module_id = p_module_id
    AND deleted_at IS NULL;

  UPDATE public.ucat_learning_module_blocks
  SET index = index + v_temporary_offset
  WHERE learning_module_id = p_module_id
    AND deleted_at IS NULL;

  v_idx := 0;
  FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    v_block_id := NULLIF(v_block->>'id', '')::UUID;

    IF v_block_id IS NOT NULL THEN
      IF v_block_id = ANY(v_kept_ids) THEN
        RAISE EXCEPTION 'learning_module_block_id_duplicated';
      END IF;

      UPDATE public.ucat_learning_module_blocks
      SET
        block_type = (v_block->>'block_type')::public.ucat_learning_module_block_type,
        index = COALESCE((v_block->>'index')::INTEGER, v_idx),
        require_completion_before_next =
          COALESCE((v_block->>'require_completion_before_next')::BOOLEAN, true),
        content = COALESCE(v_block->'content', '{}'::JSONB),
        question_stem_id = NULLIF(v_block->>'question_stem_id', '')::UUID,
        question_id = NULLIF(v_block->>'question_id', '')::UUID,
        file_id = NULLIF(v_block->>'file_id', '')::UUID,
        skill_trainer_id = NULLIF(v_block->>'skill_trainer_id', '')::UUID,
        updated_at = NOW()
      WHERE id = v_block_id
        AND learning_module_id = p_module_id
        AND deleted_at IS NULL;

      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> 1 THEN
        RAISE EXCEPTION 'learning_module_block_not_found';
      END IF;
    ELSE
      INSERT INTO public.ucat_learning_module_blocks (
        learning_module_id,
        block_type,
        index,
        require_completion_before_next,
        content,
        question_stem_id,
        question_id,
        file_id,
        skill_trainer_id
      )
      VALUES (
        p_module_id,
        (v_block->>'block_type')::public.ucat_learning_module_block_type,
        COALESCE((v_block->>'index')::INTEGER, v_idx),
        COALESCE((v_block->>'require_completion_before_next')::BOOLEAN, true),
        COALESCE(v_block->'content', '{}'::JSONB),
        NULLIF(v_block->>'question_stem_id', '')::UUID,
        NULLIF(v_block->>'question_id', '')::UUID,
        NULLIF(v_block->>'file_id', '')::UUID,
        NULLIF(v_block->>'skill_trainer_id', '')::UUID
      )
      RETURNING id INTO v_block_id;
    END IF;

    v_kept_ids := array_append(v_kept_ids, v_block_id);
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.ucat_learning_module_blocks
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE learning_module_id = p_module_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_kept_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_replace_learning_module_blocks(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_replace_learning_module_blocks(UUID, JSONB) TO authenticated;

-- Durable at-most-once protection for MCP operations that create records or
-- invoke external generation. Records are scoped to the authenticated user and
-- OAuth client, so callers cannot replay another tutor's operation.
CREATE TABLE public.ucat_mcp_idempotency_records (
  actor_user_id UUID NOT NULL,
  oauth_client_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  PRIMARY KEY (actor_user_id, oauth_client_id, tool_name, idempotency_key)
);

ALTER TABLE public.ucat_mcp_idempotency_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ucat_mcp_idempotency_records FROM PUBLIC, anon, authenticated;

CREATE INDEX idx_ucat_mcp_idempotency_expires_at
  ON public.ucat_mcp_idempotency_records(expires_at);

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_begin_idempotency(
  p_tool_name TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := (SELECT auth.uid());
  v_oauth_client_id TEXT :=
    COALESCE(NULLIF((SELECT auth.jwt()->>'client_id'), ''), 'direct-auth');
  v_record public.ucat_mcp_idempotency_records%ROWTYPE;
  v_inserted_count INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() OR v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_tool_name NOT IN (
    'create_learning_module',
    'create_question_stem',
    'create_question_set',
    'create_mock',
    'start_question_generation',
    'generate_ucat_image',
    'revise_ucat_image'
  ) THEN
    RAISE EXCEPTION 'mcp_idempotency_tool_not_allowed';
  END IF;

  IF LENGTH(p_idempotency_key) < 8 OR LENGTH(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'mcp_idempotency_key_invalid';
  END IF;

  IF p_request_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'mcp_idempotency_hash_invalid';
  END IF;

  INSERT INTO public.ucat_mcp_idempotency_records (
    actor_user_id,
    oauth_client_id,
    tool_name,
    idempotency_key,
    request_hash
  )
  VALUES (
    v_actor_user_id,
    v_oauth_client_id,
    p_tool_name,
    p_idempotency_key,
    p_request_hash
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  IF v_inserted_count = 1 THEN
    RETURN jsonb_build_object('state', 'execute');
  END IF;

  SELECT *
  INTO v_record
  FROM public.ucat_mcp_idempotency_records
  WHERE actor_user_id = v_actor_user_id
    AND oauth_client_id = v_oauth_client_id
    AND tool_name = p_tool_name
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF v_record.expires_at <= NOW() THEN
    UPDATE public.ucat_mcp_idempotency_records
    SET
      request_hash = p_request_hash,
      status = 'running',
      result = NULL,
      error_message = NULL,
      attempts = attempts + 1,
      created_at = NOW(),
      updated_at = NOW(),
      expires_at = NOW() + INTERVAL '7 days'
    WHERE actor_user_id = v_actor_user_id
      AND oauth_client_id = v_oauth_client_id
      AND tool_name = p_tool_name
      AND idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('state', 'execute');
  END IF;

  IF v_record.request_hash <> p_request_hash THEN
    RAISE EXCEPTION 'mcp_idempotency_key_reused_with_different_request';
  END IF;

  IF v_record.status = 'completed' THEN
    RETURN jsonb_build_object('state', 'completed', 'result', v_record.result);
  END IF;

  IF v_record.status = 'failed' THEN
    RETURN jsonb_build_object(
      'state',
      'failed',
      'error',
      COALESCE(v_record.error_message, 'The original operation failed')
    );
  END IF;

  RETURN jsonb_build_object('state', 'running');
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_complete_idempotency(
  p_tool_name TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_result JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() OR (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.ucat_mcp_idempotency_records
  SET
    status = 'completed',
    result = p_result,
    error_message = NULL,
    updated_at = NOW()
  WHERE actor_user_id = (SELECT auth.uid())
    AND oauth_client_id =
      COALESCE(NULLIF((SELECT auth.jwt()->>'client_id'), ''), 'direct-auth')
    AND tool_name = p_tool_name
    AND idempotency_key = p_idempotency_key
    AND request_hash = p_request_hash
    AND status = 'running';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'mcp_idempotency_record_not_running';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_fail_idempotency(
  p_tool_name TEXT,
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() OR (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.ucat_mcp_idempotency_records
  SET
    status = 'failed',
    error_message = LEFT(p_error_message, 4000),
    updated_at = NOW()
  WHERE actor_user_id = (SELECT auth.uid())
    AND oauth_client_id =
      COALESCE(NULLIF((SELECT auth.jwt()->>'client_id'), ''), 'direct-auth')
    AND tool_name = p_tool_name
    AND idempotency_key = p_idempotency_key
    AND request_hash = p_request_hash
    AND status = 'running';
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_begin_idempotency(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_complete_idempotency(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_fail_idempotency(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_begin_idempotency(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_complete_idempotency(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_fail_idempotency(TEXT, TEXT, TEXT, TEXT) TO authenticated;
