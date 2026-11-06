-- Build the exclusion set once for the MCP search's standalone unaudited filter.
-- Keep the general expression evaluator for mixed and nested audit filters.
DO $$
DECLARE
  search_rpc constant regprocedure :=
    'public.tutor_ucat_mcp_search_question_stems(jsonb,boolean,text,text[],text,text,integer,integer,boolean)'::regprocedure;
  definition text := pg_get_functiondef(search_rpc);
  filter_declaration constant text := '  v_filter JSONB;';
  filter_assignment constant text :=
    '  v_filter := public.ucat_question_catalog_compose_filter(COALESCE(p_payload, ''{}''::JSONB));';
  filter_predicate constant text := E'      AND (\n        v_filter IS NULL';
  anchor text;
BEGIN
  FOREACH anchor IN ARRAY ARRAY[filter_declaration, filter_assignment, filter_predicate] LOOP
    IF length(definition) - length(replace(definition, anchor, '')) <> length(anchor) THEN
      RAISE EXCEPTION 'Expected exactly one MCP stem search filter anchor in %', search_rpc;
    END IF;
  END LOOP;

  definition := replace(definition, filter_declaration, $body$  v_filter JSONB;
  v_only_unaudited BOOLEAN;$body$);
  definition := replace(definition, filter_assignment, filter_assignment || $body$
  v_only_unaudited := COALESCE(
    NOT (v_filter ?| ARRAY['all', 'any'])
      AND v_filter #> '{clause,auditFilters}' = '["not_audited"]'::JSONB,
    FALSE
  );
  IF v_only_unaudited THEN
    v_filter := v_filter #- '{clause,auditFilters}';
  END IF;$body$);
  -- Audit targets have non-null content IDs, so NOT IN is equivalent to the per-stem NOT EXISTS.
  definition := replace(definition, filter_predicate, $body$      AND (
        NOT v_only_unaudited OR catalog.id NOT IN (
          SELECT target.content_id
          FROM public.vtutor_ucat_mcp_audit_run_targets target
          JOIN public.vtutor_ucat_mcp_audit_runs run ON run.id = target.run_id
          WHERE target.content_type = 'stem'
            AND run.status IN ('selecting', 'active', 'completed')
        )
      )
      AND (
        v_filter IS NULL$body$);

  EXECUTE definition;
END $$;
