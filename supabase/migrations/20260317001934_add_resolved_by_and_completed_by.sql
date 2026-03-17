-- Migration: Add resolved_by to issues and completed_by to tasks
-- Description: Track who resolved each issue and who completed each task for reports.
-- Purpose: Enable "Resolved by" and "Completed by" columns in admin reports.
-- Date: 2026-03-17

-- ========================
-- 1. ISSUES: resolved_by
-- ========================

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.staff(id);

COMMENT ON COLUMN public.issues.resolved_by IS 'Staff who resolved the issue. Set by application when status changes to resolved.';

CREATE INDEX IF NOT EXISTS idx_issues_resolved_by ON public.issues(resolved_by)
  WHERE resolved_by IS NOT NULL;

-- ========================
-- 2. TASKS: completed_by
-- ========================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.staff(id);

COMMENT ON COLUMN public.tasks.completed_by IS 'Staff who completed the task. Set by application when status changes to done.';

CREATE INDEX IF NOT EXISTS idx_tasks_completed_by ON public.tasks(completed_by)
  WHERE completed_by IS NOT NULL;
