-- Migration: Fix billing cron job setup using Supabase Vault
-- Description:
--   - Update helper functions to use Supabase Vault for secure secret storage
--   - Create billing-runner cron job that will actually work
--   - Uses Vault instead of database settings for better security
--
-- Prerequisites:
--   - Vault secrets must be created before this migration runs:
--     SELECT vault.create_secret('https://your-project.supabase.co', 'project_url');
--     SELECT vault.create_secret('your-service-role-key', 'service_role_key');
--   - For local development, use: http://127.0.0.1:55321

-- ========================
-- UPDATE HELPER FUNCTIONS TO USE VAULT
-- ========================

-- Function to get Supabase URL from Vault (with fallback to database settings)
CREATE OR REPLACE FUNCTION public.get_supabase_url()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  url TEXT;
  project_ref TEXT;
BEGIN
  -- Try to get from Vault first (recommended)
  BEGIN
    SELECT decrypted_secret INTO url 
    FROM vault.decrypted_secrets 
    WHERE name = 'project_url';
    
    IF url IS NOT NULL AND url != '' THEN
      RETURN url;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Vault secret doesn't exist or vault extension not available, continue
  END;
  
  -- Fallback: Try to get from database setting
  BEGIN
    url := current_setting('app.settings.supabase_url', true);
    IF url IS NOT NULL AND url != '' THEN
      RETURN url;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Fallback: Try to construct from project reference
  BEGIN
    project_ref := current_setting('app.settings.project_ref', true);
    IF project_ref IS NOT NULL AND project_ref != '' THEN
      RETURN 'https://' || project_ref || '.supabase.co';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Final fallback: return NULL (cron jobs will need manual configuration)
  RETURN NULL;
END;
$$;

-- Function to get service role key from Vault (with fallback to database settings)
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  key TEXT;
BEGIN
  -- Try to get from Vault first (recommended)
  BEGIN
    SELECT decrypted_secret INTO key 
    FROM vault.decrypted_secrets 
    WHERE name = 'service_role_key';
    
    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Vault secret doesn't exist or vault extension not available, continue
  END;
  
  -- Fallback: Try to get from database setting
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
-- CREATE BILLING-RUNNER CRON JOB
-- ========================

-- Remove existing billing-runner cron job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      -- Check if job exists by name
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-runner') THEN
        PERFORM cron.unschedule('billing-runner');
        RAISE NOTICE 'Removed existing billing-runner cron job';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule existing billing-runner cron job: %', SQLERRM;
    END;
  END IF;
END $$;

-- Create billing-runner cron job
-- Schedule: Daily at 11:30 AM UTC = 10:00 PM Adelaide (ACDT)
-- Note: Adelaide is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
-- This processes tomorrow's sessions for billing
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  cron_job_id BIGINT;
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-runner cron job creation.';
    RETURN;
  END IF;

  -- Check if pg_net is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'pg_net extension not available. Cron job cannot make HTTP requests.';
    RETURN;
  END IF;

  -- Get Supabase URL and service role key
  supabase_url := public.get_supabase_url();
  service_key := public.get_service_role_key();
  
  -- Verify we have both required values
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: Supabase URL not configured. Please create Vault secret: SELECT vault.create_secret(''https://your-project.supabase.co'', ''project_url'');';
    RETURN;
  END IF;
  
  IF service_key IS NULL OR service_key = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: Service role key not configured. Please create Vault secret: SELECT vault.create_secret(''your-service-role-key'', ''service_role_key'');';
    RETURN;
  END IF;
  
  -- Schedule the cron job
  BEGIN
    PERFORM cron.schedule(
      'billing-runner',
      '30 11 * * *', -- 11:30 AM UTC = 10:00 PM Adelaide (ACDT)
      $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/billing-runner',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_service_role_key(),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000 -- 5 minute timeout
      );
      $cron$
    );
    
    RAISE NOTICE 'Billing runner cron job scheduled successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule billing-runner cron job: %', SQLERRM;
  END;
END $$;

-- ========================
-- VERIFICATION QUERIES (for testing)
-- ========================

-- Uncomment to verify cron job was created:
-- SELECT jobid, schedule, jobname, active, command FROM cron.job WHERE jobname = 'billing-runner';

-- Uncomment to verify helper functions work:
-- SELECT public.get_supabase_url() as supabase_url, public.get_service_role_key() IS NOT NULL as has_service_key;

-- ========================
-- COMMENTS AND DOCUMENTATION
-- ========================

COMMENT ON FUNCTION public.get_supabase_url() IS 'Helper function to get Supabase URL from Vault (preferred) or database settings. Configure via: SELECT vault.create_secret(''https://your-project.supabase.co'', ''project_url'');';
COMMENT ON FUNCTION public.get_service_role_key() IS 'Helper function to get service role key from Vault (preferred) or database settings. Configure via: SELECT vault.create_secret(''your-service-role-key'', ''service_role_key'');';

