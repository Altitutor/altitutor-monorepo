-- Migration: Sessions overhaul - cleanup obsolete tables and enums
-- Description:
--  - Drop student_absences table
--  - Drop staff_swaps table
--  - Drop session_audit_logs table
--  - Drop sessions_resource_files table if it exists
--  - Clean up notes.target_type enum to remove obsolete values

-- ========================
-- DROP OBSOLETE TABLES
-- ========================

-- Drop student_absences table
DROP TABLE IF EXISTS public.student_absences CASCADE;

-- Drop staff_swaps table
DROP TABLE IF EXISTS public.staff_swaps CASCADE;

-- Drop session_audit_logs table
DROP TABLE IF EXISTS public.session_audit_logs CASCADE;

-- Drop sessions_resource_files table if it exists
DROP TABLE IF EXISTS public.sessions_resource_files CASCADE;

-- ========================
-- CLEAN UP NOTES ENUM
-- ========================

-- Check if notes table exists and has target_type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notes'
  ) THEN
    -- We need to recreate the enum without the obsolete values
    -- First, add a temporary column
    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS target_type_new TEXT;
    
    -- Copy data, mapping obsolete types to NULL or a safe default
    UPDATE public.notes
    SET target_type_new = CASE
      WHEN target_type NOT IN ('staff_swaps', 'student_absences') THEN target_type
      ELSE NULL
    END;
    
    -- Drop the old column and rename the new one
    ALTER TABLE public.notes DROP COLUMN IF EXISTS target_type;
    ALTER TABLE public.notes RENAME COLUMN target_type_new TO target_type;
  END IF;
END $$;


