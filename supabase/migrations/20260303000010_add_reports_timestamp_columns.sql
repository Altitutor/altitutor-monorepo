-- Migration: Add report timestamp columns for easier analytics
-- Description:
--   - issues: resolved_at (set when status -> resolved, cleared when status changes away)
--   - students: registered_at (set when status -> ACTIVE, never cleared)
--   - students: active_at (set when status -> ACTIVE, cleared when status -> non-ACTIVE)
--   - invoices: voided_at (set when status -> void)
-- Purpose: Enable reports without querying activity_events
-- Author: AI Assistant
-- Date: 2026-03-04

-- ========================
-- 1. ISSUES: resolved_at
-- ========================

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.issues.resolved_at IS 'When issue status was changed to resolved. Cleared when status changes away from resolved.';

-- Backfill: existing resolved issues get updated_at as approximation
UPDATE public.issues
SET resolved_at = updated_at
WHERE status = 'resolved' AND resolved_at IS NULL;

-- Trigger
CREATE OR REPLACE FUNCTION public.set_issues_resolved_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' THEN
    NEW.resolved_at := NOW();
  ELSE
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_issues_resolved_at ON public.issues;
CREATE TRIGGER trigger_issues_resolved_at
  BEFORE INSERT OR UPDATE OF status ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_issues_resolved_at();

CREATE INDEX IF NOT EXISTS idx_issues_resolved_at ON public.issues(resolved_at)
  WHERE resolved_at IS NOT NULL;

-- ========================
-- 2. STUDENTS: registered_at
-- ========================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;

COMMENT ON COLUMN public.students.registered_at IS 'When student status was first changed to ACTIVE. Never cleared.';

-- Backfill: current ACTIVE students get created_at as approximation (we have no history)
UPDATE public.students
SET registered_at = created_at
WHERE status = 'ACTIVE' AND registered_at IS NULL;

-- Trigger: set only when transitioning TO ACTIVE (first time), never clear
CREATE OR REPLACE FUNCTION public.set_students_registered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set only when becoming ACTIVE and not already set (INSERT or first-time ACTIVE)
  IF NEW.status = 'ACTIVE' AND NEW.registered_at IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'ACTIVE' THEN
      NEW.registered_at := NOW();
    END IF;
  END IF;
  -- Never clear registered_at
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_students_registered_at ON public.students;
CREATE TRIGGER trigger_students_registered_at
  BEFORE INSERT OR UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_students_registered_at();

CREATE INDEX IF NOT EXISTS idx_students_registered_at ON public.students(registered_at)
  WHERE registered_at IS NOT NULL;

-- ========================
-- 3. STUDENTS: active_at
-- ========================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS active_at TIMESTAMPTZ;

COMMENT ON COLUMN public.students.active_at IS 'When student status was changed to ACTIVE. Cleared when status changes to non-ACTIVE (INACTIVE, TRIAL, DISCONTINUED).';

-- Backfill: current ACTIVE students get updated_at as approximation
UPDATE public.students
SET active_at = updated_at
WHERE status = 'ACTIVE' AND active_at IS NULL;

-- Trigger: set when ACTIVE, clear when not ACTIVE
CREATE OR REPLACE FUNCTION public.set_students_active_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    NEW.active_at := NOW();
  ELSE
    NEW.active_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_students_active_at ON public.students;
CREATE TRIGGER trigger_students_active_at
  BEFORE INSERT OR UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_students_active_at();

CREATE INDEX IF NOT EXISTS idx_students_active_at ON public.students(active_at)
  WHERE active_at IS NOT NULL;

-- ========================
-- 4. INVOICES: voided_at
-- ========================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

COMMENT ON COLUMN public.invoices.voided_at IS 'When invoice status was changed to void.';

-- Backfill: existing void invoices get updated_at as approximation
UPDATE public.invoices
SET voided_at = updated_at
WHERE status = 'void' AND voided_at IS NULL;

-- Trigger
CREATE OR REPLACE FUNCTION public.set_invoices_voided_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'void' THEN
    NEW.voided_at := NOW();
  ELSE
    NEW.voided_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_invoices_voided_at ON public.invoices;
CREATE TRIGGER trigger_invoices_voided_at
  BEFORE INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoices_voided_at();

CREATE INDEX IF NOT EXISTS idx_invoices_voided_at ON public.invoices(voided_at)
  WHERE voided_at IS NOT NULL;
