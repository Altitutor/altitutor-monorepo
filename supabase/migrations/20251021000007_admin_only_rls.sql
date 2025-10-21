-- Migration: Lock down all RLS to ADMINSTAFF (ACTIVE) only
-- Requirements:
--  - A user must have a row in public.staff with user_id = auth.uid(), role = 'ADMINSTAFF', status = 'ACTIVE'
--  - Remove all tutor/student/authenticated generic policies and legacy JWT-based ones

-- 1) Helper function to check ADMINSTAFF with ACTIVE status
CREATE OR REPLACE FUNCTION public.is_adminstaff_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.user_id = auth.uid()
      AND s.role = 'ADMINSTAFF'
      AND s.status = 'ACTIVE'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_adminstaff_active() TO authenticated;


-- 2) Drop legacy/non-admin policies everywhere (idempotent)
DO $$
DECLARE r record; BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND (
      policyname ILIKE 'TUTOR %' OR
      policyname ILIKE 'Allow authenticated read access%' OR
      policyname ILIKE 'Allow tutors%' OR
      policyname ILIKE 'Allow students%' OR
      policyname ILIKE 'Allow admin %' OR
      policyname ILIKE 'Allow staff %' OR
      policyname ILIKE 'ADMINSTAFF can %' OR
      policyname ILIKE 'ADMINSTAFF full access%' OR
      policyname = 'Self can read own staff row'
    )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;


-- 3) Create uniform ADMINSTAFF(ACTIVE) policies on every public RLS-enabled table (idempotent)
DO $$
DECLARE r record; BEGIN
  FOR r IN (
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  ) LOOP
    -- Drop same-named policies first for idempotency
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can select', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can insert', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can update', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ADMINSTAFF active can delete', r.tablename);

    -- Create policies
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_adminstaff_active())',
      'ADMINSTAFF active can select', r.tablename
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_adminstaff_active())',
      'ADMINSTAFF active can insert', r.tablename
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_adminstaff_active()) WITH CHECK (public.is_adminstaff_active())',
      'ADMINSTAFF active can update', r.tablename
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_adminstaff_active())',
      'ADMINSTAFF active can delete', r.tablename
    );
  END LOOP;
END $$;


