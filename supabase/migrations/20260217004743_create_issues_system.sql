-- Migration: Create Issues Tracking System
-- Description: Create issues and issue_tags tables, update tasks and activity_events
-- Author: AI Assistant
-- Date: 2026-02-17

-- 1. Create issues table
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'awaiting_response', 'resolved', 'closed')),
  description JSONB, -- Prosemirror/Tiptap JSON
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create issue_tags table (polymorphic join table)
CREATE TABLE public.issue_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure exactly one entity is tagged per row
  CONSTRAINT issue_tags_one_entity_check CHECK (
    (
      (student_id IS NOT NULL)::INTEGER +
      (staff_id IS NOT NULL)::INTEGER +
      (class_id IS NOT NULL)::INTEGER +
      (session_id IS NOT NULL)::INTEGER +
      (invoice_id IS NOT NULL)::INTEGER +
      (message_id IS NOT NULL)::INTEGER +
      (conversation_id IS NOT NULL)::INTEGER
    ) = 1
  )
);

-- 3. Update tasks table
ALTER TABLE public.tasks ADD COLUMN issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_issue_id ON public.tasks(issue_id) WHERE issue_id IS NOT NULL;

-- 4. Update activity_events table
ALTER TABLE public.activity_events ADD COLUMN issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL;
CREATE INDEX idx_activity_issue ON public.activity_events(issue_id) WHERE issue_id IS NOT NULL;

-- 5. Enable RLS and Create Policies
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_tags ENABLE ROW LEVEL SECURITY;

-- ADMINSTAFF: Full access
DROP POLICY IF EXISTS "ADMINSTAFF full access to issues" ON public.issues;
CREATE POLICY "ADMINSTAFF full access to issues" ON public.issues
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to issue_tags" ON public.issue_tags;
CREATE POLICY "ADMINSTAFF full access to issue_tags" ON public.issue_tags
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- 6. Update Activity Triggers

-- Update extract_activity_fks_tasks to include issue_id
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_task_id UUID := NULL;
  v_issue_id UUID := NULL;
  v_performed_by UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tasks');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_task_id := NEW.id;
    v_staff_id := NEW.assigned_to;
    v_issue_id := NEW.issue_id;
  ELSE
    v_task_id := NULL;
    v_staff_id := OLD.assigned_to;
    v_issue_id := OLD.issue_id;
  END IF;
  
  -- Build changed_fields for UPDATE
  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
          v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', to_jsonb(OLD)->v_field_name,
              'new', to_jsonb(NEW)->v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type,
    changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, issue_id,
    performed_by, performed_at
  ) VALUES (
    'tasks',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'tasks', 'deleted_task_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_student_id, v_staff_id, v_class_id, v_session_id, v_task_id, v_issue_id,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Function for issues table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_issues()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_issue_id UUID;
  v_performed_by UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('issues');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_issue_id := NEW.id;
  ELSE
    v_issue_id := NULL;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
          v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', to_jsonb(OLD)->v_field_name,
              'new', to_jsonb(NEW)->v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    issue_id, performed_by, performed_at
  ) VALUES (
    'issues', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'issues', 'deleted_issue_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_issue_id, v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_activity_events_issues ON public.issues;
CREATE TRIGGER trigger_activity_events_issues
AFTER INSERT OR UPDATE OR DELETE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_issues();

-- 7. Add updated_at trigger for issues
CREATE TRIGGER set_updated_at_issues
BEFORE UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Create indexes for issue_tags
CREATE INDEX idx_issue_tags_issue_id ON public.issue_tags(issue_id);
CREATE INDEX idx_issue_tags_student_id ON public.issue_tags(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_issue_tags_staff_id ON public.issue_tags(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_issue_tags_class_id ON public.issue_tags(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_issue_tags_session_id ON public.issue_tags(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_issue_tags_invoice_id ON public.issue_tags(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_issue_tags_message_id ON public.issue_tags(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_issue_tags_conversation_id ON public.issue_tags(conversation_id) WHERE conversation_id IS NOT NULL;
