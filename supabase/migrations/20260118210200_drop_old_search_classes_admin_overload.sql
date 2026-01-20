-- Migration: Drop old 8-parameter overload of search_classes_admin
-- Description:
--   - Drop the old 8-parameter version to avoid confusion
--   - The new 10-parameter version has default values, so existing code will still work
--   - All frontend components should be updated to explicitly use p_exclude_student_search and p_exclude_staff_search parameters

-- ========================
-- DROP OLD SEARCH_CLASSES_ADMIN OVERLOAD
-- ========================
-- Drop the old 8-parameter version (without p_exclude_student_search and p_exclude_staff_search)
DROP FUNCTION IF EXISTS search_classes_admin(
  TEXT,      -- p_search
  TEXT[],    -- p_statuses
  UUID[],    -- p_subject_ids
  BOOLEAN,   -- p_include_relationships
  INTEGER,   -- p_limit
  INTEGER,   -- p_offset
  TEXT,      -- p_order_by
  BOOLEAN    -- p_ascending
);

-- Verify only the new 10-parameter version remains
DO $$
DECLARE
  v_classes_count INTEGER;
BEGIN
  -- Check that we have exactly one search_classes_admin function (the 10-parameter version)
  SELECT COUNT(*) INTO v_classes_count
  FROM pg_proc
  WHERE proname = 'search_classes_admin';
  
  IF v_classes_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 search_classes_admin function, found %', v_classes_count;
  END IF;
  
  -- Verify it has 10 parameters
  IF (SELECT pronargs FROM pg_proc WHERE proname = 'search_classes_admin') != 10 THEN
    RAISE EXCEPTION 'search_classes_admin should have 10 parameters';
  END IF;
END $$;

COMMENT ON FUNCTION search_classes_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for classes with exact + fuzzy matching on class names and partial component matching (subject shortname/longname, day short/full, time) in any order. Optional student/staff name search (can be excluded via p_exclude_student_search and p_exclude_staff_search). Fixed to return empty results when search matches nothing. Supports filtering by subject_ids. Returns subjects with short_name and long_name fields.';
