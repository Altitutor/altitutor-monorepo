-- Migration: Ensure required extensions are enabled
-- Description: Enable pgcrypto and uuid-ossp extensions required by functions
-- These extensions are needed for:
--   - pgcrypto: gen_random_bytes() used in resend_confirmation_email()
--   - uuid-ossp: uuid_generate_v4() used in precreate_sessions() and other functions

-- Enable pgcrypto extension for gen_random_bytes()
-- Note: This must be created before any functions that use gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure uuid-ossp extension is enabled (should already be enabled from initial schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: COMMENT ON EXTENSION requires extension ownership, which may not be available
-- in all environments (e.g., local Supabase). Comments are optional metadata and
-- don't affect functionality.

