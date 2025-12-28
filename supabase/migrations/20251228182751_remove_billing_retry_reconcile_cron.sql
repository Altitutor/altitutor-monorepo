-- Migration: Remove billing-retry and billing-reconcile cron jobs
-- Description:
--   - Remove billing-retry cron job (Stripe handles retries automatically)
--   - Remove billing-reconcile cron job (Stripe handles reconciliation automatically)
--   - Keep billing-runner cron job

-- ========================
-- REMOVE CRON JOBS
-- ========================

-- Remove billing-retry cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('billing-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-retry');
      RAISE NOTICE 'Removed billing-retry cron job';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not remove billing-retry cron job: %', SQLERRM;
    END;
  END IF;
END $$;

-- Remove billing-reconcile cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('billing-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-reconcile');
      RAISE NOTICE 'Removed billing-reconcile cron job';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not remove billing-reconcile cron job: %', SQLERRM;
    END;
  END IF;
END $$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON SCHEMA public IS 'billing-retry and billing-reconcile cron jobs removed - Stripe handles retries and reconciliation automatically for invoices';

