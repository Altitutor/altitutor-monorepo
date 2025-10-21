-- Migration: Cleanup any non-admin-only policies
-- Drops every policy in public schema that is NOT one of the uniform admin-only policies

DO $$
DECLARE r record; BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT IN (
        'ADMINSTAFF active can select',
        'ADMINSTAFF active can insert',
        'ADMINSTAFF active can update',
        'ADMINSTAFF active can delete'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;


