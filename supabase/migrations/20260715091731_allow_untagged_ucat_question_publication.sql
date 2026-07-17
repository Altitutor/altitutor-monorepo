-- Tags improve discovery and reconciliation, but are not required for a
-- complete student-facing question. Keep reporting missing tags elsewhere
-- while excluding them from the hard publication gate.

CREATE OR REPLACE FUNCTION public.ucat_content_publication_issues(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB;
  v_enriched JSONB;
BEGIN
  v_issues := public.ucat_content_core_publication_issues(p_content_type, p_content_id);

  SELECT COALESCE(jsonb_agg(
    issue || jsonb_build_object(
      'entity_type', p_content_type,
      'entity_id', p_content_id
    )
  ), '[]'::jsonb)
  INTO v_enriched
  FROM jsonb_array_elements(v_issues) issue
  WHERE issue->>'code' <> 'missing_tags';

  IF p_content_type = 'mock' THEN
    SELECT v_enriched || COALESCE(jsonb_agg(
      issue || jsonb_build_object(
        'entity_type', 'mock',
        'entity_id', p_content_id
      )
    ), '[]'::jsonb)
    INTO v_enriched
    FROM jsonb_array_elements(public.ucat_mock_publication_shape_issues(p_content_id)) issue;
  END IF;

  RETURN v_enriched;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;
