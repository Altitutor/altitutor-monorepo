-- Shared UCAT audit-run access, typed target results, and catalog review membership.

ALTER TABLE public.ucat_mcp_audit_run_targets
  ADD COLUMN IF NOT EXISTS result TEXT;

UPDATE public.ucat_mcp_audit_run_targets
SET result = outcome->>'outcome'
WHERE status = 'completed'
  AND result IS NULL
  AND outcome->>'outcome' IN ('updated', 'unchanged');

UPDATE public.ucat_mcp_audit_run_targets
SET result = outcome->>'outcome'
WHERE status = 'skipped'
  AND result IS NULL
  AND outcome->>'outcome' IN ('suggest_delete', 'suggest_split');

ALTER TABLE public.ucat_mcp_audit_run_targets
  DROP CONSTRAINT IF EXISTS ucat_mcp_audit_run_targets_result_check;

ALTER TABLE public.ucat_mcp_audit_run_targets
  ADD CONSTRAINT ucat_mcp_audit_run_targets_result_check
  CHECK (
    result IS NULL
    OR (status = 'completed' AND result IN ('updated', 'unchanged'))
    OR (status = 'skipped' AND result IN ('suggest_delete', 'suggest_split'))
  );

CREATE INDEX IF NOT EXISTS idx_ucat_mcp_audit_targets_content
  ON public.ucat_mcp_audit_run_targets (content_type, content_id);

CREATE OR REPLACE VIEW public.vtutor_ucat_mcp_audit_runs
WITH (security_invoker = false)
AS
SELECT
  run.id,
  run.title,
  run.brief,
  run.status,
  run.published_write_mode,
  run.selector,
  run.workflow_id,
  run.workflow_version,
  run.created_by,
  run.created_at,
  run.started_at,
  run.completed_at,
  run.cancelled_at
FROM public.ucat_mcp_audit_runs run
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_mcp_audit_run_targets
WITH (security_invoker = false)
AS
SELECT
  target.id,
  target.run_id,
  target.content_type,
  target.content_id,
  target.status,
  target.result,
  target.claimed_revision,
  target.outcome,
  target.error_message,
  target.started_at,
  target.completed_at,
  target.created_at
FROM public.ucat_mcp_audit_run_targets target
WHERE public.is_ucat_tutor();

REVOKE ALL ON TABLE public.vtutor_ucat_mcp_audit_runs FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vtutor_ucat_mcp_audit_runs TO authenticated;
REVOKE ALL ON TABLE public.vtutor_ucat_mcp_audit_run_targets FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vtutor_ucat_mcp_audit_run_targets TO authenticated;

CREATE OR REPLACE FUNCTION public.ucat_is_valid_audit_catalog_filter(p_filter TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_filter = 'not_audited'
    OR p_filter ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(pending|in_progress|failed)$'
    OR p_filter ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:completed(:(updated|unchanged))?$'
    OR p_filter ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:skipped(:(suggest_delete|suggest_split))?$';
$$;

CREATE OR REPLACE FUNCTION public.ucat_question_stem_matches_audit_catalog_filter(
  p_stem_id UUID,
  p_filter TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_run_id UUID;
  v_status TEXT;
  v_result TEXT;
BEGIN
  IF p_filter = 'not_audited' THEN
    RETURN NOT EXISTS (
      SELECT 1
      FROM public.vtutor_ucat_mcp_audit_run_targets target
      JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
      WHERE target.content_type = 'stem'
        AND target.content_id = p_stem_id
        AND run.status IN ('selecting', 'active', 'completed')
    );
  END IF;

  v_run_id := SUBSTRING(p_filter FROM 1 FOR 36)::UUID;
  v_status := SPLIT_PART(p_filter, ':', 2);
  v_result := NULLIF(SPLIT_PART(p_filter, ':', 3), '');

  RETURN EXISTS (
    SELECT 1
    FROM public.vtutor_ucat_mcp_audit_run_targets target
    JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
    WHERE target.content_type = 'stem'
      AND target.content_id = p_stem_id
      AND target.run_id = v_run_id
      AND run.status IN ('selecting', 'active', 'completed')
      AND target.status = v_status
      AND (v_result IS NULL OR target.result = v_result)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_is_valid_audit_catalog_filter(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_is_valid_audit_catalog_filter(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.ucat_question_stem_matches_audit_catalog_filter(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_question_stem_matches_audit_catalog_filter(UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_add_audit_targets(
  p_run_id UUID,
  p_targets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target JSONB;
  v_content_type TEXT;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND status = 'selecting'
  ) THEN RAISE EXCEPTION 'audit_run_not_selecting'; END IF;

  FOR v_target IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_targets, '[]'::JSONB))
  LOOP
    v_content_type := v_target->>'contentType';
    PERFORM public.ucat_mcp_assert_target_exists(v_content_type, (v_target->>'id')::UUID);
    INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
    VALUES (p_run_id, v_content_type, (v_target->>'id')::UUID)
    ON CONFLICT (run_id, content_type, content_id) DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('runId', p_run_id, 'insertedCount', v_inserted);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_start_audit_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'active', started_at = NOW()
  WHERE id = p_run_id AND status = 'selecting';
  IF NOT FOUND THEN RAISE EXCEPTION 'audit_run_not_selecting'; END IF;
  RETURN public.tutor_ucat_mcp_get_audit_run(p_run_id, 0, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_claim_audit_targets(
  p_run_id UUID,
  p_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_targets JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'audit_run_not_active'; END IF;

  WITH candidates AS (
    SELECT target.id
    FROM public.ucat_mcp_audit_run_targets target
    WHERE target.run_id = p_run_id AND target.status = 'pending'
    ORDER BY target.created_at, target.id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 1), 1), 25)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.ucat_mcp_audit_run_targets target
    SET status = 'in_progress', started_at = NOW(), error_message = NULL
    FROM candidates
    WHERE target.id = candidates.id
    RETURNING target.id, target.content_type, target.content_id, target.status
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(claimed)), '[]'::JSONB)
  INTO v_targets
  FROM claimed;

  RETURN jsonb_build_object('runId', p_run_id, 'targets', v_targets);
END;
$$;

DROP FUNCTION IF EXISTS public.tutor_ucat_mcp_finish_audit_target(
  UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT
);

CREATE FUNCTION public.tutor_ucat_mcp_finish_audit_target(
  p_run_id UUID,
  p_content_type TEXT,
  p_content_id UUID,
  p_status TEXT,
  p_claimed_revision TEXT,
  p_outcome JSONB,
  p_error_message TEXT,
  p_result TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('completed', 'failed', 'skipped', 'pending') THEN
    RAISE EXCEPTION 'invalid_audit_target_status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'audit_run_not_active'; END IF;

  v_result := NULLIF(BTRIM(COALESCE(p_result, p_outcome->>'outcome')), '');
  IF p_status IN ('pending', 'failed') THEN
    v_result := NULL;
  ELSIF p_status = 'completed' THEN
    IF v_result IS NOT NULL AND v_result NOT IN ('updated', 'unchanged') THEN
      RAISE EXCEPTION 'invalid_audit_target_result';
    END IF;
  ELSIF p_status = 'skipped' THEN
    IF v_result IS NOT NULL AND v_result NOT IN ('suggest_delete', 'suggest_split') THEN
      RAISE EXCEPTION 'invalid_audit_target_result';
    END IF;
  END IF;

  UPDATE public.ucat_mcp_audit_run_targets
  SET
    status = p_status,
    result = v_result,
    claimed_revision = p_claimed_revision,
    outcome = p_outcome,
    error_message = NULLIF(BTRIM(COALESCE(p_error_message, '')), ''),
    started_at = CASE WHEN p_status = 'pending' THEN NULL ELSE started_at END,
    completed_at = CASE WHEN p_status = 'pending' THEN NULL ELSE NOW() END
  WHERE run_id = p_run_id
    AND content_type = p_content_type
    AND content_id = p_content_id
    AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'audit_target_not_in_progress'; END IF;

  RETURN jsonb_build_object(
    'runId', p_run_id,
    'contentType', p_content_type,
    'contentId', p_content_id,
    'status', p_status,
    'result', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_finish_audit_target(
  UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_finish_audit_target(
  UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_complete_audit_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_run_targets
    WHERE run_id = p_run_id AND status IN ('pending', 'in_progress')
  ) THEN RAISE EXCEPTION 'audit_run_has_unfinished_targets'; END IF;
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_run_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'audit_run_not_active'; END IF;
  RETURN public.tutor_ucat_mcp_get_audit_run(p_run_id, 0, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_cancel_audit_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_run_id
    AND status IN ('selecting', 'active');
  IF NOT FOUND THEN RAISE EXCEPTION 'audit_run_not_cancellable'; END IF;
  RETURN public.tutor_ucat_mcp_get_audit_run(p_run_id, 0, 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_get_audit_run(
  p_run_id UUID,
  p_target_offset INTEGER DEFAULT 0,
  p_target_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run JSONB;
  v_targets JSONB;
  v_counts JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT to_jsonb(run) INTO v_run
  FROM public.ucat_mcp_audit_runs run
  WHERE run.id = p_run_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'audit_run_not_found'; END IF;

  SELECT COALESCE(jsonb_object_agg(status, count), '{}'::JSONB)
  INTO v_counts
  FROM (
    SELECT status, COUNT(*)::INTEGER AS count
    FROM public.ucat_mcp_audit_run_targets
    WHERE run_id = p_run_id
    GROUP BY status
  ) grouped;

  SELECT COALESCE(jsonb_agg(to_jsonb(target)), '[]'::JSONB)
  INTO v_targets
  FROM (
    SELECT id, content_type, content_id, status, result, claimed_revision,
      outcome, error_message, started_at, completed_at, created_at
    FROM public.ucat_mcp_audit_run_targets
    WHERE run_id = p_run_id
    ORDER BY created_at, id
    OFFSET GREATEST(COALESCE(p_target_offset, 0), 0)
    LIMIT LEAST(GREATEST(COALESCE(p_target_limit, 100), 1), 500)
  ) target;

  RETURN jsonb_build_object(
    'run', v_run,
    'targetCounts', v_counts,
    'targets', v_targets,
    'targetOffset', GREATEST(COALESCE(p_target_offset, 0), 0),
    'targetLimit', LEAST(GREATEST(COALESCE(p_target_limit, 100), 1), 500)
  );
END;
$$;

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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  WITH candidates AS MATERIALIZED (
    SELECT run.*
    FROM public.ucat_mcp_audit_runs run
    WHERE (p_status IS NULL OR run.status = p_status)
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
    WHERE (p_status IS NULL OR run.status = p_status)
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

COMMENT ON FUNCTION public.tutor_ucat_mcp_list_audit_runs(TEXT, TIMESTAMPTZ, UUID, INTEGER) IS
  'Lists durable UCAT MCP audit runs for any UCAT tutor using stable keyset pagination.';

CREATE OR REPLACE FUNCTION public.ucat_mcp_assert_audit_application(
  p_run_id UUID,
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_run_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_mcp_audit_runs run
    JOIN public.ucat_mcp_audit_run_targets target ON target.run_id = run.id
    WHERE run.id = p_run_id
      AND run.status = 'active'
      AND run.published_write_mode = 'apply_valid_changes'
      AND target.content_type = p_content_type
      AND target.content_id = p_content_id
  ) THEN
    RAISE EXCEPTION 'audit_run_not_authorized_to_apply';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_create_content_change(
  p_target_type TEXT,
  p_target_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_base_snapshot JSONB,
  p_proposed_snapshot JSONB,
  p_operations JSONB,
  p_summary TEXT,
  p_rationale TEXT,
  p_source TEXT,
  p_audit_run_id UUID,
  p_finding_refs JSONB,
  p_reverse_of_change_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current RECORD;
  v_change_id UUID;
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_current FROM public.ucat_mcp_lock_target(p_target_type, p_target_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'mcp_stale_revision';
  END IF;
  IF v_current.kind IS DISTINCT FROM 'folder'::public.ucat_learning_module_kind
    AND v_current.status IS DISTINCT FROM 'published'::public.ucat_content_status THEN
    RAISE EXCEPTION 'mcp_change_proposal_requires_published';
  END IF;
  IF p_source = 'audit_run' AND p_audit_run_id IS NULL THEN
    RAISE EXCEPTION 'audit_run_required';
  END IF;
  v_staff_id := public.current_tutor_id();
  IF p_audit_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_mcp_audit_runs run
    JOIN public.ucat_mcp_audit_run_targets target ON target.run_id = run.id
    WHERE run.id = p_audit_run_id
      AND run.status = 'active'
      AND target.content_type = p_target_type
      AND target.content_id = p_target_id
  ) THEN
    RAISE EXCEPTION 'audit_run_not_authorized_for_target';
  END IF;
  INSERT INTO public.ucat_mcp_content_changes (
    target_type, target_id, source, audit_run_id, base_revision,
    base_snapshot, proposed_snapshot, operations, summary, rationale,
    finding_refs, reverse_of_change_id, created_by
  ) VALUES (
    p_target_type, p_target_id, p_source, p_audit_run_id,
    public.ucat_mcp_authoring_revision(p_target_id, v_current.updated_at),
    p_base_snapshot, p_proposed_snapshot, COALESCE(p_operations, '[]'::JSONB),
    BTRIM(p_summary), NULLIF(BTRIM(COALESCE(p_rationale, '')), ''),
    COALESCE(p_finding_refs, '[]'::JSONB), p_reverse_of_change_id, v_staff_id
  ) RETURNING id INTO v_change_id;
  RETURN jsonb_build_object('id', v_change_id, 'status', 'pending');
END;
$$;

DROP FUNCTION IF EXISTS public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER, BOOLEAN, UUID[]
);

CREATE FUNCTION public.tutor_ucat_list_question_catalog(
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
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(
    result,
    JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'total', 0, 'page', safe_page, 'pageSize', safe_page_size)
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
