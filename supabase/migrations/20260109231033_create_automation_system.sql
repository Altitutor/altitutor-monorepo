-- Migration: Create Automation System
-- Description: Create automation_rules, automation_actions, and notifications tables
--              Add foreign keys to tasks table and enhance message_templates
-- Author: AI Assistant
-- Date: 2026-01-09
-- Related Issue: ALTI-125

-- ========================
-- CREATE notifications TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  activity_event_id UUID REFERENCES public.activity_events(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL, -- 'TAG', 'CLASS_CHANGED', 'SESSION_ADDED', etc.
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  action_url TEXT, -- Link to relevant page
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_staff_unread ON public.notifications(staff_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_staff_created ON public.notifications(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_activity_event ON public.notifications(activity_event_id) WHERE activity_event_id IS NOT NULL;

-- ========================
-- CREATE automation_rules TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL, -- Which table to watch (e.g., 'sessions', 'students', 'tasks')
  event_types TEXT[] NOT NULL, -- ['CREATED', 'UPDATED'] - array of event types to match
  conditions JSONB, -- {"field": "status", "operator": "equals", "value": "draft"}
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = runs first
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick rule matching check (optimization for trigger)
CREATE INDEX IF NOT EXISTS idx_automation_rules_matching ON public.automation_rules(enabled, entity_type, event_types) 
  WHERE enabled = true;

-- Index for priority ordering
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON public.automation_rules(priority DESC) WHERE enabled = true;

-- ========================
-- CREATE automation_actions TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.automation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('SEND_MESSAGE', 'CREATE_TASK', 'CREATE_NOTIFICATION')),
  action_config JSONB NOT NULL, -- Template ID, assignee, etc.
  order_index INTEGER DEFAULT 0, -- Order within rule
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering actions within a rule
CREATE INDEX IF NOT EXISTS idx_automation_actions_rule_order ON public.automation_actions(rule_id, order_index);

-- ========================
-- ADD FOREIGN KEYS TO tasks TABLE
-- ========================

-- Add foreign key constraints to tasks table (if columns exist)
DO $$
BEGIN
  -- Check if source_rule_id column exists and add FK if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_rule_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'tasks' 
      AND constraint_name = 'tasks_source_rule_id_fkey'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_source_rule_id_fkey 
        FOREIGN KEY (source_rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Check if source_activity_id column exists and add FK if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_activity_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'tasks' 
      AND constraint_name = 'tasks_source_activity_id_fkey'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_source_activity_id_fkey 
        FOREIGN KEY (source_activity_id) REFERENCES public.activity_events(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ========================
-- ENHANCE message_templates TABLE
-- ========================

-- Add variables JSONB column to message_templates (for documentation/metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates' 
    AND column_name = 'variables'
  ) THEN
    ALTER TABLE public.message_templates
      ADD COLUMN variables JSONB;
    
    COMMENT ON COLUMN public.message_templates.variables IS 'Documentation of available template variables (metadata only, for UI display)';
  END IF;
END $$;

-- ========================
-- ENABLE RLS
-- ========================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES
-- ========================

-- Notifications: ADMINSTAFF can view all, staff can view their own
DROP POLICY IF EXISTS "ADMINSTAFF full access to notifications" ON public.notifications;
CREATE POLICY "ADMINSTAFF full access to notifications" ON public.notifications
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Staff can view own notifications" ON public.notifications;
CREATE POLICY "Staff can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff can update own notifications" ON public.notifications;
CREATE POLICY "Staff can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    staff_id IN (
      SELECT id FROM public.staff WHERE user_id = (SELECT auth.uid())
    )
  );

-- Automation Rules: ADMINSTAFF only
DROP POLICY IF EXISTS "ADMINSTAFF full access to automation_rules" ON public.automation_rules;
CREATE POLICY "ADMINSTAFF full access to automation_rules" ON public.automation_rules
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Automation Actions: ADMINSTAFF only (via rule access)
DROP POLICY IF EXISTS "ADMINSTAFF full access to automation_actions" ON public.automation_actions;
CREATE POLICY "ADMINSTAFF full access to automation_actions" ON public.automation_actions
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- CREATE updated_at TRIGGER FOR automation_rules
-- ========================

DROP TRIGGER IF EXISTS set_updated_at_automation_rules ON public.automation_rules;
CREATE TRIGGER set_updated_at_automation_rules
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- COMMENTS
-- ========================

COMMENT ON TABLE public.notifications IS 'Notifications for staff members, can be created manually or via automation rules';
COMMENT ON TABLE public.automation_rules IS 'Rules that trigger actions based on activity events';
COMMENT ON TABLE public.automation_actions IS 'Actions to execute when an automation rule matches an activity event';
COMMENT ON COLUMN public.automation_rules.conditions IS 'JSONB object defining conditions to match (e.g., {"field": "status", "operator": "equals", "value": "draft"})';
COMMENT ON COLUMN public.automation_actions.action_config IS 'JSONB object with action-specific configuration (template_id for SEND_MESSAGE, task properties for CREATE_TASK, notification properties for CREATE_NOTIFICATION)';

