-- Migration: Add custom cron secret authentication for billing-runner
-- Description:
--   - Create helper function to get billing cron secret from Vault
--   - Update billing-runner cron job to use custom secret instead of service role key
--   - This provides better security and control over cron job authentication
--
-- Prerequisites:
--   - Vault secret must be created before this migration runs:
--     SELECT vault.create_secret('your-random-secret-key-here', 'billing_cron_secret');
--   - Edge Function must have BILLING_CRON_SECRET_KEY environment variable set
--     (set via Supabase Dashboard > Edge Functions > billing-runner > Settings > Secrets)
--
-- Security Note:
--   - The billing_cron_secret should be a long, random string (e.g., 32+ characters)
--   - This secret is separate from the service role key, providing better security
--   - Only cron jobs and the edge function need to know this secret
--   - Admin users can still access via x-admin-token header (like billing-single)

-- ========================
-- CREATE HELPER FUNCTION
-- ========================

-- Function to get billing cron secret from Vault (with fallback to database settings)
CREATE OR REPLACE FUNCTION public.get_billing_cron_secret()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  secret TEXT;
BEGIN
  -- Try to get from Vault first (recommended)
  BEGIN
    SELECT decrypted_secret INTO secret 
    FROM vault.decrypted_secrets 
    WHERE name = 'billing_cron_secret';
    
    IF secret IS NOT NULL AND secret != '' THEN
      RETURN secret;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Vault secret doesn't exist or vault extension not available, continue
  END;
  
  -- Fallback: Try to get from database setting
  BEGIN
    secret := current_setting('app.settings.billing_cron_secret', true);
    IF secret IS NOT NULL AND secret != '' THEN
      RETURN secret;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist, continue
  END;
  
  -- Fallback: return NULL (cron jobs will need manual configuration)
  RETURN NULL;
END;
$$;

-- Restrict access to postgres role only (same as other helper functions)
REVOKE EXECUTE ON FUNCTION public.get_billing_cron_secret() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billing_cron_secret() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_billing_cron_secret() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_billing_cron_secret() FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_billing_cron_secret() TO postgres;

-- Ensure search_path is set for security
ALTER FUNCTION public.get_billing_cron_secret() SET search_path = public;

COMMENT ON FUNCTION public.get_billing_cron_secret() IS 
'Secure helper function to get billing cron secret from Vault (preferred) or database settings. 
Only accessible to postgres role (for cron jobs). 
Configure via: SELECT vault.create_secret(''your-random-secret-key-here'', ''billing_cron_secret'');';

-- ========================
-- UPDATE BILLING-RUNNER CRON JOB
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

-- Create billing-runner cron job with new authentication
-- Schedule: Daily at 11:30 AM UTC = 10:00 PM Adelaide (ACDT)
DO $$
DECLARE
  supabase_url TEXT;
  cron_secret TEXT;
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

  -- Get Supabase URL and billing cron secret
  supabase_url := public.get_supabase_url();
  cron_secret := public.get_billing_cron_secret();
  
  -- Verify we have both required values
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: Supabase URL not configured. Please create Vault secret: SELECT vault.create_secret(''https://your-project.supabase.co'', ''project_url'');';
    RETURN;
  END IF;
  
  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: Billing cron secret not configured. Please create Vault secret: SELECT vault.create_secret(''your-random-secret-key-here'', ''billing_cron_secret'');';
    RETURN;
  END IF;
  
  -- Schedule the cron job with new authentication
  BEGIN
    PERFORM cron.schedule(
      'billing-runner',
      '30 11 * * *', -- 11:30 AM UTC = 10:00 PM Adelaide (ACDT)
      $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/billing-runner',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_billing_cron_secret(),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000 -- 5 minute timeout
      );
      $cron$
    );
    
    RAISE NOTICE 'Billing runner cron job scheduled successfully with custom cron secret authentication';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule billing-runner cron job: %', SQLERRM;
  END;
END $$;

-- ========================
-- VERIFICATION QUERIES (for testing)
-- ========================

-- Uncomment to verify cron job was created:
-- SELECT jobid, schedule, jobname, active, command FROM cron.job WHERE jobname = 'billing-runner';

-- Uncomment to verify helper function works:
-- SELECT public.get_billing_cron_secret() IS NOT NULL as has_cron_secret;
