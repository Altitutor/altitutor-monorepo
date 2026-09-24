-- Allow UCAT tutors to manage active audit targets from the web audit board.

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_audit_target_status(
  p_target_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.ucat_mcp_audit_run_targets;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_status NOT IN ('pending', 'in_progress', 'completed', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'invalid_audit_target_status';
  END IF;

  SELECT target.*
  INTO v_target
  FROM public.ucat_mcp_audit_run_targets target
  JOIN public.ucat_mcp_audit_runs run ON run.id = target.run_id
  WHERE target.id = p_target_id
    AND run.status = 'active'
  FOR UPDATE OF target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit_target_not_active';
  END IF;

  UPDATE public.ucat_mcp_audit_run_targets target
  SET
    status = p_status,
    result = NULL,
    outcome = NULL,
    error_message = CASE
      WHEN p_status = 'failed' THEN COALESCE(target.error_message, 'Manually marked as failed')
      ELSE NULL
    END,
    claimed_revision = CASE WHEN p_status = 'pending' THEN NULL ELSE target.claimed_revision END,
    started_at = CASE
      WHEN p_status = 'pending' THEN NULL
      ELSE COALESCE(target.started_at, NOW())
    END,
    completed_at = CASE
      WHEN p_status IN ('completed', 'failed', 'skipped') THEN NOW()
      ELSE NULL
    END
  WHERE target.id = p_target_id
  RETURNING target.* INTO v_target;

  RETURN to_jsonb(v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_audit_target_status(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_audit_target_status(UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_set_audit_target_status(UUID, TEXT) IS
  'Moves a target on an active UCAT audit board and clears workflow-owned result fields.';
