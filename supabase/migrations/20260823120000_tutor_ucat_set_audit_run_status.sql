-- Let UCAT tutors change an audit run's lifecycle status from tutor-web.

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_audit_run_status(
  p_run_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.ucat_mcp_audit_runs;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_status NOT IN ('selecting', 'active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_audit_run_status';
  END IF;

  SELECT run.*
  INTO v_run
  FROM public.ucat_mcp_audit_runs run
  WHERE run.id = p_run_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit_run_not_found';
  END IF;

  IF v_run.status = p_status THEN
    RETURN to_jsonb(v_run);
  END IF;

  IF p_status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM public.ucat_mcp_audit_run_targets target
      WHERE target.run_id = p_run_id
        AND target.status IN ('pending', 'in_progress')
    )
  THEN
    RAISE EXCEPTION 'audit_run_has_unfinished_targets';
  END IF;

  UPDATE public.ucat_mcp_audit_runs run
  SET
    status = p_status,
    started_at = CASE
      WHEN p_status = 'active' THEN COALESCE(run.started_at, NOW())
      ELSE run.started_at
    END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE NULL END
  WHERE run.id = p_run_id
  RETURNING run.* INTO v_run;

  RETURN to_jsonb(v_run);
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_audit_run_status(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_audit_run_status(UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_set_audit_run_status(UUID, TEXT) IS
  'Sets a UCAT audit run lifecycle status from tutor-web after an explicit confirmation.';
