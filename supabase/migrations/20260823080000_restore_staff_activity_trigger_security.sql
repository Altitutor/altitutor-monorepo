-- A staff-cascade activity migration recreated these trigger functions as
-- SECURITY INVOKER, preventing authenticated ADMINSTAFF writes from reaching
-- the private log_activity_event helper. Restore the private trigger boundary
-- without exposing log_activity_event as a client-callable RPC.

DO $$
DECLARE
  function_name TEXT;
  function_signature REGPROCEDURE;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'extract_activity_fks_classes_staff',
    'extract_activity_fks_sessions_staff',
    'extract_activity_fks_tutor_logs_staff_attendance',
    'extract_activity_fks_admin_shifts_staff'
  ]
  LOOP
    function_signature := to_regprocedure(format('public.%I()', function_name));

    IF function_signature IS NULL THEN
      RAISE EXCEPTION 'Expected activity trigger function public.%() does not exist',
        function_name;
    END IF;

    EXECUTE format(
      'ALTER FUNCTION %s SECURITY DEFINER SET search_path = public',
      function_signature
    );
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', function_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_signature);
  END LOOP;
END;
$$;
