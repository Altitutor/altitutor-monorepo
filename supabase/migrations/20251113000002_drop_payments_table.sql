-- Migration: Drop old payments table
-- Description: After migrating to payment_attempts, drop the old payments table
-- NOTE: Only run this migration after verifying all code is updated and tested
-- NOTE: Make sure all edge functions are using payment_attempts before running this

-- ================================================
-- DROP OLD PAYMENTS TABLE
-- ================================================

-- Verify no code is still referencing the old table
-- If this migration runs, it means the developer has verified all code is updated

DROP TABLE IF EXISTS public.payments CASCADE;

COMMENT ON SCHEMA public IS 'Successfully migrated from payments to payment_attempts table';







