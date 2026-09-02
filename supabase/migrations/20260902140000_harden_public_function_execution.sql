-- Reassert deny-by-default privileges for objects created directly by postgres.
-- Hosted migration machinery can also create objects through supabase_admin,
-- whose default ACL cannot be altered by the project migration role. CI therefore
-- requires every new public object to state its own GRANT or REVOKE contract.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- A SECURITY DEFINER function must never become an anonymous RPC implicitly.
-- Explicit authenticated/service-role grants remain untouched.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT procedure.oid::REGPROCEDURE AS signature
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND has_function_privilege('anon', procedure.oid, 'EXECUTE')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC',
      function_record.signature
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM anon',
      function_record.signature
    );
  END LOOP;
END
$$;
