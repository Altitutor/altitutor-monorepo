-- After 20260721082329 revoked EXECUTE on SECURITY DEFINER functions from
-- authenticated, activity logging broke: extract_activity_fks_* triggers are
-- SECURITY INVOKER and call log_activity_event (SECURITY DEFINER). The notes
-- (and other entity) insert then fails with PostgREST 403.
--
-- Fix: run extractors as SECURITY DEFINER so they can call log_activity_event
-- without exposing log_activity_event as a client RPC. Trigger functions do
-- not require EXECUTE for the invoking role.

DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'extract_activity_fks_%'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SECURITY DEFINER SET search_path = public',
      function_record.signature
    );
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_record.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', function_record.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_record.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_record.signature);
  END LOOP;
END $$;
