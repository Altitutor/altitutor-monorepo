-- Migration: Remove audit log trigger that references dropped tables
-- Description:
-- The auth.after_email_confirmation() function tries to insert into student_audit_logs
-- which was dropped in migration 20251021000013_remove_audit_tables_and_notes.sql
-- This causes "Database error creating new user" when creating accounts via invites.

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS auth.after_email_confirmation();

