-- Migration: Add completed_at to tasks and projects for operations reports
-- Description: Set when status -> done (tasks) or completed (projects); never cleared.
-- Purpose: Enable open/completed tasks and open projects reports.
-- Date: 2026-03-06

-- ========================
-- 1. TASKS: completed_at
-- ========================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.completed_at IS 'When task status was changed to done. Never cleared.';

-- Backfill: existing done tasks get updated_at as approximation
UPDATE public.tasks
SET completed_at = updated_at
WHERE status = 'done' AND completed_at IS NULL;

-- Trigger: set only when transitioning TO done, never clear
CREATE OR REPLACE FUNCTION public.set_tasks_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'done' THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tasks_completed_at ON public.tasks;
CREATE TRIGGER trigger_tasks_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tasks_completed_at();

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at)
  WHERE completed_at IS NOT NULL;

-- ========================
-- 2. PROJECTS: completed_at
-- ========================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.projects.completed_at IS 'When project status was changed to completed. Never cleared.';

-- Backfill: existing completed projects get updated_at as approximation
UPDATE public.projects
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Trigger: set only when transitioning TO completed, never clear
CREATE OR REPLACE FUNCTION public.set_projects_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'completed' THEN
      NEW.completed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_projects_completed_at ON public.projects;
CREATE TRIGGER trigger_projects_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_projects_completed_at();

CREATE INDEX IF NOT EXISTS idx_projects_completed_at ON public.projects(completed_at)
  WHERE completed_at IS NOT NULL;
