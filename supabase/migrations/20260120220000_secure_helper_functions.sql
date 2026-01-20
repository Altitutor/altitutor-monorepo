-- Migration: Secure helper functions for cron jobs and triggers
-- Description:
--   - Restrict access to get_service_role_key() and get_supabase_url()
--   - Only allow postgres role to execute (cron jobs and triggers run as postgres)
--   - Revoke PUBLIC access to prevent unauthorized access
--   - These functions are needed for:
--     1. pg_cron jobs calling edge functions (run as postgres)
--     2. Database triggers calling edge functions (run as postgres)
--
-- Security Note:
--   - Cron jobs are visible in cron.job table (PUBLIC access)
--   - But the function itself is now restricted to postgres only
--   - This prevents unauthorized users from calling the function directly
--   - The service role key is stored securely in Vault and accessed via these functions

-- ========================
-- SECURE get_supabase_url()
-- ========================

-- Revoke PUBLIC access
REVOKE EXECUTE ON FUNCTION public.get_supabase_url() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_supabase_url() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_supabase_url() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_supabase_url() FROM service_role;

-- Grant only to postgres (cron jobs and triggers run as postgres)
GRANT EXECUTE ON FUNCTION public.get_supabase_url() TO postgres;

-- Ensure search_path is set for security
ALTER FUNCTION public.get_supabase_url() SET search_path = public;

-- ========================
-- SECURE get_service_role_key()
-- ========================

-- Revoke PUBLIC access
REVOKE EXECUTE ON FUNCTION public.get_service_role_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_service_role_key() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_service_role_key() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_service_role_key() FROM service_role;

-- Grant only to postgres (cron jobs and triggers run as postgres)
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO postgres;

-- Ensure search_path is set for security
ALTER FUNCTION public.get_service_role_key() SET search_path = public;

-- ========================
-- UPDATE COMMENTS
-- ========================

COMMENT ON FUNCTION public.get_supabase_url() IS 
'Secure helper function to get Supabase URL from Vault (preferred) or database settings. 
Only accessible to postgres role (for cron jobs and triggers). 
Configure via: SELECT vault.create_secret(''https://your-project.supabase.co'', ''project_url'');';

COMMENT ON FUNCTION public.get_service_role_key() IS 
'Secure helper function to get service role key from Vault (preferred) or database settings. 
Only accessible to postgres role (for cron jobs and triggers). 
Configure via: SELECT vault.create_secret(''your-service-role-key'', ''service_role_key'');';
