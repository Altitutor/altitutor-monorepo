BEGIN;
SELECT plan(7);

-- Exercise the exact cleanup routine even on disposable stacks without pg_cron.
DO $fixture$
BEGIN
  IF to_regclass('cron.job_run_details') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS cron;
    CREATE TABLE cron.job_run_details (
      runid bigint PRIMARY KEY,
      jobid bigint,
      database text,
      username text,
      command text,
      status text,
      start_time timestamptz,
      end_time timestamptz
    );
  END IF;
END;
$fixture$;

INSERT INTO cron.job_run_details (
  runid, jobid, database, username, command, status, start_time, end_time
)
SELECT run_id, -1, current_database(), current_user, 'SELECT 1', 'succeeded',
  now() - interval '41 days', now() - interval '40 days'
FROM generate_series(-25000, -20000) AS run_id
UNION ALL
SELECT fixture.run_id, -1, current_database(), current_user, 'SELECT 1',
  fixture.status, now() - interval '41 days', fixture.end_time
FROM (VALUES
  (-19000, 'succeeded', now() - interval '30 days'),
  (-18999, 'succeeded', now() - interval '2 days'),
  (-18998, 'failed', now() - interval '40 days'),
  (-18997, 'running', NULL),
  (-18996, 'succeeded', NULL)
) AS fixture(run_id, status, end_time);

SELECT is(private.prune_successful_cron_run_history(), 5000,
  'the cleanup deletes at most one batch per run');

SELECT is(
  (SELECT array_agg(runid) FROM cron.job_run_details WHERE runid BETWEEN -25000 AND -20000),
  ARRAY[-20000]::bigint[],
  'the remaining expired success can be drained by the next run'
);

SELECT is(private.prune_successful_cron_run_history(), 1,
  'a second run drains the remaining expired success');
SELECT is(private.prune_successful_cron_run_history(), 0, 'a rerun is safe once caught up');

SELECT is(
  (SELECT array_agg(runid ORDER BY runid) FROM cron.job_run_details WHERE runid BETWEEN -19000 AND -18996),
  ARRAY[-19000, -18999, -18998, -18997, -18996]::bigint[],
  'cutoff-boundary, recent, failed and unfinished runs survive'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'private.prune_successful_cron_run_history()', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'private.prune_successful_cron_run_history()', 'EXECUTE'),
  'the cleanup is available to the scheduler owner and not exposed as an app operation'
);

SELECT CASE WHEN to_regclass('cron.job') IS NULL THEN skip('pg_cron is not preloaded locally')
  ELSE results_eq(
    $$SELECT schedule, command, active FROM cron.job WHERE jobname = 'prune-successful-cron-run-history'$$,
    $$VALUES ('17 * * * *'::text, 'SELECT private.prune_successful_cron_run_history()'::text, true)$$,
    'the deployment registers one active hourly cleanup job'
  )
END;

SELECT * FROM finish();
ROLLBACK;
