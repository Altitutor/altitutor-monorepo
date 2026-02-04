-- Migration: Drop Simple Reconciliation Views
-- Description:
--  - Drop simple reconciliation views that have been refactored to frontend queries
--  - Views dropped: unlogged_sessions, unassigned_classes, unreplied_messages, 
--    failed_delivery_messages, students_without_payment_method, trial_students_not_signed_up
--  - Keep complex views: uninvoiced_sessions, students_without_classes
-- Purpose: Simplify database by moving simple filtering logic to frontend

-- ================================================
-- DROP VIEWS: Simple views refactored to frontend
-- ================================================

-- Drop unlogged sessions view (now queried directly from sessions table)
DROP VIEW IF EXISTS public.vadmin_reconciliation_unlogged_sessions;

-- Drop unassigned classes view (now queried directly from classes table)
DROP VIEW IF EXISTS public.vadmin_reconciliation_unassigned_classes;

-- Drop unreplied messages view (no longer needed)
DROP VIEW IF EXISTS public.vadmin_reconciliation_unreplied_messages;

-- Drop failed delivery messages view (now queried directly from messages table)
DROP VIEW IF EXISTS public.vadmin_reconciliation_failed_delivery_messages;

-- Drop students without payment method view (now queried directly from students table)
DROP VIEW IF EXISTS public.vadmin_reconciliation_students_without_payment_method;

-- Drop trial students not signed up view (now queried directly from students table)
DROP VIEW IF EXISTS public.vadmin_reconciliation_trial_students_not_signed_up;

-- ================================================
-- VERIFICATION
-- ================================================
-- Verify that complex views still exist (should not error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'vadmin_reconciliation_uninvoiced_sessions'
  ) THEN
    RAISE EXCEPTION 'Expected view vadmin_reconciliation_uninvoiced_sessions does not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'vadmin_reconciliation_students_without_classes'
  ) THEN
    RAISE EXCEPTION 'Expected view vadmin_reconciliation_students_without_classes does not exist';
  END IF;
END $$;
