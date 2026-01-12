-- Migration: Drop students without classes view
-- Description: Remove vadmin_reconciliation_students_without_classes view as it's no longer needed

DROP VIEW IF EXISTS public.vadmin_reconciliation_students_without_classes;
