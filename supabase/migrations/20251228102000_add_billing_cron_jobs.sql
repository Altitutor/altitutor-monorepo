-- Migration: Add billing cron jobs using pg_cron
-- Description:
--   - Enable pg_cron extension for scheduling
--   - Enable pg_net extension for HTTP calls to Edge Functions
--   - Create helper function to get Supabase URL and service role key
--   - Create cron jobs for billing-runner, billing-retry, and billing-reconcile
--
-- Note: This migration requires manual configuration of Supabase URL and service role key
-- via database settings or vault. See comments below for configuration steps.

-- ========================
-- ENABLE EXTENSIONS
-- ========================

-- Enable pg_cron extension (if not already enabled)
-- Note: pg_cron may not be available or may require special permissions in local development
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available or permission denied (this is normal in local development). Cron jobs will need manual configuration in production via Supabase Dashboard.';
  END;
END $$;

-- Enable pg_net extension for HTTP calls (if available)
-- Note: pg_net is Supabase's extension for HTTP calls to Edge Functions
DO $$
BEGIN
  -- Try to enable pg_net (Supabase's HTTP extension)
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension not available. Cron jobs will need manual configuration via Supabase Dashboard.';
  END;
END $$;

-- ========================
-- HELPER FUNCTION FOR SUPABASE URL
-- ========================

-- Function to get Supabase URL from current_setting or construct from project reference
CREATE OR REPLACE FUNCTION public.get_supabase_url()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  url TEXT;
  project_ref TEXT;
BEGIN
  -- Try to get from database setting first
  BEGIN
    url := current_setting('app.settings.supabase_url', true);
    IF url IS NOT NULL AND url != '' THEN
      RETURN url;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Try to construct from project reference
  BEGIN
    project_ref := current_setting('app.settings.project_ref', true);
    IF project_ref IS NOT NULL AND project_ref != '' THEN
      RETURN 'https://' || project_ref || '.supabase.co';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Fallback: return NULL (cron jobs will need manual configuration)
  RETURN NULL;
END;
$$;

-- ========================
-- HELPER FUNCTION FOR SERVICE ROLE KEY
-- ========================

-- Function to get service role key from database setting or vault
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  key TEXT;
BEGIN
  -- Try to get from database setting
  BEGIN
    key := current_setting('app.settings.service_role_key', true);
    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Fallback: return NULL (cron jobs will need manual configuration)
  RETURN NULL;
END;
$$;

-- ========================
-- CREATE CRON JOBS
-- ========================

-- Remove existing cron jobs if they exist (idempotent)
-- Only attempt if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('billing-runner') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-runner');
      PERFORM cron.unschedule('billing-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-retry');
      PERFORM cron.unschedule('billing-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-reconcile');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule existing cron jobs: %', SQLERRM;
    END;
  END IF;
END $$;

-- Billing runner (daily at 10 PM Adelaide = 11:30 AM UTC)
-- Note: Adelaide is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
-- 10 PM Adelaide = 11:30 AM UTC (during ACDT) or 12:30 PM UTC (during ACST)
-- Using 11:30 AM UTC as default (adjust if needed)
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-runner cron job creation.';
    RETURN;
  END IF;

  supabase_url := public.get_supabase_url();
  service_key := public.get_service_role_key();
  
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    BEGIN
      PERFORM cron.schedule(
        'billing-runner',
        '30 11 * * *', -- 11:30 AM UTC = 10:00 PM Adelaide (ACDT)
        $cron$
        SELECT pg_net.http_post(
          url := public.get_supabase_url() || '/functions/v1/billing-runner',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || public.get_service_role_key(),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        );
        $cron$
      );
      RAISE NOTICE 'Billing runner cron job scheduled successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to schedule billing-runner cron job: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Cannot schedule billing-runner cron job: Supabase URL or service role key not configured. Please configure manually via Supabase Dashboard or set app.settings.supabase_url and app.settings.service_role_key.';
  END IF;
END $$;

-- Billing retry (every 6 hours)
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-retry cron job creation.';
    RETURN;
  END IF;

  supabase_url := public.get_supabase_url();
  service_key := public.get_service_role_key();
  
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    BEGIN
      PERFORM cron.schedule(
        'billing-retry',
        '0 */6 * * *', -- Every 6 hours
        $cron$
        SELECT pg_net.http_post(
          url := public.get_supabase_url() || '/functions/v1/billing-retry',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || public.get_service_role_key()
          ),
          body := '{}'::jsonb
        );
        $cron$
      );
      RAISE NOTICE 'Billing retry cron job scheduled successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to schedule billing-retry cron job: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Cannot schedule billing-retry cron job: Supabase URL or service role key not configured.';
  END IF;
END $$;

-- Billing reconcile (daily at 2 AM Adelaide = 3:30 PM UTC previous day)
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-reconcile cron job creation.';
    RETURN;
  END IF;

  supabase_url := public.get_supabase_url();
  service_key := public.get_service_role_key();
  
  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    BEGIN
      PERFORM cron.schedule(
        'billing-reconcile',
        '30 15 * * *', -- 3:30 PM UTC = 2:00 AM Adelaide (ACDT)
        $cron$
        SELECT pg_net.http_post(
          url := public.get_supabase_url() || '/functions/v1/billing-reconcile',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || public.get_service_role_key()
          ),
          body := '{}'::jsonb
        );
        $cron$
      );
      RAISE NOTICE 'Billing reconcile cron job scheduled successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to schedule billing-reconcile cron job: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Cannot schedule billing-reconcile cron job: Supabase URL or service role key not configured.';
  END IF;
END $$;

-- ========================
-- COMMENTS AND DOCUMENTATION
-- ========================

COMMENT ON FUNCTION public.get_supabase_url() IS 'Helper function to get Supabase URL from database settings. Configure via: ALTER DATABASE SET app.settings.supabase_url = ''https://your-project.supabase.co'';';
COMMENT ON FUNCTION public.get_service_role_key() IS 'Helper function to get service role key from database settings. Configure via: ALTER DATABASE SET app.settings.service_role_key = ''your-service-role-key'';';

-- ========================
-- MANUAL CONFIGURATION INSTRUCTIONS
-- ========================

-- If cron jobs were not scheduled automatically, configure manually:
--
-- Option 1: Set database settings (recommended)
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
--   Then re-run the cron job creation DO blocks above.
--
-- Option 2: Configure via Supabase Dashboard
--   1. Navigate to Edge Functions > billing-runner
--   2. Click "Invoke" tab
--   3. Set up cron schedule: "30 11 * * *" (11:30 AM UTC = 10 PM Adelaide)
--   4. Method: POST
--   5. Headers: Authorization: Bearer <service-role-key>
--   6. Body: {}
--
-- Option 3: Use pg_cron directly with hardcoded values (not recommended for production)
--   SELECT cron.schedule(
--     'billing-runner',
--     '30 11 * * *',
--     $$
--     SELECT pg_net.http_post(
--       url := 'https://your-project.supabase.co/functions/v1/billing-runner',
--       headers := jsonb_build_object('Authorization', 'Bearer your-service-role-key'),
--       body := '{}'::jsonb
--     );
--     $$
--   );

