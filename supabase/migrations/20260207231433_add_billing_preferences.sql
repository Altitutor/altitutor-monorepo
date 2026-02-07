-- Migration: Add billing preferences to students_billing table
-- Description:
--   - Add auto_bill_enabled: Whether to automatically charge payment method when available (default: true)
--   - Add invoice_email_to_student: Whether to send invoice emails to student (default: true)
--   - Add invoice_email_to_parents: Whether to send invoice emails to all linked parents (default: true)
-- Purpose: Allow per-student configuration of billing behavior and invoice email recipients
-- Author: AI Assistant
-- Date: 2026-02-08

-- ================================================
-- ADD BILLING PREFERENCE COLUMNS
-- ================================================

ALTER TABLE public.students_billing
  ADD COLUMN IF NOT EXISTS auto_bill_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_email_to_student BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_email_to_parents BOOLEAN NOT NULL DEFAULT true;

-- Add comments
COMMENT ON COLUMN public.students_billing.auto_bill_enabled IS 'If true, automatically charge payment method when available. If false, always send invoice via email instead.';
COMMENT ON COLUMN public.students_billing.invoice_email_to_student IS 'If true, send invoice emails to the student email address.';
COMMENT ON COLUMN public.students_billing.invoice_email_to_parents IS 'If true, send invoice emails to all linked parent email addresses.';

-- ================================================
-- NOTES
-- ================================================
-- Default values match current behavior:
-- - auto_bill_enabled = true: Current behavior is to auto-bill if payment method exists
-- - invoice_email_to_student = true: Current behavior sends to student or parent email
-- - invoice_email_to_parents = true: Current behavior sends to parent email if available
--
-- Existing rows will automatically get these defaults, preserving current behavior.
-- Admin can update these preferences per-student via admin dashboard.
