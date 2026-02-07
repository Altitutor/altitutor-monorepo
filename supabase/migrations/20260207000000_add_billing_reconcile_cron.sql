-- Migration: Add cron job for billing-reconcile
-- Description:
--   - Schedule billing-reconcile to run daily at 2:00 AM local time (Adelaide)
--   - Uses same authentication pattern as billing-runner (billing_cron_secret)
--   - Reconciliation runs as backup to webhooks (primary sync mechanism)
--
-- Schedule: Daily at 2:00 AM Adelaide time (4:30 PM UTC previous day)
-- Purpose: Reconcile invoices between Stripe and database
--   - Find invoices in Stripe missing from DB (webhook failures)
--   - Fix incomplete invoices in DB (missing items/totals)
--   - Detect status drift and amount mismatches (report only by default)
--
-- Prerequisites:
--   - Vault secret must exist: billing_cron_secret
--   - Edge Function must have BILLING_CRON_SECRET_KEY environment variable set
--   - pg_cron and pg_net extensions must be available

-- ========================
-- REMOVE EXISTING CRON JOB (if any)
-- ========================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('billing-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-reconcile');
      RAISE NOTICE 'Removed existing billing-reconcile cron job';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not remove existing billing-reconcile cron job: %', SQLERRM;
    END;
  END IF;
END $$;

-- ========================
-- SCHEDULE BILLING-RECONCILE CRON JOB
-- ========================

DO $$
DECLARE
  supabase_url TEXT;
  cron_secret TEXT;
BEGIN
  -- Only proceed if pg_cron is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-reconcile cron job creation.';
    RAISE NOTICE 'Please configure manually via Supabase Dashboard > Edge Functions > billing-reconcile > Invoke';
    RETURN;
  END IF;

  -- Check if pg_net is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'pg_net extension not available. Cron job cannot make HTTP requests.';
    RETURN;
  END IF;

  -- Get Supabase URL
  supabase_url := public.get_supabase_url();
  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Cannot schedule billing-reconcile cron job: Supabase URL not configured.';
    RETURN;
  END IF;
  
  -- Get billing cron secret (same as billing-runner)
  cron_secret := public.get_billing_cron_secret();
  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE WARNING 'Cannot schedule billing-reconcile cron job: billing_cron_secret not configured.';
    RAISE WARNING 'Create Vault secret: SELECT vault.create_secret(''your-secret-key'', ''billing_cron_secret'');';
    RETURN;
  END IF;
  
  -- Schedule the cron job
  -- 2:00 AM Adelaide (ACDT) = 4:30 PM UTC previous day (16:30 UTC)
  -- Note: During daylight saving (ACDT), Adelaide is UTC+10:30
  -- During standard time (ACST), Adelaide is UTC+9:30
  -- Using 16:30 UTC covers both (approximately 2:00 AM Adelaide)
  BEGIN
    PERFORM cron.schedule(
      'billing-reconcile',
      '30 16 * * *', -- 4:30 PM UTC = ~2:00 AM Adelaide (next day)
      $cron$
      SELECT net.http_post(
        url := public.get_supabase_url() || '/functions/v1/billing-reconcile',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_billing_cron_secret(),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'mode', 'all',
          'days_back', 7,
          'fix_status_drift', true,
          'fix_amounts_mismatch', true
        ),
        timeout_milliseconds := 300000 -- 5 minute timeout
      );
      $cron$
    );
    
    RAISE NOTICE 'Billing reconcile cron job scheduled successfully';
    RAISE NOTICE 'Schedule: Daily at 4:30 PM UTC (~2:00 AM Adelaide)';
    RAISE NOTICE 'Runs all reconciliation strategies with 7 days lookback';
    RAISE NOTICE 'Automatically fixes status drift and amounts mismatches';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule billing-reconcile cron job: %', SQLERRM;
  END;
END $$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON SCHEMA public IS 'billing-reconcile cron job scheduled - runs daily to reconcile invoices between Stripe and database';

-- ========================
-- VERIFICATION QUERIES (for testing)
-- ========================

-- Uncomment to verify cron job was created:
-- SELECT jobid, schedule, jobname, active, command FROM cron.job WHERE jobname = 'billing-reconcile';

-- Uncomment to verify helper function works:
-- SELECT public.get_billing_cron_secret() IS NOT NULL as has_cron_secret;
