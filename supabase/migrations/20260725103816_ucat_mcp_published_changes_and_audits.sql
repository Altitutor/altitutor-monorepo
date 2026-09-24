-- Durable MCP audit manifests and recoverable content changes.
-- Audit reasoning remains in the calling agent; Postgres owns authorization,
-- optimistic concurrency, lifecycle preservation, and the change ledger.

CREATE TABLE public.ucat_mcp_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (BTRIM(title) <> ''),
  brief TEXT,
  status TEXT NOT NULL DEFAULT 'selecting'
    CHECK (status IN ('selecting', 'active', 'completed', 'cancelled')),
  published_write_mode TEXT NOT NULL DEFAULT 'proposal_only'
    CHECK (published_write_mode IN ('proposal_only', 'apply_valid_changes')),
  selector JSONB NOT NULL DEFAULT '{"kind":"manual"}'::JSONB,
  workflow_id TEXT,
  workflow_version TEXT,
  idempotency_key TEXT NOT NULL CHECK (LENGTH(idempotency_key) BETWEEN 8 AND 200),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_by UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  oauth_client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_ucat_mcp_audit_runs_idempotency
  ON public.ucat_mcp_audit_runs(created_by, oauth_client_id, idempotency_key);
CREATE INDEX idx_ucat_mcp_audit_runs_created_by
  ON public.ucat_mcp_audit_runs(created_by, created_at DESC);
CREATE INDEX idx_ucat_mcp_audit_runs_status
  ON public.ucat_mcp_audit_runs(status, created_at DESC);

CREATE TABLE public.ucat_mcp_audit_run_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ucat_mcp_audit_runs(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('learning_module', 'stem', 'set', 'mock')),
  content_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  claimed_revision TEXT,
  outcome JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, content_type, content_id)
);

CREATE INDEX idx_ucat_mcp_audit_targets_dispatch
  ON public.ucat_mcp_audit_run_targets(run_id, status, created_at);

CREATE TABLE public.ucat_mcp_content_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL
    CHECK (target_type IN ('learning_module', 'stem', 'set', 'mock')),
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'rejected', 'stale')),
  source TEXT NOT NULL
    CHECK (source IN ('interactive_agent', 'audit_run', 'assessment', 'recovery')),
  audit_run_id UUID REFERENCES public.ucat_mcp_audit_runs(id) ON DELETE SET NULL,
  base_revision TEXT NOT NULL,
  resulting_revision TEXT,
  base_snapshot JSONB NOT NULL,
  proposed_snapshot JSONB NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]'::JSONB,
  summary TEXT NOT NULL CHECK (BTRIM(summary) <> ''),
  rationale TEXT,
  finding_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  reverse_of_change_id UUID REFERENCES public.ucat_mcp_content_changes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX idx_ucat_mcp_content_changes_target
  ON public.ucat_mcp_content_changes(target_type, target_id, created_at DESC);
CREATE INDEX idx_ucat_mcp_content_changes_status
  ON public.ucat_mcp_content_changes(status, created_at DESC);
CREATE INDEX idx_ucat_mcp_content_changes_run
  ON public.ucat_mcp_content_changes(audit_run_id, created_at DESC)
  WHERE audit_run_id IS NOT NULL;

ALTER TABLE public.ucat_mcp_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_mcp_audit_run_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_mcp_content_changes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ucat_mcp_audit_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ucat_mcp_audit_run_targets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ucat_mcp_content_changes FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ucat_ai_question_assessment_decisions
  DROP CONSTRAINT IF EXISTS ucat_ai_question_assessment_decisions_decision_check;
ALTER TABLE public.ucat_ai_question_assessment_decisions
  ADD CONSTRAINT ucat_ai_question_assessment_decisions_decision_check
  CHECK (decision IN (
    'dismissed',
    'acknowledged',
    'suggestion_accepted',
    'suggestion_rejected'
  ));
ALTER TABLE public.ucat_ai_question_assessment_decisions
  ADD COLUMN content_change_id UUID
  REFERENCES public.ucat_mcp_content_changes(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.ucat_mcp_assert_target_exists(
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
  IF p_content_type = 'stem' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'question_stem_not_found'; END IF;
  ELSIF p_content_type = 'set' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.question_sets
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'question_set_not_found'; END IF;
  ELSIF p_content_type = 'mock' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ucat_mocks
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'mock_not_found'; END IF;
  ELSIF p_content_type = 'learning_module' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ucat_learning_modules
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'learning_module_not_found'; END IF;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_assert_target_exists(TEXT, UUID) FROM PUBLIC, anon, authenticated;

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

    IF v_content_type = 'stem' THEN
      INSERT INTO public.ucat_mcp_audit_run_targets (run_id, content_type, content_id)
      SELECT v_run_id, 'stem', stem.id
      FROM public.question_stems stem
      WHERE stem.deleted_at IS NULL
        AND (v_status IS NULL OR stem.status = v_status)
        AND (v_access_scope IS NULL OR stem.access_scope = v_access_scope)
        AND (v_section_id IS NULL OR stem.section_id = v_section_id)
        AND (v_category_id IS NULL OR stem.question_stem_category_id = v_category_id);
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
  v_staff_id UUID;
  v_target JSONB;
  v_content_type TEXT;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND created_by = v_staff_id AND status = 'selecting'
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
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'active', started_at = NOW()
  WHERE id = p_run_id AND created_by = v_staff_id AND status = 'selecting';
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
  v_staff_id UUID;
  v_targets JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND created_by = v_staff_id AND status = 'active'
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

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_finish_audit_target(
  p_run_id UUID,
  p_content_type TEXT,
  p_content_id UUID,
  p_status TEXT,
  p_claimed_revision TEXT,
  p_outcome JSONB,
  p_error_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('completed', 'failed', 'skipped', 'pending') THEN
    RAISE EXCEPTION 'invalid_audit_target_status';
  END IF;
  v_staff_id := public.current_tutor_id();
  IF NOT EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_runs
    WHERE id = p_run_id AND created_by = v_staff_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'audit_run_not_active'; END IF;

  UPDATE public.ucat_mcp_audit_run_targets
  SET
    status = p_status,
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
    'status', p_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_complete_audit_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF EXISTS (
    SELECT 1 FROM public.ucat_mcp_audit_run_targets
    WHERE run_id = p_run_id AND status IN ('pending', 'in_progress')
  ) THEN RAISE EXCEPTION 'audit_run_has_unfinished_targets'; END IF;
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_run_id AND created_by = v_staff_id AND status = 'active';
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
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  UPDATE public.ucat_mcp_audit_runs
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_run_id
    AND created_by = v_staff_id
    AND oauth_client_id IS NOT DISTINCT FROM (SELECT auth.jwt()->>'client_id')
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
  v_staff_id UUID;
  v_run JSONB;
  v_targets JSONB;
  v_counts JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  SELECT to_jsonb(run) INTO v_run
  FROM public.ucat_mcp_audit_runs run
  WHERE run.id = p_run_id AND run.created_by = v_staff_id;
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
    SELECT id, content_type, content_id, status, claimed_revision,
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

CREATE OR REPLACE FUNCTION public.ucat_mcp_lock_target(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS TABLE(updated_at TIMESTAMPTZ, status public.ucat_content_status, kind public.ucat_learning_module_kind)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_content_type = 'stem' THEN
    RETURN QUERY SELECT item.updated_at, item.status, NULL::public.ucat_learning_module_kind
    FROM public.question_stems item
    WHERE item.id = p_content_id AND item.deleted_at IS NULL FOR UPDATE;
  ELSIF p_content_type = 'set' THEN
    RETURN QUERY SELECT item.updated_at, item.status, NULL::public.ucat_learning_module_kind
    FROM public.question_sets item
    WHERE item.id = p_content_id AND item.deleted_at IS NULL FOR UPDATE;
  ELSIF p_content_type = 'mock' THEN
    RETURN QUERY SELECT item.updated_at, item.status, NULL::public.ucat_learning_module_kind
    FROM public.ucat_mocks item
    WHERE item.id = p_content_id AND item.deleted_at IS NULL FOR UPDATE;
  ELSIF p_content_type = 'learning_module' THEN
    RETURN QUERY SELECT item.updated_at, item.status, item.kind
    FROM public.ucat_learning_modules item
    WHERE item.id = p_content_id AND item.deleted_at IS NULL FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_lock_target(TEXT, UUID) FROM PUBLIC, anon, authenticated;

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
DECLARE
  v_staff_id UUID;
BEGIN
  IF p_run_id IS NULL THEN RETURN; END IF;
  v_staff_id := public.current_tutor_id();
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_mcp_audit_runs run
    JOIN public.ucat_mcp_audit_run_targets target ON target.run_id = run.id
    WHERE run.id = p_run_id
      AND run.created_by = v_staff_id
      AND run.oauth_client_id IS NOT DISTINCT FROM (SELECT auth.jwt()->>'client_id')
      AND run.status = 'active'
      AND run.published_write_mode = 'apply_valid_changes'
      AND target.content_type = p_content_type
      AND target.content_id = p_content_id
  ) THEN
    RAISE EXCEPTION 'audit_run_not_authorized_to_apply';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_assert_audit_application(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

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
      AND run.created_by = v_staff_id
      AND run.oauth_client_id IS NOT DISTINCT FROM (SELECT auth.jwt()->>'client_id')
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

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_apply_content_change(
  p_existing_change_id UUID,
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
  v_after_updated_at TIMESTAMPTZ;
  v_after_status public.ucat_content_status;
  v_change_id UUID;
  v_staff_id UUID;
  v_existing public.ucat_mcp_content_changes%ROWTYPE;
  v_module_id UUID;
  v_issue JSONB;
  v_ref JSONB;
  v_assessment_run RECORD;
  v_finding JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_current FROM public.ucat_mcp_lock_target(p_target_type, p_target_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    IF p_existing_change_id IS NOT NULL THEN
      UPDATE public.ucat_mcp_content_changes
      SET status = 'stale'
      WHERE id = p_existing_change_id AND status = 'pending';
    END IF;
    RAISE EXCEPTION 'mcp_stale_revision';
  END IF;

  IF p_audit_run_id IS NOT NULL THEN
    PERFORM public.ucat_mcp_assert_audit_application(
      p_audit_run_id, p_target_type, p_target_id
    );
  END IF;

  v_staff_id := public.current_tutor_id();
  IF p_existing_change_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.ucat_mcp_content_changes
    WHERE id = p_existing_change_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND status = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'content_change_not_pending'; END IF;
    IF v_existing.base_revision <> public.ucat_mcp_authoring_revision(p_target_id, v_current.updated_at) THEN
      UPDATE public.ucat_mcp_content_changes SET status = 'stale' WHERE id = p_existing_change_id;
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
    v_change_id := v_existing.id;
    p_base_snapshot := v_existing.base_snapshot;
    p_proposed_snapshot := v_existing.proposed_snapshot;
    p_operations := v_existing.operations;
    p_summary := v_existing.summary;
    p_rationale := v_existing.rationale;
    p_source := v_existing.source;
    p_audit_run_id := v_existing.audit_run_id;
    p_finding_refs := v_existing.finding_refs;
    p_reverse_of_change_id := v_existing.reverse_of_change_id;
  ELSE
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
  END IF;

  IF p_target_type = 'stem' THEN
    PERFORM public.tutor_ucat_upsert_question_stem_bundle(
      p_target_id,
      (p_proposed_snapshot->>'sectionId')::UUID,
      NULLIF(p_proposed_snapshot->>'categoryId', '')::UUID,
      COALESCE(p_proposed_snapshot->'stemText', '{}'::JSONB),
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(p_proposed_snapshot->'questions', '[]'::JSONB),
      'ai_generation',
      p_proposed_snapshot->>'tutorSourceNote'
    );
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.question_stems WHERE id = p_target_id;
  ELSIF p_target_type = 'set' THEN
    PERFORM public.tutor_ucat_upsert_question_set(
      p_target_id,
      p_proposed_snapshot->'name',
      COALESCE(p_proposed_snapshot->'description', '{}'::JSONB),
      NULLIF(p_proposed_snapshot->>'timeLimitSeconds', '')::INTEGER,
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(p_proposed_snapshot->'stemIds', '[]'::JSONB)
    );
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.question_sets WHERE id = p_target_id;
  ELSIF p_target_type = 'mock' THEN
    PERFORM public.tutor_ucat_upsert_mock(
      p_target_id,
      p_proposed_snapshot->>'name',
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(p_proposed_snapshot->'setIds', '[]'::JSONB),
      NULLIF(p_proposed_snapshot->'instructionsText', 'null'::JSONB)
    );
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.ucat_mocks WHERE id = p_target_id;
  ELSIF p_target_type = 'learning_module' THEN
    v_module_id := public.tutor_ucat_upsert_learning_module(
      p_target_id,
      (p_proposed_snapshot->>'kind')::public.ucat_learning_module_kind,
      p_proposed_snapshot->>'title',
      p_proposed_snapshot->>'description',
      NULLIF(p_proposed_snapshot->>'sectionId', '')::UUID,
      NULLIF(p_proposed_snapshot->>'parentId', '')::UUID,
      COALESCE((p_proposed_snapshot->>'index')::INTEGER, 0),
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(NULLIF(p_proposed_snapshot->>'iconKey', ''), 'book-open'),
      NULLIF(p_proposed_snapshot->>'estimatedMinutes', '')::INTEGER
    );
    PERFORM public.tutor_ucat_update_learning_module_study_plan_metadata(
      v_module_id,
      COALESCE(NULLIF(p_proposed_snapshot->>'studyPlanPriority', ''), 'recommended'),
      ARRAY(
        SELECT value::UUID
        FROM jsonb_array_elements_text(
          COALESCE(p_proposed_snapshot->'studyPlanCategoryIds', '[]'::JSONB)
        )
      ),
      ARRAY(
        SELECT value::UUID
        FROM jsonb_array_elements_text(
          COALESCE(p_proposed_snapshot->'studyPlanTagIds', '[]'::JSONB)
        )
      )
    );
    IF p_proposed_snapshot->>'kind' = 'lesson' THEN
      PERFORM public.tutor_ucat_replace_learning_module_blocks(
        v_module_id,
        COALESCE(p_proposed_snapshot->'blocks', '[]'::JSONB)
      );
    END IF;
    UPDATE public.ucat_learning_modules
    SET updated_at = NOW(), updated_by = v_staff_id
    WHERE id = v_module_id
    RETURNING updated_at, status INTO v_after_updated_at, v_after_status;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF v_current.kind IS DISTINCT FROM 'folder'::public.ucat_learning_module_kind
    AND v_current.status IS DISTINCT FROM v_after_status THEN
    RAISE EXCEPTION 'mcp_content_lifecycle_changed';
  END IF;

  UPDATE public.ucat_mcp_content_changes
  SET
    status = 'applied',
    resulting_revision = public.ucat_mcp_authoring_revision(p_target_id, v_after_updated_at),
    applied_by = v_staff_id,
    applied_at = NOW()
  WHERE id = v_change_id;

  FOR v_ref IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_finding_refs, '[]'::JSONB))
  LOOP
    IF v_ref->>'assessmentRunId' IS NULL OR v_ref->>'findingKey' IS NULL THEN
      CONTINUE;
    END IF;
    SELECT run.id, run.stem_id, run.content_fingerprint, run.assessment_result, cycle.is_current
    INTO v_assessment_run
    FROM public.ucat_ai_question_assessment_runs run
    JOIN public.ucat_ai_question_assessment_cycles cycle ON cycle.id = run.cycle_id
    WHERE run.id = (v_ref->>'assessmentRunId')::UUID
      AND run.status = 'completed'
      AND run.stem_id = p_target_id;
    IF NOT FOUND OR v_assessment_run.is_current IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'assessment_finding_stale';
    END IF;
    SELECT value INTO v_finding
    FROM jsonb_array_elements(
      COALESCE(v_assessment_run.assessment_result->'findings', '[]'::JSONB)
    )
    WHERE value->>'key' = v_ref->>'findingKey'
    LIMIT 1;
    IF v_finding IS NULL THEN RAISE EXCEPTION 'assessment_finding_not_found'; END IF;
    INSERT INTO public.ucat_ai_question_assessment_decisions (
      run_id, stem_id, finding_key, decision, reason,
      reviewed_content_fingerprint, patch, decided_by, content_change_id
    ) VALUES (
      v_assessment_run.id, p_target_id, v_ref->>'findingKey',
      CASE
        WHEN COALESCE((v_ref->>'appliedExactSuggestion')::BOOLEAN, false)
          THEN 'suggestion_accepted'
        ELSE 'acknowledged'
      END,
      NULLIF(BTRIM(COALESCE(v_ref->>'reason', '')), ''),
      v_assessment_run.content_fingerprint,
      CASE
        WHEN COALESCE((v_ref->>'appliedExactSuggestion')::BOOLEAN, false)
          THEN v_finding->'suggestion'->'patches'
        ELSE NULL
      END,
      v_staff_id,
      v_change_id
    );
  END LOOP;

  PERFORM public.ucat_mcp_record_activity(
    CASE p_target_type
      WHEN 'stem' THEN 'question_stems'
      WHEN 'set' THEN 'question_sets'
      WHEN 'mock' THEN 'ucat_mocks'
      ELSE 'ucat_learning_modules'
    END,
    p_target_id,
    'UPDATED',
    CASE
      WHEN p_source = 'assessment' THEN 'accept_question_ai_assessment_suggestion'
      WHEN p_source = 'recovery' THEN 'restore_published_content_change'
      ELSE 'apply_published_content_change'
    END,
    v_current.updated_at,
    v_after_updated_at,
    COALESCE(p_operations, '[]'::JSONB)
  );

  RETURN jsonb_build_object(
    'id', p_target_id,
    'status', v_after_status,
    'revision', public.ucat_mcp_authoring_revision(p_target_id, v_after_updated_at),
    'changeId', v_change_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_reject_content_change(
  p_change_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  UPDATE public.ucat_mcp_content_changes
  SET status = 'rejected', rejected_by = v_staff_id, rejected_at = NOW(),
    rejection_reason = NULLIF(BTRIM(COALESCE(p_reason, '')), '')
  WHERE id = p_change_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'content_change_not_pending'; END IF;
  RETURN jsonb_build_object('id', p_change_id, 'status', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_get_content_changes(
  p_change_id UUID DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_audit_run_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(change_row)), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT change.*
    FROM public.ucat_mcp_content_changes change
    WHERE (p_change_id IS NULL OR change.id = p_change_id)
      AND (p_target_type IS NULL OR change.target_type = p_target_type)
      AND (p_target_id IS NULL OR change.target_id = p_target_id)
      AND (p_audit_run_id IS NULL OR change.audit_run_id = p_audit_run_id)
      AND (p_status IS NULL OR change.status = p_status)
    ORDER BY change.created_at DESC
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) change_row;
  RETURN jsonb_build_object(
    'items', v_items,
    'offset', GREATEST(COALESCE(p_offset, 0), 0),
    'limit', LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_record_assessment_decision(
  p_run_id UUID,
  p_stem_id UUID,
  p_finding_key TEXT,
  p_decision TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
  v_run RECORD;
  v_finding JSONB;
  v_decision_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_decision NOT IN ('dismissed', 'acknowledged', 'suggestion_rejected') THEN
    RAISE EXCEPTION 'invalid_assessment_decision';
  END IF;
  IF p_decision = 'dismissed' AND NULLIF(BTRIM(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'assessment_dismissal_reason_required';
  END IF;

  SELECT run.id, run.stem_id, run.content_fingerprint, run.assessment_result, cycle.is_current
  INTO v_run
  FROM public.ucat_ai_question_assessment_runs run
  JOIN public.ucat_ai_question_assessment_cycles cycle ON cycle.id = run.cycle_id
  WHERE run.id = p_run_id AND run.stem_id = p_stem_id AND run.status = 'completed';
  IF NOT FOUND THEN RAISE EXCEPTION 'assessment_finding_unavailable'; END IF;
  IF v_run.is_current IS DISTINCT FROM true THEN RAISE EXCEPTION 'assessment_finding_stale'; END IF;
  SELECT value INTO v_finding
  FROM jsonb_array_elements(COALESCE(v_run.assessment_result->'findings', '[]'::JSONB))
  WHERE value->>'key' = p_finding_key
  LIMIT 1;
  IF v_finding IS NULL THEN RAISE EXCEPTION 'assessment_finding_not_found'; END IF;
  IF p_decision = 'suggestion_rejected' AND v_finding->'suggestion' IS NULL THEN
    RAISE EXCEPTION 'assessment_suggestion_not_found';
  END IF;

  v_staff_id := public.current_tutor_id();
  INSERT INTO public.ucat_ai_question_assessment_decisions (
    run_id, stem_id, finding_key, decision, reason,
    reviewed_content_fingerprint, patch, decided_by
  ) VALUES (
    p_run_id, p_stem_id, p_finding_key, p_decision,
    NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
    v_run.content_fingerprint,
    CASE WHEN p_decision = 'suggestion_rejected'
      THEN v_finding->'suggestion'->'patches' ELSE NULL END,
    v_staff_id
  ) RETURNING id INTO v_decision_id;

  RETURN jsonb_build_object('id', v_decision_id, 'decision', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_create_audit_run(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_add_audit_targets(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_start_audit_run(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_claim_audit_targets(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_finish_audit_target(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_complete_audit_run(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_cancel_audit_run(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_get_audit_run(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_create_content_change(
  TEXT, UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID, JSONB, UUID
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_apply_content_change(
  UUID, TEXT, UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID, JSONB, UUID
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_reject_content_change(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_get_content_changes(
  UUID, TEXT, UUID, UUID, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_record_assessment_decision(UUID, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_create_audit_run(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_add_audit_targets(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_start_audit_run(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_claim_audit_targets(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_finish_audit_target(UUID, TEXT, UUID, TEXT, TEXT, JSONB, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_complete_audit_run(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_cancel_audit_run(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_get_audit_run(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_create_content_change(
  TEXT, UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID, JSONB, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_apply_content_change(
  UUID, TEXT, UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID, JSONB, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_reject_content_change(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_get_content_changes(
  UUID, TEXT, UUID, UUID, TEXT, INTEGER, INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_record_assessment_decision(UUID, UUID, TEXT, TEXT, TEXT)
  TO authenticated;

COMMENT ON TABLE public.ucat_mcp_audit_runs IS
  'Agent-orchestrated UCAT audit manifests; audit prompts and reasoning remain client-side.';
COMMENT ON TABLE public.ucat_mcp_content_changes IS
  'Recoverable proposed and applied MCP content changes against exact authoring revisions.';
