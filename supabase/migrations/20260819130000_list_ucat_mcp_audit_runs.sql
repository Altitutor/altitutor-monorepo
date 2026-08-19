-- Let production-maintenance MCP clients recover and resume durable audit runs
-- without already knowing a run id.

CREATE INDEX idx_ucat_mcp_audit_runs_owner_created_id
  ON public.ucat_mcp_audit_runs(created_by, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_list_audit_runs(
  p_status TEXT DEFAULT NULL,
  p_before_created_at TIMESTAMPTZ DEFAULT NULL,
  p_before_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
  v_limit INTEGER;
  v_runs JSONB;
  v_has_more BOOLEAN;
  v_cursor_created_at TIMESTAMPTZ;
  v_cursor_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status IS NOT NULL
    AND p_status NOT IN ('selecting', 'active', 'completed', 'cancelled')
  THEN
    RAISE EXCEPTION 'invalid_audit_status';
  END IF;
  IF (p_before_created_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_audit_cursor';
  END IF;

  v_staff_id := public.current_tutor_id();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  WITH candidates AS MATERIALIZED (
    SELECT run.*
    FROM public.ucat_mcp_audit_runs run
    WHERE run.created_by = v_staff_id
      AND (p_status IS NULL OR run.status = p_status)
      AND (
        p_before_created_at IS NULL
        OR (run.created_at, run.id) < (p_before_created_at, p_before_id)
      )
    ORDER BY run.created_at DESC, run.id DESC
    LIMIT v_limit + 1
  ),
  visible AS (
    SELECT *
    FROM candidates
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  ),
  enriched AS (
    SELECT
      visible.created_at,
      visible.id,
      jsonb_build_object(
        'run', to_jsonb(visible)
          - 'idempotency_key'
          - 'request_hash',
        'targetCounts', COALESCE((
          SELECT jsonb_object_agg(grouped.status, grouped.count)
          FROM (
            SELECT target.status, COUNT(*)::INTEGER AS count
            FROM public.ucat_mcp_audit_run_targets target
            WHERE target.run_id = visible.id
            GROUP BY target.status
          ) grouped
        ), '{}'::JSONB)
      ) AS item
    FROM visible
  )
  SELECT
    COALESCE(jsonb_agg(item ORDER BY created_at DESC, id DESC), '[]'::JSONB),
    (SELECT COUNT(*) > v_limit FROM candidates)
  INTO v_runs, v_has_more
  FROM enriched;

  IF v_has_more THEN
    SELECT run.created_at, run.id
    INTO v_cursor_created_at, v_cursor_id
    FROM public.ucat_mcp_audit_runs run
    WHERE run.created_by = v_staff_id
      AND (p_status IS NULL OR run.status = p_status)
      AND (
        p_before_created_at IS NULL
        OR (run.created_at, run.id) < (p_before_created_at, p_before_id)
      )
    ORDER BY run.created_at DESC, run.id DESC
    OFFSET v_limit - 1
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'runs', v_runs,
    'nextCursor', CASE WHEN v_has_more THEN jsonb_build_object(
      'createdAt', v_cursor_created_at,
      'id', v_cursor_id
    ) ELSE NULL END,
    'limit', v_limit,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_list_audit_runs(TEXT, TIMESTAMPTZ, UUID, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_list_audit_runs(TEXT, TIMESTAMPTZ, UUID, INTEGER)
  TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_mcp_list_audit_runs(TEXT, TIMESTAMPTZ, UUID, INTEGER) IS
  'Lists durable UCAT MCP audit runs owned by the acting tutor using stable keyset pagination.';
