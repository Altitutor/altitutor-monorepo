-- Keep equal-time Sessions in a consistent order across search pages.
DO $$
DECLARE
  search_rpc constant regprocedure :=
    'public.search_sessions_admin(text,timestamptz,timestamptz,uuid,uuid,uuid,uuid,text[],text[],boolean,integer,integer,text,boolean,uuid)'::regprocedure;
  definition text := pg_get_functiondef(search_rpc);
  sort_tail constant text := E'      start_at ASC\n    LIMIT p_limit OFFSET p_offset';
BEGIN
  IF length(definition) - length(replace(definition, sort_tail, '')) <> length(sort_tail) THEN
    RAISE EXCEPTION 'Expected exactly one session search sort anchor in %', search_rpc;
  END IF;
  EXECUTE replace(definition, sort_tail, E'      start_at ASC, id ASC\n    LIMIT p_limit OFFSET p_offset');
END $$;
