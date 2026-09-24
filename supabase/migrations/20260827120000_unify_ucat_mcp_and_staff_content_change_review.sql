-- Unify UCAT MCP authoring and let staff review pending changes without
-- weakening MCP audit-run application policy.

ALTER TABLE public.ucat_mcp_audit_runs
  ALTER COLUMN published_write_mode SET DEFAULT 'apply_valid_changes';

CREATE OR REPLACE FUNCTION public.ucat_mcp_enforce_audit_change_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'applied'
    AND OLD.status IS DISTINCT FROM 'applied'
    AND NEW.audit_run_id IS NOT NULL
    AND COALESCE(
      current_setting('app.ucat_staff_content_change_review', true),
      'off'
    ) IS DISTINCT FROM 'on' THEN
    PERFORM public.ucat_mcp_assert_audit_application(
      NEW.audit_run_id,
      NEW.target_type,
      NEW.target_id
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mcp_enforce_audit_change_application()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_review_content_change(
  p_change_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_change public.ucat_mcp_content_changes%ROWTYPE;
  v_current RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_decision NOT IN ('apply', 'reject') THEN
    RAISE EXCEPTION 'invalid_content_change_review_decision';
  END IF;

  IF p_decision = 'reject' THEN
    RETURN public.tutor_ucat_mcp_reject_content_change(p_change_id, p_reason);
  END IF;

  SELECT * INTO v_change
  FROM public.ucat_mcp_content_changes
  WHERE id = p_change_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'content_change_not_pending'; END IF;

  SELECT * INTO v_current
  FROM public.ucat_mcp_lock_target(v_change.target_type, v_change.target_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;

  IF v_change.base_revision IS DISTINCT FROM public.ucat_mcp_authoring_revision(
    v_change.target_id,
    v_current.updated_at
  ) THEN
    UPDATE public.ucat_mcp_content_changes
    SET status = 'stale'
    WHERE id = v_change.id;
    RETURN jsonb_build_object('id', v_change.id, 'status', 'stale');
  END IF;

  -- Only this SECURITY DEFINER review function sets the transaction-local flag.
  -- MCP application continues to require the audit run's live-write mode.
  PERFORM set_config('app.ucat_staff_content_change_review', 'on', true);

  RETURN public.tutor_ucat_mcp_apply_content_change(
    v_change.id,
    v_change.target_type,
    v_change.target_id,
    v_current.updated_at,
    v_change.base_snapshot,
    v_change.proposed_snapshot,
    v_change.operations,
    v_change.summary,
    v_change.rationale,
    v_change.source,
    NULL,
    v_change.finding_refs,
    v_change.reverse_of_change_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_review_content_change(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_review_content_change(UUID, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_review_content_change(UUID, TEXT, TEXT) IS
  'Applies or rejects one pending UCAT content change after explicit tutor-web staff review; MCP audit-run write policy remains enforced for MCP application.';
