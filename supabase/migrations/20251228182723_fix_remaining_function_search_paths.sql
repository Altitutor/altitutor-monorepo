-- Migration: Fix remaining function search_path security issues for Dev project
-- Description:
--   Add SET search_path = '' to functions that don't have it set.
--   This prevents schema injection attacks by ensuring functions always use
--   a fixed search_path instead of inheriting from the caller.
--   
--   Functions fixed:
--   - get_supabase_url() - Missing from previous migration
--   - get_service_role_key() - Missing from previous migration
--   - standardize_au_phone(text) - Already in previous migration but ensuring it's set
--   - set_updated_at() / update_updated_at() - Ensuring it's set (may be named differently)
--   
--   Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
--
--   Note: Using SET search_path = public to match previous migration pattern.
--   This prevents search path injection while maintaining compatibility.

-- ========================
-- FIX get_supabase_url()
-- ========================
DO $$
BEGIN
  -- Check if function exists and doesn't have search_path set
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_supabase_url'
      AND (
        p.proconfig IS NULL 
        OR NOT array_to_string(p.proconfig, ', ') LIKE '%search_path%'
      )
  ) THEN
    ALTER FUNCTION public.get_supabase_url() SET search_path = public;
  END IF;
END $$;

-- ========================
-- FIX get_service_role_key()
-- ========================
DO $$
BEGIN
  -- Check if function exists and doesn't have search_path set
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_service_role_key'
      AND (
        p.proconfig IS NULL 
        OR NOT array_to_string(p.proconfig, ', ') LIKE '%search_path%'
      )
  ) THEN
    ALTER FUNCTION public.get_service_role_key() SET search_path = public;
  END IF;
END $$;

-- ========================
-- FIX standardize_au_phone(text)
-- ========================
-- This should already be fixed in previous migration, but ensuring it's set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'standardize_au_phone'
      AND pg_get_function_identity_arguments(p.oid) = 'phone_input text'
      AND (
        p.proconfig IS NULL 
        OR NOT array_to_string(p.proconfig, ', ') LIKE '%search_path%'
      )
  ) THEN
    ALTER FUNCTION public.standardize_au_phone(phone_input TEXT) SET search_path = public;
  END IF;
END $$;

-- ========================
-- FIX update_updated_at() / set_updated_at()
-- ========================
-- The advisor mentioned set_updated_at, but the codebase uses update_updated_at
-- Fix both names if they exist
DO $$
BEGIN
  -- Fix update_updated_at() if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at'
      AND (
        p.proconfig IS NULL 
        OR NOT array_to_string(p.proconfig, ', ') LIKE '%search_path%'
      )
  ) THEN
    ALTER FUNCTION public.update_updated_at() SET search_path = public;
  END IF;
  
  -- Fix set_updated_at() if it exists (different function name)
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND (
        p.proconfig IS NULL 
        OR NOT array_to_string(p.proconfig, ', ') LIKE '%search_path%'
      )
  ) THEN
    ALTER FUNCTION public.set_updated_at() SET search_path = public;
  END IF;
END $$;

-- ========================
-- COMMENTS
-- ========================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_supabase_url' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.get_supabase_url() IS 'Returns Supabase URL from database settings. Fixed search_path for security.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_service_role_key' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.get_service_role_key() IS 'Returns service role key from database settings or vault. Fixed search_path for security.';
  END IF;
END $$;

