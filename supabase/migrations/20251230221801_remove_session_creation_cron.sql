-- Migration: Remove automated session creation cron job
-- Description:
--   - Remove the weekly-session-creation cron job
--   - Sessions should now only be created:
--     1. Automatically when a class is created (via trigger)
--     2. Manually via the precreate_sessions function (button on sessions page)

-- ========================
-- REMOVE CRON JOB
-- ========================

DO $$
BEGIN
  -- Only attempt if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      -- Unschedule the weekly-session-creation cron job if it exists
      PERFORM cron.unschedule('weekly-session-creation')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'weekly-session-creation'
      );
      
      RAISE NOTICE 'Removed weekly-session-creation cron job';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not remove cron job (may not exist): %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Skipping cron job removal.';
  END IF;
END $$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON SCHEMA public IS 'Session creation is now handled automatically via triggers when classes are created, and manually via the precreate_sessions function. The automated cron job has been removed.';

