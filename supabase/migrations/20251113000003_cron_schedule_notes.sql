-- Migration: Cron Schedule Configuration Notes
-- Description: Instructions for configuring cron jobs for billing functions
-- NOTE: This migration only contains comments/documentation
-- Actual cron job configuration must be done through Supabase Dashboard

-- ================================================
-- BILLING-RUNNER CRON JOB
-- ================================================

-- Schedule: Daily at 10:00 PM local time (processes tomorrow's sessions)
-- Function: billing-runner
-- Configuration in Supabase Dashboard:
--   1. Navigate to Edge Functions > billing-runner
--   2. Click "Invoke" tab
--   3. Set up cron schedule: "0 22 * * *" (10 PM daily)
--   4. Method: POST
--   5. Headers: None (service role auth automatic)
--   6. Body: {} (empty for production mode)

-- ================================================
-- BILLING-RETRY CRON JOB
-- ================================================

-- Schedule: Every 6 hours
-- Function: billing-retry
-- Configuration in Supabase Dashboard:
--   1. Navigate to Edge Functions > billing-retry
--   2. Click "Invoke" tab
--   3. Set up cron schedule: "0 */6 * * *" (every 6 hours)
--   4. Method: POST
--   5. Headers: None (service role auth automatic)
--   6. Body: {} (empty)

-- ================================================
-- BILLING-RECONCILE CRON JOB
-- ================================================

-- Schedule: Daily at 2:00 AM local time
-- Function: billing-reconcile
-- Configuration in Supabase Dashboard:
--   1. Navigate to Edge Functions > billing-reconcile
--   2. Click "Invoke" tab
--   3. Set up cron schedule: "0 2 * * *" (2 AM daily)
--   4. Method: POST
--   5. Headers: None (service role auth automatic)
--   6. Body: {} (empty)

-- Purpose: Reconcile stuck payment attempts with Stripe
-- This handles missed webhooks and payments stuck in pending/processing status

-- ================================================
-- ALTERNATIVE: pg_cron Extension (if available)
-- ================================================

-- If using pg_cron extension instead of Supabase cron:
-- Note: pg_cron may not be available on all Supabase plans

-- Billing runner (daily at 10 PM)
-- SELECT cron.schedule('billing-runner', '0 22 * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-project.supabase.co/functions/v1/billing-runner',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{}'::jsonb
--   );
-- $$);

-- Billing retry (every 6 hours)
-- SELECT cron.schedule('billing-retry', '0 */6 * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-project.supabase.co/functions/v1/billing-retry',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{}'::jsonb
--   );
-- $$);

-- Billing reconcile (daily at 2 AM)
-- SELECT cron.schedule('billing-reconcile', '0 2 * * *', $$
--   SELECT net.http_post(
--     url := 'https://your-project.supabase.co/functions/v1/billing-reconcile',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{}'::jsonb
--   );
-- $$);

COMMENT ON SCHEMA public IS 'Cron schedule configuration documented for billing edge functions';















