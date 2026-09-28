-- A dedicated secret authenticates the cron call without tying it to a
-- potentially rotated service-role API key. CI installs the same secret in
-- Vault and the Edge Function, then recreates the cron job after deployment.
CREATE OR REPLACE FUNCTION public.get_mobile_push_dispatch_secret()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  secret TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets
    WHERE name = 'mobile_push_dispatch_secret';
  EXCEPTION WHEN OTHERS THEN
    secret := NULL;
  END;
  RETURN NULLIF(secret, '');
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mobile_push_dispatch_secret()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_mobile_push_dispatch_secret() TO postgres;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'mobile-push-dispatch';
  END IF;
END;
$block$;
