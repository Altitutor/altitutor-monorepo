CREATE OR REPLACE FUNCTION public.ucat_mcp_enforce_audit_change_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'applied'
    AND OLD.status IS DISTINCT FROM 'applied'
    AND NEW.audit_run_id IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS enforce_ucat_mcp_audit_change_application
  ON public.ucat_mcp_content_changes;

CREATE TRIGGER enforce_ucat_mcp_audit_change_application
BEFORE UPDATE OF status ON public.ucat_mcp_content_changes
FOR EACH ROW
EXECUTE FUNCTION public.ucat_mcp_enforce_audit_change_application();

COMMENT ON FUNCTION public.ucat_mcp_enforce_audit_change_application() IS
  'Prevents an audit-scoped pending proposal from bypassing its run write mode or frozen target manifest when later applied.';
