-- Migration: Consolidate RLS policies to single "ADMINSTAFF full access" pattern
-- Description:
--  Replace all separate SELECT/INSERT/UPDATE/DELETE policies with a single
--  "ADMINSTAFF full access to {table}" policy using FOR ALL.
--  This simplifies policy management and matches the pattern used in later migrations.

-- ================================================
-- DROP ALL SEPARATE POLICIES AND CREATE CONSOLIDATED ONES
-- ================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' 
      AND c.relrowsecurity
    ORDER BY c.relname
  ) LOOP
    -- Drop all existing policies for this table
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can select', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can insert', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can update', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can delete', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF can insert ' || r.tablename, r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF can update ' || r.tablename, r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF can delete ' || r.tablename, r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF full access to ' || r.tablename, r.tablename);
    
    -- Create single consolidated policy
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()))',
      'ADMINSTAFF full access to ' || r.tablename, r.tablename
    );
    
    RAISE NOTICE 'Consolidated RLS policies for table: %', r.tablename;
  END LOOP;
END $$;

-- ================================================
-- VERIFICATION
-- ================================================
-- To verify, run:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE 'ADMINSTAFF%'
-- ORDER BY tablename, policyname;

