-- ========================
-- FIX ALL RLS PERFORMANCE: Cache is_adminstaff_active() calls across ALL remaining tables
-- ========================
-- 
-- Problem: Many tables still have policies using is_adminstaff_active() WITHOUT SELECT caching
-- Migration 20251114000003 fixed some tables, but most still need fixing
--
-- Solution: Update all remaining policies to wrap function calls in (SELECT ...)
-- This applies to policies created by migration 20251021000007_admin_only_rls.sql
--
-- Impact: Massive performance improvement - reduces function calls from per-row to per-query

DO $$
DECLARE 
  r record;
  policy_exists boolean;
  current_qual text;
BEGIN
  -- Loop through all tables with "ADMINSTAFF active can X" policies
  FOR r IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public' 
      AND policyname LIKE 'ADMINSTAFF active can %'
      AND qual::text = 'is_adminstaff_active()'  -- Only fix uncached ones
  ) LOOP
    BEGIN
      -- Fix SELECT policy
      EXECUTE format('
        DROP POLICY IF EXISTS %I ON public.%I;
        CREATE POLICY %I ON public.%I 
          FOR SELECT TO authenticated 
          USING ((SELECT public.is_adminstaff_active()));
      ', 'ADMINSTAFF active can select', r.tablename, 
         'ADMINSTAFF active can select', r.tablename);

      -- Fix INSERT policy  
      EXECUTE format('
        DROP POLICY IF EXISTS %I ON public.%I;
        CREATE POLICY %I ON public.%I 
          FOR INSERT TO authenticated 
          WITH CHECK ((SELECT public.is_adminstaff_active()));
      ', 'ADMINSTAFF active can insert', r.tablename,
         'ADMINSTAFF active can insert', r.tablename);

      -- Fix UPDATE policy
      EXECUTE format('
        DROP POLICY IF EXISTS %I ON public.%I;
        CREATE POLICY %I ON public.%I 
          FOR UPDATE TO authenticated 
          USING ((SELECT public.is_adminstaff_active())) 
          WITH CHECK ((SELECT public.is_adminstaff_active()));
      ', 'ADMINSTAFF active can update', r.tablename,
         'ADMINSTAFF active can update', r.tablename);

      -- Fix DELETE policy
      EXECUTE format('
        DROP POLICY IF EXISTS %I ON public.%I;
        CREATE POLICY %I ON public.%I 
          FOR DELETE TO authenticated 
          USING ((SELECT public.is_adminstaff_active()));
      ', 'ADMINSTAFF active can delete', r.tablename,
         'ADMINSTAFF active can delete', r.tablename);

      RAISE NOTICE 'Updated RLS policies for table: %', r.tablename;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped table % due to error: %', r.tablename, SQLERRM;
    END;
  END LOOP;

  -- Also fix any "ADMINSTAFF full access to X" policies that are still uncached
  FOR r IN (
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' 
      AND policyname LIKE 'ADMINSTAFF full access to %'
      AND (qual::text = 'is_adminstaff_active()' OR with_check::text = 'is_adminstaff_active()')
  ) LOOP
    BEGIN
      EXECUTE format('
        DROP POLICY IF EXISTS %I ON public.%I;
        CREATE POLICY %I ON public.%I 
          FOR ALL TO authenticated 
          USING ((SELECT public.is_adminstaff_active())) 
          WITH CHECK ((SELECT public.is_adminstaff_active()));
      ', r.policyname, r.tablename, r.policyname, r.tablename);
      
      RAISE NOTICE 'Updated policy: % on table %', r.policyname, r.tablename;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipped policy % on table % due to error: %', r.policyname, r.tablename, SQLERRM;
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

