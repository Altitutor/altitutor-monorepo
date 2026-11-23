-- Keep operational failures and recent successful runs available for diagnosis.
-- Bound each maintenance transaction so old log history drains gradually.
CREATE FUNCTION private.prune_successful_cron_run_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '2s'
AS $function$
DECLARE
  deleted_rows integer;
BEGIN
  WITH expired AS (
    SELECT runid
    FROM cron.job_run_details
    WHERE status = 'succeeded'
      AND end_time < now() - interval '30 days'
    ORDER BY runid
    LIMIT 5000
  )
  DELETE FROM cron.job_run_details AS history
  USING expired
  WHERE history.runid = expired.runid
    AND history.status = 'succeeded'
    AND history.end_time < now() - interval '30 days';

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$function$;

REVOKE ALL ON FUNCTION private.prune_successful_cron_run_history()
  FROM PUBLIC, anon, authenticated, service_role;

DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'prune-successful-cron-run-history',
      '17 * * * *',
      'SELECT private.prune_successful_cron_run_history()'
    );
  END IF;
END;
$schedule$;
