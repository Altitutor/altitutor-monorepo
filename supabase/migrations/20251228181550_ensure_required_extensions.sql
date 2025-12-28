-- Migration: Ensure required extensions are enabled
-- Description: Enable pgcrypto and uuid-ossp extensions required by functions
-- These extensions are needed for:
--   - pgcrypto: gen_random_bytes() used in resend_confirmation_email()
--   - uuid-ossp: uuid_generate_v4() used in precreate_sessions() and other functions

-- Enable pgcrypto extension for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure uuid-ossp extension is enabled (should already be enabled from initial schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

COMMENT ON EXTENSION pgcrypto IS 'Provides cryptographic functions including gen_random_bytes()';
COMMENT ON EXTENSION "uuid-ossp" IS 'Provides UUID generation functions including uuid_generate_v4()';

