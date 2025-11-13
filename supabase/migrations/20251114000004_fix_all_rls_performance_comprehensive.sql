-- ========================
-- FIX ALL RLS PERFORMANCE: Cache is_adminstaff_active() calls across ALL tables
-- ========================
-- 
-- Problem: Migration 20251021000007 created policies on all RLS-enabled tables
-- using is_adminstaff_active() WITHOUT caching, causing performance issues
--
-- Solution: Recreate ALL those policies with cached function calls
-- This migration dynamically updates ALL tables that have the standard ADMINSTAFF policies
--
-- Impact: Massive performance improvement across entire database

DO $$
DECLARE 
  r record;
BEGIN
  -- Loop through all tables with RLS enabled
  FOR r IN (
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' 
      AND c.relrowsecurity
  ) LOOP
    BEGIN
      -- Drop and recreate SELECT policy with cached function call
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can select', r.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()))',
        'ADMINSTAFF active can select', r.tablename
      );

      -- Drop and recreate INSERT policy with cached function call
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can insert', r.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_adminstaff_active()))',
        'ADMINSTAFF active can insert', r.tablename
      );

      -- Drop and recreate UPDATE policy with cached function call
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can update', r.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()))',
        'ADMINSTAFF active can update', r.tablename
      );

      -- Drop and recreate DELETE policy with cached function call
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can delete', r.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_adminstaff_active()))',
        'ADMINSTAFF active can delete', r.tablename
      );

      RAISE NOTICE 'Updated RLS policies for table: %', r.tablename;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped table % due to error: %', r.tablename, SQLERRM;
    END;
  END LOOP;
END $$;


-- ========================
-- VERIFICATION
-- ========================
-- To verify the fix works, check that policies now use (SELECT ...) pattern:
-- 
-- SELECT tablename, policyname, qual::text 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND policyname LIKE 'ADMINSTAFF active%'
--   AND qual::text LIKE '%(SELECT%'
-- ORDER BY tablename;
--
-- Expected: All policies should show "(SELECT public.is_adminstaff_active())" in qual

