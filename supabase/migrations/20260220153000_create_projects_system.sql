-- Migration: Create Projects System
-- Description: Add projects entity, link tasks and notes_documents to projects,
--              enforce task issue/project exclusivity, and wire activity + search.
-- Author: AI Assistant
-- Date: 2026-02-20

-- 1) Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description JSONB,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'planned', 'in_progress', 'completed')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
  project_lead_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector
);

CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_priority ON public.projects(priority);
CREATE INDEX idx_projects_project_lead_id ON public.projects(project_lead_id) WHERE project_lead_id IS NOT NULL;
CREATE INDEX idx_projects_target_date ON public.projects(target_date) WHERE target_date IS NOT NULL;
CREATE INDEX idx_projects_search_vector ON public.projects USING GIN(search_vector);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to projects" ON public.projects;
CREATE POLICY "ADMINSTAFF full access to projects" ON public.projects
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Link tasks and notes_documents to projects
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.notes_documents
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_documents_project_id ON public.notes_documents(project_id) WHERE project_id IS NOT NULL;

-- 3) Enforce task issue/project exclusivity (at most one link)
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_issue_or_project_exclusive_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_issue_or_project_exclusive_check
  CHECK (NOT (issue_id IS NOT NULL AND project_id IS NOT NULL));

-- 4) Add activity_events.project_id
ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_project ON public.activity_events(project_id) WHERE project_id IS NOT NULL;

-- 5) Search-vector trigger for projects
CREATE OR REPLACE FUNCTION public.update_projects_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  content_text := public.extract_text_from_prosemirror_json(NEW.description);

  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_search_vector ON public.projects;
CREATE TRIGGER update_projects_search_vector
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_projects_search_vector();

-- 6) Update tasks activity extractor to include project_id
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
  v_project_id UUID := NULL;
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
    v_project_id := NEW.project_id;
  ELSE
    v_task_id := NULL;
    v_staff_id := OLD.assigned_to;
    v_issue_id := OLD.issue_id;
    v_project_id := OLD.project_id;
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
    entity_type, entity_id, event_type,
    changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, issue_id, project_id,
    performed_by, performed_at
  ) VALUES (
    'tasks',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'tasks', 'deleted_task_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_student_id, v_staff_id, v_class_id, v_session_id, v_task_id, v_issue_id, v_project_id,
    v_performed_by, NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 7) Projects activity extractor + trigger
CREATE OR REPLACE FUNCTION public.extract_activity_fks_projects()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
  v_performed_by UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('projects');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;

  IF TG_OP != 'DELETE' THEN
    v_project_id := NEW.id;
  ELSE
    v_project_id := NULL;
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
    project_id, performed_by, performed_at
  ) VALUES (
    'projects', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'projects', 'deleted_project_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_project_id, v_performed_by, NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_activity_events_projects ON public.projects;
CREATE TRIGGER trigger_activity_events_projects
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_projects();

-- 8) Exclude description/search_vector from projects activity payloads
CREATE OR REPLACE FUNCTION public.get_excluded_fields_for_table(table_name text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE table_name
    WHEN 'invoices' THEN ARRAY['created_at', 'updated_at', 'created_by', 'stripe_invoice_id', 'stripe_invoice_number', 'stripe_charge_id', 'stripe_payment_intent_id', 'receipt_url', 'hosted_invoice_url', 'invoice_pdf', 'dispute_id', 'dispute_status', 'dispute_reason', 'dispute_amount_cents', 'dispute_currency', 'dispute_created_at', 'dispute_updated_at', 'dispute_resolved_at', 'finalized_at', 'paid_at']
    WHEN 'invoice_items' THEN ARRAY['created_at', 'stripe_invoice_item_id']
    WHEN 'credit_notes' THEN ARRAY['created_at', 'updated_at', 'stripe_credit_note_id']
    WHEN 'tasks' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector', 'source_rule_id', 'source_activity_id']
    WHEN 'issues' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    WHEN 'projects' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    ELSE ARRAY['created_at', 'updated_at', 'created_by']
  END;
END;
$$;

-- 9) Backfill project search vectors
UPDATE public.projects SET updated_at = NOW();
