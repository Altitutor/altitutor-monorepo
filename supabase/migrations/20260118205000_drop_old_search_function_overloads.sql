-- Migration: Drop old 8-parameter overloads of search_students_admin and search_staff_admin
-- Description:
--   - Drop the old 8-parameter versions to avoid confusion
--   - The new 9-parameter versions have default values, so existing code will still work
--   - All frontend components should be updated to explicitly use p_exclude_class_search parameter

-- ========================
-- DROP OLD SEARCH_STUDENTS_ADMIN OVERLOAD
-- ========================
-- Drop the old 8-parameter version (without p_exclude_class_search)
DROP FUNCTION IF EXISTS search_students_admin(
  TEXT,      -- p_search
  TEXT[],    -- p_statuses
  UUID[],    -- p_subject_ids
  BOOLEAN,   -- p_include_relationships
  INTEGER,   -- p_limit
  INTEGER,   -- p_offset
  TEXT,      -- p_order_by
  BOOLEAN    -- p_ascending
);

-- ========================
-- DROP OLD SEARCH_STAFF_ADMIN OVERLOAD
-- ========================
-- Drop the old 8-parameter version (without p_exclude_class_search)
DROP FUNCTION IF EXISTS search_staff_admin(
  TEXT,      -- p_search
  TEXT[],    -- p_statuses
  UUID[],    -- p_subject_ids
  BOOLEAN,   -- p_include_relationships
  INTEGER,   -- p_limit
  INTEGER,   -- p_offset
  TEXT,      -- p_order_by
  BOOLEAN    -- p_ascending
);

-- Verify only the new 9-parameter versions remain
DO $$
DECLARE
  v_students_count INTEGER;
  v_staff_count INTEGER;
BEGIN
  -- Check that we have exactly one search_students_admin function (the 9-parameter version)
  SELECT COUNT(*) INTO v_students_count
  FROM pg_proc
  WHERE proname = 'search_students_admin';
  
  IF v_students_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 search_students_admin function, found %', v_students_count;
  END IF;
  
  -- Check that we have exactly one search_staff_admin function (the 9-parameter version)
  SELECT COUNT(*) INTO v_staff_count
  FROM pg_proc
  WHERE proname = 'search_staff_admin';
  
  IF v_staff_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 search_staff_admin function, found %', v_staff_count;
  END IF;
  
  -- Verify they have 9 parameters
  IF (SELECT pronargs FROM pg_proc WHERE proname = 'search_students_admin') != 9 THEN
    RAISE EXCEPTION 'search_students_admin should have 9 parameters';
  END IF;
  
  IF (SELECT pronargs FROM pg_proc WHERE proname = 'search_staff_admin') != 9 THEN
    RAISE EXCEPTION 'search_staff_admin should have 9 parameters';
  END IF;
END $$;

COMMENT ON FUNCTION search_students_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for students with exact + fuzzy name matching. Optional class name search (can be excluded via p_exclude_class_search). Returns phone and email fields. Supports filtering by subject_ids via students_subjects AND/OR classes_students.classes.subject_id. Returns subjects with short_name and long_name fields.';

COMMENT ON FUNCTION search_staff_admin(TEXT, TEXT[], UUID[], BOOLEAN, BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search function for staff with exact + fuzzy name matching. Optional class name search (can be excluded via p_exclude_class_search). Fixed to return empty results when search matches nothing. Supports filtering by subject_ids via staff_subjects AND/OR classes_staff.classes.subject_id. Returns subjects with short_name and long_name fields.';
