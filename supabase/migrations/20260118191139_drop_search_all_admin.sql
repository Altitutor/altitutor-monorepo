-- Migration: Drop search_all_admin RPC function
-- Description: This function is no longer needed as we're replacing GlobalSearch
--   with a new CommandPalette that uses individual entity search RPCs for better
--   performance and flexibility.
-- 
-- The CommandPalette uses parallel queries to individual search RPCs:
--   - search_students_admin
--   - search_staff_admin
--   - search_classes_admin
--   - search_parents_admin
--   - search_subjects_admin
--   - search_topics_admin
--
-- This provides better performance, caching, and maintainability.

-- Drop the function
DROP FUNCTION IF EXISTS search_all_admin(TEXT, INTEGER, INTEGER, TEXT[], TEXT[], TEXT[], INTEGER, INTEGER);
