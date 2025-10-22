-- Migration: Remove audit log tables, tasks table, and notes columns
-- Description:
-- - Drops student_audit_logs, staff_audit_logs, classes_audit_logs (and legacy class_audit_logs)
-- - Drops tasks table if present
-- - Removes notes columns from classes, sessions, and sessions_students
-- All operations are idempotent and safe to run multiple times.

-- ========================
-- DROP NOTES COLUMNS
-- ========================
ALTER TABLE IF EXISTS public.classes DROP COLUMN IF EXISTS notes;
ALTER TABLE IF EXISTS public.sessions DROP COLUMN IF EXISTS notes;
ALTER TABLE IF EXISTS public.sessions_students DROP COLUMN IF EXISTS notes;

-- ========================
-- DROP AUDIT LOG TABLES
-- ========================
DROP TABLE IF EXISTS public.student_audit_logs CASCADE;
DROP TABLE IF EXISTS public.staff_audit_logs CASCADE;
DROP TABLE IF EXISTS public.classes_audit_logs CASCADE;
-- Also drop legacy name in case earlier migrations haven't run
DROP TABLE IF EXISTS public.class_audit_logs CASCADE;

-- ========================
-- DROP TASKS TABLE
-- ========================
DROP TABLE IF EXISTS public.tasks CASCADE;


