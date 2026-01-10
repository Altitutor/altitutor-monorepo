-- Migration: Drop unused booking views
-- Description: Remove views that are no longer used in the codebase:
--   - vbooking_settings: Replaced by calculating duration from slots
--   - vopening_hours: Never used, booking functions query opening_hours table directly
--   - vstaff_availability_summary: Never used, booking functions query staff table directly

-- ========================
-- DROP VIEWS
-- ========================

-- Drop vbooking_settings view
DROP VIEW IF EXISTS public.vbooking_settings CASCADE;

-- Drop vopening_hours view
DROP VIEW IF EXISTS public.vopening_hours CASCADE;

-- Drop vstaff_availability_summary view
DROP VIEW IF EXISTS public.vstaff_availability_summary CASCADE;

-- ========================
-- COMMENTS
-- ========================
-- These views were created for read-only access but were never actually used.
-- Duration is now calculated from selected slots in the frontend.
-- Booking functions query base tables directly with SECURITY DEFINER.
