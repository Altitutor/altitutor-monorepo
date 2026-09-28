\set ON_ERROR_STOP on

-- CI supplies the secret through psql; this script never prints its value.
SELECT vault.update_secret(
  secret.id,
  :'dispatch_secret',
  'mobile_push_dispatch_secret',
  'Shared authentication for the mobile push dispatcher'
)
FROM vault.secrets AS secret
WHERE secret.name = 'mobile_push_dispatch_secret';

SELECT vault.create_secret(
  :'dispatch_secret',
  'mobile_push_dispatch_secret',
  'Shared authentication for the mobile push dispatcher'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM vault.secrets AS secret
  WHERE secret.name = 'mobile_push_dispatch_secret'
);

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Mobile push dispatcher requires pg_cron and pg_net.';
  END IF;
  IF public.get_supabase_url() IS NULL
     OR public.get_mobile_push_dispatch_secret() IS NULL THEN
    RAISE EXCEPTION 'Mobile push dispatcher URL or secret is missing.';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'mobile-push-dispatch';

  PERFORM cron.schedule(
    'mobile-push-dispatch',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/mobile-push-dispatch',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_mobile_push_dispatch_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
END;
$block$;
