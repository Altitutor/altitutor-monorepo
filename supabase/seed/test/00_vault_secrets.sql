-- Seed file: Vault secrets for local development
-- This file sets up Vault secrets needed for cron jobs and other features
-- Runs before other seed files (00 prefix ensures it runs first)

-- ========================
-- VAULT SECRETS FOR LOCAL DEVELOPMENT
-- ========================

-- Note: Vault extension must be enabled for this to work
-- If vault extension is not available, these will fail gracefully

DO $$
BEGIN
  -- Create project URL secret for local development
  -- Local Supabase API URL from config.toml
  BEGIN
    PERFORM vault.create_secret('http://127.0.0.1:55321', 'project_url');
    RAISE NOTICE 'Created Vault secret: project_url';
  EXCEPTION WHEN OTHERS THEN
    -- Vault extension might not be available or secret already exists
    RAISE NOTICE 'Could not create project_url secret: %', SQLERRM;
  END;

  -- Create service role key secret for local development
  -- Default local Supabase service role key (from supabase status output)
  -- This is the standard local development service role key
  BEGIN
    PERFORM vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', 'service_role_key');
    RAISE NOTICE 'Created Vault secret: service_role_key';
  EXCEPTION WHEN OTHERS THEN
    -- Vault extension might not be available or secret already exists
    RAISE NOTICE 'Could not create service_role_key secret: %', SQLERRM;
  END;
END $$;

