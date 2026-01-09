-- Migration: Create tasks table
-- Description: Create tasks table for Linear-style task management system
-- Author: AI Assistant
-- Date: 2026-01-09

-- ========================
-- CREATE tasks TABLE
-- ========================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Status (Linear-style workflow)
  status TEXT NOT NULL DEFAULT 'backlog' 
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  
  -- Priority (0 = no priority, 1 = urgent, 2 = high, 3 = medium, 4 = low)
  priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
  
  -- Assignment (single assignee only)
  assigned_to UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  
  -- Estimate (story points or time estimate)
  estimate INTEGER CHECK (estimate > 0),
  
  -- Due date
  due_date TIMESTAMPTZ,
  
  -- Audit fields
  created_by UUID REFERENCES public.staff(id), -- NULL for automated tasks
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For future automation integration
  source_rule_id UUID, -- Will reference automation_rules(id) when that table exists
  source_activity_id UUID -- Will reference activity_events(id) when that table exists
);

-- ========================
-- CREATE INDEXES
-- ========================
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at DESC);

-- ========================
-- ENABLE RLS
-- ========================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES
-- ========================
-- ADMINSTAFF: Full access (read/write)
-- Note: Wrapped in SELECT for performance (see: 20251114000003_fix_rls_performance_cache_adminstaff_check.sql)
DROP POLICY IF EXISTS "ADMINSTAFF full access to tasks" ON public.tasks;
CREATE POLICY "ADMINSTAFF full access to tasks" ON public.tasks
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- TUTOR: No access
-- STUDENT: No access
-- (No policies needed - default deny)

-- ========================
-- CREATE updated_at TRIGGER
-- ========================
DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

