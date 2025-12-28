-- Migration: Add automated weekly session creation cron job
-- Description:
--   - Enable pg_cron extension (if not already enabled)
--   - Create cron job that runs every Sunday at midnight to precreate sessions for the next 8 weeks
--   - Calls precreate_sessions() function directly

-- ========================
-- ENABLE EXTENSION
-- ========================

-- Enable pg_cron extension (if not already enabled)
-- Note: pg_cron may not be available or may require special permissions in local development
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available or permission denied (this is normal in local development). Cron job will need manual configuration in production via Supabase Dashboard.';
  END;
END $$;

-- ========================
-- CREATE CRON JOB
-- ========================

-- Remove existing cron job if it exists (idempotent)
-- Only attempt if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('weekly-session-creation') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-session-creation');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule existing cron job: %', SQLERRM;
    END;
  END IF;
END $$;

-- Schedule weekly session creation
-- Runs every Sunday at midnight UTC
-- Note: Adelaide timezone is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
-- Midnight Sunday UTC = 10:30 AM Sunday Adelaide (ACDT) or 9:30 AM Sunday Adelaide (ACST)
-- Adjust schedule if you want it to run at a different time
DO $$
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping weekly-session-creation cron job creation.';
    RETURN;
  END IF;

  BEGIN
    PERFORM cron.schedule(
      'weekly-session-creation',
      '0 0 * * 0', -- Every Sunday at midnight UTC
      $cron$
      SELECT public.precreate_sessions(
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '8 weeks',
        NULL, -- created_by (system, NULL is acceptable)
        NULL  -- class_id (all classes)
      );
      $cron$
    );
    RAISE NOTICE 'Weekly session creation cron job scheduled successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule weekly-session-creation cron job: %', SQLERRM;
  END;
END $$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON SCHEMA public IS 'Weekly session creation cron job runs every Sunday at midnight UTC to precreate sessions for the next 8 weeks.';

-- ========================
-- VERIFICATION
-- ========================

-- To verify the cron job was created, run:
-- SELECT * FROM cron.job WHERE jobname = 'weekly-session-creation';
--
-- To manually trigger the cron job for testing:
-- SELECT public.precreate_sessions(CURRENT_DATE, CURRENT_DATE + INTERVAL '8 weeks', NULL, NULL);
--
-- To unschedule the cron job:
-- SELECT cron.unschedule('weekly-session-creation');

