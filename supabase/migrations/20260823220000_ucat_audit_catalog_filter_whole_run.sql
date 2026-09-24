-- Allow the questions catalog to filter by every stem in a named audit run.

CREATE OR REPLACE FUNCTION public.ucat_is_valid_audit_catalog_filter(p_filter TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_filter = 'not_audited'
    OR p_filter ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
  v_status := NULLIF(SPLIT_PART(p_filter, ':', 2), '');
  v_result := NULLIF(SPLIT_PART(p_filter, ':', 3), '');

  RETURN EXISTS (
    SELECT 1
    FROM public.vtutor_ucat_mcp_audit_run_targets target
    JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
    WHERE target.content_type = 'stem'
      AND target.content_id = p_stem_id
      AND target.run_id = v_run_id
      AND run.status IN ('selecting', 'active', 'completed')
      AND (v_status IS NULL OR target.status = v_status)
      AND (v_result IS NULL OR target.result = v_result)
  );
END;
$$;
