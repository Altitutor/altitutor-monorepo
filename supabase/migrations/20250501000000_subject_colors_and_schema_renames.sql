-- Migration: Add subject colors and rename audit logs table
-- Description: This migration adds a color field to subjects, renames class_audit_logs to classes_audit_logs,
-- and manages the class_sessions table.

-- Add color column to subjects table
ALTER TABLE public.subjects
ADD COLUMN color TEXT;

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN public.subjects.color IS 'Color code for visual representation of subject in UI';

-- Rename class_audit_logs to classes_audit_logs
-- First, drop the existing constraint
ALTER TABLE public.class_audit_logs
DROP CONSTRAINT IF EXISTS class_audit_logs_class_id_fkey;

-- Rename the table
ALTER TABLE public.class_audit_logs
RENAME TO classes_audit_logs;

-- Re-add the constraint with the new table name
ALTER TABLE public.classes_audit_logs
ADD CONSTRAINT classes_audit_logs_class_id_fkey
FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

-- Update any policies that might reference the old table name
ALTER POLICY IF EXISTS "Allow staff to read class_audit_logs" ON public.classes_audit_logs
RENAME TO "Allow staff to read classes_audit_logs";

ALTER POLICY IF EXISTS "Allow adminstaff to write class_audit_logs" ON public.classes_audit_logs
RENAME TO "Allow adminstaff to write classes_audit_logs";

-- Delete class_sessions table if it exists
-- (First check if there are any foreign key references to it)
DROP TABLE IF EXISTS public.attendance_records; -- This references class_sessions
DROP TABLE IF EXISTS public.class_sessions;

-- The sessions table already has a class_id field, so we don't need to add it
COMMENT ON COLUMN public.sessions.class_id IS 'Reference to the class this session belongs to'; 