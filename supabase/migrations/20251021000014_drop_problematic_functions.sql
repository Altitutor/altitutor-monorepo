-- Migration: Drop problematic legacy functions (keep precreate_sessions)
-- This removes functions that reference removed columns/tables and break linting.

DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT n.nspname AS schema_name,
           p.proname  AS function_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_student',
        'is_student_profile_complete',
        'select_student_subjects'
      )
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s);', r.schema_name, r.function_name, r.args);
  END LOOP;
END $$;


