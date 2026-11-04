-- Fresh CLI stacks finish initializing Storage after application migrations.
-- The deployment step installs this guard after initialization; uploads fail closed until then.
CREATE FUNCTION public.teaching_private_storage_ready()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid='storage.objects'::regclass AND p.polname='teaching_private_server_only'
      AND NOT p.polpermissive AND p.polcmd='*'
      AND p.polroles @> ARRAY['anon'::regrole::oid,'authenticated'::regrole::oid]
      AND p.polqual IS NOT NULL AND p.polwithcheck IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.teaching_private_storage_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.teaching_private_storage_ready() TO service_role;
