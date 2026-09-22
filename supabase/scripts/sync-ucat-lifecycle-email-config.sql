\set ON_ERROR_STOP on

-- Keep database cron authentication synchronized with the Edge Function
-- secret. Values arrive as psql variables from CI and are never printed.
SELECT vault.update_secret(
  secret.id,
  :'lifecycle_secret',
  'ucat_lifecycle_cron_secret',
  'Shared authentication for UCAT lifecycle and Resend contact-sync jobs'
)
FROM vault.secrets AS secret
WHERE secret.name = 'ucat_lifecycle_cron_secret';

SELECT vault.create_secret(
  :'lifecycle_secret',
  'ucat_lifecycle_cron_secret',
  'Shared authentication for UCAT lifecycle and Resend contact-sync jobs'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM vault.secrets AS secret
  WHERE secret.name = 'ucat_lifecycle_cron_secret'
);

-- psql does not expand variables inside the dollar-quoted DO block below.
-- Store this non-secret deployment switch in the session for PL/pgSQL to read.
SELECT set_config(
  'app.ucat_contact_sync_enabled',
  :'contact_sync_enabled',
  FALSE
);

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'Cannot schedule UCAT lifecycle email jobs: pg_cron or pg_net unavailable.';
  END IF;
  IF public.get_supabase_url() IS NULL THEN
    RAISE EXCEPTION 'Cannot schedule UCAT lifecycle email jobs: project_url is absent from Vault.';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'ucat-lifecycle-emails';

  PERFORM cron.schedule(
    'ucat-lifecycle-emails',
    '17 * * * *',
    $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/ucat-lifecycle-emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_ucat_lifecycle_cron_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{"mode":"send"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'ucat-resend-contact-sync';

  IF current_setting('app.ucat_contact_sync_enabled')::BOOLEAN THEN
    PERFORM cron.schedule(
      'ucat-resend-contact-sync',
      '37 * * * *',
      $cron$
        SELECT net.http_post(
          url := public.get_supabase_url() || '/functions/v1/ucat-resend-contact-sync',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || public.get_ucat_lifecycle_cron_secret(),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        );
      $cron$
    );
  END IF;
END;
$block$;
