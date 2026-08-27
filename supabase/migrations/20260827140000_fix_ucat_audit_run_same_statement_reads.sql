-- Audit-run mutation functions return the newly written run through this
-- reader. VOLATILE gives each invocation a current command snapshot, including
-- when callers create and then inspect a run within one SQL statement.

ALTER FUNCTION public.tutor_ucat_mcp_get_audit_run(UUID, INTEGER, INTEGER)
  VOLATILE;

COMMENT ON FUNCTION public.tutor_ucat_mcp_get_audit_run(UUID, INTEGER, INTEGER) IS
  'Returns one UCAT MCP audit run and a bounded target page, including writes made earlier in the current statement.';
