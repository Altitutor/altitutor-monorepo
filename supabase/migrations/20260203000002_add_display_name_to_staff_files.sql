-- Migration: Add display_name column to staff_files table
-- Description:
--  - Add display_name column to allow custom file names per staff file relationship
--  - Display name is optional and falls back to files.filename if not set

-- ========================
-- ADD display_name COLUMN
-- ========================

ALTER TABLE public.staff_files
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON COLUMN public.staff_files.display_name IS 'Optional custom display name for the file. If NULL, falls back to files.filename';
